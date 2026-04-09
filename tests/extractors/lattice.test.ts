import { describe, it, expect } from 'vitest'
import { findIntersections, buildGridCells, assignTextToCells } from '../../src/extractors/lattice.js'
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
