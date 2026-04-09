import { describe, it, expect } from 'vitest'
import { extractLinesFromOps, classifyLine } from '../../src/parsers/pdf-lines.js'
import type { LineSegment } from '../../src/ir.js'

describe('classifyLine', () => {
  it('classifies horizontal lines', () => {
    expect(classifyLine(0, 0.5, 1, 0.5)).toBe('horizontal')
  })
  it('classifies vertical lines', () => {
    expect(classifyLine(0.3, 0, 0.3, 1)).toBe('vertical')
  })
  it('classifies diagonal lines as other', () => {
    expect(classifyLine(0, 0, 1, 1)).toBe('other')
  })
})

describe('extractLinesFromOps', () => {
  it('extracts line from constructPath with moveTo+lineTo', () => {
    const fnArray = [91, 20]
    const argsArray = [
      [[0, 1], [72, 700, 540, 700]],
      null,
    ]
    const lines = extractLinesFromOps(fnArray, argsArray, 612, 792, 1, 1)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const hLine = lines.find((l) => l.orientation === 'horizontal')
    expect(hLine).toBeDefined()
    expect(hLine!.x1).toBeCloseTo(72 / 612, 2)
    expect(hLine!.y1).toBeCloseTo(1 - 700 / 792, 2)
  })

  it('extracts 4 lines from rectangle op', () => {
    const fnArray = [19, 20]
    const argsArray = [
      [100, 500, 400, 200],
      null,
    ]
    const lines = extractLinesFromOps(fnArray, argsArray, 612, 792, 1, 1)
    const hLines = lines.filter((l) => l.orientation === 'horizontal')
    const vLines = lines.filter((l) => l.orientation === 'vertical')
    expect(hLines.length).toBe(2)
    expect(vLines.length).toBe(2)
  })

  it('ignores paths without stroke or fill', () => {
    const fnArray = [91, 91, 20]
    const argsArray = [
      [[0, 1], [10, 10, 100, 10]],
      [[0, 1], [10, 50, 100, 50]],
      null,
    ]
    const lines = extractLinesFromOps(fnArray, argsArray, 612, 792, 1, 1)
    expect(lines).toHaveLength(1)
  })

  it('returns empty array when no drawing ops', () => {
    const lines = extractLinesFromOps([], [], 612, 792, 1, 1)
    expect(lines).toHaveLength(0)
  })
})
