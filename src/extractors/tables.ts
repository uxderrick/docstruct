import { claimElements, type DocumentIR, type TextElement } from '../ir.js'
import type { Table } from '../types.js'
import { extractLatticeTables } from './lattice.js'

const PIPE_ROW_RE = /^\|(.+)\|$/
const SEPARATOR_RE = /^\|[\s\-:|]+\|$/

function parsePipeRow(line: string): string[] {
  const match = line.match(PIPE_ROW_RE)
  if (!match) return []
  return match[1].split('|').map((cell) => cell.trim())
}

function extractPipeTables(ir: DocumentIR): { tables: Table[]; claimed: TextElement[] } {
  const tables: Table[] = []
  const claimed: TextElement[] = []
  let currentRows: string[][] = []
  let currentElements: TextElement[] = []

  for (const element of ir.elements) {
    if (element.claimed) continue
    const text = element.text.trim()

    if (SEPARATOR_RE.test(text)) {
      // Skip markdown separator rows but claim them
      currentElements.push(element)
      continue
    }

    const cells = parsePipeRow(text)
    if (cells.length >= 2) {
      currentRows.push(cells)
      currentElements.push(element)
    } else {
      if (currentRows.length >= 2) {
        tables.push({
          columns: currentRows[0],
          rows: currentRows.slice(1),
        })
        claimed.push(...currentElements)
      }
      currentRows = []
      currentElements = []
    }
  }

  if (currentRows.length >= 2) {
    tables.push({
      columns: currentRows[0],
      rows: currentRows.slice(1),
    })
    claimed.push(...currentElements)
  }

  return { tables, claimed }
}

function extractTabTables(ir: DocumentIR): { tables: Table[]; claimed: TextElement[] } {
  const tables: Table[] = []
  const claimed: TextElement[] = []
  let currentRows: string[][] = []
  let currentElements: TextElement[] = []
  let expectedCols = -1

  for (const element of ir.elements) {
    if (element.claimed) continue
    const text = element.text

    if (!text.includes('\t')) {
      if (currentRows.length >= 2) {
        tables.push({ columns: currentRows[0], rows: currentRows.slice(1) })
        claimed.push(...currentElements)
      }
      currentRows = []
      currentElements = []
      expectedCols = -1
      continue
    }

    const cells = text.split('\t').map((c) => c.trim())
    if (expectedCols === -1) {
      expectedCols = cells.length
    }

    if (cells.length === expectedCols && cells.length >= 2) {
      currentRows.push(cells)
      currentElements.push(element)
    } else {
      if (currentRows.length >= 2) {
        tables.push({ columns: currentRows[0], rows: currentRows.slice(1) })
        claimed.push(...currentElements)
      }
      currentRows = []
      currentElements = []
      expectedCols = -1
    }
  }

  if (currentRows.length >= 2) {
    tables.push({ columns: currentRows[0], rows: currentRows.slice(1) })
    claimed.push(...currentElements)
  }

  return { tables, claimed }
}

/**
 * Detect repeated page-header rows across pages.
 * A row is considered a page header if its exact text signature appears
 * on more than half of the pages in the document. This is generic —
 * it works for any PDF with repeated headers, not just specific formats.
 */
function findRepeatedRowSignatures(
  pageResults: { tableRows: string[][] }[]
): Set<string> {
  if (pageResults.length < 2) return new Set()

  // Count how many pages each row signature appears on
  const signatureCounts = new Map<string, number>()
  for (const result of pageResults) {
    // Use a set to avoid double-counting the same signature on one page
    const seenOnPage = new Set<string>()
    for (const row of result.tableRows) {
      const sig = row.join('|||')
      if (!seenOnPage.has(sig)) {
        seenOnPage.add(sig)
        signatureCounts.set(sig, (signatureCounts.get(sig) ?? 0) + 1)
      }
    }
  }

  // A row appearing on more than half the pages is a repeated header
  const threshold = Math.ceil(pageResults.length / 2)
  const repeated = new Set<string>()
  for (const [sig, count] of signatureCounts) {
    if (count >= threshold) {
      repeated.add(sig)
    }
  }
  return repeated
}

