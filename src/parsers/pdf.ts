import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createTextElement, createDocumentIR, type DocumentIR, type TextElement, type LineSegment } from '../ir.js'
import { extractLinesFromOps } from './pdf-lines.js'

export async function parsePdf(input: Buffer): Promise<DocumentIR> {
  const data = new Uint8Array(input)
  const pdf = await getDocument({ data, useSystemFonts: true }).promise
  const totalPages = pdf.numPages
  const allElements: TextElement[] = []
  const allLines: LineSegment[] = []
  let totalTextLength = 0

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1.0 })

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue

      const tx = item.transform
      const x = tx[4] / viewport.width
      const y = 1 - tx[5] / viewport.height
      const width = item.width / viewport.width
      const height = item.height / viewport.height

      allElements.push(
        createTextElement(item.str.trim(), x, y, width, height, {
          page: i,
          font: {
            size: item.height || 12,
            bold: (item.fontName?.toLowerCase().includes('bold')) ?? false,
          },
        })
      )
      totalTextLength += item.str.trim().length
    }

    // Extract lines from operator list
    try {
      const opList = await page.getOperatorList()
      const pageLines = extractLinesFromOps(
        opList.fnArray,
        opList.argsArray,
        viewport.width,
        viewport.height,
        i
      )
      allLines.push(...pageLines)
    } catch {
      // If operator list extraction fails, continue without lines
    }
  }

  // If meaningful text found, return text-based IR
  if (totalTextLength > 10) {
    return createDocumentIR(allElements, 'pdf', totalPages, undefined, allLines.length > 0 ? allLines : undefined)
  }

  // Fall back to OCR (lazy-loaded)
  // Note: Full OCR fallback requires rendering PDF pages to images,
  // which needs canvas support in Node. For V1, we return empty elements
  // with a warning for scanned PDFs. The image parser handles standalone images.
  return createDocumentIR([], 'pdf', totalPages)
}
