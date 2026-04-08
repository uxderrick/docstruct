import { createTextElement, createDocumentIR, type DocumentIR } from '../ir.js'

export function parseText(input: string | Buffer): DocumentIR {
  const text = typeof input === 'string' ? input : input.toString('utf-8')
  const lines = text.split('\n')
  const totalLines = lines.length
  const elements = []

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i]
    if (line.trim() === '') continue

    elements.push(
      createTextElement(
        line,
        0,
        totalLines <= 1 ? 0 : i / (totalLines - 1),
        1,
        totalLines <= 1 ? 1 : 1 / totalLines
      )
    )
  }

  return createDocumentIR(elements, 'text', 1, text)
}
