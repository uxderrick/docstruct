import mammoth from 'mammoth'
import { parseHtml } from './html.js'
import type { DocumentIR } from '../ir.js'

export async function parseDocx(input: Buffer): Promise<DocumentIR> {
  const result = await mammoth.convertToHtml({ buffer: input })
  const ir = parseHtml(result.value)

  // Override sourceType since this came from a DOCX
  return {
    ...ir,
    sourceType: 'docx',
  }
}
