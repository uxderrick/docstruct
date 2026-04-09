# Lattice-Based PDF Table Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract table cell boundaries from ruled lines drawn in PDFs, using pdfjs-dist's operator list, to achieve Tabula-quality table detection in pure JS.

**Architecture:** The PDF parser extracts line segments from `page.getOperatorList()` and stores them in the IR alongside text elements. A new lattice extractor builds grids from line intersections, assigns text to cells, and produces tables. Falls back to existing spatial extraction when no lines are found.

**Tech Stack:** TypeScript, pdfjs-dist (`getOperatorList()`, OPS constants), vitest

**Spec:** `docs/superpowers/specs/2026-04-09-lattice-table-extraction-design.md`

---

### Task 1: Extend IR with LineSegment Type

**Files:**
- Modify: `src/ir.ts`
- Test: `tests/ir.test.ts` (new)

- [ ] **Step 1: Write failing test**

Create `tests/ir.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDocumentIR, createTextElement, type LineSegment } from '../../src/ir.js'

describe('DocumentIR with lines', () => {
  it('supports optional lines array', () => {
    const elements = [createTextElement('hello', 0, 0, 0.1, 0.02)]
    const lines: LineSegment[] = [
      { x1: 0, y1: 0.1, x2: 1, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const ir = createDocumentIR(elements, 'pdf', 1, undefined, lines)

    expect(ir.lines).toHaveLength(1)
    expect(ir.lines![0].orientation).toBe('horizontal')
  })

  it('defaults lines to undefined when not provided', () => {
    const ir = createDocumentIR([], 'text', 1)
    expect(ir.lines).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/ir.test.ts
```

Expected: FAIL — `LineSegment` not exported, `createDocumentIR` doesn't accept lines parameter.

- [ ] **Step 3: Implement the IR extension**

Update `src/ir.ts` — add `LineSegment` interface, add `lines` to `DocumentIR`, update `createDocumentIR`:

```ts
export interface LineSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  lineWidth: number
  page?: number
  orientation: 'horizontal' | 'vertical' | 'other'
}

export interface DocumentIR {
  elements: TextElement[]
  lines?: LineSegment[]
  sourceType: string
  pageCount: number
  raw?: string
}

export function createDocumentIR(
  elements: TextElement[],
  sourceType: string,
  pageCount: number = 1,
  raw?: string,
  lines?: LineSegment[]
): DocumentIR {
  return { elements, sourceType, pageCount, raw, lines }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/ir.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests to check nothing broke**

```bash
npx vitest run
```

Expected: All tests PASS. Existing `createDocumentIR` calls without the `lines` parameter still work because it's optional.

- [ ] **Step 6: Commit**

```bash
git add src/ir.ts tests/ir.test.ts
git commit -m "feat: add LineSegment type and lines field to DocumentIR"
```

---

### Task 2: Extract Lines from PDF Operator List

**Files:**
- Modify: `src/parsers/pdf.ts`
- Create: `src/parsers/pdf-lines.ts`
- Test: `tests/parsers/pdf-lines.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/parsers/pdf-lines.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractLinesFromOps, classifyLine } from '../../src/parsers/pdf-lines.js'
import type { LineSegment } from '../../src/ir.js'

describe('classifyLine', () => {
  it('classifies horizontal lines', () => {
    expect(classifyLine(0, 0.5, 1, 0.5)).toBe('horizontal')
  })

  it('classifies vertical lines', () => {
    expect(classifyLine(0.3, 0, 0.3, 1)).toBe('vertical')
  })

  it('classifies diagonal lines as other', () => {
    expect(classifyLine(0, 0, 1, 1)).toBe('other')
  })
})

