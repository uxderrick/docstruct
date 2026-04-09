import { describe, it, expect } from 'vitest'
import { findIntersections, buildGridCells, assignTextToCells, deduplicateLines } from '../../src/extractors/lattice.js'
import { createTextElement, type LineSegment } from '../../src/ir.js'

describe('findIntersections', () => {
  it('finds where horizontal and vertical lines cross', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.6, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const points = findIntersections(hLines, vLines)
    expect(points).toHaveLength(6)
  })

  it('returns empty when lines do not cross', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.9, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const points = findIntersections(hLines, vLines)
    expect(points).toHaveLength(0)
  })
})

describe('buildGridCells', () => {
  it('builds cells from intersection points (2 cols x 1 row = 2 cells)', () => {
    const points = [
      { x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.9, y: 0.2 },
      { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
    ]
    const cells = buildGridCells(points)
    expect(cells).toHaveLength(2)
    expect(cells[0].left).toBeCloseTo(0.1)
    expect(cells[0].right).toBeCloseTo(0.5)
    expect(cells[0].top).toBeCloseTo(0.2)
    expect(cells[0].bottom).toBeCloseTo(0.5)
  })
})

describe('assignTextToCells', () => {
  it('assigns text elements to the cell that contains them', () => {
    const cells = [
      { left: 0.1, top: 0.2, right: 0.5, bottom: 0.5, row: 0, col: 0 },
      { left: 0.5, top: 0.2, right: 0.9, bottom: 0.5, row: 0, col: 1 },
    ]
    const elements = [
      createTextElement('Hello', 0.2, 0.3, 0.1, 0.02, { page: 1 }),
      createTextElement('World', 0.6, 0.3, 0.1, 0.02, { page: 1 }),
    ]
    const result = assignTextToCells(cells, elements)
    expect(result.get('0-0')).toBe('Hello')
    expect(result.get('0-1')).toBe('World')
  })

  it('joins multiple text elements in the same cell', () => {
    const cells = [
      { left: 0.1, top: 0.2, right: 0.9, bottom: 0.5, row: 0, col: 0 },
    ]
    const elements = [
      createTextElement('First', 0.2, 0.25, 0.1, 0.02, { page: 1 }),
      createTextElement('Second', 0.2, 0.35, 0.1, 0.02, { page: 1 }),
    ]
    const result = assignTextToCells(cells, elements)
    expect(result.get('0-0')).toBe('First Second')
  })
})

describe('deduplicateLines', () => {
  it('merges identical horizontal lines', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('merges overlapping horizontal lines at the same y', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.3, x2: 0.5, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.4, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('merges adjacent horizontal lines within tolerance', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.502, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0.1)
    expect(result[0].x2).toBeCloseTo(0.9)
  })

  it('keeps non-overlapping horizontal lines separate', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.6, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(2)
  })

  it('merges identical vertical lines', () => {
    const lines: LineSegment[] = [
      { x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.8, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.8, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
  })

  it('merges lines at nearly the same y (within snap tolerance)', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.200, x2: 0.9, y2: 0.200, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.202, x2: 0.9, y2: 0.202, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
  })

  it('keeps the wider lineWidth when merging', () => {
    const lines: LineSegment[] = [
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 3, page: 1, orientation: 'horizontal' },
    ]
    const result = deduplicateLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lineWidth).toBe(3)
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateLines([])).toHaveLength(0)
  })
})
