# Merged Cell Detection — Design Spec

## Overview

Detect merged cells in lattice-extracted tables by checking for missing internal borders between adjacent grid cells. When a border is absent, merge the cells — text goes in the first position, empty strings fill the absorbed positions.

## Algorithm

New function `detectMergedCells(cells, cellText, hLines, vLines)` runs after `buildGridCells` and `assignTextToCells`:

### Horizontal merge (colspan)

For each pair of horizontally-adjacent cells (same row, columns `c` and `c+1`):
1. The shared boundary is a vertical line at `x = cells[c].right` spanning `[cells.top, cells.bottom]`
2. Check if any vertical line in `vLines` exists at that x (within SNAP_TOLERANCE) whose y-range covers at least 80% of the cell height
3. If no such line exists → these cells should be merged
4. Group consecutive missing-border pairs into merge spans (e.g., columns 1-3 if borders between 1-2 and 2-3 are both missing)

### Vertical merge (rowspan)

For each pair of vertically-adjacent cells (same column, rows `r` and `r+1`):
1. The shared boundary is a horizontal line at `y = cells[r].bottom` spanning `[cells.left, cells.right]`
2. Check if any horizontal line in `hLines` exists at that y (within SNAP_TOLERANCE) whose x-range covers at least 80% of the cell width
3. If no such line exists → these cells should be merged

### Applying merges

After detecting all merge spans:
1. For horizontal merges: combine text from all cells in the span (joined with space, in reading order), place in the leftmost cell's position, set empty strings for the other positions
2. For vertical merges: combine text from all cells in the span, place in the topmost cell's position, set empty strings for the other positions
3. Return the updated `cellText` Map

### 80% coverage threshold

A line "exists" if it covers at least 80% of the boundary length. This handles PDFs where borders don't extend to the exact pixel but are clearly present. A border covering only 20% of the boundary (e.g., a small decorative mark) is not considered a real border.

## Integration

In `extractLatticeTables`, after `assignTextToCells` and before building table rows:

```
cells = buildGridCells(points)
cellText = assignTextToCells(cells, pageElements)
cellText = detectMergedCells(cells, cellText, cluster.hLines, cluster.vLines)  // NEW
// ... build rows from cellText as before
```

## Output Format

No change to the `Table` type. Merged cells produce text in the first position and empty strings in absorbed positions:

```
// 3-column table with merged header spanning all 3 columns:
columns: ["Report Title", "", ""]
rows: [["Alice", "30", "Accra"], ...]
```

## Files Changed

| File | Change |
|------|--------|
| `src/extractors/lattice.ts` | Add `detectMergedCells()`, call in pipeline |
| `tests/extractors/lattice.test.ts` | Add merge detection tests |

## What's NOT in Scope

- Changing the `Table` type (no colspan/rowspan metadata)
- Complex merge patterns (L-shaped merges, nested merges)
- Merges that cross cluster boundaries