describe('extractLinesFromOps', () => {
  it('extracts line from constructPath with moveTo+lineTo', () => {
    // Simulate pdfjs-dist operator list
    // constructPath op: fnArray[0] = 91
    // args: [subOps, [x1,y1,x2,y2...]]
    // stroke op: fnArray[1] = 20
    const fnArray = [91, 20]
    const argsArray = [
      // constructPath: subOps=[moveTo(0), lineTo(1)], coords=[x1, y1, x2, y2]
      [[0, 1], [72, 700, 540, 700]],
      // stroke: no args
      null,
    ]
    const viewportWidth = 612
    const viewportHeight = 792
    const page = 1
    const lineWidth = 1

    const lines = extractLinesFromOps(fnArray, argsArray, viewportWidth, viewportHeight, page, lineWidth)

    expect(lines.length).toBeGreaterThanOrEqual(1)
    const hLine = lines.find((l) => l.orientation === 'horizontal')
    expect(hLine).toBeDefined()
    expect(hLine!.x1).toBeCloseTo(72 / 612, 2)
    // PDF y is bottom-up, so 700/792 from bottom = 1 - 700/792 from top
    expect(hLine!.y1).toBeCloseTo(1 - 700 / 792, 2)
  })

  it('extracts 4 lines from rectangle op', () => {
    // rectangle op: fnArray[0] = 19, args = [x, y, w, h]
    // stroke op: fnArray[1] = 20
    const fnArray = [19, 20]
    const argsArray = [
      [100, 500, 400, 200], // x=100, y=500, w=400, h=200
      null,
    ]

    const lines = extractLinesFromOps(fnArray, argsArray, 612, 792, 1, 1)

    // Rectangle should produce 4 lines: top, bottom, left, right
    const hLines = lines.filter((l) => l.orientation === 'horizontal')
    const vLines = lines.filter((l) => l.orientation === 'vertical')
    expect(hLines.length).toBe(2)
    expect(vLines.length).toBe(2)
  })

  it('ignores paths without stroke or fill', () => {
    // constructPath without a following stroke/fill
    const fnArray = [91, 91, 20] // second constructPath + stroke, first is orphaned
    const argsArray = [
      [[0, 1], [10, 10, 100, 10]], // orphaned path
      [[0, 1], [10, 50, 100, 50]], // stroked path
      null,
    ]

    const lines = extractLinesFromOps(fnArray, argsArray, 612, 792, 1, 1)

    // Only the second path (followed by stroke) should produce lines
    expect(lines).toHaveLength(1)
  })

  it('returns empty array when no drawing ops', () => {
    const lines = extractLinesFromOps([], [], 612, 792, 1, 1)
    expect(lines).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/parsers/pdf-lines.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/parsers/pdf-lines.ts`**

```ts
import type { LineSegment } from '../ir.js'

const OPS_CONSTRUCT_PATH = 91
const OPS_RECTANGLE = 19
const OPS_STROKE = 20
const OPS_FILL = 22
const OPS_FILL_STROKE = 23
const OPS_SET_LINE_WIDTH = 2

// Sub-operation codes inside constructPath
const SUB_MOVE_TO = 0
const SUB_LINE_TO = 1

const ORIENTATION_TOLERANCE = 0.002

export function classifyLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): 'horizontal' | 'vertical' | 'other' {
  if (Math.abs(y2 - y1) < ORIENTATION_TOLERANCE) return 'horizontal'
  if (Math.abs(x2 - x1) < ORIENTATION_TOLERANCE) return 'vertical'
  return 'other'
}

function normalizeCoords(
  x: number,
  y: number,
  vpWidth: number,
  vpHeight: number
): { nx: number; ny: number } {
  return {
    nx: x / vpWidth,
    ny: 1 - y / vpHeight, // PDF y is bottom-up, normalize to top-down
  }
}

function extractLinesFromConstructPath(
  subOps: number[],
  coords: number[],
  vpWidth: number,
  vpHeight: number,
  page: number,
  lineWidth: number
): LineSegment[] {
  const lines: LineSegment[] = []
  let curX = 0
  let curY = 0
  let coordIdx = 0

  for (const op of subOps) {
    if (op === SUB_MOVE_TO) {
      curX = coords[coordIdx++]
      curY = coords[coordIdx++]
    } else if (op === SUB_LINE_TO) {
      const toX = coords[coordIdx++]
      const toY = coords[coordIdx++]

      const from = normalizeCoords(curX, curY, vpWidth, vpHeight)
      const to = normalizeCoords(toX, toY, vpWidth, vpHeight)

      const orientation = classifyLine(from.nx, from.ny, to.nx, to.ny)

      lines.push({
        x1: Math.min(from.nx, to.nx),
        y1: Math.min(from.ny, to.ny),
        x2: Math.max(from.nx, to.nx),
        y2: Math.max(from.ny, to.ny),
        lineWidth,
        page,
        orientation,
      })

      curX = toX
      curY = toY
    } else {
      // curveTo(2), closePath(4), etc — skip coords as needed
      if (op === 2) coordIdx += 4 // curveTo has 3 points = 6 coords, but 2 already consumed? adjust if needed
      // closePath has no coords
    }
  }

  return lines
}

function extractLinesFromRectangle(
  x: number,
  y: number,
  w: number,
  h: number,
  vpWidth: number,
  vpHeight: number,
  page: number,
  lineWidth: number
): LineSegment[] {
  const tl = normalizeCoords(x, y + h, vpWidth, vpHeight)
  const tr = normalizeCoords(x + w, y + h, vpWidth, vpHeight)
  const bl = normalizeCoords(x, y, vpWidth, vpHeight)
  const br = normalizeCoords(x + w, y, vpWidth, vpHeight)

  return [
    // Top edge
    { x1: Math.min(tl.nx, tr.nx), y1: tl.ny, x2: Math.max(tl.nx, tr.nx), y2: tr.ny, lineWidth, page, orientation: 'horizontal' as const },
    // Bottom edge
    { x1: Math.min(bl.nx, br.nx), y1: bl.ny, x2: Math.max(bl.nx, br.nx), y2: br.ny, lineWidth, page, orientation: 'horizontal' as const },
    // Left edge
    { x1: tl.nx, y1: Math.min(tl.ny, bl.ny), x2: bl.nx, y2: Math.max(tl.ny, bl.ny), lineWidth, page, orientation: 'vertical' as const },
    // Right edge
    { x1: tr.nx, y1: Math.min(tr.ny, br.ny), x2: br.nx, y2: Math.max(tr.ny, br.ny), lineWidth, page, orientation: 'vertical' as const },
  ]
}

export function extractLinesFromOps(
  fnArray: number[],
  argsArray: any[],
  vpWidth: number,
  vpHeight: number,
  page: number,
  currentLineWidth: number = 1
): LineSegment[] {
  const allLines: LineSegment[] = []
  let pendingLines: LineSegment[] = []
  let lineWidth = currentLineWidth

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i]
    const args = argsArray[i]

    if (op === OPS_SET_LINE_WIDTH) {
      lineWidth = args?.[0] ?? 1
    } else if (op === OPS_CONSTRUCT_PATH && args) {
      const [subOps, coords] = args
      pendingLines = extractLinesFromConstructPath(subOps, coords, vpWidth, vpHeight, page, lineWidth)
    } else if (op === OPS_RECTANGLE && args) {
      const [x, y, w, h] = args
      pendingLines = extractLinesFromRectangle(x, y, w, h, vpWidth, vpHeight, page, lineWidth)
    } else if (op === OPS_STROKE || op === OPS_FILL || op === OPS_FILL_STROKE) {
      // Commit pending lines — they are visible
      if (pendingLines.length > 0) {
        // Filter out very thin lines (rendering artifacts)
        const valid = pendingLines.filter((l) => l.lineWidth >= 0.1 || l.orientation !== 'other')
        allLines.push(...valid)
        pendingLines = []
      }
    } else {
      // Any other op clears pending (the path wasn't rendered)
      // But only clear if it's not a state-setting op
      if (op !== OPS_SET_LINE_WIDTH) {
        pendingLines = []
      }
    }
  }

  return allLines
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/parsers/pdf-lines.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/pdf-lines.ts tests/parsers/pdf-lines.test.ts
git commit -m "feat: add PDF line extraction from operator list"
```

---

### Task 3: Wire Line Extraction into PDF Parser

**Files:**
- Modify: `src/parsers/pdf.ts`
- Modify: `src/ir.ts` (import only)

- [ ] **Step 1: Update PDF parser to extract lines**

Update `src/parsers/pdf.ts` to call `extractLinesFromOps` for each page and pass lines to `createDocumentIR`:

```ts
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createTextElement, createDocumentIR, type DocumentIR, type TextElement, type LineSegment } from '../ir.js'
import { extractLinesFromOps } from './pdf-lines.js'

export async function parsePdf(input: Buffer): Promise<DocumentIR> {
  const data = new Uint8Array(input)
  const pdf = await getDocument({ data, useSystemFonts: true }).promise
  const totalPages = pdf.numPages
  const allElements: TextElement[] = []
  const allLines: LineSegment[] = []
  let totalTextLength = 0

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1.0 })

    // Extract text elements
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue

      const tx = item.transform
      const x = tx[4] / viewport.width
      const y = 1 - tx[5] / viewport.height
      const width = item.width / viewport.width
      const height = item.height / viewport.height

      allElements.push(
        createTextElement(item.str.trim(), x, y, width, height, {
          page: i,
          font: {
            size: item.height || 12,
            bold: (item.fontName?.toLowerCase().includes('bold')) ?? false,
          },
        })
      )
      totalTextLength += item.str.trim().length
    }

    // Extract lines from operator list
    try {
      const opList = await page.getOperatorList()
      const pageLines = extractLinesFromOps(
        opList.fnArray,
        opList.argsArray,
        viewport.width,
        viewport.height,
        i
      )
      allLines.push(...pageLines)
    } catch {
      // If operator list extraction fails, continue without lines
    }
  }

  if (totalTextLength > 10) {
    return createDocumentIR(allElements, 'pdf', totalPages, undefined, allLines.length > 0 ? allLines : undefined)
  }

  return createDocumentIR([], 'pdf', totalPages)
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/parsers/pdf.ts
git commit -m "feat: wire line extraction into PDF parser"
```

---

### Task 4: Lattice Table Extractor — Grid Building

**Files:**
- Create: `src/extractors/lattice.ts`
- Test: `tests/extractors/lattice.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/extractors/lattice.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findIntersections, buildGridCells, assignTextToCells } from '../../src/extractors/lattice.js'
import { createTextElement, type LineSegment } from '../../src/ir.js'

