import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { parseDoc } from '../src/index.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const testDir = join(tmpdir(), 'docstruct-test-' + Date.now())

describe('parseDoc', () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('parses a plain text file to JSON', async () => {
    const filePath = join(testDir, 'test.txt')
    writeFileSync(filePath, 'Name: Steve\nAccount: 1234\n\n- Item one\n- Item two\n\nA paragraph of text.')

    const result = await parseDoc(filePath, { output: 'json' })

    expect(result).toHaveProperty('keyValues')
    expect(result).toHaveProperty('lists')
    expect(result).toHaveProperty('paragraphs')
    expect(result).toHaveProperty('warnings')
    expect(result).toHaveProperty('metadata')

    const json = result as Record<string, unknown>
    expect(json.metadata).toEqual({
      sourceType: 'text',
      pages: 1,
      extractionMethod: 'text',
    })
  })

  it('parses a buffer with type hint', async () => {
    const buffer = Buffer.from('Name: Jane\n\n1. First\n2. Second')
    const result = await parseDoc(buffer, { type: 'text', output: 'json' })

    const json = result as Record<string, unknown>
    expect(json.keyValues).toHaveProperty('name')
  })

  it('returns CSV string when output is csv', async () => {
    const filePath = join(testDir, 'test2.txt')
    writeFileSync(filePath, 'Name: Steve')

    const result = await parseDoc(filePath, { output: 'csv' })
    expect(typeof result).toBe('string')
    expect(result as string).toContain('name,Steve')
  })

  it('returns Markdown string when output is markdown', async () => {
    const filePath = join(testDir, 'test3.txt')
    writeFileSync(filePath, 'Name: Steve')

    const result = await parseDoc(filePath, { output: 'markdown' })
    expect(typeof result).toBe('string')
    expect(result as string).toContain('**name:** Steve')
  })

  it('respects extract filter', async () => {
    const filePath = join(testDir, 'test4.txt')
    writeFileSync(filePath, 'Name: Steve\n\n- Item one\n- Item two\n\nA paragraph.')

    const result = (await parseDoc(filePath, {
      output: 'json',
      extract: ['keyValues'],
    })) as Record<string, unknown>

    expect(Object.keys(result.keyValues as object).length).toBeGreaterThan(0)
    expect(result.lists).toEqual([])
    expect(result.paragraphs).toEqual([])
  })

  it('throws on unsupported file type', async () => {
    const filePath = join(testDir, 'test.xyz')
    writeFileSync(filePath, 'content')

    await expect(parseDoc(filePath)).rejects.toThrow()
  })

  it('throws when buffer has no type', async () => {
    const buffer = Buffer.from('hello')
    await expect(parseDoc(buffer)).rejects.toThrow()
  })
})
