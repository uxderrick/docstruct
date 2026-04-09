import { describe, it, expect } from 'vitest'
import { extractTables } from '../../src/extractors/tables.js'
import { createTextElement, createDocumentIR, type LineSegment } from '../../src/ir.js'

describe('Lattice table extraction integration', () => {
  it('extracts a 2x3 table from lines and text elements', () => {
    // Simulate a simple table with 2 rows, 3 columns
    // Grid: x=[0.1, 0.4, 0.7, 0.95], y=[0.1, 0.2, 0.3]
    const lines: LineSegment[] = [
      // Horizontal lines
      { x1: 0.1, y1: 0.1, x2: 0.95, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.2, x2: 0.95, y2: 0.2, lineWidth: 1, page: 1, orientation: 'horizontal' },
      { x1: 0.1, y1: 0.3, x2: 0.95, y2: 0.3, lineWidth: 1, page: 1, orientation: 'horizontal' },
      // Vertical lines
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
      { x1: 0.95, y1: 0.1, x2: 0.95, y2: 0.3, lineWidth: 1, page: 1, orientation: 'vertical' },
    ]

    const elements = [
      // Header row
      createTextElement('Name', 0.15, 0.13, 0.1, 0.02, { page: 1 }),
      createTextElement('Age', 0.45, 0.13, 0.1, 0.02, { page: 1 }),
      createTextElement('City', 0.75, 0.13, 0.1, 0.02, { page: 1 }),
      // Data row
      createTextElement('Alice', 0.15, 0.23, 0.1, 0.02, { page: 1 }),
      createTextElement('30', 0.45, 0.23, 0.05, 0.02, { page: 1 }),
      createTextElement('Accra', 0.75, 0.23, 0.1, 0.02, { page: 1 }),
    ]

    const ir = createDocumentIR(elements, 'pdf', 1, undefined, lines)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Name', 'Age', 'City'])
    expect(tables[0].rows).toEqual([['Alice', '30', 'Accra']])
  })

  it('falls back to spatial when no lines present', () => {
    const elements = [
      createTextElement('| A | B |', 0, 0, 1, 0.05),
      createTextElement('| 1 | 2 |', 0, 0.1, 1, 0.05),
    ]

    const ir = createDocumentIR(elements, 'text', 1)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['A', 'B'])
  })

  it('does not interfere with non-PDF formats', () => {
    const elements = [
      createTextElement('Name: Steve', 0, 0, 1, 0.05),
    ]
    const ir = createDocumentIR(elements, 'text', 1)

    const tables = extractTables(ir)
    expect(tables).toHaveLength(0)
  })
})
