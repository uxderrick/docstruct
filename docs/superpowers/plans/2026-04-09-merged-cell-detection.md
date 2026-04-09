# Merged Cell Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect merged cells in lattice-extracted tables by checking for missing internal borders, and consolidate their text into the first position with empty strings for absorbed positions.

**Architecture:** A `detectMergedCells` function takes the grid cells, cell text map, and page lines. It checks each pair of adjacent cells for a separating border line. Where no border exists, it merges the cells' text into the first position and empties the rest. Called after `assignTextToCells` in the pipeline.

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-09-merged-cell-detection-design.md`

---

### Task 1: Add Merged Cell Detection

**Files:**
- Modify: `src/extractors/lattice.ts`
- Modify: `tests/extractors/lattice.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/extractors/lattice.test.ts`. Update the import line to include `detectMergedCells`:

```ts
import { findIntersections, buildGridCells, assignTextToCells, deduplicateLines, clusterLines, detectMergedCells } from '../../src/extractors/lattice.js'
```

Then add this describe block at the end of the file:

```ts
describe('detectMergedCells', () => {
  it('does nothing when all internal borders exist', () => {
    // 2x2 grid with all borders present
    const cells: GridCell[] = [
      { left: 0.1, top: 0.1, right: 0.5, bottom: 0.3, row: 0, col: 0 },
      { left: 0.5, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 1 },
      { left: 0.1, top: 0.3, right: 0.5, bottom: 0.5, row: 1, col: 0 },
      { left: 0.5, top: 0.3, right: 0.9, bottom: 0.5, row: 1, col: 1 },
    ]
    const cellText = new Map([
      ['0-0', 'A'], ['0-1', 'B'],
      ['1-0', 'C'], ['1-1', 'D'],
    ])
    // All borders: vertical at x=0.5, horizontal at y=0.3
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('A')
    expect(result.get('0-1')).toBe('B')
    expect(result.get('1-0')).toBe('C')
    expect(result.get('1-1')).toBe('D')
  })

  it('merges horizontally when vertical border is missing', () => {
    // 1 row, 3 columns — middle vertical border missing (cols 0-1 merged)
    const cells: GridCell[] = [
      { left: 0.1, top: 0.1, right: 0.4, bottom: 0.3, row: 0, col: 0 },
      { left: 0.4, top: 0.1, right: 0.7, bottom: 0.3, row: 0, col: 1 },
      { left: 0.7, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 2 },
    ]
    const cellText = new Map([
      ['0-0', 'Merged Header'],
      ['0-2', 'Solo'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      // No vertical line at x=0.4 — border between col 0 and col 1 is missing
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('Merged Header')
    expect(result.get('0-1')).toBe('')
    expect(result.get('0-2')).toBe('Solo')
  })

  it('merges vertically when horizontal border is missing', () => {
    // 2 rows, 1 column — horizontal border between rows missing
    const cells: GridCell[] = [
      { left: 0.1, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 0 },
      { left: 0.1, top: 0.3, right: 0.9, bottom: 0.5, row: 1, col: 0 },
    ]
    const cellText = new Map([
      ['0-0', 'Top'],
      ['1-0', 'Bottom'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      // No horizontal line at y=0.3 — border between row 0 and row 1 is missing
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('Top Bottom')
    expect(result.get('1-0')).toBe('')
  })

  it('merges a header spanning all 3 columns', () => {
    // Row 0: header spanning 3 cols (both internal vertical borders missing)
    // Row 1: 3 normal cells
    const cells: GridCell[] = [
      { left: 0.1, top: 0.1, right: 0.4, bottom: 0.2, row: 0, col: 0 },
      { left: 0.4, top: 0.1, right: 0.7, bottom: 0.2, row: 0, col: 1 },
      { left: 0.7, top: 0.1, right: 0.9, bottom: 0.2, row: 0, col: 2 },
      { left: 0.1, top: 0.2, right: 0.4, bottom: 0.3, row: 1, col: 0 },
      { left: 0.4, top: 0.2, right: 0.7, bottom: 0.3, row: 1, col: 1 },
      { left: 0.7, top: 0.2, right: 0.9, bottom: 0.3, row: 1, col: 2 },
    ]
    const cellText = new Map([
      ['0-0', 'Report Title'],
      ['1-0', 'Name'], ['1-1', 'Age'], ['1-2', 'City'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      // x=0.4 only spans row 1 (y=0.2 to y=0.3), NOT row 0
      { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      // x=0.7 only spans row 1
      { x1: 0.7, y1: 0.2, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    // Row 0: merged across all 3 columns
    expect(result.get('0-0')).toBe('Report Title')
    expect(result.get('0-1')).toBe('')
    expect(result.get('0-2')).toBe('')
    // Row 1: normal
    expect(result.get('1-0')).toBe('Name')
    expect(result.get('1-1')).toBe('Age')
    expect(result.get('1-2')).toBe('City')
  })

  it('returns unchanged map when no cells provided', () => {
    const cellText = new Map<string, string>()
    const result = detectMergedCells([], cellText, [], [])
    expect(result.size).toBe(0)
  })
})
```

Note: The `GridCell` interface is not exported from `lattice.ts`. The tests need access to it. You have two options: export the interface, or construct cells inline as object literals (which TypeScript allows since they satisfy the shape). The test code above uses inline objects — but you need to add a type annotation or export GridCell. **Export `GridCell` from `lattice.ts`** by changing `interface GridCell` to `export interface GridCell` and importing it in the test file:

```ts
import { createTextElement, type LineSegment } from '../../src/ir.js'
```

Add to this import or add a separate one:

```ts
import type { GridCell } from '../../src/extractors/lattice.js'
```

Actually, since the test objects are plain object literals matching the shape, TypeScript structural typing handles it without explicit import. The tests above will work as-is since they don't type-annotate the cells array. Leave `GridCell` unexported; the tests use untyped object literals.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: FAIL — `detectMergedCells` is not exported from `lattice.js`.

- [ ] **Step 3: Implement `detectMergedCells`**

Add to `src/extractors/lattice.ts`, after `assignTextToCells` (after line 310) and before `extractLatticeTables` (before line 312):

```ts
const BORDER_COVERAGE_THRESHOLD = 0.8

/**
 * Check if a vertical border line exists at a given x-coordinate
 * spanning the y-range [yTop, yBottom].
 * Returns true if a vertical line at x covers >= 80% of the height.
 */
function hasVerticalBorder(
  x: number,
  yTop: number,
  yBottom: number,
  vLines: LineSegment[]
): boolean {
  const height = yBottom - yTop
  if (height <= 0) return false

  for (const v of vLines) {
    if (Math.abs(v.x1 - x) > SNAP_TOLERANCE) continue
    const vTop = Math.min(v.y1, v.y2)
    const vBottom = Math.max(v.y1, v.y2)
    // How much of the boundary does this line cover?
    const overlapTop = Math.max(yTop, vTop)
    const overlapBottom = Math.min(yBottom, vBottom)
    const coverage = (overlapBottom - overlapTop) / height
    if (coverage >= BORDER_COVERAGE_THRESHOLD) return true
  }
  return false
}

/**
 * Check if a horizontal border line exists at a given y-coordinate
 * spanning the x-range [xLeft, xRight].
 * Returns true if a horizontal line at y covers >= 80% of the width.
 */
function hasHorizontalBorder(
  y: number,
  xLeft: number,
  xRight: number,
  hLines: LineSegment[]
): boolean {
  const width = xRight - xLeft
  if (width <= 0) return false

  for (const h of hLines) {
    if (Math.abs(h.y1 - y) > SNAP_TOLERANCE) continue
    const hLeft = Math.min(h.x1, h.x2)
    const hRight = Math.max(h.x1, h.x2)
    const overlapLeft = Math.max(xLeft, hLeft)
    const overlapRight = Math.min(xRight, hRight)
    const coverage = (overlapRight - overlapLeft) / width
    if (coverage >= BORDER_COVERAGE_THRESHOLD) return true
  }
  return false
}

/**
 * Detect merged cells by checking for missing internal borders.
 * Where a border between adjacent cells is missing, merge their text
 * into the first position and set empty strings for absorbed positions.
 */
export function detectMergedCells(
  cells: GridCell[],
  cellText: Map<string, string>,
  hLines: LineSegment[],
  vLines: LineSegment[]
): Map<string, string> {
  if (cells.length === 0) return cellText

  const result = new Map(cellText)

  // Build a lookup: "row-col" -> cell
  const cellMap = new Map<string, GridCell>()
  for (const cell of cells) {
    cellMap.set(`${cell.row}-${cell.col}`, cell)
  }

  // Track which cells have been absorbed by a merge
  const absorbed = new Set<string>()

  // Detect horizontal merges (missing vertical borders between columns)
  const maxRow = Math.max(...cells.map((c) => c.row))
  const maxCol = Math.max(...cells.map((c) => c.col))

  for (let r = 0; r <= maxRow; r++) {
    let mergeStart = -1

    for (let c = 0; c <= maxCol; c++) {
      const key = `${r}-${c}`
      const cell = cellMap.get(key)
      if (!cell) continue

      if (mergeStart === -1) {
        mergeStart = c
        continue
      }

      // Check if vertical border exists between col c-1 and col c
      const prevCell = cellMap.get(`${r}-${c - 1}`)
      if (!prevCell) {
        mergeStart = c
        continue
      }

      const borderX = prevCell.right
      const borderExists = hasVerticalBorder(borderX, cell.top, cell.bottom, vLines)

      if (!borderExists) {
        // Continue the merge span
        continue
      }

      // Border exists — flush any merge span
      if (c - 1 > mergeStart) {
        // We have a merge from mergeStart to c-1
        const texts: string[] = []
        for (let mc = mergeStart; mc <= c - 1; mc++) {
          const mk = `${r}-${mc}`
          const t = result.get(mk) ?? ''
          if (t) texts.push(t)
        }
        const merged = texts.join(' ')
        result.set(`${r}-${mergeStart}`, merged)
        for (let mc = mergeStart + 1; mc <= c - 1; mc++) {
          const mk = `${r}-${mc}`
          result.set(mk, '')
          absorbed.add(mk)
        }
      }

      mergeStart = c
    }

    // Flush final merge span in the row
    if (mergeStart !== -1 && maxCol > mergeStart) {
      // Check if the last cells in the row are merged
      let lastMerged = mergeStart
      for (let c = mergeStart + 1; c <= maxCol; c++) {
        const prevCell = cellMap.get(`${r}-${c - 1}`)
        const currCell = cellMap.get(`${r}-${c}`)
        if (!prevCell || !currCell) break
        const borderX = prevCell.right
        if (hasVerticalBorder(borderX, currCell.top, currCell.bottom, vLines)) break
        lastMerged = c
      }

      if (lastMerged > mergeStart) {
        const texts: string[] = []
        for (let mc = mergeStart; mc <= lastMerged; mc++) {
          const mk = `${r}-${mc}`
          const t = result.get(mk) ?? ''
          if (t) texts.push(t)
        }
        const merged = texts.join(' ')
        result.set(`${r}-${mergeStart}`, merged)
        for (let mc = mergeStart + 1; mc <= lastMerged; mc++) {
          const mk = `${r}-${mc}`
          result.set(mk, '')
          absorbed.add(mk)
        }
      }
    }
  }

  // Detect vertical merges (missing horizontal borders between rows)
  for (let c = 0; c <= maxCol; c++) {
    let mergeStart = -1

    for (let r = 0; r <= maxRow; r++) {
      const key = `${r}-${c}`
      if (absorbed.has(key)) {
        // Already absorbed by horizontal merge — don't merge vertically
        if (mergeStart !== -1) {
          flushVerticalMerge(mergeStart, r - 1, c, result, cellMap, hLines)
          mergeStart = -1
        }
        continue
      }

      const cell = cellMap.get(key)
      if (!cell) {
        if (mergeStart !== -1) {
          flushVerticalMerge(mergeStart, r - 1, c, result, cellMap, hLines)
          mergeStart = -1
        }
        continue
      }

      if (mergeStart === -1) {
        mergeStart = r
        continue
      }

      const prevCell = cellMap.get(`${r - 1}-${c}`)
      if (!prevCell) {
        mergeStart = r
        continue
      }

      const borderY = prevCell.bottom
      const borderExists = hasHorizontalBorder(borderY, cell.left, cell.right, hLines)

      if (borderExists) {
        flushVerticalMerge(mergeStart, r - 1, c, result, cellMap, hLines)
        mergeStart = r
      }
    }

    // Flush final span
    if (mergeStart !== -1 && mergeStart < maxRow) {
      flushVerticalMerge(mergeStart, maxRow, c, result, cellMap, hLines)
    }
  }

  return result
}

function flushVerticalMerge(
  startRow: number,
  endRow: number,
  col: number,
  result: Map<string, string>,
  cellMap: Map<string, GridCell>,
  hLines: LineSegment[]
): void {
  // Verify the merge span actually has missing borders
  let lastMerged = startRow
  for (let r = startRow + 1; r <= endRow; r++) {
    const prevCell = cellMap.get(`${r - 1}-${col}`)
    const currCell = cellMap.get(`${r}-${col}`)
    if (!prevCell || !currCell) break
    const borderY = prevCell.bottom
    if (hasHorizontalBorder(borderY, currCell.left, currCell.right, hLines)) break
    lastMerged = r
  }

  if (lastMerged <= startRow) return

  const texts: string[] = []
  for (let r = startRow; r <= lastMerged; r++) {
    const key = `${r}-${col}`
    const t = result.get(key) ?? ''
    if (t) texts.push(t)
  }
  const merged = texts.join(' ')
  result.set(`${startRow}-${col}`, merged)
  for (let r = startRow + 1; r <= lastMerged; r++) {
    result.set(`${r}-${col}`, '')
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Wire into `extractLatticeTables`**

In `extractLatticeTables`, after line 381 (`const cellText = assignTextToCells(cells, pageElements)`), add the merge detection call. Change:

```ts
      const cellText = assignTextToCells(cells, pageElements)

      const maxRow = Math.max(...cells.map((c) => c.row))
```

To:

```ts
      const cellText = assignTextToCells(cells, pageElements)

      // Detect and merge cells with missing internal borders
      const mergedText = detectMergedCells(cells, cellText, cluster.hLines, cluster.vLines)

      const maxRow = Math.max(...cells.map((c) => c.row))
```

And update the row-building loop to use `mergedText` instead of `cellText`. Change:

```ts
          row.push(cellText.get(`${r}-${c}`) ?? '')
```

To:

```ts
          row.push(mergedText.get(`${r}-${c}`) ?? '')
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/extractors/lattice.ts tests/extractors/lattice.test.ts
git commit -m "feat: detect and merge cells with missing internal borders"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | `detectMergedCells()` — checks for missing borders, merges adjacent cells, wired into pipeline |