function isPageHeaderRow(rowTexts: string[], repeatedSignatures: Set<string>): boolean {
  return repeatedSignatures.has(rowTexts.join('|||'))
}

function computeAdaptiveXTolerance(elements: TextElement[]): number {
  // Collect all unique x-positions and sort them
  const uniqueXs = [...new Set(elements.map((el) => el.x))].sort((a, b) => a - b)

  if (uniqueXs.length < 2) return 0.03

  // Calculate gaps between adjacent x-positions
  const gaps: number[] = []
  for (let i = 1; i < uniqueXs.length; i++) {
    const gap = uniqueXs[i] - uniqueXs[i - 1]
    if (gap > 0.001) {
      gaps.push(gap)
    }
  }

  if (gaps.length === 0) return 0.03

  // Use median gap to determine tolerance
  gaps.sort((a, b) => a - b)
  const medianGap = gaps[Math.floor(gaps.length / 2)]
  const tolerance = medianGap * 0.4

  // Clamp between 0.005 and 0.03
  return Math.max(0.005, Math.min(0.03, tolerance))
}

const HEADER_MIN_COLUMNS = 4
const HEADER_MIN_SPREAD = 0.3
const HEADER_X_DISTINCT_TOLERANCE = 0.02

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

  // Find header row: first y-group with >= 4 distinct x-positions and wide spread
  const sortedYGroups = [...byY.entries()].sort(([a], [b]) => a - b)

  let headerY = -1
  let headerElements: TextElement[] = []

  for (const [y, group] of sortedYGroups) {
    const xs = group.map((el) => el.x).sort((a, b) => a - b)
    const distinctXs: number[] = [xs[0]]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - distinctXs[distinctXs.length - 1] > HEADER_X_DISTINCT_TOLERANCE) {
        distinctXs.push(xs[i])
      }
    }

    if (distinctXs.length < HEADER_MIN_COLUMNS) continue

    const spread = distinctXs[distinctXs.length - 1] - distinctXs[0]
    if (spread < HEADER_MIN_SPREAD) continue

    headerY = y
    headerElements = group
    break
  }

  if (headerY === -1) return null

  // Build column anchors from header elements
  headerElements.sort((a, b) => a.x - b.x)

  const anchors: { x: number; label: string }[] = []
  for (const el of headerElements) {
    if (anchors.length === 0 || el.x - anchors[anchors.length - 1].x > HEADER_X_DISTINCT_TOLERANCE) {
      anchors.push({ x: el.x, label: el.text.trim() })
    } else {
      anchors[anchors.length - 1].label += ' ' + el.text.trim()
    }
  }

  if (anchors.length < HEADER_MIN_COLUMNS) return null

  // Column boundaries are midpoints between adjacent anchors
  const boundaries: number[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    boundaries.push((anchors[i].x + anchors[i + 1].x) / 2)
  }

  function getColumnIndex(x: number): number {
    for (let i = 0; i < boundaries.length; i++) {
      if (x < boundaries[i]) return i
    }
    return anchors.length - 1
  }

  // Collect data elements (not on header row)
  const dataElements = elements.filter((el) => Math.abs(el.y - headerY) >= yTolerance)
  if (dataElements.length === 0) return null

  // Group data by y to form rows
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

  if (tableRows.length < 3) return null

  return { tableRows, tableElements }
}

