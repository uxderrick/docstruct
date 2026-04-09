import { describe, it, expect } from 'vitest'
import { extractTables } from '../../src/extractors/tables.js'
import { createDocumentIR, createTextElement } from '../../src/ir.js'
import type { Table } from '../../src/types.js'

function makeIR(lines: string[]) {
  const elements = lines.map((text, i) =>
    createTextElement(text, 0, i / Math.max(lines.length - 1, 1), 1, 0.05)
  )
  return createDocumentIR(elements, 'text', 1, lines.join('\n'))
}

describe('extractTables', () => {
  it('detects pipe-delimited table', () => {
    const ir = makeIR([
      '| Date | Description | Amount |',
      '| --- | --- | --- |',
      '| 2024-01-03 | Electricity Bill | 120.00 |',
      '| 2024-01-05 | Grocery Store | 45.50 |',
    ])
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Date', 'Description', 'Amount'])
    expect(tables[0].rows).toEqual([
      ['2024-01-03', 'Electricity Bill', '120.00'],
      ['2024-01-05', 'Grocery Store', '45.50'],
    ])
  })

  it('detects pipe-delimited table without separator row', () => {
    const ir = makeIR([
      '| Name | Age |',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ])
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Name', 'Age'])
    expect(tables[0].rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ])
  })

  it('detects tab-separated table', () => {
    const ir = makeIR([
      'Name\tAge\tCity',
      'Alice\t30\tNew York',
      'Bob\t25\tLondon',
    ])
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Name', 'Age', 'City'])
    expect(tables[0].rows).toEqual([
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'London'],
    ])
  })

  it('detects column-aligned table from spatial elements', () => {
    const elements = [
      // Header row
      createTextElement('Date', 0.05, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Amount', 0.30, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Status', 0.55, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      // Row 1
      createTextElement('Jan 3', 0.05, 0.15, 0.1, 0.02),
      createTextElement('120.00', 0.30, 0.15, 0.1, 0.02),
      createTextElement('Paid', 0.55, 0.15, 0.1, 0.02),
      // Row 2
      createTextElement('Jan 5', 0.05, 0.20, 0.1, 0.02),
      createTextElement('45.50', 0.30, 0.20, 0.1, 0.02),
      createTextElement('Pending', 0.55, 0.20, 0.1, 0.02),
    ]
    const ir = createDocumentIR(elements, 'pdf', 1)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Date', 'Amount', 'Status'])
    expect(tables[0].rows).toEqual([
      ['Jan 3', '120.00', 'Paid'],
      ['Jan 5', '45.50', 'Pending'],
    ])
  })

  it('returns empty array when no tables found', () => {
    const ir = makeIR(['Just a paragraph.', 'Another line.'])
    const tables = extractTables(ir)

    expect(tables).toHaveLength(0)
  })

  it('claims matched elements', () => {
    const ir = makeIR([
      '| A | B |',
      '| 1 | 2 |',
      'Not a table',
    ])
    extractTables(ir)

    expect(ir.elements[0].claimed).toBe(true)
    expect(ir.elements[1].claimed).toBe(true)
    expect(ir.elements[2].claimed).toBe(false)
  })
})
