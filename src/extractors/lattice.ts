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
    if (orientation === 'horizontal') {
      group.sort((a, b) => a.x1 - b.x1)
    } else {
      group.sort((a, b) => a.y1 - b.y1)
    }

    let current = { ...group[0] }

    for (let i = 1; i < group.length; i++) {
      const next = group[i]
      const currentEnd = orientation === 'horizontal' ? current.x2 : current.y2
      const nextStart = orientation === 'horizontal' ? next.x1 : next.y1

      if (nextStart <= currentEnd + SNAP_TOLERANCE) {
        if (orientation === 'horizontal') {
          current.x2 = Math.max(current.x2, next.x2)
        } else {
          current.y2 = Math.max(current.y2, next.y2)
        }
        current.lineWidth = Math.max(current.lineWidth, next.lineWidth)
      } else {
        result.push(current)
        current = { ...next }
      }
    }

    result.push(current)
  }

  return result
}

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

  const ys = uniqueSnapped(
    hLines.map((l) => l.y1),
    SNAP_TOLERANCE
  )

  if (ys.length < 2) return [{ hLines, vLines }]

  const gaps: { index: number; size: number }[] = []
  for (let i = 1; i < ys.length; i++) {
    gaps.push({ index: i, size: ys[i] - ys[i - 1] })
  }

  if (gaps.length < 2) return [{ hLines, vLines }]

  const sortedGaps = [...gaps].sort((a, b) => a.size - b.size)
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)].size

  const splitIndices: number[] = []
  for (const gap of gaps) {
    if (gap.size > medianGap * 3) {
      splitIndices.push(gap.index)
    }
  }

  if (splitIndices.length === 0) return [{ hLines, vLines }]

  const ranges: { yMin: number; yMax: number }[] = []
  let start = 0
  for (const splitIdx of splitIndices) {
    ranges.push({ yMin: ys[start], yMax: ys[splitIdx - 1] })
    start = splitIdx
  }
  ranges.push({ yMin: ys[start], yMax: ys[ys.length - 1] })

  const clusters: LineCluster[] = ranges.map(() => ({ hLines: [], vLines: [] }))

  for (const h of hLines) {
    for (let i = 0; i < ranges.length; i++) {
      if (h.y1 >= ranges[i].yMin - SNAP_TOLERANCE && h.y1 <= ranges[i].yMax + SNAP_TOLERANCE) {
        clusters[i].hLines.push(h)
        break
      }
    }
  }

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

      const maxRow = Math.max(...cells.map((c) => c.row))
      const maxCol = Math.max(...cells.map((c) => c.col))

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
  }

  claimElements(claimed)

  return { tables, claimed }
}
