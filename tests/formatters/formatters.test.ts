import { describe, it, expect } from 'vitest'
import { formatJson } from '../../src/formatters/json.js'
import { formatCsv } from '../../src/formatters/csv.js'
import { formatMarkdown } from '../../src/formatters/markdown.js'
import type { ParseResult } from '../../src/types.js'

const sampleResult: ParseResult = {
  tables: [
    {
      columns: ['Date', 'Amount'],
      rows: [
        ['2024-01-03', '120.00'],
        ['2024-01-05', '45.50'],
      ],
    },
  ],
  keyValues: { name: 'Steve', account: '1234' },
  paragraphs: ['First paragraph.', 'Second paragraph.'],
  lists: [['Item A', 'Item B']],
  warnings: [],
  metadata: { sourceType: 'text', pages: 1, extractionMethod: 'text' },
}

describe('formatJson', () => {
  it('returns the ParseResult object as-is', () => {
    const result = formatJson(sampleResult)
    expect(result).toBe(sampleResult)
  })
})

describe('formatCsv', () => {
  it('formats tables with headers and rows', () => {
    const csv = formatCsv(sampleResult)
    expect(csv).toContain('Date,Amount')
    expect(csv).toContain('2024-01-03,120.00')
    expect(csv).toContain('2024-01-05,45.50')
  })

  it('formats key-values as two columns', () => {
    const csv = formatCsv(sampleResult)
    expect(csv).toContain('name,Steve')
    expect(csv).toContain('account,1234')
  })

  it('includes paragraphs section', () => {
    const csv = formatCsv(sampleResult)
    expect(csv).toContain('First paragraph.')
    expect(csv).toContain('Second paragraph.')
  })

  it('includes lists section', () => {
    const csv = formatCsv(sampleResult)
    expect(csv).toContain('Item A')
    expect(csv).toContain('Item B')
  })
})

describe('formatMarkdown', () => {
  it('formats tables as pipe-delimited markdown', () => {
    const md = formatMarkdown(sampleResult)
    expect(md).toContain('| Date | Amount |')
    expect(md).toContain('| --- | --- |')
    expect(md).toContain('| 2024-01-03 | 120.00 |')
  })

  it('formats key-values as bold key with value', () => {
    const md = formatMarkdown(sampleResult)
    expect(md).toContain('**name:** Steve')
    expect(md).toContain('**account:** 1234')
  })

  it('formats paragraphs as plain text blocks', () => {
    const md = formatMarkdown(sampleResult)
    expect(md).toContain('First paragraph.')
    expect(md).toContain('Second paragraph.')
  })

  it('formats lists as markdown lists', () => {
    const md = formatMarkdown(sampleResult)
    expect(md).toContain('- Item A')
    expect(md).toContain('- Item B')
  })
})
