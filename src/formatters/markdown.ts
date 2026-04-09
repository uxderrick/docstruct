import type { ParseResult } from '../types.js'

export function formatMarkdown(result: ParseResult): string {
  const sections: string[] = []

  if (result.tables.length > 0) {
    sections.push('## Tables\n')
    for (const table of result.tables) {
      const header = `| ${table.columns.join(' | ')} |`
      const separator = `| ${table.columns.map(() => '---').join(' | ')} |`
      const rows = table.rows.map((row) => `| ${row.join(' | ')} |`)
      sections.push([header, separator, ...rows].join('\n'))
      sections.push('')
    }
  }

  if (Object.keys(result.keyValues).length > 0) {
    sections.push('## Key-Values\n')
    for (const [key, value] of Object.entries(result.keyValues)) {
      sections.push(`**${key}:** ${value}`)
    }
    sections.push('')
  }

  if (result.paragraphs.length > 0) {
    sections.push('## Content\n')
    sections.push(result.paragraphs.join('\n\n'))
    sections.push('')
  }

  if (result.lists.length > 0) {
    sections.push('## Lists\n')
    for (const list of result.lists) {
      for (const item of list) {
        sections.push(`- ${item}`)
      }
      sections.push('')
    }
  }

  return sections.join('\n').trim()
}
