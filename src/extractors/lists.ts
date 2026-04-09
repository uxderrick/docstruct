import { claimElements, type DocumentIR, type TextElement } from '../ir.js'

const UNORDERED_RE = /^[-*•→]\s+(.+)$/
const ORDERED_RE = /^(?:\d+[.)]\s+|[a-z][.)]\s+|[ivx]+[.)]\s+)(.+)$/i
const ARROW_RE = /^(?:->|=>)\s+(.+)$/

function getListItemText(text: string): string | null {
  let match = text.match(UNORDERED_RE)
  if (match) return match[1]

  match = text.match(ARROW_RE)
  if (match) return match[1]

  match = text.match(ORDERED_RE)
  if (match) return match[1]

  return null
}

export function extractLists(ir: DocumentIR): string[][] {
  const lists: string[][] = []
  let currentList: string[] = []
  let currentElements: TextElement[] = []

  for (const element of ir.elements) {
    if (element.claimed) continue

    const itemText = getListItemText(element.text.trim())

    if (itemText !== null) {
      currentList.push(itemText)
      currentElements.push(element)
    } else {
      if (currentList.length > 0) {
        lists.push(currentList)
        claimElements(currentElements)
        currentList = []
        currentElements = []
      }
    }
  }

  if (currentList.length > 0) {
    lists.push(currentList)
    claimElements(currentElements)
  }

  return lists
}
