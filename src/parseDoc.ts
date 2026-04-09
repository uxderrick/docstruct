import { readFile } from 'fs/promises'
import { extname } from 'path'
import type { ParseOptions, ParseResult, SourceType, ExtractTarget, Metadata } from './types.js'
import { extractStructures } from './extract.js'
import { formatJson } from './formatters/json.js'
import { formatCsv } from './formatters/csv.js'
import { formatMarkdown } from './formatters/markdown.js'
import { parseText } from './parsers/text.js'
import { parseHtml } from './parsers/html.js'
import { parseXlsx } from './parsers/xlsx.js'
import type { DocumentIR } from './ir.js'

const EXTENSION_MAP: Record<string, SourceType> = {
  '.pdf': 'pdf',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.txt': 'text',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.html': 'html',
  '.htm': 'html',
}

const ALL_TARGETS: ExtractTarget[] = ['tables', 'keyValues', 'paragraphs', 'lists']

function detectSourceType(filePath: string): SourceType {
  const ext = extname(filePath).toLowerCase()
  const sourceType = EXTENSION_MAP[ext]
  if (!sourceType) {
    throw new Error(`Unsupported file type: ${ext}`)
  }
  return sourceType
}

async function loadInput(
  input: string | Buffer,
  type?: SourceType
): Promise<{ data: Buffer; sourceType: SourceType }> {
  if (Buffer.isBuffer(input)) {
    if (!type) {
      throw new Error('type option is required when input is a Buffer')
    }
    return { data: input, sourceType: type }
  }

  const sourceType = type ?? detectSourceType(input)
  const data = await readFile(input)
  return { data, sourceType }
}

async function parseToIR(data: Buffer, sourceType: SourceType): Promise<DocumentIR> {
  switch (sourceType) {
    case 'text':
      return parseText(data)
    case 'html':
      return parseHtml(data)
    case 'xlsx':
      return parseXlsx(data)
    case 'pdf':
    case 'image':
    case 'docx':
      throw new Error(`Parser for ${sourceType} not yet implemented`)
    default:
      throw new Error(`Unknown source type: ${sourceType}`)
  }
}

export async function parseDoc(
  input: string | Buffer,
  options: ParseOptions = {}
): Promise<ParseResult | string> {
  const { output = 'json', extract = ALL_TARGETS, type } = options
  const { data, sourceType } = await loadInput(input, type)

  const ir = await parseToIR(data, sourceType)

  const metadata: Metadata = {
    sourceType,
    pages: ir.pageCount,
    extractionMethod: 'text',
  }

  const result = extractStructures(ir, extract, metadata)

  switch (output) {
    case 'json':
      return formatJson(result)
    case 'csv':
      return formatCsv(result)
    case 'markdown':
      return formatMarkdown(result)
    default:
      return formatJson(result)
  }
}
