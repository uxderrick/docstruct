import type { TextElement } from '../ir.js'
import { createTextElement } from '../ir.js'

let workerPromise: Promise<import('tesseract.js').Worker> | null = null

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import('tesseract.js')
      const worker = await Tesseract.createWorker('eng')
      return worker
    })()
  }
  return workerPromise
}

export async function ocrImage(
  imageData: Buffer,
  pageWidth: number = 1,
  pageHeight: number = 1,
  page?: number
): Promise<TextElement[]> {
  const worker = await getWorker()
  const { data } = await worker.recognize(imageData)
  const elements: TextElement[] = []

  for (const word of (data as any).words) {
    if (!word.text.trim()) continue

    const x = word.bbox.x0 / pageWidth
    const y = word.bbox.y0 / pageHeight
    const width = (word.bbox.x1 - word.bbox.x0) / pageWidth
    const height = (word.bbox.y1 - word.bbox.y0) / pageHeight

    elements.push(
      createTextElement(word.text.trim(), x, y, width, height, {
        page,
        font: { size: word.font_size || 12, bold: false },
      })
    )
  }

  return elements
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}
