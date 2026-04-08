import { describe, it, expect } from 'vitest'
import { parseText } from '../../src/parsers/text.js'

describe('parseText', () => {
  it('converts plain text lines into TextElements with line-based y-positions', () => {
    const input = 'Hello World\nSecond line\nThird line'
    const ir = parseText(input)

    expect(ir.sourceType).toBe('text')
    expect(ir.pageCount).toBe(1)
    expect(ir.raw).toBe(input)
    expect(ir.elements).toHaveLength(3)
    expect(ir.elements[0].text).toBe('Hello World')
    expect(ir.elements[0].y).toBeCloseTo(0)
    expect(ir.elements[1].text).toBe('Second line')
    expect(ir.elements[1].y).toBeCloseTo(1 / 2)
    expect(ir.elements[2].text).toBe('Third line')
    expect(ir.elements[2].y).toBeCloseTo(2 / 2)
  })

  it('handles empty input', () => {
    const ir = parseText('')
    expect(ir.elements).toHaveLength(0)
    expect(ir.raw).toBe('')
  })

  it('handles single line input', () => {
    const ir = parseText('Just one line')
    expect(ir.elements).toHaveLength(1)
    expect(ir.elements[0].text).toBe('Just one line')
    expect(ir.elements[0].y).toBe(0)
  })

  it('skips blank lines but preserves y-spacing', () => {
    const input = 'Line one\n\nLine three'
    const ir = parseText(input)

    expect(ir.elements).toHaveLength(2)
    expect(ir.elements[0].text).toBe('Line one')
    expect(ir.elements[0].y).toBeCloseTo(0)
    expect(ir.elements[1].text).toBe('Line three')
    expect(ir.elements[1].y).toBeCloseTo(2 / 2)
  })

  it('accepts a Buffer input', () => {
    const buffer = Buffer.from('Hello from buffer')
    const ir = parseText(buffer)
    expect(ir.elements).toHaveLength(1)
    expect(ir.elements[0].text).toBe('Hello from buffer')
  })
})
