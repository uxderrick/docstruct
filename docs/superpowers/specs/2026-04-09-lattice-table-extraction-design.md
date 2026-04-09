# Lattice-Based PDF Table Extraction — Design Spec

## Overview

Add lattice-based table detection to docstruct's PDF parser. Instead of guessing table structure from text positions (spatial heuristics), extract the actual ruled lines drawn in the PDF and use line intersections to identify table cell boundaries. This mirrors Tabula's lattice mode — the gold standard for PDF table extraction — in pure JS with zero extra dependencies.

**Scope:** PDF parser and table extractor only. Other format parsers (HTML, XLSX, DOCX, text) are unchanged.

---

## Why

PDFs have no semantic "table" concept. Tables are drawn as:
1. **Ruled lines** — path operators (`moveTo`, `lineTo`, `rectangle`) followed by `stroke`/`fill`
2. **Text fragments** — independently positioned with `(x, y)` coordinates

V1 uses only the text positions (spatial clustering) to guess at table structure. This is fragile for dense tables with many columns. The ruled lines are a definitive signal for cell boundaries — pdfjs-dist already exposes them via `page.getOperatorList()`, we just need to read them.

---

## IR Extension

Add `LineSegment` type and optional `lines` field to `DocumentIR`:

```ts
interface LineSegment {
  x1: number          // normalized 0-1
  y1: number
  x2: number
  y2: number
  lineWidth: number
  page?: number
  orientation: 'horizontal' | 'vertical' | 'other'
}

interface DocumentIR {
  elements: TextElement[]
  lines?: LineSegment[]  // only populated for PDFs with drawn lines
  sourceType: string
  pageCount: number
  raw?: string
}
```

Lines classified as `'other'` (diagonal, curved) are stored but ignored by the table extractor. Only horizontal and vertical lines form grids.

---

## PDF Parser — Line Extraction

In `src/parsers/pdf.ts`, after extracting text content per page, also process `page.getOperatorList()`:

### Operator Processing

1. **Iterate `fnArray`** — look for:
   - `constructPath` (OPS code 91): contains sub-operations — moveTo(0) sets current point, lineTo(1) draws to next point. Extract each line segment from the coordinate arrays.
   - `rectangle` (OPS code 19): provides `[x, y, width, height]`. Decompose into 4 line segments (top, bottom, left, right).

2. **Filter to visible lines** — only keep paths followed by `stroke` (20) or `fill` (22) ops. Unstroked paths are invisible and should be ignored.

3. **Filter by line width** — ignore very thin lines (lineWidth < 0.1) which are likely rendering artifacts, not structural borders.

4. **Classify orientation**:
   - `|y2 - y1| < tolerance` → horizontal
   - `|x2 - x1| < tolerance` → vertical
   - Otherwise → other

5. **Normalize coordinates** — convert from PDF coordinate space (origin bottom-left, absolute units) to docstruct's 0-1 range (origin top-left, normalized). Use viewport dimensions from `page.getViewport()`, same as text element normalization.

6. **Deduplicate** — merge overlapping/identical lines at the same position (within tolerance).

Line extraction runs in the same page loop as text extraction — no extra passes over the PDF.

---

## Lattice Table Extractor

New function `extractLatticeTables(ir)` in `src/extractors/tables.ts`.

### Algorithm

**Step 1: Group lines by page**
Separate horizontal and vertical lines for each page.

**Step 2: Snap lines to grid**
Lines within a small tolerance of each other (e.g., 0.002 in normalized space) are snapped to a single coordinate. Handles PDFs with double-drawn borders or slight rendering offsets.

**Step 3: Find intersections**
For each pair of (horizontal line, vertical line), check if they cross:
- The vertical line's x must be between the horizontal line's x1 and x2
- The horizontal line's y must be between the vertical line's y1 and y2

Each intersection is recorded as a point `(x, y)`.

**Step 4: Build grid cells**
From intersection points, identify rectangular regions:
- Sort intersections into a grid by unique x and y values
- For each adjacent pair of x-values and y-values, check if all 4 corners have intersections AND connecting lines exist on all 4 sides
- Each valid rectangle is a table cell with bounds `{ left, top, right, bottom }`

Group cells into rows (shared top/bottom) and columns (shared left/right).

**Step 5: Assign text to cells**
For each text element on the page, find which cell rectangle contains its `(x, y)` position. Multiple text elements in one cell are joined with spaces in reading order (sorted by y then x).

**Step 6: Build Table output**
First row of cells becomes `columns`, remaining rows become `rows`. Same `{ columns: string[], rows: string[][] }` output format as existing extractors. Claim all matched text elements.

### Per-Page Decision

If a page has enough intersections to form at least a 2x2 grid (minimum 4 cells), use lattice for that page. Otherwise, that page falls through to the spatial extractor.

---

## Integration with Extraction Pipeline

The extraction order in `extractTables()` becomes:

```
1. Pipe-delimited tables (text-based)
2. Tab-separated tables (text-based)
3. Lattice tables (NEW — line-based, PDF only)
4. Spatial tables (fallback — position-based)
```

Lattice runs before spatial. It claims text elements it matches. Spatial only processes unclaimed elements — so on pages where lattice succeeds, spatial doesn't interfere. On pages with no grid lines, spatial kicks in as before.

---

## Files Changed

| File | Change |
|------|--------|
| `src/ir.ts` | Add `LineSegment` interface, add `lines?: LineSegment[]` to `DocumentIR` |
| `src/parsers/pdf.ts` | Add `getOperatorList()` processing to extract lines per page |
| `src/extractors/tables.ts` | Add `extractLatticeTables()`, wire into pipeline before spatial |
| `tests/extractors/tables.test.ts` | Add lattice extraction tests with mock line data |
| `tests/parsers/pdf.test.ts` | Add test verifying line extraction from operator list |

---

## What's NOT in Scope

- Other format parsers (HTML, XLSX, DOCX, text)
- Merged cell detection (V3)
- Multi-table detection on a single page from lines (V3 — for now, all lines on a page form one table)
- Image-based table detection (OCR tables have no lines)
