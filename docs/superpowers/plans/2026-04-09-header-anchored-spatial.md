# Header-Anchored Spatial Table Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect header rows in dense PDF tables and use their x-positions as column anchors, replacing x-clustering when a clear header exists.

**Architecture:** A new `tryHeaderAnchored` function in `src/extractors/tables.ts` detects the header row (first y-value with >= 4 distinct x-positions and wide spread), uses header x-positions to define column boundaries via midpoints, and assigns data elements to columns by nearest boundary. Called at the top of `extractSpatialTablesForPage` before the existing x-clustering fallback.

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-09-header-anchored-spatial-design.md`

---

### Task 1: Add Header-Anchored Extraction

**Files:**
- Modify: `src/extractors/tables.ts`
- Modify: `tests/extractors/tables.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/extractors/tables.test.ts` after the existing tests:

```ts
it('detects dense table using header-anchored columns', () => {
  // Simulate a bank statement: header row with 5 columns,
  // data elements with varying x-positions within each column
  const elements = [
    // Header row at y=0.1
    createTextElement('DATE', 0.05, 0.1, 0.08, 0.02),
    createTextElement('NAME', 0.20, 0.1, 0.08, 0.02),
    createTextElement('TYPE', 0.40, 0.1, 0.06, 0.02),
    createTextElement('AMOUNT', 0.55, 0.1, 0.08, 0.02),
    createTextElement('BALANCE', 0.75, 0.1, 0.08, 0.02),
    // Data row 1 at y=0.15 — x-positions vary slightly from headers
    createTextElement('Jan 3', 0.05, 0.15, 0.06, 0.02),
    createTextElement('Alice Smith', 0.18, 0.15, 0.10, 0.02),
    createTextElement('TRANSFER', 0.38, 0.15, 0.08, 0.02),
    createTextElement('120.00', 0.58, 0.15, 0.05, 0.02),
    createTextElement('880.00', 0.78, 0.15, 0.05, 0.02),
    // Data row 2 at y=0.20 — different x-offsets (right-aligned numbers)
    createTextElement('Jan 5', 0.05, 0.20, 0.06, 0.02),
    createTextElement('Bob Jones', 0.19, 0.20, 0.09, 0.02),
    createTextElement('PAYMENT', 0.39, 0.20, 0.07, 0.02),
    createTextElement('45.50', 0.59, 0.20, 0.04, 0.02),
    createTextElement('834.50', 0.77, 0.20, 0.05, 0.02),
  ]
  const ir = createDocumentIR(elements, 'pdf', 1)
  const tables = extractTables(ir)

  expect(tables).toHaveLength(1)
  expect(tables[0].columns).toEqual(['DATE', 'NAME', 'TYPE', 'AMOUNT', 'BALANCE'])
  expect(tables[0].rows).toHaveLength(2)
  expect(tables[0].rows[0]).toEqual(['Jan 3', 'Alice Smith', 'TRANSFER', '120.00', '880.00'])
  expect(tables[0].rows[1]).toEqual(['Jan 5', 'Bob Jones', 'PAYMENT', '45.50', '834.50'])
})

