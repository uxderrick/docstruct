# Line Deduplication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge overlapping/duplicate line segments in the lattice extractor to handle double-drawn borders and shared cell edges.

**Architecture:** A single `deduplicateLines` function groups lines by their fixed-axis coordinate (y for horizontal, x for vertical), sorts by the varying axis, and merges overlapping/adjacent segments. Called in `extractLatticeTables` before `findIntersections`.

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-09-line-deduplication-design.md`

---

### Task 1: Add Line Deduplication

**Files:**
- Modify: `src/extractors/lattice.ts`
- Modify: `tests/extractors/lattice.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the end of `tests/extractors/lattice.test.ts`:

```ts
import { deduplicateLines } from '../../src/extractors/lattice.js'

describe('deduplicateLines', () => {
  it('merges identical horizontal lines', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('merges overlapping horizontal lines at the same y', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.3, x2: 0.5, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.4, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('merges adjacent horizontal lines within tolerance', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.502, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('keeps non-overlapping horizontal lines separate', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.6, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(2)
  })

  it('merges identical vertical lines', () => {
    const lines: LineSegment[] = [
      { x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.8, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.8, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
  })

  it('merges lines at nearly the same y (within snap tolerance)', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.200, x2: 0.9, y2: 0.200, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.202, x2: 0.9, y2: 0.202, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
  })

  it('keeps the wider lineWidth when merging', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 3, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lineWidth).toBe(3)
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateLines([])).toHaveLength(0)
  })
})
```

Note: The existing import at the top of the file already imports `type LineSegment` from `../../src/ir.js`. Update the import from `../../src/extractors/lattice.js` to also include `deduplicateLines`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: FAIL — `deduplicateLines` is not exported from `lattice.js`.

- [ ] **Step 3: Implement `deduplicateLines`**

Add to `src/extractors/lattice.ts`, before `findIntersections`:

```ts
/**
 * Merge overlapping or identical line segments.
 * Groups lines by their fixed-axis coordinate (y for horizontal, x for vertical),
 * then merges overlapping/adjacent segments along the varying axis.
 */
export function deduplicateLines(lines: LineSegment[]): LineSegment[] {
  if (lines.length === 0) return []

  const orientation = lines[0].orientation

  // Group by fixed axis: y for horizontal, x for vertical
  const groups = new Map<number, LineSegment[]>()
  for (const line of lines) {
    const fixedVal = orientation === 'horizontal' ? line.y1 : line.x1
    // Snap to existing group key within tolerance
    let groupKey: number | null = null
    for (const key of groups.keys()) {
      if (Math.abs(fixedVal - key) <= SNAP_TOLERANCE) {
        groupKey = key
        break
      }
    }
    if (groupKey === null) {
      groupKey = fixedVal
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(line)
  }

  const result: LineSegment[] = []

  for (const [fixedVal, group] of groups) {
    // Sort by varying axis start
    if (orientation === 'horizontal') {
      group.sort((a, b) => a.x1 - b.x1)
    } else {
      group.sort((a, b) => a.y1 - b.y1)
    }

    // Merge overlapping/adjacent segments
    let current = { ...group[0] }

    for (let i = 1; i < group.length; i++) {
      const next = group[i]
      const currentEnd = orientation === 'horizontal' ? current.x2 : current.y2
      const nextStart = orientation === 'horizontal' ? next.x1 : next.y1

      if (nextStart <= currentEnd + SNAP_TOLERANCE) {
        // Merge: extend end, keep wider lineWidth
        if (orientation === 'horizontal') {
          current.x2 = Math.max(current.x2, next.x2)
        } else {
          current.y2 = Math.max(current.y2, next.y2)
        }
        current.lineWidth = Math.max(current.lineWidth, next.lineWidth)
      } else {
        // Gap too large — emit current, start new
        result.push(current)
        current = { ...next }
      }
    }

    result.push(current)
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/extractors/lattice.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Wire into `extractLatticeTables`**

In `extractLatticeTables`, after the `hLines.length < 2` check and before `findIntersections`, add deduplication:

Change:
```ts
    // Skip pages with insufficient lines for a grid
    if (hLines.length < 2 || vLines.length < 2) continue

    const points = findIntersections(hLines, vLines)
```

To:
```ts
    // Skip pages with insufficient lines for a grid
    if (hLines.length < 2 || vLines.length < 2) continue

    // Merge overlapping/duplicate lines before intersection detection
    const dedupH = deduplicateLines(hLines)
    const dedupV = deduplicateLines(vLines)

    const points = findIntersections(dedupH, dedupV)
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS. Existing lattice tests are unaffected — deduplication on non-duplicate lines is a no-op.

- [ ] **Step 7: Commit**

```bash
git add src/extractors/lattice.ts tests/extractors/lattice.test.ts
git commit -m "feat: add line deduplication to lattice extractor"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | `deduplicateLines()` — merges overlapping/duplicate line segments, wired into lattice pipeline |
