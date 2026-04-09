# Header-Anchored Spatial Table Extraction — Design Spec

## Overview

The spatial table extractor currently clusters elements by x-proximity to find columns. This fails on dense tables (bank statements, invoices) where data elements have varying x-positions within a column (right-aligned numbers, centered text). Fix this by detecting the header row and using its x-positions as column anchors.

## Why

A MoMo statement page has 831 elements, 118 unique x-values, but only 16 logical columns. The header row at y=0.135 has exactly 16 elements with distinct x-positions that define the columns. Data elements vary in x-position per row (right-aligned amounts, left-aligned names), causing the x-clustering to create 30+ spurious columns.

## Algorithm

### Header Detection

1. For each unique y-value on the page, count elements at distinct x-positions (x-values that are > 0.02 apart count as distinct)
2. The header row is the first y-value with >= 4 elements at distinct x-positions AND a total x-spread (max x - min x) >= 0.3 (avoids bullet lists or narrow text blocks)
3. If no header row found → fall back to current x-clustering logic (no change)

### Column Assignment

1. Sort header elements by x-position → these are the column anchors
2. Column boundaries are midpoints between adjacent anchors. Element before first midpoint → column 0, between midpoints i and i+1 → column i+1, after last midpoint → last column
3. The header elements themselves become the column labels (the `columns` array in the Table output)

### Row Building

1. All elements at y-values other than the header y are data elements
2. Group by y-value using existing y-tolerance (0.02)
3. Within each row, assign each element to its column using the midpoint boundaries
4. Multiple elements in the same cell are joined with space in reading order (sorted by x)

### Quality Check

After building, apply the same fill-ratio and single-column-dominance checks that already exist. Skip the header-anchored path if the result fails quality checks — fall back to x-clustering.

## Integration

Modify `extractSpatialTablesForPage` in `src/extractors/tables.ts`:

```
function extractSpatialTablesForPage(elements):
  // NEW: Try header-anchored extraction first
  headerResult = tryHeaderAnchored(elements)
  if (headerResult) return headerResult

  // EXISTING: Fall back to x-clustering
  ... current code unchanged ...
```

The new `tryHeaderAnchored` function is a private function in the same file.

## Files Changed

| File | Change |
|------|--------|
| `src/extractors/tables.ts` | Add `tryHeaderAnchored()`, call at top of `extractSpatialTablesForPage` |
| `tests/extractors/tables.test.ts` | Add header-anchored tests with mock dense table data |

## What's NOT in Scope

- Multi-line cell merging (element at same x but different y within a row — handled by existing y-tolerance)
- Lattice extractor changes
- Header detection across multiple pages (each page is independent)
