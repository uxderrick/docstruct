import { describe, it, expect } from 'vitest'
import { findIntersections, buildGridCells, assignTextToCells, deduplicateLines, clusterLines, detectMergedCells } from '../../src/extractors/lattice.js'
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

describe('clusterLines', () => {
  it('returns one cluster when all lines form a single table', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.15, x2: 0.9, y2: 0.15, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].hLines).toHaveLength(3)
    expect(clusters[0].vLines).toHaveLength(2)
  })

  it('splits into two clusters when there is a large gap', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.15, x2: 0.9, y2: 0.15, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.6, x2: 0.9, y2: 0.6, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.65, x2: 0.9, y2: 0.65, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.7, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.1, y1: 0.6, x2: 0.1, y2: 0.7, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.6, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(2)
    expect(clusters[0].hLines).toHaveLength(3)
    expect(clusters[0].vLines).toHaveLength(2)
    expect(clusters[1].hLines).toHaveLength(3)
    expect(clusters[1].vLines).toHaveLength(2)
  })

  it('assigns vertical lines spanning both clusters to each cluster they overlap', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.7, x2: 0.9, y2: 0.7, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.8, x2: 0.9, y2: 0.8, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.5, y1: 0.05, x2: 0.5, y2: 0.85, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(2)
    expect(clusters[0].vLines).toHaveLength(1)
    expect(clusters[1].vLines).toHaveLength(1)
  })

  it('returns one cluster for only two horizontal lines', () => {
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const clusters = clusterLines(hLines, vLines)
    expect(clusters).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    const clusters = clusterLines([], [])
    expect(clusters).toHaveLength(0)
  })
})

describe('detectMergedCells', () => {
  it('does nothing when all internal borders exist', () => {
    const cells = [
      { left: 0.1, top: 0.1, right: 0.5, bottom: 0.3, row: 0, col: 0 },
      { left: 0.5, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 1 },
      { left: 0.1, top: 0.3, right: 0.5, bottom: 0.5, row: 1, col: 0 },
      { left: 0.5, top: 0.3, right: 0.9, bottom: 0.5, row: 1, col: 1 },
    ]
    const cellText = new Map([
      ['0-0', 'A'], ['0-1', 'B'],
      ['1-0', 'C'], ['1-1', 'D'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('A')
    expect(result.get('0-1')).toBe('B')
    expect(result.get('1-0')).toBe('C')
    expect(result.get('1-1')).toBe('D')
  })

  it('merges horizontally when vertical border is missing', () => {
    const cells = [
      { left: 0.1, top: 0.1, right: 0.4, bottom: 0.3, row: 0, col: 0 },
      { left: 0.4, top: 0.1, right: 0.7, bottom: 0.3, row: 0, col: 1 },
      { left: 0.7, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 2 },
    ]
    const cellText = new Map([
      ['0-0', 'Merged Header'],
      ['0-2', 'Solo'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('Merged Header')
    expect(result.get('0-1')).toBe('')
    expect(result.get('0-2')).toBe('Solo')
  })

  it('merges vertically when horizontal border is missing', () => {
    const cells = [
      { left: 0.1, top: 0.1, right: 0.9, bottom: 0.3, row: 0, col: 0 },
      { left: 0.1, top: 0.3, right: 0.9, bottom: 0.5, row: 1, col: 0 },
    ]
    const cellText = new Map([
      ['0-0', 'Top'],
      ['1-0', 'Bottom'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.5, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('Top Bottom')
    expect(result.get('1-0')).toBe('')
  })

  it('merges a header spanning all 3 columns', () => {
    const cells = [
      { left: 0.1, top: 0.1, right: 0.4, bottom: 0.2, row: 0, col: 0 },
      { left: 0.4, top: 0.1, right: 0.7, bottom: 0.2, row: 0, col: 1 },
      { left: 0.7, top: 0.1, right: 0.9, bottom: 0.2, row: 0, col: 2 },
      { left: 0.1, top: 0.2, right: 0.4, bottom: 0.3, row: 1, col: 0 },
      { left: 0.4, top: 0.2, right: 0.7, bottom: 0.3, row: 1, col: 1 },
      { left: 0.7, top: 0.2, right: 0.9, bottom: 0.3, row: 1, col: 2 },
    ]
    const cellText = new Map([
      ['0-0', 'Report Title'],
      ['1-0', 'Name'], ['1-1', 'Age'], ['1-2', 'City'],
    ])
    const hLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const vLines: LineSegment[] = [
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.7, y1: 0.2, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]
    const result = detectMergedCells(cells, cellText, hLines, vLines)
    expect(result.get('0-0')).toBe('Report Title')
    expect(result.get('0-1')).toBe('')
    expect(result.get('0-2')).toBe('')
    expect(result.get('1-0')).toBe('Name')
    expect(result.get('1-1')).toBe('Age')
    expect(result.get('1-2')).toBe('City')
  })

  it('returns unchanged map when no cells provided', () => {
    const cellText = new Map<string, string>()
    const result = detectMergedCells([], cellText, [], [])
    expect(result.size).toBe(0)
  })
})
