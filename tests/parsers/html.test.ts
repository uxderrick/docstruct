import { describe, it, expect } from 'vitest'
import { parseHtml } from '../../src/parsers/html.js'

describe('parseHtml', () => {
  it('extracts text from HTML paragraphs', () => {
    const html = '<html><body><p>Hello World</p><p>Second paragraph</p></body></html>'
    const ir = parseHtml(Buffer.from(html))

    expect(ir.sourceType).toBe('html')
    expect(ir.elements.length).toBeGreaterThanOrEqual(2)
    expect(ir.elements.some((el) => el.text === 'Hello World')).toBe(true)
    expect(ir.elements.some((el) => el.text === 'Second paragraph')).toBe(true)
  })

  it('preserves table structure in raw HTML', () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Age</th></tr>
        <tr><td>Alice</td><td>30</td></tr>
      </table>`
    const ir = parseHtml(Buffer.from(html))

    expect(ir.raw).toContain('<table>')
    expect(ir.elements.some((el) => el.text.includes('Name'))).toBe(true)
  })

  it('extracts list items', () => {
    const html = '<ul><li>Item one</li><li>Item two</li></ul>'
    const ir = parseHtml(Buffer.from(html))

    expect(ir.elements.some((el) => el.text.includes('Item one'))).toBe(true)
    expect(ir.elements.some((el) => el.text.includes('Item two'))).toBe(true)
  })

  it('handles empty HTML', () => {
    const ir = parseHtml(Buffer.from('<html><body></body></html>'))
    expect(ir.elements).toHaveLength(0)
  })

  it('accepts string input', () => {
    const ir = parseHtml('<p>Hello</p>')
    expect(ir.elements.length).toBeGreaterThanOrEqual(1)
  })
})
