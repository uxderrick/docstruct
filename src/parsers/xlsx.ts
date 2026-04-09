import * as XLSX from 'xlsx'
import { createTextElement, createDocumentIR, type DocumentIR } from '../ir.js'

export function parseXlsx(input: Buffer): DocumentIR {
  const workbook = XLSX.read(input, { type: 'buffer' })
  const elements = []
  const sheetCount = workbook.SheetNames.length

  for (let sheetIdx = 0; sheetIdx < sheetCount; sheetIdx++) {
    const sheetName = workbook.SheetNames[sheetIdx]
    const sheet = workbook.Sheets[sheetName]
    const ref = sheet['!ref']
    if (!ref) continue

    const range = XLSX.utils.decode_range(ref)
    const totalRows = range.e.r - range.s.r + 1
    const totalCols = range.e.c - range.s.c + 1

    if (totalRows === 0 || totalCols === 0) continue

    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = sheet[cellRef]
        if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') continue

        const text = String(cell.v).trim()
        const x = totalCols <= 1 ? 0 : (col - range.s.c) / (totalCols - 1)
        const y = totalRows <= 1 ? 0 : (row - range.s.r) / (totalRows - 1)

        elements.push(
          createTextElement(text, x, y, 1 / totalCols, 1 / totalRows, {
            page: sheetIdx,
          })
        )
      }
    }
  }

  return createDocumentIR(elements, 'xlsx', sheetCount)
}
