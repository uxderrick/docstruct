import { claimElements, type DocumentIR, type TextElement, type LineSegment } from '../ir.js'
import type { Table } from '../types.js'

const SNAP_TOLERANCE = 0.003
const INTERSECTION_TOLERANCE = 0.005

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

/**
 * Find all intersection points between horizontal and vertical line segments.
 * A crossing occurs when the vertical line's x falls within the horizontal line's
 * x-range AND the horizontal line's y falls within the vertical line's y-range.
 */
export function findIntersections(hLines: LineSegment[], vLines: LineSegment[]): Point[] {
  const points: Point[] = []

  for (const h of hLines) {
    const hXMin = Math.min(h.x1, h.x2)
    const hXMax = Math.max(h.x1, h.x2)
    const hY = h.y1 // horizontal line: y1 === y2

    for (const v of vLines) {
      const vYMin = Math.min(v.y1, v.y2)
      const vYMax = Math.max(v.y1, v.y2)
      const vX = v.x1 // vertical line: x1 === x2

      const xInRange =
        vX >= hXMin - INTERSECTION_TOLERANCE && vX <= hXMax + INTERSECTION_TOLERANCE
      const yInRange =
        hY >= vYMin - INTERSECTION_TOLERANCE && hY <= vYMax + INTERSECTION_TOLERANCE

      if (xInRange && yInRange) {
        points.push({ x: vX, y: hY })
      }
    }
  }

  return points
}

/**
 * Snap a value to the nearest existing value in an array, within tolerance.
 * Returns the value itself if no match is found.
 */
function snapValue(value: number, existing: number[], tolerance: number): number {
  for (const v of existing) {
    if (Math.abs(value - v) <= tolerance) return v
  }
  return value
}

/**
 * Build a sorted array of unique values from a list, merging values within tolerance.
 */
function uniqueSnapped(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const result: number[] = []
  for (const v of sorted) {
    if (result.length === 0 || Math.abs(v - result[result.length - 1]) > tolerance) {
      result.push(v)
    }
  }
  return result
}

/**
 * Build grid cells from a set of intersection points.
 * Points are snapped to a grid and then used to determine cell boundaries.
 * A cell is created for each (col, row) pair where all four corners exist.
 */
export function buildGridCells(points: Point[]): GridCell[] {
  if (points.length === 0) return []

  // Snap all x and y values to build a clean grid
  const rawXs = points.map((p) => p.x)
  const rawYs = points.map((p) => p.y)

  const xs = uniqueSnapped(rawXs, SNAP_TOLERANCE)
  const ys = uniqueSnapped(rawYs, SNAP_TOLERANCE)

  if (xs.length < 2 || ys.length < 2) return []

  // Build a lookup set of snapped point coordinates
  const pointSet = new Set<string>()
  for (const p of points) {
    const sx = snapValue(p.x, xs, SNAP_TOLERANCE)
    const sy = snapValue(p.y, ys, SNAP_TOLERANCE)
    pointSet.add(`${sx.toFixed(6)},${sy.toFixed(6)}`)
  }

  const hasPoint = (x: number, y: number): boolean =>
    pointSet.has(`${x.toFixed(6)},${y.toFixed(6)}`)

  const cells: GridCell[] = []

  for (let rowIdx = 0; rowIdx < ys.length - 1; rowIdx++) {
    for (let colIdx = 0; colIdx < xs.length - 1; colIdx++) {
      const left = xs[colIdx]
      const right = xs[colIdx + 1]
      const top = ys[rowIdx]
      const bottom = ys[rowIdx + 1]

      // All four corners must exist as intersection points
      if (
        hasPoint(left, top) &&
        hasPoint(right, top) &&
        hasPoint(left, bottom) &&
        hasPoint(right, bottom)
      ) {
        cells.push({ left, top, right, bottom, row: rowIdx, col: colIdx })
      }
    }
  }

  return cells
}

/**
 * Assign text elements to grid cells.
 * Returns a Map keyed by "row-col" with the joined text content of each cell.
 * Text elements are sorted by y then x (reading order) before joining.
 */
export function assignTextToCells(
  cells: GridCell[],
  elements: TextElement[]
): Map<string, string> {
  const result = new Map<string, string>()

  for (const cell of cells) {
    const key = `${cell.row}-${cell.col}`

    const cellElements = elements.filter((el) => {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      return (
        cx >= cell.left &&
        cx <= cell.right &&
        cy >= cell.top &&
        cy <= cell.bottom
      )
    })

    // Sort by y then x for reading order
    cellElements.sort((a, b) => a.y - b.y || a.x - b.x)
    const text = cellElements
      .map((el) => el.text.trim())
      .filter(Boolean)
      .join(' ')

    if (text) {
      result.set(key, text)
    }
  }

  return result
}

/**
 * Orchestrates lattice table extraction for an entire document IR.
 * Groups lines by page, finds intersections, builds grid cells, assigns text,
 * and produces Table output. First row of grid = column headers, rest = data rows.
 */
export function extractLatticeTables(ir: DocumentIR): {
  tables: Table[]
  claimed: TextElement[]
} {
  const tables: Table[] = []
  const claimed: TextElement[] = []

  if (!ir.lines || ir.lines.length === 0) return { tables, claimed }

  // Group lines by page
  const linesByPage = new Map<number, { hLines: LineSegment[]; vLines: LineSegment[] }>()
  for (const line of ir.lines) {
    const page = line.page ?? 1
    let group = linesByPage.get(page)
    if (!group) {
      group = { hLines: [], vLines: [] }
      linesByPage.set(page, group)
    }
    if (line.orientation === 'horizontal') {
      group.hLines.push(line)
    } else if (line.orientation === 'vertical') {
      group.vLines.push(line)
    }
  }

  // Group unclaimed elements by page
  const elementsByPage = new Map<number, TextElement[]>()
  for (const el of ir.elements) {
    if (el.claimed) continue
    const page = el.page ?? 1
    let group = elementsByPage.get(page)
    if (!group) {
      group = []
      elementsByPage.set(page, group)
    }
    group.push(el)
  }

  const sortedPages = [...linesByPage.keys()].sort((a, b) => a - b)

  for (const page of sortedPages) {
    const { hLines, vLines } = linesByPage.get(page)!

    // Skip pages with insufficient lines for a grid
    if (hLines.length < 2 || vLines.length < 2) continue

    const points = findIntersections(hLines, vLines)
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
  }

  claimElements(claimed)

  return { tables, claimed }
}
