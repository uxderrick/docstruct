import { describe, it, expect } from 'vitest'
import { parseXlsx } from '../../src/parsers/xlsx.js'
import * as XLSX from 'xlsx'

function createTestWorkbook(data: string[][]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buffer)
}

describe('parseXlsx', () => {
  it('converts spreadsheet cells into positioned TextElements', () => {
    const data = [
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'London'],
    ]
    const buffer = createTestWorkbook(data)
    const ir = parseXlsx(buffer)

    expect(ir.sourceType).toBe('xlsx')
    expect(ir.pageCount).toBe(1)
    expect(ir.elements.length).toBe(9)
  })

  it('maps cell positions to normalized coordinates', () => {
    const data = [
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]
    const buffer = createTestWorkbook(data)
    const ir = parseXlsx(buffer)

    const a1 = ir.elements.find((el) => el.text === 'A1')!
    const b1 = ir.elements.find((el) => el.text === 'B1')!
    expect(a1.x).toBeLessThan(b1.x)

    const a2 = ir.elements.find((el) => el.text === 'A2')!
    expect(a1.y).toBeLessThan(a2.y)
  })

  it('skips empty cells', () => {
    const data = [
      ['Name', '', 'City'],
      ['Alice', '', 'NY'],
    ]
    const buffer = createTestWorkbook(data)
    const ir = parseXlsx(buffer)

    expect(ir.elements.every((el) => el.text.trim() !== '')).toBe(true)
  })

  it('handles empty workbook', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([[]])
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    const ir = parseXlsx(buffer)

    expect(ir.elements).toHaveLength(0)
  })
})