function extractSpatialTablesForPage(
  elements: TextElement[]
): { tableRows: string[][]; tableElements: TextElement[] } | null {
  if (elements.length < 4) return null

  // Try header-anchored extraction first (best for dense tables like bank statements)
  const headerResult = tryHeaderAnchored(elements)
  if (headerResult) return headerResult

  // Compute adaptive x-tolerance based on density of distinct x-positions
  const xTolerance = computeAdaptiveXTolerance(elements)

  // Cluster elements by x-position to find columns
  const xGroups = new Map<number, TextElement[]>()

  for (const el of elements) {
    let foundGroup = false
    for (const [groupX, group] of xGroups) {
      if (Math.abs(el.x - groupX) < xTolerance) {
        group.push(el)
        foundGroup = true
        break
      }
    }
    if (!foundGroup) {
      xGroups.set(el.x, [el])
    }
  }

  // Need at least 2 columns with 2+ elements each
  const columns = Array.from(xGroups.entries())
    .filter(([, group]) => group.length >= 2)
    .sort(([a], [b]) => a - b)

  if (columns.length < 2) return null

  // Cluster by y-position to form rows
  const yTolerance = 0.02
  const allTableElements = columns.flatMap(([, group]) => group)
  const yValues = [...new Set(allTableElements.map((el) => el.y))].sort((a, b) => a - b)

  if (yValues.length === 0) return null

  const yGroups: number[][] = []
  let currentGroup = [yValues[0]]

  for (let i = 1; i < yValues.length; i++) {
    if (yValues[i] - yValues[i - 1] < yTolerance) {
      currentGroup.push(yValues[i])
    } else {
      yGroups.push(currentGroup)
      currentGroup = [yValues[i]]
    }
  }
  yGroups.push(currentGroup)

  if (yGroups.length < 2) return null

  // Build table rows — collect ALL elements per cell, join with space
  const tableRows: string[][] = []
  const tableElements: TextElement[] = []

  for (const yGroup of yGroups) {
    const yMin = Math.min(...yGroup)
    const yMax = Math.max(...yGroup)
    const row: string[] = []
    const rowElements: TextElement[] = []

    for (const [colX] of columns) {
      const cellElements = allTableElements.filter(
        (el) => Math.abs(el.x - colX) < xTolerance && el.y >= yMin - yTolerance && el.y <= yMax + yTolerance
      )
      // Sort by y then x so multi-line cell text is in reading order
      cellElements.sort((a, b) => a.y - b.y || a.x - b.x)
      const cellText = cellElements.map((el) => el.text.trim()).join(' ').trim()
      row.push(cellText)
      rowElements.push(...cellElements)
    }

    if (rowElements.length > 0) {
      tableRows.push(row)
      tableElements.push(...rowElements)
    }
  }

  if (tableRows.length < 2) return null

  // Quality filter: reject false-positive tables
  // A real table has content distributed across columns.
  // Body text masquerading as a table has most cells empty.
  const totalCells = tableRows.length * columns.length
  let nonEmptyCells = 0
  for (const row of tableRows) {
    for (const cell of row) {
      if (cell.trim()) nonEmptyCells++
    }
  }
  const fillRatio = nonEmptyCells / totalCells

  // If less than 40% of cells have content, it's likely not a table
  if (fillRatio < 0.4) return null

  // If most rows have content in only 1 column, it's paragraph text not a table
  let singleColumnRows = 0
  for (const row of tableRows) {
    const filledCols = row.filter((c) => c.trim()).length
    if (filledCols <= 1) singleColumnRows++
  }
  if (singleColumnRows / tableRows.length > 0.6) return null

  return { tableRows, tableElements }
}

function columnsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((col, i) => col === b[i])
}

/**
 * Check if two column sets are compatible for merging across pages.
 * Returns the "wider" column set if the smaller is a subset (by position),
 * or null if they're incompatible.
 */