it('falls back to x-clustering when no header row detected', () => {
  // Simple aligned table without a clear header row pattern
  // (all rows have the same number of elements — no single row stands out)
  const elements = [
    createTextElement('Date', 0.05, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
    createTextElement('Amount', 0.30, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
    createTextElement('Status', 0.55, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
    createTextElement('Jan 3', 0.05, 0.15, 0.1, 0.02),
    createTextElement('120.00', 0.30, 0.15, 0.1, 0.02),
    createTextElement('Paid', 0.55, 0.15, 0.1, 0.02),
    createTextElement('Jan 5', 0.05, 0.20, 0.1, 0.02),
    createTextElement('45.50', 0.30, 0.20, 0.1, 0.02),
    createTextElement('Pending', 0.55, 0.20, 0.1, 0.02),
  ]
  const ir = createDocumentIR(elements, 'pdf', 1)
  const tables = extractTables(ir)

  expect(tables).toHaveLength(1)
  expect(tables[0].columns).toEqual(['Date', 'Amount', 'Status'])
  expect(tables[0].rows).toHaveLength(2)
})

it('handles header-anchored table with multi-word cell values', () => {
  const elements = [
    // Header row at y=0.1 with 4 columns
    createTextElement('NAME', 0.05, 0.1, 0.06, 0.02),
    createTextElement('ACCOUNT', 0.25, 0.1, 0.08, 0.02),
    createTextElement('TYPE', 0.50, 0.1, 0.05, 0.02),
    createTextElement('REF', 0.75, 0.1, 0.04, 0.02),
    // Data row 1 — multi-word name
    createTextElement('Derrick Tsorme', 0.04, 0.15, 0.12, 0.02),
    createTextElement('53907613', 0.26, 0.15, 0.06, 0.02),
    createTextElement('TRANSFER', 0.48, 0.15, 0.08, 0.02),
    createTextElement('Food', 0.76, 0.15, 0.04, 0.02),
    // Data row 2
    createTextElement('VODAFONE PUSH OVA', 0.03, 0.20, 0.16, 0.02),
    createTextElement('54814522', 0.27, 0.20, 0.06, 0.02),
    createTextElement('PAYMENT', 0.49, 0.20, 0.07, 0.02),
    createTextElement('Pastry', 0.74, 0.20, 0.05, 0.02),
  ]
  const ir = createDocumentIR(elements, 'pdf', 1)
  const tables = extractTables(ir)

  expect(tables).toHaveLength(1)
  expect(tables[0].columns).toEqual(['NAME', 'ACCOUNT', 'TYPE', 'REF'])
  expect(tables[0].rows[0]).toEqual(['Derrick Tsorme', '53907613', 'TRANSFER', 'Food'])
  expect(tables[0].rows[1]).toEqual(['VODAFONE PUSH OVA', '54814522', 'PAYMENT', 'Pastry'])
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/extractors/tables.test.ts
```

Expected: The "dense table" test fails (wrong column count or collapsed rows). The "falls back" test should still pass (existing behavior). The "multi-word" test likely fails.

- [ ] **Step 3: Implement `tryHeaderAnchored`**

Add to `src/extractors/tables.ts`, before `extractSpatialTablesForPage`:

```ts
const HEADER_MIN_COLUMNS = 4
const HEADER_MIN_SPREAD = 0.3
const HEADER_X_DISTINCT_TOLERANCE = 0.02

/**
 * Try to extract a table using header-row anchoring.
 * Finds the first y-value with >= 4 distinct x-positions spread across the page,
 * uses those positions as column anchors, and assigns data elements to the nearest column.
 * Returns null if no suitable header row is found.
 */
function tryHeaderAnchored(
  elements: TextElement[]
): { tableRows: string[][]; tableElements: TextElement[] } | null {
  if (elements.length < HEADER_MIN_COLUMNS * 2) return null

  const yTolerance = 0.02

  // Group elements by y-value
  const byY = new Map<number, TextElement[]>()
  for (const el of elements) {
    let foundY = false
    for (const [groupY, group] of byY) {
      if (Math.abs(el.y - groupY) < yTolerance) {
        group.push(el)
        foundY = true
        break
      }
    }
    if (!foundY) {
      byY.set(el.y, [el])
    }
  }

  // Find the header row: first y-group with >= 4 distinct x-positions and wide spread
  const sortedYGroups = [...byY.entries()].sort(([a], [b]) => a - b)

  let headerY = -1
  let headerElements: TextElement[] = []

  for (const [y, group] of sortedYGroups) {
    // Count distinct x-positions
    const xs = group.map((el) => el.x).sort((a, b) => a - b)
    const distinctXs: number[] = [xs[0]]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - distinctXs[distinctXs.length - 1] > HEADER_X_DISTINCT_TOLERANCE) {
        distinctXs.push(xs[i])
      }
    }

    if (distinctXs.length < HEADER_MIN_COLUMNS) continue

    // Check spread
    const spread = distinctXs[distinctXs.length - 1] - distinctXs[0]
    if (spread < HEADER_MIN_SPREAD) continue

    headerY = y
    headerElements = group
    break
  }

  if (headerY === -1) return null

  // Build column anchors from header elements, sorted by x
  headerElements.sort((a, b) => a.x - b.x)

  // Deduplicate headers at same x
  const anchors: { x: number; label: string }[] = []
  for (const el of headerElements) {
    if (anchors.length === 0 || el.x - anchors[anchors.length - 1].x > HEADER_X_DISTINCT_TOLERANCE) {
      anchors.push({ x: el.x, label: el.text.trim() })
    } else {
      // Merge with previous anchor
      anchors[anchors.length - 1].label += ' ' + el.text.trim()
    }
  }

  if (anchors.length < HEADER_MIN_COLUMNS) return null

  // Compute column boundaries as midpoints between adjacent anchors
  const boundaries: number[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    boundaries.push((anchors[i].x + anchors[i + 1].x) / 2)
  }

  // Assign a column index to an element based on midpoint boundaries
  function getColumnIndex(x: number): number {
    for (let i = 0; i < boundaries.length; i++) {
      if (x < boundaries[i]) return i
    }
    return anchors.length - 1
  }

  // Collect data elements (everything not on the header row)
  const dataElements = elements.filter((el) => Math.abs(el.y - headerY) >= yTolerance)
  if (dataElements.length === 0) return null

  // Group data elements by y to form rows
  const dataByY = new Map<number, TextElement[]>()
  for (const el of dataElements) {
    let foundY = false
    for (const [groupY, group] of dataByY) {
      if (Math.abs(el.y - groupY) < yTolerance) {
        group.push(el)
        foundY = true
        break
      }
    }
    if (!foundY) {
      dataByY.set(el.y, [el])
    }
  }

  const sortedDataRows = [...dataByY.entries()].sort(([a], [b]) => a - b)

  const columns = anchors.map((a) => a.label)
  const tableRows: string[][] = [columns]
  const tableElements: TextElement[] = [...headerElements]

  for (const [, rowElements] of sortedDataRows) {
    const row: string[] = new Array(anchors.length).fill('')

    // Group elements by their assigned column
    const cellGroups = new Map<number, TextElement[]>()
    for (const el of rowElements) {
      const colIdx = getColumnIndex(el.x)
      if (!cellGroups.has(colIdx)) cellGroups.set(colIdx, [])
      cellGroups.get(colIdx)!.push(el)
    }

    for (const [colIdx, cellEls] of cellGroups) {
      cellEls.sort((a, b) => a.x - b.x)
      row[colIdx] = cellEls.map((el) => el.text.trim()).join(' ')
    }

    tableRows.push(row)
    tableElements.push(...rowElements)
  }

  if (tableRows.length < 3) return null // Need header + at least 2 data rows

  return { tableRows, tableElements }
}
```

- [ ] **Step 4: Wire into `extractSpatialTablesForPage`**

At the top of `extractSpatialTablesForPage`, add the header-anchored attempt before existing logic. Change:

```ts
function extractSpatialTablesForPage(
  elements: TextElement[]
): { tableRows: string[][]; tableElements: TextElement[] } | null {
  if (elements.length < 4) return null

  // Compute adaptive x-tolerance based on density of distinct x-positions
  const xTolerance = computeAdaptiveXTolerance(elements)
```

To:

```ts
function extractSpatialTablesForPage(
  elements: TextElement[]
): { tableRows: string[][]; tableElements: TextElement[] } | null {
  if (elements.length < 4) return null

  // Try header-anchored extraction first (best for dense tables like bank statements)
  const headerResult = tryHeaderAnchored(elements)
  if (headerResult) return headerResult

  // Fall back to x-clustering for simpler tables
  // Compute adaptive x-tolerance based on density of distinct x-positions
  const xTolerance = computeAdaptiveXTolerance(elements)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/extractors/tables.test.ts
```

Expected: All tests PASS including the 3 new ones.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/extractors/tables.ts tests/extractors/tables.test.ts
git commit -m "feat: add header-anchored column detection for dense spatial tables"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | `tryHeaderAnchored()` — detects header rows, uses x-positions as column anchors, falls back to x-clustering when no header found |
