import * as cheerio from 'cheerio'
import { createTextElement, createDocumentIR, type DocumentIR } from '../ir.js'

export function parseHtml(input: string | Buffer): DocumentIR {
  const html = typeof input === 'string' ? input : input.toString('utf-8')
  const $ = cheerio.load(html)
  const elements = []
  let yPosition = 0
  const yStep = 0.02

  // Process tables — emit each row as pipe-delimited for table extractor
  $('table').each((_, table) => {
    const rows = $(table).find('tr')
    rows.each((_, tr) => {
      const cells: string[] = []
      $(tr).find('th, td').each((_, cell) => {
        cells.push($(cell).text().trim())
      })
      if (cells.length > 0) {
        const pipeRow = `| ${cells.join(' | ')} |`
        elements.push(createTextElement(pipeRow, 0, yPosition, 1, yStep))
        yPosition += yStep
      }
    })
    yPosition += yStep
  })

  // Process lists — emit with markers for list extractor
  $('ul, ol').each((_, list) => {
    const isOrdered = $(list).is('ol')
    $(list).find('> li').each((i, li) => {
      const text = $(li).text().trim()
      if (text) {
        const marker = isOrdered ? `${i + 1}. ` : '- '
        elements.push(createTextElement(marker + text, 0, yPosition, 1, yStep))
        yPosition += yStep
      }
    })
    yPosition += yStep
  })

  // Process definition lists as key-value pairs
  $('dl').each((_, dl) => {
    const terms = $(dl).find('dt')
    terms.each((_, dt) => {
      const key = $(dt).text().trim()
      const dd = $(dt).next('dd')
      const value = dd.length ? dd.text().trim() : ''
      if (key && value) {
        elements.push(createTextElement(`${key}: ${value}`, 0, yPosition, 1, yStep))
        yPosition += yStep
      }
    })
  })

  // Process paragraphs and other text — skip elements already covered
  $('p, h1, h2, h3, h4, h5, h6, div, span, blockquote')
    .not('table *, ul *, ol *, dl *')
    .each((_, el) => {
      const text = $(el).text().trim()
      if (text && !elements.some((e) => e.text.includes(text))) {
        elements.push(createTextElement(text, 0, yPosition, 1, yStep))
        yPosition += yStep
      }
    })

  return createDocumentIR(elements, 'html', 1, html)
}
