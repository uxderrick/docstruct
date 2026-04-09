import { describe, it, expect } from 'vitest'
import { createDocumentIR, createTextElement, type LineSegment } from '../src/ir.js'

describe('DocumentIR with lines', () => {
  it('supports optional lines array', () => {
    const elements = [createTextElement('hello', 0, 0, 0.1, 0.02)]
    const lines: LineSegment[] = [
      { x1: 0, y1: 0.1, x2: 1, y2: 0.1, lineWidth: 1, page: 1, orientation: 'horizontal' },
    ]
    const ir = createDocumentIR(elements, 'pdf', 1, undefined, lines)

    expect(ir.lines).toHaveLength(1)
    expect(ir.lines![0].orientation).toBe('horizontal')
  })

  it('defaults lines to undefined when not provided', () => {
    const ir = createDocumentIR([], 'text', 1)
    expect(ir.lines).toBeUndefined()
  })
})
