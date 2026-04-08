import type { ParseOptions, ParseResult } from './types.js'

export async function parseDoc(
  input: string | Buffer,
  options: ParseOptions = {}
): Promise<ParseResult | string> {
  throw new Error('Not yet implemented')
}
