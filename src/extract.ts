import type { DocumentIR } from './ir.js'
import type { ExtractTarget, ParseResult, Metadata } from './types.js'
import { extractTables } from './extractors/tables.js'
import { extractKeyValues } from './extractors/keyValues.js'
import { extractLists } from './extractors/lists.js'
import { extractParagraphs } from './extractors/paragraphs.js'

export function extractStructures(
  ir: DocumentIR,
  targets: ExtractTarget[],
  metadata: Metadata
): ParseResult {
  const result: ParseResult = {
    tables: [],
    keyValues: {},
    paragraphs: [],
    lists: [],
    warnings: [],
    metadata,
  }

  // Run extractors in priority order, only for requested targets
  if (targets.includes('tables')) {
    result.tables = extractTables(ir)
  }

  if (targets.includes('keyValues')) {
    result.keyValues = extractKeyValues(ir)
  }

  if (targets.includes('lists')) {
    result.lists = extractLists(ir)
  }

  if (targets.includes('paragraphs')) {
    result.paragraphs = extractParagraphs(ir)
  }

  return result
}
