# Multi-Table Per Page — Design Spec

## Overview

Currently the lattice extractor treats all lines on a page as one table. Real PDFs often have multiple independent tables on the same page. This feature clusters lines into separate groups by spatial proximity and runs the grid pipeline independently per cluster.

## Algorithm

New function `clusterLines(hLines, vLines)` returns an array of `{ hLines, vLines }` groups:

1. Collect all y-coordinates from horizontal lines
2. Sort and compute gaps between adjacent y-values
3. Compute median gap (typical row spacing)
4. Split at gaps > 3x the median — these are table boundaries
5. Each split produces a cluster of horizontal lines within that y-range
6. Assign vertical lines to clusters: a vertical line belongs to a cluster if its y-range overlaps with the cluster's y-range. If it spans multiple clusters, assign to each one it overlaps.
7. Return array of `{ hLines, vLines }` clusters

## Integration

In `extractLatticeTables`, the per-page processing changes from:

```
dedupH → dedupV → findIntersections → buildGridCells → ...
```

To:

```
dedupH → dedupV → clusterLines(dedupH, dedupV) → for each cluster: findIntersections → buildGridCells → ...
```

Each cluster independently produces a table (or is skipped if too small). A page can now emit 0, 1, or many tables.

## Edge Cases

- **Single table (no large gaps):** One cluster containing all lines. Identical to current behavior.
- **Clusters too small:** The existing `hLines.length < 2 || vLines.length < 2` and `cells.length < 2` checks apply per cluster.
- **Vertical lines spanning gap:** Assigned to all clusters they overlap with. A full-page vertical border shared by two tables appears in both clusters.

## Files Changed

| File | Change |
|------|--------|
| `src/extractors/lattice.ts` | Add `clusterLines()`, update `extractLatticeTables` to iterate clusters |
| `tests/extractors/lattice.test.ts` | Add clustering tests |

## What's NOT in Scope

- Horizontal clustering (tables side-by-side) — rare in practice, can add later
- Changing the IR or other extractors
- Merged cell detection
