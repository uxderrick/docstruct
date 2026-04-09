import type { LineSegment } from '../ir.js'

// PDF operator codes
const OP_CONSTRUCT_PATH = 91
const OP_RECTANGLE = 19
const OP_STROKE = 20
const OP_FILL = 22
const OP_FILL_STROKE = 23
const OP_SET_LINE_WIDTH = 2

// constructPath sub-op codes
const SUB_MOVE_TO = 0
const SUB_LINE_TO = 1
const SUB_CURVE_TO = 2
const SUB_CLOSE_PATH = 4

const TOLERANCE = 0.002

/**
 * Classify a line segment (in normalized coords) as horizontal, vertical, or other.
 */
export function classifyLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): 'horizontal' | 'vertical' | 'other' {
  if (Math.abs(y2 - y1) <= TOLERANCE) return 'horizontal'
  if (Math.abs(x2 - x1) <= TOLERANCE) return 'vertical'
  return 'other'
}

/**
 * Normalize a PDF x coordinate (bottom-left origin, absolute) to docstruct space (0-1).
 */
function nx(x: number, vpWidth: number): number {
  return x / vpWidth
}

/**
 * Normalize a PDF y coordinate (bottom-left origin, absolute) to docstruct space (top-left origin, 0-1).
 */
function ny(y: number, vpHeight: number): number {
  return 1 - y / vpHeight
}

/**
 * Build a LineSegment from two normalized points, ensuring x1<=x2 and y1<=y2.
 */
function makeSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lineWidth: number,
  page: number
): LineSegment {
  const x1 = Math.min(ax, bx)
  const x2 = Math.max(ax, bx)
  const y1 = Math.min(ay, by)
  const y2 = Math.max(ay, by)
  return {
    x1,
    y1,
    x2,
    y2,
    lineWidth,
    page,
    orientation: classifyLine(x1, y1, x2, y2),
  }
}

/**
 * Extract line segments from a pdfjs-dist operator list.
 *
 * @param fnArray - Array of operator codes
 * @param argsArray - Parallel array of operator arguments
 * @param vpWidth - Viewport width in PDF units
 * @param vpHeight - Viewport height in PDF units
 * @param page - Page number to assign to segments
 * @param currentLineWidth - Initial line width to use
 */
export function extractLinesFromOps(
  fnArray: number[],
  argsArray: any[],
  vpWidth: number,
  vpHeight: number,
  page: number,
  currentLineWidth: number = 1
): LineSegment[] {
  const result: LineSegment[] = []
  let pending: LineSegment[] = []
  let lineWidth = currentLineWidth

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i]
    const args = argsArray[i]

    if (op === OP_SET_LINE_WIDTH) {
      // setLineWidth — update state, does NOT clear pending
      if (Array.isArray(args) && args.length > 0) {
        lineWidth = args[0] as number
      } else if (typeof args === 'number') {
        lineWidth = args
      }
      continue
    }

    if (op === OP_CONSTRUCT_PATH) {
      // args: [subOps[], coords[]]
      const subOps: number[] = args[0]
      const coords: number[] = args[1]

      const pathLines: LineSegment[] = []
      let coordIdx = 0
      let curX = 0
      let curY = 0
      let startX = 0
      let startY = 0

      for (const sub of subOps) {
        if (sub === SUB_MOVE_TO) {
          curX = coords[coordIdx++]
          curY = coords[coordIdx++]
          startX = curX
          startY = curY
        } else if (sub === SUB_LINE_TO) {
          const toX = coords[coordIdx++]
          const toY = coords[coordIdx++]
          pathLines.push(
            makeSegment(
              nx(curX, vpWidth),
              ny(curY, vpHeight),
              nx(toX, vpWidth),
              ny(toY, vpHeight),
              lineWidth,
              page
            )
          )
          curX = toX
          curY = toY
        } else if (sub === SUB_CURVE_TO) {
          // skip 6 coords (3 control points), no line extraction
          coordIdx += 6
        } else if (sub === SUB_CLOSE_PATH) {
          // Draw line back to start
          if (curX !== startX || curY !== startY) {
            pathLines.push(
              makeSegment(
                nx(curX, vpWidth),
                ny(curY, vpHeight),
                nx(startX, vpWidth),
                ny(startY, vpHeight),
                lineWidth,
                page
              )
            )
          }
          curX = startX
          curY = startY
        }
      }

      // Replace pending with this path's lines
      pending = pathLines
      continue
    }

    if (op === OP_RECTANGLE) {
      // args: [x, y, w, h]
      const [rx, ry, rw, rh] = args as number[]
      // Rectangle corners: bottom-left (rx, ry), bottom-right (rx+rw, ry),
      // top-right (rx+rw, ry+rh), top-left (rx, ry+rh)
      const left = nx(rx, vpWidth)
      const right = nx(rx + rw, vpWidth)
      const bottom = ny(ry, vpHeight)
      const top = ny(ry + rh, vpHeight)

      // In normalized space, top < bottom since we flipped y
      const yLow = Math.min(top, bottom)
      const yHigh = Math.max(top, bottom)

      pending = [
        // bottom horizontal edge
        { x1: left, y1: yHigh, x2: right, y2: yHigh, lineWidth, page, orientation: 'horizontal' },
        // top horizontal edge
        { x1: left, y1: yLow, x2: right, y2: yLow, lineWidth, page, orientation: 'horizontal' },
        // left vertical edge
        { x1: left, y1: yLow, x2: left, y2: yHigh, lineWidth, page, orientation: 'vertical' },
        // right vertical edge
        { x1: right, y1: yLow, x2: right, y2: yHigh, lineWidth, page, orientation: 'vertical' },
      ]
      continue
    }

    if (op === OP_STROKE || op === OP_FILL || op === OP_FILL_STROKE) {
      // Commit pending lines to result
      for (const seg of pending) {
        result.push(seg)
      }
      pending = []
      continue
    }

    // Other ops (state-setting like setFillColor, setStrokeColor, etc.)
    // do NOT clear pending — only path-starting ops replace pending
  }

  return result
}
