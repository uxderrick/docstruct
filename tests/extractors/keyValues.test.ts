import { describe, it, expect } from 'vitest'
import { extractKeyValues } from '../../src/extractors/keyValues.js'
import { createDocumentIR, createTextElement } from '../../src/ir.js'

function makeIR(lines: string[]) {
  const elements = lines.map((text, i) =>
    createTextElement(text, 0, i / Math.max(lines.length - 1, 1), 1, 0.05)
  )
  return createDocumentIR(elements, 'text', 1, lines.join('\n'))
}

describe('extractKeyValues', () => {
  it('detects colon-separated key-value pairs', () => {
    const ir = makeIR(['Name: Steve Mensah', 'Account: 1234567890'])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({
      name: 'Steve Mensah',
      account: '1234567890',
    })
  })

  it('detects equals-separated key-value pairs', () => {
    const ir = makeIR(['Status = Active', 'Priority = High'])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({
      status: 'Active',
      priority: 'High',
    })
  })

  it('ignores lines that are not key-value pairs', () => {
    const ir = makeIR([
      'Name: John',
      'This is a regular paragraph.',
      'Date: 2024-01-01',
    ])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({
      name: 'John',
      date: '2024-01-01',
    })
  })

  it('handles keys with multiple words', () => {
    const ir = makeIR(['Full Name: Jane Doe', 'Account Number: 9876'])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({
      'full name': 'Jane Doe',
      'account number': '9876',
    })
  })

  it('does not match lines where colon appears mid-sentence', () => {
    const ir = makeIR(['Please note: this is important information that spans a long line of text.'])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({})
  })

  it('claims matched elements', () => {
    const ir = makeIR(['Name: Steve', 'A paragraph.'])
    extractKeyValues(ir)

    expect(ir.elements[0].claimed).toBe(true)
    expect(ir.elements[1].claimed).toBe(false)
  })

  it('detects spatial key-value pairs from bold elements', () => {
    const elements = [
      createTextElement('Name', 0.05, 0.1, 0.15, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Steve Mensah', 0.25, 0.1, 0.3, 0.02, { font: { size: 12, bold: false } }),
      createTextElement('Date', 0.05, 0.15, 0.1, 0.02, { font: { size: 12, bold: true } }),
      createTextElement('Jan 3, 2024', 0.25, 0.15, 0.2, 0.02, { font: { size: 12, bold: false } }),
    ]
    const ir = createDocumentIR(elements, 'pdf', 1)
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({
      name: 'Steve Mensah',
      date: 'Jan 3, 2024',
    })
  })

  it('returns empty object when no key-values found', () => {
    const ir = makeIR(['Just a paragraph.', 'Another line.'])
    const kv = extractKeyValues(ir)

    expect(kv).toEqual({})
  })
})
