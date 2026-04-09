import { claimElements, getUnclaimedElements, type DocumentIR } from '../ir.js'

// If the y-gap between two elements is greater than this multiple of the average gap,
// treat it as a paragraph break
const GAP_MULTIPLIER = 2.0

export function extractParagraphs(ir: DocumentIR): string[] {
  const unclaimed = getUnclaimedElements(ir)
  if (unclaimed.length === 0) return []

  // Sort by page then y-position
  const sorted = [...unclaimed].sort((a, b) => {
    const pageDiff = (a.page ?? 0) - (b.page ?? 0)
    if (pageDiff !== 0) return pageDiff
    return a.y - b.y
  })

  // Calculate typical y-gap using the minimum gap as the baseline for normal line spacing
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].y - sorted[i - 1].y)
  }
  const minGap = gaps.length > 0 ? Math.min(...gaps) : 0.1
  // Use max of (min gap * multiplier) or a small absolute threshold
  const breakThreshold = Math.max(minGap * GAP_MULTIPLIER, 0.05)

  const paragraphs: string[] = []
  let currentLines: string[] = [sorted[0].text.trim()]
  let currentElements = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].y - sorted[i - 1].y
    const pageDiff = (sorted[i].page ?? 0) - (sorted[i - 1].page ?? 0)

    if (pageDiff > 0 || gap > breakThreshold) {
      // Paragraph break
      const text = currentLines.join(' ').trim()
      if (text) paragraphs.push(text)
      claimElements(currentElements)
      currentLines = []
      currentElements = []
    }

    currentLines.push(sorted[i].text.trim())
    currentElements.push(sorted[i])
  }

  const text = currentLines.join(' ').trim()
  if (text) paragraphs.push(text)
  claimElements(currentElements)

  return paragraphs
}
