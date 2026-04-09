import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { parseDoc } from '../../src/index.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const testDir = join(tmpdir(), 'docstruct-e2e-' + Date.now())

describe('End-to-end integration', () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('extracts all structure types from a complex text document', async () => {
    const content = [
      'Invoice Number: INV-2024-001',
      'Date: January 3, 2024',
      'Customer: Steve Mensah',
      '',
      'Thank you for your purchase. Please review the items below.',
      '',
      '| Item | Qty | Price |',
      '| --- | --- | --- |',
      '| Widget A | 2 | 25.00 |',
      '| Widget B | 1 | 45.00 |',
      '',
      'Notes:',
      '- All sales are final',
      '- Returns within 30 days',
      '- Contact support for issues',
      '',
      'Total amount due within 30 business days.',
    ].join('\n')

    const filePath = join(testDir, 'invoice.txt')
    writeFileSync(filePath, content)

    const result = (await parseDoc(filePath, { output: 'json' })) as Record<string, unknown>

    // Key-values extracted
    const kv = result.keyValues as Record<string, string>
    expect(kv['invoice number']).toBe('INV-2024-001')
    expect(kv['date']).toBe('January 3, 2024')
    expect(kv['customer']).toBe('Steve Mensah')

    // Table extracted
    const tables = result.tables as Array<{ columns: string[]; rows: string[][] }>
    expect(tables.length).toBeGreaterThanOrEqual(1)
    expect(tables[0].columns).toEqual(['Item', 'Qty', 'Price'])
    expect(tables[0].rows).toHaveLength(2)

    // Lists extracted
    const lists = result.lists as string[][]
    expect(lists.length).toBeGreaterThanOrEqual(1)
    expect(lists[0]).toContain('All sales are final')

    // Paragraphs extracted (remaining text)
    const paragraphs = result.paragraphs as string[]
    expect(paragraphs.length).toBeGreaterThanOrEqual(1)

    // Metadata
    const metadata = result.metadata as Record<string, unknown>
    expect(metadata.sourceType).toBe('text')
  })

  it('produces valid CSV output', async () => {
    const filePath = join(testDir, 'simple.txt')
    writeFileSync(filePath, 'Name: Alice\nRole: Engineer')

    const result = await parseDoc(filePath, { output: 'csv' })
    expect(typeof result).toBe('string')
    expect(result as string).toContain('name,Alice')
    expect(result as string).toContain('role,Engineer')
  })

  it('produces valid Markdown output', async () => {
    const filePath = join(testDir, 'simple2.txt')
    writeFileSync(filePath, '| A | B |\n| 1 | 2 |')

    const result = await parseDoc(filePath, { output: 'markdown' })
    expect(typeof result).toBe('string')
    expect(result as string).toContain('| A | B |')
    expect(result as string).toContain('| --- | --- |')
  })

  it('respects extract filter to only get tables', async () => {
    const filePath = join(testDir, 'filter.txt')
    writeFileSync(filePath, 'Name: Test\n\n| A | B |\n| 1 | 2 |\n\n- item')

    const result = (await parseDoc(filePath, {
      output: 'json',
      extract: ['tables'],
    })) as Record<string, unknown>

    const tables = result.tables as unknown[]
    expect(tables.length).toBeGreaterThanOrEqual(1)
    expect(result.keyValues).toEqual({})
    expect(result.lists).toEqual([])
    expect(result.paragraphs).toEqual([])
  })
})
