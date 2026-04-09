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

  it('detects dense table using header-anchored columns', () => {
    const elements = [
      createTextElement('DATE', 0.05, 0.1, 0.08, 0.02),
      createTextElement('NAME', 0.20, 0.1, 0.08, 0.02),
      createTextElement('TYPE', 0.40, 0.1, 0.06, 0.02),
      createTextElement('AMOUNT', 0.55, 0.1, 0.08, 0.02),
      createTextElement('BALANCE', 0.75, 0.1, 0.08, 0.02),
      createTextElement('Jan 3', 0.05, 0.15, 0.06, 0.02),
      createTextElement('Alice Smith', 0.18, 0.15, 0.10, 0.02),
      createTextElement('TRANSFER', 0.38, 0.15, 0.08, 0.02),
      createTextElement('120.00', 0.58, 0.15, 0.05, 0.02),
      createTextElement('880.00', 0.78, 0.15, 0.05, 0.02),
      createTextElement('Jan 5', 0.05, 0.20, 0.06, 0.02),
      createTextElement('Bob Jones', 0.19, 0.20, 0.09, 0.02),
      createTextElement('PAYMENT', 0.39, 0.20, 0.07, 0.02),
      createTextElement('45.50', 0.59, 0.20, 0.04, 0.02),
      createTextElement('834.50', 0.77, 0.20, 0.05, 0.02),
    ]
    const ir = createDocumentIR(elements, 'pdf', 1)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['DATE', 'NAME', 'TYPE', 'AMOUNT', 'BALANCE'])
    expect(tables[0].rows).toHaveLength(2)
    expect(tables[0].rows[0]).toEqual(['Jan 3', 'Alice Smith', 'TRANSFER', '120.00', '880.00'])
    expect(tables[0].rows[1]).toEqual(['Jan 5', 'Bob Jones', 'PAYMENT', '45.50', '834.50'])
  })

  it('falls back to x-clustering when no header row detected', () => {
    const elements = [
      createTextElement('Date', 0.05, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Amount', 0.30, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Status', 0.55, 0.1, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Jan 3', 0.05, 0.15, 0.1, 0.02),
      createTextElement('120.00', 0.30, 0.15, 0.1, 0.02),
      createTextElement('Paid', 0.55, 0.15, 0.1, 0.02),
      createTextElement('Jan 5', 0.05, 0.20, 0.1, 0.02),
      createTextElement('45.50', 0.30, 0.20, 0.1, 0.02),
      createTextElement('Pending', 0.55, 0.20, 0.1, 0.02),
    ]
    const ir = createDocumentIR(elements, 'pdf', 1)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['Date', 'Amount', 'Status'])
    expect(tables[0].rows).toHaveLength(2)
  })

  it('handles header-anchored table with multi-word cell values', () => {
    const elements = [
      createTextElement('NAME', 0.05, 0.1, 0.06, 0.02),
      createTextElement('ACCOUNT', 0.25, 0.1, 0.08, 0.02),
      createTextElement('TYPE', 0.50, 0.1, 0.05, 0.02),
      createTextElement('REF', 0.75, 0.1, 0.04, 0.02),
      createTextElement('Derrick Tsorme', 0.04, 0.15, 0.12, 0.02),
      createTextElement('53907613', 0.26, 0.15, 0.06, 0.02),
      createTextElement('TRANSFER', 0.48, 0.15, 0.08, 0.02),
      createTextElement('Food', 0.76, 0.15, 0.04, 0.02),
      createTextElement('VODAFONE PUSH OVA', 0.03, 0.20, 0.16, 0.02),
      createTextElement('54814522', 0.27, 0.20, 0.06, 0.02),
      createTextElement('PAYMENT', 0.49, 0.20, 0.07, 0.02),
      createTextElement('Pastry', 0.74, 0.20, 0.05, 0.02),
    ]
    const ir = createDocumentIR(elements, 'pdf', 1)
    const tables = extractTables(ir)

    expect(tables).toHaveLength(1)
    expect(tables[0].columns).toEqual(['NAME', 'ACCOUNT', 'TYPE', 'REF'])
    expect(tables[0].rows[0]).toEqual(['Derrick Tsorme', '53907613', 'TRANSFER', 'Food'])
    expect(tables[0].rows[1]).toEqual(['VODAFONE PUSH OVA', '54814522', 'PAYMENT', 'Pastry'])
  })
})
