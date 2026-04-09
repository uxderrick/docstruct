import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createTextElement, createDocumentIR, type DocumentIR, type TextElement } from '../ir.js'

export async function parsePdf(input: Buffer): Promise<DocumentIR> {
  const data = new Uint8Array(input)
  const pdf = await getDocument({ data, useSystemFonts: true }).promise
  const totalPages = pdf.numPages
  const allElements: TextElement[] = []
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
  }

  // If meaningful text found, return text-based IR
  if (totalTextLength > 10) {
    return createDocumentIR(allElements, 'pdf', totalPages)
  }

  // Fall back to OCR (lazy-loaded)
  // Note: Full OCR fallback requires rendering PDF pages to images,
  // which needs canvas support in Node. For V1, we return empty elements
  // with a warning for scanned PDFs. The image parser handles standalone images.
  return createDocumentIR([], 'pdf', totalPages)
}
