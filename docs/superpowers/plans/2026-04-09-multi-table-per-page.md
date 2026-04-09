# Multi-Table Per Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect and extract multiple independent tables on the same PDF page by clustering lines by spatial proximity.

**Architecture:** A `clusterLines` function splits horizontal and vertical lines into groups based on gaps in the y-coordinates of horizontal lines. Each cluster is processed independently through the existing grid pipeline (dedup → intersections → grid → cells → text).

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-09-multi-table-per-page-design.md`

---

### Task 1: Add Line Clustering and Wire into Pipeline

**Files:**
- Modify: `src/extractors/lattice.ts`
- Modify: `tests/extractors/lattice.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/extractors/lattice.test.ts`. Update the import line to include `clusterLines`:

```ts
import { findIntersections, buildGridCells, assignTextToCells, deduplicateLines, clusterLines } from '../../src/extractors/lattice.js'
```

Then add this describe block:

```ts
describe('clusterLines', () => {
  it('returns one cluster when all lines form a single table', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.15, x2: 0.9, y2: 0.15, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].hLines).toHaveLength(3)
    expect(clusters[0].vLines).toHaveLength(2)
  })

  it('splits into two clusters when there is a large gap', () => {
    const hLines: LineSegment[] = [
      // Table 1: y = 0.1, 0.15, 0.2
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.15, x2: 0.9, y2: 0.15, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      // Table 2: y = 0.6, 0.65, 0.7 (large gap from 0.2 to 0.6)
      { x1: 0.1, y1: 0.6, x2: 0.9, y2: 0.6, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.65, x2: 0.9, y2: 0.65, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.7, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      // Vertical lines spanning table 1 only
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      // Vertical lines spanning table 2 only
      { x1: 0.1, y1: 0.6, x2: 0.1, y2: 0.7, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.6, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(2)
    expect(clusters[0].hLines).toHaveLength(3)
    expect(clusters[0].vLines).toHaveLength(2)
    expect(clusters[1].hLines).toHaveLength(3)
    expect(clusters[1].vLines).toHaveLength(2)
  })

  it('assigns vertical lines spanning both clusters to each cluster they overlap', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.7, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.8, x2: 0.9, y2: 0.8, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      // Full-page vertical line spanning both tables
      { x1: 0.5, y1: 0.05, x2: 0.5, y2: 0.85, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(2)
    // The spanning vertical line should appear in both clusters
    expect(clusters[0].vLines).toHaveLength(1)
    expect(clusters[1].vLines).toHaveLength(1)
  })

  it('returns one cluster for only two horizontal lines', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    // Only 2 h-lines = 1 gap, can't compute median meaningfully, so no split
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    const clusters = clusterLines([], [])
    expect(clusters).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: FAIL — `clusterLines` is not exported from `lattice.js`.

- [ ] **Step 3: Implement `clusterLines`**

Add to `src/extractors/lattice.ts`, after `deduplicateLines` and before `findIntersections`:

```ts
interface LineCluster {
  hLines: LineSegment[]
  vLines: LineSegment[]
}

/**
 * Split horizontal and vertical lines into independent table clusters.
 * Groups by finding large gaps in the y-coordinates of horizontal lines.
 * A gap > 3x the median gap indicates a table boundary.
 * Vertical lines are assigned to each cluster whose y-range they overlap.
 */
export function clusterLines(
  hLines: LineSegment[],
  vLines: LineSegment[]
): LineCluster[] {
  if (hLines.length === 0) return []

  // Collect unique y-values from horizontal lines (using their y1 since they're horizontal)
  const ys = uniqueSnapped(
    hLines.map((l) => l.y1),
    SNAP_TOLERANCE
  )

  if (ys.length < 2) return [{ hLines, vLines }]

  // Compute gaps between adjacent y-values
  const gaps: { index: number; size: number }[] = []
  for (let i = 1; i < ys.length; i++) {
    gaps.push({ index: i, size: ys[i] - ys[i - 1] })
  }

  // Need at least 2 gaps to compute a meaningful median
  if (gaps.length < 2) return [{ hLines, vLines }]

  // Find median gap
  const sortedGaps = [...gaps].sort((a, b) => a.size - b.size)
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)].size

  // Find split points: gaps > 3x median
  const splitIndices: number[] = []
  for (const gap of gaps) {
    if (gap.size > medianGap * 3) {
      splitIndices.push(gap.index)
    }
  }

  if (splitIndices.length === 0) return [{ hLines, vLines }]

  // Build y-ranges for each cluster
  const ranges: { yMin: number; yMax: number }[] = []
  let start = 0
  for (const splitIdx of splitIndices) {
    ranges.push({ yMin: ys[start], yMax: ys[splitIdx - 1] })
    start = splitIdx
  }
  ranges.push({ yMin: ys[start], yMax: ys[ys.length - 1] })

  // Assign horizontal lines to clusters
  const clusters: LineCluster[] = ranges.map(() => ({ hLines: [], vLines: [] }))

  for (const h of hLines) {
    for (let i = 0; i < ranges.length; i++) {
      if (h.y1 >= ranges[i].yMin - SNAP_TOLERANCE && h.y1 <= ranges[i].yMax + SNAP_TOLERANCE) {
        clusters[i].hLines.push(h)
        break
      }
    }
  }

  // Assign vertical lines to every cluster they overlap with
  for (const v of vLines) {
    const vYMin = Math.min(v.y1, v.y2)
    const vYMax = Math.max(v.y1, v.y2)

    for (let i = 0; i < ranges.length; i++) {
      const overlaps =
        vYMin <= ranges[i].yMax + SNAP_TOLERANCE &&
        vYMax >= ranges[i].yMin - SNAP_TOLERANCE
      if (overlaps) {
        clusters[i].vLines.push(v)
      }
    }
  }

  return clusters
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Wire `clusterLines` into `extractLatticeTables`**

In `extractLatticeTables`, replace the block from deduplication through table building (lines 284-327) with a loop over clusters. Change:

```ts
    // Merge overlapping/duplicate lines before intersection detection
    const dedupH = deduplicateLines(hLines)
    const dedupV = deduplicateLines(vLines)

    const points = findIntersections(dedupH, dedupV)
    if (points.length === 0) continue

    const cells = buildGridCells(points)
    if (cells.length < 2) continue

    const pageElements = elementsByPage.get(page) ?? []
    const cellText = assignTextToCells(cells, pageElements)

    // Determine grid dimensions
    const maxRow = Math.max(...cells.map((c) => c.row))
    const maxCol = Math.max(...cells.map((c) => c.col))

    // Build rows: row 0 = columns, rows 1+ = data
    const allRows: string[][] = []
    for (let r = 0; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = 0; c <= maxCol; c++) {
        row.push(cellText.get(`${r}-${c}`) ?? '')
      }
      allRows.push(row)
    }

    if (allRows.length < 1) continue

    const columns = allRows[0]
    const rows = allRows.slice(1)

    tables.push({ columns, rows })

    // Claim the elements that fell inside grid cells
    const claimedOnPage = pageElements.filter((el) => {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      return cells.some(
        (cell) =>
          cx >= cell.left && cx <= cell.right && cy >= cell.top && cy <= cell.bottom
      )
    })
    claimed.push(...claimedOnPage)
```

To:

```ts
    // Merge overlapping/duplicate lines before intersection detection
    const dedupH = deduplicateLines(hLines)
    const dedupV = deduplicateLines(vLines)

    // Cluster lines into independent table groups
    const clusters = clusterLines(dedupH, dedupV)

    const pageElements = elementsByPage.get(page) ?? []

    for (const cluster of clusters) {
      if (cluster.hLines.length < 2 || cluster.vLines.length < 2) continue

      const points = findIntersections(cluster.hLines, cluster.vLines)
      if (points.length === 0) continue

      const cells = buildGridCells(points)
      if (cells.length < 2) continue

      const cellText = assignTextToCells(cells, pageElements)

      // Determine grid dimensions
      const maxRow = Math.max(...cells.map((c) => c.row))
      const maxCol = Math.max(...cells.map((c) => c.col))

      // Build rows: row 0 = columns, rows 1+ = data
      const allRows: string[][] = []
      for (let r = 0; r <= maxRow; r++) {
        const row: string[] = []
        for (let c = 0; c <= maxCol; c++) {
          row.push(cellText.get(`${r}-${c}`) ?? '')
        }
        allRows.push(row)
      }

      if (allRows.length < 1) continue

      const columns = allRows[0]
      const rows = allRows.slice(1)

      tables.push({ columns, rows })

      // Claim the elements that fell inside grid cells
      const claimedOnPage = pageElements.filter((el) => {
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        return cells.some(
          (cell) =>
            cx >= cell.left && cx <= cell.right && cy >= cell.top && cy <= cell.bottom
        )
      })
      claimed.push(...claimedOnPage)
    }
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS. Existing tests are unaffected — single-table pages produce one cluster which processes identically.

- [ ] **Step 7: Commit**

```bash
git add src/extractors/lattice.ts tests/extractors/lattice.test.ts
git commit -m "feat: support multiple tables per page via line clustering"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | `clusterLines()` — splits lines into table groups by y-gap analysis, wired into pipeline |
