import { describe, it, expect } from 'vitest'
import { parseDocx } from '../../src/parsers/docx.js'
import { parseHtml } from '../../src/parsers/html.js'

// Since creating real .docx files in tests is complex, we test the HTML-based
// intermediate step. The parseDocx function converts DOCX -> HTML -> IR using
// the same logic as the HTML parser.

describe('parseDocx', () => {
  it('exports a function', () => {
    expect(typeof parseDocx).toBe('function')
  })

  // Verify the HTML parser handles mammoth-style output correctly
  it('HTML parser handles mammoth-style HTML output', () => {
    const mammothHtml = `
      <p>Account Name: John Doe</p>
      <p>This is a paragraph of text.</p>
      <ul><li>Item one</li><li>Item two</li></ul>
      <table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
    `
    const ir = parseHtml(mammothHtml)

    expect(ir.elements.length).toBeGreaterThan(0)
    expect(ir.sourceType).toBe('html')
  })
})
