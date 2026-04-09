import { claimElements, type DocumentIR, type TextElement } from '../ir.js'
import type { Table } from '../types.js'

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

function extractSpatialTablesForPage(
  elements: TextElement[]
): { tableRows: string[][]; tableElements: TextElement[] } | null {
  if (elements.length < 4) return null

  // Cluster elements by x-position to find columns
  const xTolerance = 0.05
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
  return { tableRows, tableElements }
}

function columnsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((col, i) => col === b[i])
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

  // Merge consecutive page results with the same column structure
  let currentTable: { columns: string[]; rows: string[][]; elements: TextElement[] } | null = null

  for (const result of pageResults) {
    const firstRow = result.tableRows[0]

    if (currentTable && currentTable.columns.length === firstRow.length) {
      // Same number of columns — check if first row is a duplicate header
      const isHeaderDuplicate = columnsMatch(currentTable.columns, firstRow)
      const rowsToAdd = isHeaderDuplicate ? result.tableRows.slice(1) : result.tableRows
      currentTable.rows.push(...rowsToAdd)
      currentTable.elements.push(...result.tableElements)
    } else {
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

  // Then spatial for remaining elements
  const spatial = extractSpatialTables(ir)
  claimElements(spatial.claimed)

  return [...pipe.tables, ...tab.tables, ...spatial.tables]
}
