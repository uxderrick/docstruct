# docstruct

Offline, rule-based document parser for AI pipelines. Extracts structured data (tables, key-value pairs, paragraphs, lists) from PDFs, DOCX, XLSX, HTML, images, and plain text — deterministically, with zero API calls.

## Why

LLMs hallucinate table cells, skip rows, and cost money per call. docstruct gives you the same structured output every time, runs locally, and processes thousands of documents in minutes.

Built for products that parse documents regularly without AI.

## Install

```bash
npm install docstruct
```

Requires Node.js >= 18.

## Quick Start

```ts
import { parseDoc } from 'docstruct'

// From file path
const result = await parseDoc('statement.pdf')

// From buffer
const buffer = fs.readFileSync('report.pdf')
const result = await parseDoc(buffer, { type: 'pdf' })
```

## API

### `parseDoc(input, options?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string \| Buffer` | File path or buffer. When passing a buffer, `type` is required. |
| `options.type` | `SourceType` | File type: `'pdf'`, `'docx'`, `'xlsx'`, `'html'`, `'image'`, `'text'` |
| `options.extract` | `ExtractTarget[]` | What to extract: `'tables'`, `'keyValues'`, `'paragraphs'`, `'lists'`. Defaults to all. |
| `options.output` | `OutputFormat` | Output format: `'json'` (default), `'csv'`, `'markdown'` |

### Response

```ts
interface ParseResult {
  tables: Table[]
  keyValues: Record<string, string>
  paragraphs: string[]
  lists: string[][]
  warnings: string[]
  metadata: Metadata
}

interface Table {
  columns: string[]  // Header row
  rows: string[][]   // Data rows
}

interface Metadata {
  sourceType: 'pdf' | 'image' | 'text' | 'docx' | 'xlsx' | 'html'
  pages: number
  extractionMethod: 'text' | 'ocr' | 'direct'
}
```

## Supported Formats

| Format | Extensions | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | pdfjs-dist (text + line extraction) |
| Word | `.docx` | mammoth |
| Excel | `.xlsx` | xlsx |
| HTML | `.html`, `.htm` | cheerio |
| Images | `.jpg`, `.png` | tesseract.js (OCR) |
| Plain text | `.txt` | Built-in |

## Table Extraction

docstruct uses multiple strategies to find tables, applied in this order:

1. **Pipe-delimited** — `| col1 | col2 |` markdown-style tables
2. **Tab-separated** — TSV-formatted rows
3. **Lattice** (PDF only) — extracts ruled lines from the PDF's drawing operators and builds grids from line intersections. Handles merged cells, multi-table pages, and double-drawn borders.
4. **Header-anchored spatial** — detects header rows with 4+ columns spread across the page, uses header positions as column anchors. Handles dense tables like bank statements where data elements have varying x-positions.
5. **Spatial fallback** — clusters text elements by x/y position to infer table structure

Each strategy claims the text elements it matches, so later strategies only process unclaimed elements.

### Example: Bank Statement

```ts
const result = await parseDoc('momo-statement.pdf', {
  extract: ['tables'],
  type: 'pdf'
})

console.log(result.tables[0].columns)
// ["TRANSACTION DATE", "FROM ACCT", "FROM NAME", "FROM NO.", "TRANS. TYPE",
//  "AMOUNT", "FEES", "E-LEVY", "BAL BEFORE", "BAL AFTER", "TO NO.",
//  "TO NAME", "TO ACCT", "F_ID", "REF", "OVA"]

console.log(result.tables[0].rows[0])
// ["12-Dec-2024 09:03:10 PM", "53907613", "Derrick Tsorme", "233547759141",
//  "TRANSFER", "151", "1.13", "1.51", "1222.35", "1220.84", ...]
```

## Output Formats

### JSON (default)

Returns a `ParseResult` object.

### CSV

```ts
const csv = await parseDoc('data.pdf', { output: 'csv' })
// Returns CSV string of the first table
```

### Markdown

```ts
const md = await parseDoc('data.pdf', { output: 'markdown' })
// Returns markdown-formatted tables and content
```

## Architecture

```
Input (file/buffer)
  → Parser (pdf, docx, xlsx, html, image, text)
    → DocumentIR (normalized text elements + line segments)
      → Extractors (tables, key-values, paragraphs, lists)
        → Formatters (json, csv, markdown)
          → Output
```

All parsers produce a common intermediate representation (`DocumentIR`) with normalized coordinates (0-1 range, top-left origin). Extractors work on this IR regardless of source format.

## Development

```bash
npm install
npm test          # Run tests
npm run build     # Build to dist/
npm run test:watch # Watch mode
```

### Web Companion

A browser-based viewer for testing document parsing:

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

## License

MIT
