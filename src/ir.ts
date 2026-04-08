export interface TextElement {
  text: string
  x: number
  y: number
  width: number
  height: number
  page?: number
  font?: {
    size: number
    bold: boolean
  }
  claimed?: boolean
}

export interface DocumentIR {
  elements: TextElement[]
  sourceType: string
  pageCount: number
  raw?: string
}

export function createTextElement(
  text: string,
  x: number,
  y: number,
  width: number = 0,
  height: number = 0,
  options?: { page?: number; font?: { size: number; bold: boolean } }
): TextElement {
  return {
    text,
    x,
    y,
    width,
    height,
    page: options?.page,
    font: options?.font,
    claimed: false,
  }
}

export function createDocumentIR(
  elements: TextElement[],
  sourceType: string,
  pageCount: number = 1,
  raw?: string
): DocumentIR {
  return { elements, sourceType, pageCount, raw }
}

export function getUnclaimedElements(ir: DocumentIR): TextElement[] {
  return ir.elements.filter((el) => !el.claimed)
}

export function claimElements(elements: TextElement[]): void {
  for (const el of elements) {
    el.claimed = true
  }
}