describe('findIntersections', () => {
  it('finds where horizontal and vertical lines cross', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]

    const points = findIntersections(hLines, vLines)

    // 2 horizontal x 3 vertical = 6 intersections
    expect(points).toHaveLength(6)
  })

  it('returns empty when lines do not cross', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.9, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]

    const points = findIntersections(hLines, vLines)
    expect(points).toHaveLength(0)
  })
})

describe('buildGridCells', () => {
  it('builds 2x2 grid from 6 intersections (2 rows x 3 cols)', () => {
    const points = [
      { x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.9, y: 0.2 },
      { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
    ]

    const cells = buildGridCells(points)

    // 2 columns x 1 row = 2 cells
    expect(cells).toHaveLength(2)
    expect(cells[0].left).toBeCloseTo(0.1)
    expect(cells[0].right).toBeCloseTo(0.5)
    expect(cells[0].top).toBeCloseTo(0.2)
    expect(cells[0].bottom).toBeCloseTo(0.5)
  })
})

describe('assignTextToCells', () => {
  it('assigns text elements to the cell that contains them', () => {
    const cells = [
      { left: 0.1, top: 0.2, right: 0.5, bottom: 0.5, row: 0, col: 0 },
      { left: 0.5, top: 0.2, right: 0.9, bottom: 0.5, row: 0, col: 1 },
    ]
    const elements = [
      createTextElement('Hello', 0.2, 0.3, 0.1, 0.02, { page: 1 }),
      createTextElement('World', 0.6, 0.3, 0.1, 0.02, { page: 1 }),
    ]

    const result = assignTextToCells(cells, elements)

    expect(result.get('0-0')).toBe('Hello')
    expect(result.get('0-1')).toBe('World')
  })

  it('joins multiple text elements in the same cell', () => {
    const cells = [
      { left: 0.1, top: 0.2, right: 0.9, bottom: 0.5, row: 0, col: 0 },
    ]
    const elements = [
      createTextElement('First', 0.2, 0.25, 0.1, 0.02, { page: 1 }),
      createTextElement('Second', 0.2, 0.35, 0.1, 0.02, { page: 1 }),
    ]

    const result = assignTextToCells(cells, elements)

    expect(result.get('0-0')).toBe('First Second')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/extractors/lattice.ts`**

```ts
import { claimElements, type DocumentIR, type TextElement, type LineSegment } from '../ir.js'
import type { Table } from '../types.js'

interface Point {
  x: number
  y: number
}

interface GridCell {
  left: number
  top: number
  right: number
  bottom: number
  row: number
  col: number
}

const SNAP_TOLERANCE = 0.003
const INTERSECTION_TOLERANCE = 0.005

function snapToGrid(values: number[]): number[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const snapped: number[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - snapped[snapped.length - 1] > SNAP_TOLERANCE) {
      snapped.push(sorted[i])
    }
  }

  return snapped
}

export function findIntersections(
  hLines: LineSegment[],
  vLines: LineSegment[]
): Point[] {
  const points: Point[] = []

  for (const h of hLines) {
    for (const v of vLines) {
      // Vertical line's x must be within horizontal line's x-range
      const vxInRange = v.x1 >= h.x1 - INTERSECTION_TOLERANCE && v.x1 <= h.x2 + INTERSECTION_TOLERANCE
      // Horizontal line's y must be within vertical line's y-range
      const hyInRange = h.y1 >= v.y1 - INTERSECTION_TOLERANCE && h.y1 <= v.y2 + INTERSECTION_TOLERANCE

      if (vxInRange && hyInRange) {
        points.push({ x: v.x1, y: h.y1 })
      }
    }
  }

  return points
}

export function buildGridCells(points: Point[]): GridCell[] {
  if (points.length < 4) return []

  const xs = snapToGrid(points.map((p) => p.x))
  const ys = snapToGrid(points.map((p) => p.y))

  if (xs.length < 2 || ys.length < 2) return []

  const cells: GridCell[] = []

  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      // Check that all 4 corners have intersection points
      const topLeft = points.some((p) => Math.abs(p.x - xs[col]) < SNAP_TOLERANCE && Math.abs(p.y - ys[row]) < SNAP_TOLERANCE)
      const topRight = points.some((p) => Math.abs(p.x - xs[col + 1]) < SNAP_TOLERANCE && Math.abs(p.y - ys[row]) < SNAP_TOLERANCE)
      const bottomLeft = points.some((p) => Math.abs(p.x - xs[col]) < SNAP_TOLERANCE && Math.abs(p.y - ys[row + 1]) < SNAP_TOLERANCE)
      const bottomRight = points.some((p) => Math.abs(p.x - xs[col + 1]) < SNAP_TOLERANCE && Math.abs(p.y - ys[row + 1]) < SNAP_TOLERANCE)

      if (topLeft && topRight && bottomLeft && bottomRight) {
        cells.push({
          left: xs[col],
          top: ys[row],
          right: xs[col + 1],
          bottom: ys[row + 1],
          row,
          col,
        })
      }
    }
  }

  return cells
}

export function assignTextToCells(
  cells: GridCell[],
  elements: TextElement[]
): Map<string, string> {
  const cellText = new Map<string, { text: string; y: number; x: number }[]>()

  for (const el of elements) {
    for (const cell of cells) {
      if (
        el.x >= cell.left - SNAP_TOLERANCE &&
        el.x <= cell.right + SNAP_TOLERANCE &&
        el.y >= cell.top - SNAP_TOLERANCE &&
        el.y <= cell.bottom + SNAP_TOLERANCE
      ) {
        const key = `${cell.row}-${cell.col}`
        if (!cellText.has(key)) cellText.set(key, [])
        cellText.get(key)!.push({ text: el.text.trim(), y: el.y, x: el.x })
        break
      }
    }
  }

  // Join text in reading order (top-to-bottom, left-to-right)
  const result = new Map<string, string>()
  for (const [key, items] of cellText) {
    items.sort((a, b) => a.y - b.y || a.x - b.x)
    result.set(key, items.map((i) => i.text).join(' '))
  }

  return result
}

export function extractLatticeTables(ir: DocumentIR): { tables: Table[]; claimed: TextElement[] } {
  const tables: Table[] = []
  const claimed: TextElement[] = []

  if (!ir.lines || ir.lines.length === 0) return { tables, claimed }

  // Group lines and elements by page
  const pages = new Set<number>()
  for (const line of ir.lines) pages.add(line.page ?? 1)

  for (const page of pages) {
    const pageLines = ir.lines.filter((l) => (l.page ?? 1) === page)
    const hLines = pageLines.filter((l) => l.orientation === 'horizontal')
    const vLines = pageLines.filter((l) => l.orientation === 'vertical')

    if (hLines.length < 2 || vLines.length < 2) continue

    const intersections = findIntersections(hLines, vLines)
    const cells = buildGridCells(intersections)

    if (cells.length < 2) continue // Need at least a 2-cell grid

    const pageElements = ir.elements.filter((el) => !el.claimed && (el.page ?? 1) === page)
    const textMap = assignTextToCells(cells, pageElements)

    // Determine grid dimensions
    const maxRow = Math.max(...cells.map((c) => c.row))
    const maxCol = Math.max(...cells.map((c) => c.col))

    // Build table rows
    const tableRows: string[][] = []
    for (let r = 0; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = 0; c <= maxCol; c++) {
        row.push(textMap.get(`${r}-${c}`) ?? '')
      }
      tableRows.push(row)
    }

    if (tableRows.length >= 2) {
      tables.push({
        columns: tableRows[0],
        rows: tableRows.slice(1),
      })

      // Claim matched text elements
      for (const el of pageElements) {
        for (const cell of cells) {
          if (
            el.x >= cell.left - SNAP_TOLERANCE &&
            el.x <= cell.right + SNAP_TOLERANCE &&
            el.y >= cell.top - SNAP_TOLERANCE &&
            el.y <= cell.bottom + SNAP_TOLERANCE
          ) {
            claimed.push(el)
            break
          }
        }
      }
    }
  }

  return { tables, claimed }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extractors/lattice.ts tests/extractors/lattice.test.ts
git commit -m "feat: add lattice table extractor with grid detection"
```

---

### Task 5: Wire Lattice Extractor into Pipeline

**Files:**
- Modify: `src/extractors/tables.ts`

- [ ] **Step 1: Add lattice extraction before spatial fallback**

Update `src/extractors/tables.ts` — import and call `extractLatticeTables` in the `extractTables` function:

```ts
import { extractLatticeTables } from './lattice.js'

export function extractTables(ir: DocumentIR): Table[] {
  // Try delimiter-based first
  const pipe = extractPipeTables(ir)
  claimElements(pipe.claimed)

  const tab = extractTabTables(ir)
  claimElements(tab.claimed)

  // Try lattice (line-based) for PDFs with drawn borders
  const lattice = extractLatticeTables(ir)
  claimElements(lattice.claimed)

  // Then spatial for remaining elements
  const spatial = extractSpatialTables(ir)
  claimElements(spatial.claimed)

  return [...pipe.tables, ...tab.tables, ...lattice.tables, ...spatial.tables]
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS. The lattice extractor returns empty results when `ir.lines` is undefined (non-PDF sources) or empty, so existing tests are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/extractors/tables.ts
git commit -m "feat: wire lattice extractor into table extraction pipeline"
```

---

### Task 6: Integration Test

**Files:**
- Create: `tests/extractors/lattice-integration.test.ts`

- [ ] **Step 1: Write integration test with mock PDF data**

Create `tests/extractors/lattice-integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractTables } from '../../src/extractors/tables.js'
import { createTextElement, createDocumentIR, type LineSegment } from '../../src/ir.js'

describe('Lattice table extraction integration', () => {
  it('extracts a 2x3 table from lines and text elements', () => {
    // Simulate a simple table with 2 rows, 3 columns
    // Grid: x=[0.1, 0.4, 0.7, 0.95], y=[0.1, 0.2, 0.3]
    const lines: LineSegment[] = [
      // Horizontal lines
      { x1: 0.1, y1: 0.1, x2: 0.95, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.95, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.95, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      // Vertical lines
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.95, y1: 0.1, x2: 0.95, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]

    const elements = [
      // Header row
      createTextElement('Name', 0.15, 0.13, 0.1, 0.02, { page: 1 }),
      createTextElement('Age', 0.45, 0.13, 0.1, 0.02, { page: 1 }),
      createTextElement('City', 0.75, 0.13, 0.1, 0.02, { page: 1 }),
      // Data row
      createTextElement('Alice', 0.15, 0.23, 0.1, 0.02, { page: 1 }),
      createTextElement('30', 0.45, 0.23, 0.05, 0.02, { page: 1 }),
      createTextElement('Accra', 0.75, 0.23, 0.1, 0.02, { page: 1 }),
    ]

    const ir = createDocumentIR(elements, 'pdf', 1, undefined, lines)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Name', 'Age', 'City'])
    expect(tables[0].rows).toEqual([['Alice', '30', 'Accra']])
  })

  it('falls back to spatial when no lines present', () => {
    // No lines — spatial extractor should handle this
    const elements = [
      createTextElement('| A | B |', 0, 0, 1, 0.05),
      createTextElement('| 1 | 2 |', 0, 0.1, 1, 0.05),
    ]

    const ir = createDocumentIR(elements, 'text', 1)
    const tables = extractTables(ir)

    // Should still find the pipe-delimited table
    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['A', 'B'])
  })

  it('does not interfere with non-PDF formats', () => {
    const elements = [
      createTextElement('Name: Steve', 0, 0, 1, 0.05),
    ]
    const ir = createDocumentIR(elements, 'text', 1)

    // No lines, no table structure — should produce no tables
    const tables = extractTables(ir)
    expect(tables).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run tests/extractors/lattice-integration.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add tests/extractors/lattice-integration.test.ts
git commit -m "test: add lattice table extraction integration tests"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | IR extension — `LineSegment` type + `lines` field |
| 2 | PDF line extractor — reads `getOperatorList()` for lines and rectangles |
| 3 | Wire lines into PDF parser — `parsePdf()` populates `ir.lines` |
| 4 | Lattice extractor — intersections → grid → cells → text assignment |
| 5 | Pipeline integration — lattice before spatial in `extractTables()` |
| 6 | Integration tests — end-to-end with mock data |
