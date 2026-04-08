export type OutputFormat = 'json' | 'csv' | 'markdown'

export type SourceType = 'pdf' | 'image' | 'text' | 'docx' | 'xlsx' | 'html'

export type ExtractTarget = 'tables' | 'keyValues' | 'paragraphs' | 'lists'

export interface ParseOptions {
  output?: OutputFormat
  extract?: ExtractTarget[]
  type?: SourceType
}

export interface Table {
  columns: string[]
  rows: string[][]
}

export interface Metadata {
  sourceType: SourceType
  pages: number
  extractionMethod: 'text' | 'ocr' | 'direct'
}

export interface ParseResult {
  tables: Table[]
  keyValues: Record<string, string>
  paragraphs: string[]
  lists: string[][]
  warnings: string[]
  metadata: Metadata
}
