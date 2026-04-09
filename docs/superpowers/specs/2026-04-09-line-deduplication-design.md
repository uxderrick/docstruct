# Line Deduplication — Design Spec

## Overview

Add line deduplication to the lattice table extractor. Some PDF generators draw borders twice (double-stroked), or adjacent cells share edges that produce overlapping line segments. These duplicates inflate intersection counts and can produce phantom grid cells. Deduplication merges overlapping/identical line segments before intersection detection.

## Where

In `src/extractors/lattice.ts`, as a preprocessing step inside `extractLatticeTables` — after grouping lines by page and orientation, before calling `findIntersections`.

## Algorithm

One function handles both orientations:

```ts
function deduplicateLines(lines: LineSegment[]): LineSegment[]
```

**For horizontal lines** (orientation = 'horizontal'):
1. Snap y-coordinates within SNAP_TOLERANCE to the same value (reuse `snapValue`/`uniqueSnapped` logic)
2. Group lines by snapped y
3. Within each group, sort by x1 (ascending)
4. Merge overlapping/adjacent segments: walk the sorted list, if next.x1 <= current.x2 + SNAP_TOLERANCE, extend current.x2 to max(current.x2, next.x2). Keep the wider lineWidth.
5. Emit merged segments

**For vertical lines** (orientation = 'vertical'): same logic, group by snapped x, merge along y.

The function inspects the first line's orientation to decide which axis to group on and which to merge along. If called with an empty array, returns empty.

## Integration

In `extractLatticeTables`, the per-page processing becomes:

```
hLines = deduplicateLines(hLines)
vLines = deduplicateLines(vLines)
// then findIntersections(hLines, vLines) as before
```

## Files Changed

| File | Change |
|------|--------|
| `src/extractors/lattice.ts` | Add `deduplicateLines()`, call before `findIntersections` |
| `tests/extractors/lattice.test.ts` | Add dedup tests |

## What's NOT in Scope

- Changes to `pdf-lines.ts` or the IR
- Line-width filtering (separate concern)
- Diagonal line handling
