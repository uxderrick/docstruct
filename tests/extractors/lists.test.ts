import { describe, it, expect } from 'vitest'
import { extractLists } from '../../src/extractors/lists.js'
import { createDocumentIR, createTextElement } from '../../src/ir.js'

function makeIR(lines: string[]) {
  const elements = lines.map((text, i) =>
    createTextElement(text, 0, i / Math.max(lines.length - 1, 1), 1, 0.05)
  )
  return createDocumentIR(elements, 'text', 1, lines.join('\n'))
}

describe('extractLists', () => {
  it('detects unordered list with dash markers', () => {
    const ir = makeIR(['- Item one', '- Item two', '- Item three'])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(1)
    expect(lists[0]).toEqual(['Item one', 'Item two', 'Item three'])
  })

  it('detects unordered list with asterisk markers', () => {
    const ir = makeIR(['* First', '* Second'])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(1)
    expect(lists[0]).toEqual(['First', 'Second'])
  })

  it('detects ordered list with number-dot markers', () => {
    const ir = makeIR(['1. First item', '2. Second item', '3. Third item'])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(1)
    expect(lists[0]).toEqual(['First item', 'Second item', 'Third item'])
  })

  it('detects ordered list with letter-paren markers', () => {
    const ir = makeIR(['a) Alpha', 'b) Beta', 'c) Charlie'])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(1)
    expect(lists[0]).toEqual(['Alpha', 'Beta', 'Charlie'])
  })

  it('splits separate lists on non-list gap', () => {
    const ir = makeIR([
      '- Item A',
      '- Item B',
      'Some paragraph text',
      '1. One',
      '2. Two',
    ])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(2)
    expect(lists[0]).toEqual(['Item A', 'Item B'])
    expect(lists[1]).toEqual(['One', 'Two'])
  })

  it('returns empty array when no lists found', () => {
    const ir = makeIR(['Just a paragraph.', 'Another line.'])
    const lists = extractLists(ir)

    expect(lists).toHaveLength(0)
  })

  it('claims matched elements', () => {
    const ir = makeIR(['- Item one', '- Item two', 'Not a list'])
    extractLists(ir)

    expect(ir.elements[0].claimed).toBe(true)
    expect(ir.elements[1].claimed).toBe(true)
    expect(ir.elements[2].claimed).toBe(false)
  })
})
