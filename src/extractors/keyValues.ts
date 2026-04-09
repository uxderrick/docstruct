import { claimElements, type DocumentIR, type TextElement } from '../ir.js'

// Matches "Key: Value" or "Key = Value" where key is short (1-5 words)
const KV_COLON_RE = /^([A-Za-z][A-Za-z0-9 ]{0,40}):\s+(.+)$/
const KV_EQUALS_RE = /^([A-Za-z][A-Za-z0-9 ]{0,40})\s*=\s+(.+)$/

// Heuristic: if the value portion is too long relative to the key, it's likely a sentence
const MAX_VALUE_LENGTH = 80

function extractRegexKeyValues(
  ir: DocumentIR
): { kv: Record<string, string>; claimed: TextElement[] } {
  const kv: Record<string, string> = {}
  const claimed: TextElement[] = []

  for (const element of ir.elements) {
    if (element.claimed) continue
    const text = element.text.trim()

    let match = text.match(KV_COLON_RE) || text.match(KV_EQUALS_RE)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()

      // Skip if value is too long (likely a sentence, not a KV pair)
      if (value.length > MAX_VALUE_LENGTH) continue
      // Skip if value has too many words (likely a sentence, not a short value)
      if (value.split(' ').length > 6) continue
      // Skip if key is longer than value (likely a sentence like "Please note: x")
      if (key.length > value.length && value.split(' ').length > 3) continue

      kv[key.toLowerCase()] = value
      claimed.push(element)
    }
  }

  return { kv, claimed }
}

function extractSpatialKeyValues(
  ir: DocumentIR
): { kv: Record<string, string>; claimed: TextElement[] } {
  const kv: Record<string, string> = {}
  const claimed: TextElement[] = []

  const unclaimed = ir.elements.filter((el) => !el.claimed)
  const yTolerance = 0.01

  // 1. Bold label paired with non-bold value to the right
  const boldElements = unclaimed.filter((el) => el.font?.bold)

  for (const boldEl of boldElements) {
    const pair = unclaimed.find(
      (el) =>
        el !== boldEl &&
        !el.font?.bold &&
        !el.claimed &&
        Math.abs(el.y - boldEl.y) < yTolerance &&
        el.x > boldEl.x
    )

    if (pair) {
      const key = boldEl.text.replace(/:$/, '').trim()
      kv[key.toLowerCase()] = pair.text.trim()
      claimed.push(boldEl, pair)
    }
  }

  // 2. Non-bold label ending with ":" paired with value to the right on same y-line
  const LABEL_RE = /^[A-Za-z][A-Za-z0-9 ]{0,40}:$/
  const labelElements = unclaimed.filter(
    (el) => !el.claimed && !claimed.includes(el) && LABEL_RE.test(el.text.trim())
  )

  for (const labelEl of labelElements) {
    const pair = unclaimed.find(
      (el) =>
        el !== labelEl &&
        !el.claimed &&
        !claimed.includes(el) &&
        Math.abs(el.y - labelEl.y) < yTolerance &&
        el.x > labelEl.x
    )

    if (pair) {
      const value = pair.text.trim()
      // Skip if value is too long (likely a sentence)
      if (value.length > MAX_VALUE_LENGTH) continue
      if (value.split(' ').length > 6) continue

      const key = labelEl.text.replace(/:$/, '').trim()
      kv[key.toLowerCase()] = value
      claimed.push(labelEl, pair)
    }
  }

  return { kv, claimed }
}

export function extractKeyValues(ir: DocumentIR): Record<string, string> {
  // Try regex-based first
  const regex = extractRegexKeyValues(ir)
  claimElements(regex.claimed)

  // Then spatial pairing for remaining elements
  const spatial = extractSpatialKeyValues(ir)
  claimElements(spatial.claimed)

  return { ...regex.kv, ...spatial.kv }
}