function compatibleColumns(a: string[], b: string[]): string[] | null {
  // Exact match
  if (columnsMatch(a, b)) return a

  // Allow difference of up to 2 columns
  if (Math.abs(a.length - b.length) > 2) return null

  const wider = a.length >= b.length ? a : b
  const narrower = a.length < b.length ? a : b

  // Check if narrower columns are a positional subset of wider columns
  // (i.e., narrower[i] matches wider[i] for all i, or narrower columns
  // appear somewhere in wider in order)
  let wi = 0
  let ni = 0
  while (ni < narrower.length && wi < wider.length) {
    if (narrower[ni] === wider[wi]) {
      ni++
    }
    wi++
  }

  if (ni === narrower.length) return wider

  // Also try: narrower columns match the first N columns of wider
  if (narrower.every((col, i) => col === wider[i])) return wider

  return null
}

function extractSpatialTables(ir: DocumentIR): { tables: Table[]; claimed: TextElement[] } {
  const tables: Table[] = []
  const claimed: TextElement[] = []
  const unclaimed = ir.elements.filter((el) => !el.claimed)

  if (unclaimed.length < 4) return { tables, claimed }

  // Group unclaimed elements by page
  const byPage = new Map<number, TextElement[]>()
  for (const el of unclaimed) {
    const page = el.page ?? 1
    let group = byPage.get(page)
    if (!group) {
      group = []
      byPage.set(page, group)
    }
    group.push(el)
  }

  // Process each page independently
  const pageResults: { page: number; tableRows: string[][]; tableElements: TextElement[] }[] = []
  const sortedPages = [...byPage.keys()].sort((a, b) => a - b)

  for (const page of sortedPages) {
    const pageElements = byPage.get(page)!
    const result = extractSpatialTablesForPage(pageElements)
    if (result) {
      pageResults.push({ page, ...result })
    }
  }

  if (pageResults.length === 0) return { tables, claimed }

  // Detect repeated page-header rows and filter them out
  const repeatedSignatures = findRepeatedRowSignatures(pageResults)
  if (repeatedSignatures.size > 0) {
    for (const result of pageResults) {
      result.tableRows = result.tableRows.filter(
        (row) => !isPageHeaderRow(row, repeatedSignatures)
      )
    }
  }

  // Merge consecutive page results with compatible column structures
  let currentTable: { columns: string[]; rows: string[][]; elements: TextElement[] } | null = null

  for (const result of pageResults) {
    if (result.tableRows.length === 0) continue
    const firstRow = result.tableRows[0]

    if (currentTable) {
      const mergedColumns = compatibleColumns(currentTable.columns, firstRow)

      if (mergedColumns) {
        // Update columns to the wider set if needed
        const targetColCount = mergedColumns.length
        currentTable.columns = mergedColumns

        // Pad existing rows if the column count grew
        if (currentTable.rows.length > 0 && currentTable.rows[0].length < targetColCount) {
          currentTable.rows = currentTable.rows.map((row) => {
            while (row.length < targetColCount) row.push('')
            return row
          })
        }

        // Check if first row is a duplicate header
        const isHeaderDuplicate = columnsMatch(mergedColumns, firstRow)
        let rowsToAdd = isHeaderDuplicate ? result.tableRows.slice(1) : result.tableRows

        // Pad new rows if needed
        rowsToAdd = rowsToAdd.map((row) => {
          if (row.length < targetColCount) {
            const padded = [...row]
            while (padded.length < targetColCount) padded.push('')
            return padded
          }
          return row
        })

        currentTable.rows.push(...rowsToAdd)
        currentTable.elements.push(...result.tableElements)
        continue
      }
    }

    // Flush previous table
    if (currentTable && currentTable.rows.length >= 1) {
      tables.push({ columns: currentTable.columns, rows: currentTable.rows })
      claimed.push(...currentTable.elements)
    }
    // Start new table
    currentTable = {
      columns: firstRow,
      rows: result.tableRows.slice(1),
      elements: [...result.tableElements],
    }
  }

  // Flush last table
  if (currentTable && currentTable.rows.length >= 1) {
    tables.push({ columns: currentTable.columns, rows: currentTable.rows })
    claimed.push(...currentTable.elements)
  }

  return { tables, claimed }
}

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
