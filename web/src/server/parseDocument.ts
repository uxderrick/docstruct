import { createServerFn } from '@tanstack/react-start'
import { parseDoc } from 'docstruct'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface ParseInput {
  data: string // base64-encoded file content
  fileName: string
}

interface ParseOutput {
  json: Record<string, unknown>
  csv: string
  markdown: string
}

export const parseDocument = createServerFn({ method: 'POST' })
  .handler(async ({ data: input }: { data: ParseInput }): Promise<ParseOutput> => {
    const dir = join(tmpdir(), 'docstruct-web')
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, input.fileName)

    try {
      // Write base64 data to temp file
      const buffer = Buffer.from(input.data, 'base64')
      writeFileSync(filePath, buffer)

      // Run parseDoc in all 3 output formats
      const jsonResult = await parseDoc(filePath, { output: 'json' })
      const csvResult = await parseDoc(filePath, { output: 'csv' })
      const markdownResult = await parseDoc(filePath, { output: 'markdown' })

      return {
        json: jsonResult as Record<string, unknown>,
        csv: csvResult as string,
        markdown: markdownResult as string,
      }
    } finally {
      // Clean up temp file
      try {
        unlinkSync(filePath)
      } catch {
        // ignore cleanup errors
      }
    }
  })
