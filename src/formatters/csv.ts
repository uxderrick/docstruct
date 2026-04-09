import type { ParseResult } from '../types.js'

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function csvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',')
}

export function formatCsv(result: ParseResult): string {
  const sections: string[] = []

  if (result.tables.length > 0) {
    sections.push('[Tables]')
    for (const table of result.tables) {
      sections.push(csvRow(table.columns))
      for (const row of table.rows) {
        sections.push(csvRow(row))
      }
      sections.push('')
    }
  }

  if (Object.keys(result.keyValues).length > 0) {
    sections.push('[Key-Values]')
    for (const [key, value] of Object.entries(result.keyValues)) {
      sections.push(csvRow([key, value]))
    }
    sections.push('')
  }

  if (result.paragraphs.length > 0) {
    sections.push('[Paragraphs]')
    for (const para of result.paragraphs) {
      sections.push(escapeCsvField(para))
    }
    sections.push('')
  }

  if (result.lists.length > 0) {
    sections.push('[Lists]')
    for (const list of result.lists) {
      for (const item of list) {
        sections.push(escapeCsvField(item))
      }
      sections.push('')
    }
  }

  return sections.join('\n').trim()
}
