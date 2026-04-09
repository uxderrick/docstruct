import { describe, it, expect } from 'vitest'
import { extractParagraphs } from '../../src/extractors/paragraphs.js'
import { createDocumentIR, createTextElement } from '../../src/ir.js'

function makeIR(lines: string[]) {
  const elements = lines.map((text, i) =>
    createTextElement(text, 0, i * 0.1, 1, 0.05)
  )
  return createDocumentIR(elements, 'text', 1, lines.join('\n'))
}

describe('extractParagraphs', () => {
  it('groups consecutive unclaimed elements into paragraphs', () => {
    const ir = makeIR(['First sentence.', 'Second sentence.'])
    const paragraphs = extractParagraphs(ir)

    expect(paragraphs).toEqual(['First sentence. Second sentence.'])
  })

  it('splits paragraphs on large y-gaps', () => {
    const elements = [
      createTextElement('Paragraph one line one.', 0, 0.0, 1, 0.02),
      createTextElement('Paragraph one line two.', 0, 0.03, 1, 0.02),
      createTextElement('Paragraph two line one.', 0, 0.15, 1, 0.02),
    ]
    const ir = createDocumentIR(elements, 'text', 1)
    const paragraphs = extractParagraphs(ir)

    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toBe('Paragraph one line one. Paragraph one line two.')
    expect(paragraphs[1]).toBe('Paragraph two line one.')
  })

  it('skips claimed elements', () => {
    const ir = makeIR(['Claimed line', 'Free line one', 'Free line two'])
    ir.elements[0].claimed = true
    const paragraphs = extractParagraphs(ir)

    expect(paragraphs).toEqual(['Free line one Free line two'])
  })

  it('returns empty array when all elements claimed', () => {
    const ir = makeIR(['Claimed'])
    ir.elements[0].claimed = true
    const paragraphs = extractParagraphs(ir)

    expect(paragraphs).toEqual([])
  })

  it('claims matched elements', () => {
    const ir = makeIR(['A sentence.'])
    extractParagraphs(ir)

    expect(ir.elements[0].claimed).toBe(true)
  })
})
