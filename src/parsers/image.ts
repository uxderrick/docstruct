import { createDocumentIR, type DocumentIR } from '../ir.js'
import { ocrImage } from './ocr.js'

export async function parseImage(input: Buffer): Promise<DocumentIR> {
  const elements = await ocrImage(input)
  return createDocumentIR(elements, 'image', 1)
}
