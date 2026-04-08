# docstruct — Design Spec

## Overview

`docstruct` is an offline, rule-based NPM package that parses raw documents into clean structured output before they enter AI pipelines. No LLMs, no cloud services, no external APIs. Fully local.

**The problem:** Developers building AI pipelines waste tokens feeding raw documents directly to LLMs.

**The solution:** `docstruct` acts as a preprocessing layer — extracting structure from documents offline, so only clean, minimal data reaches the AI.

```
Raw PDF → docstruct → Clean JSON → AI Agent (cheap, fast, precise)
```

**Market position:** There is no JS/TS equivalent. Python's `Unstructured` is the closest analog but requires Python or their cloud API. `docstruct` fills this gap as the first offline, multi-format, structure-extracting JS/TS library.

---

## API Design

### Primary Function

```ts
import { parseDoc } from 'docstruct'

// From file path (format auto-detected from extension)
const result = await parseDoc('./invoice.pdf', {
  output: 'json',                        // 'json' | 'csv' | 'markdown'
  extract: ['tables', 'keyValues'],       // optional filter, defaults to all
})

// From buffer (type hint required)
const result = await parseDoc(buffer, {
  type: 'pdf',                            // required when passing a buffer
  output: 'json',
})
```

### Input

- **File path** (string) — format auto-detected from extension
- **Buffer** — requires a `type` option specifying the format

### Options

| Option    | Type                                             | Default                                  | Description                          |
|-----------|--------------------------------------------------|------------------------------------------|--------------------------------------|
| `output`  | `'json' \| 'csv' \| 'markdown'`                 | `'json'`                                 | Output serialization format          |
| `extract` | `('tables' \| 'keyValues' \| 'paragraphs' \| 'lists')[]` | `['tables', 'keyValues', 'paragraphs', 'lists']` | Which structures to extract |
| `type`    | `'pdf' \| 'image' \| 'text' \| 'docx' \| 'xlsx' \| 'html'` | Auto-detected from file extension        | Required when input is a buffer      |

### Output Shape (JSON)

```json
{
  "tables": [
    {
      "columns": ["Date", "Description", "Amount"],
      "rows": [
        ["2024-01-03", "Electricity Bill", "120.00"],
        ["2024-01-05", "Grocery Store", "45.50"]
      ]
    }
  ],
  "keyValues": {
    "name": "Steve Mensah",
    "account": "1234567890",
    "period": "January 2024"
  },
  "paragraphs": [
    "This is your monthly statement for the period ending January 31, 2024.",
    "Please review all transactions and report any discrepancies within 30 days."
  ],
  "lists": [
    ["Item one", "Item two", "Item three"]
  ],
  "warnings": [
    "Page 4: OCR confidence below threshold"
  ],
  "metadata": {
    "sourceType": "pdf",
    "pages": 5,
    "extractionMethod": "text"
  }
}
```

All top-level fields are always present. Empty arrays/objects for types not found.

**Return type by output format:**
- `output: 'json'` — returns the object above (typed `ParseResult`)
- `output: 'csv'` — returns a `string` (CSV-formatted)
- `output: 'markdown'` — returns a `string` (Markdown-formatted)

---

## Architecture: Two-Layer Pipeline

```
Input → Detect Format → Parser → Intermediate Representation (IR) → Extractors → Formatter → Output
```

### Why Two Layers

Instead of extracting structure directly from each format (massive duplication), every parser converts its format into a common Intermediate Representation. Extractors only need to understand that one format.

```
PDF  ──→ IR ──→ Table Extractor
DOCX ──→ IR ──→ KV Extractor
XLSX ──→ IR ──→ List Extractor
HTML ──→ IR ──→ Paragraph Extractor
```

---

## Intermediate Representation (IR)

The IR is a list of text elements with normalized spatial coordinates.

```ts
interface TextElement {
  text: string
  x: number          // horizontal position (normalized 0-1)
  y: number          // vertical position (normalized 0-1)
  width: number
  height: number
  page?: number      // for multi-page documents
  font?: {
    size: number
    bold: boolean
  }
}

interface DocumentIR {
  elements: TextElement[]
  sourceType: string
  pageCount: number
  raw?: string        // fallback plain text for formats without spatial data
}
```

### How Each Parser Maps to the IR

| Format       | Spatial data?  | IR strategy                                                                 |
|--------------|----------------|-----------------------------------------------------------------------------|
| PDF (text)   | Yes            | Full `TextElement[]` with x/y/width/height from pdfjs-dist coordinates      |
| PDF (OCR)    | Yes            | Full `TextElement[]` from Tesseract word bounding boxes                     |
| Images       | Yes            | Same as OCR                                                                 |
| DOCX         | Partial        | Sequential y-positions from document order, `raw` HTML from mammoth        |
| XLSX         | Yes            | Elements positioned by row/column index mapped to grid coordinates          |
| HTML         | Partial        | Sequential positions from DOM order, table/list tags preserved in raw       |
| Plain text   | No             | Line-based y-positions, `raw` text populated                               |

Coordinates are normalized to 0-1 range so spatial heuristics (column alignment detection) work consistently across formats and page sizes.

---

## Parsers

Six format-specific parsers. Each converts its format into the `DocumentIR`.

### PDF Parser (Two-Pass Strategy)

1. Attempt text extraction with `pdfjs-dist` — extract text items with coordinates
2. If no meaningful text found, fall back to `tesseract.js` OCR
3. The caller never knows which path was taken — abstracted internally
4. `metadata.extractionMethod` reports `'text'` or `'ocr'`

**Tesseract.js optimization:**
- Lazy-loaded — only initialized when OCR is actually needed
- Workers reused across calls (avoid re-downloading the ~15-20MB language data)
- English only (`eng`) with the `fast` language path for speed

### Image Parser

- JPG, PNG support via `tesseract.js`
- Same Tesseract worker reuse as PDF OCR
- Preprocess images (grayscale, contrast adjustment) before OCR for better accuracy

### DOCX Parser

- `mammoth` converts DOCX to HTML
- HTML is then parsed to extract structural elements
- Positional data derived from document order (sequential y-values)

### XLSX Parser

- `xlsx` (SheetJS) reads workbook
- Each sheet processed separately
- Cell references (A1, B2) mapped to normalized grid coordinates
- Each sheet becomes a table in the output

### HTML Parser

- `cheerio` for DOM parsing
- Semantic tags (`<table>`, `<ul>`, `<ol>`, `<dl>`) directly map to structure types
- Remaining text nodes become paragraphs

### Plain Text Parser

- Split by lines
- Line number becomes y-position
- Character offset becomes x-position
- `raw` field populated with full text

---

## Structure Extractors

Four extractors run in priority order. Each extractor "claims" the IR elements it matches. This prevents double-counting (e.g., a table row also appearing as a paragraph).

**Execution order:** Tables → Key-Values → Lists → Paragraphs

### Table Extractor

Two detection strategies:

1. **Delimiter-based** — detect pipe `|` characters, tab-separated values, or HTML `<table>` tag patterns in the raw text
2. **Column alignment** — cluster IR elements by x-position; if 3+ elements share similar x-coordinates across multiple y-positions, that's a column. Group rows by y-proximity.

Column headers auto-detected from the first row if it differs stylistically (bold, different font size). Falls back to treating the first row as data if no stylistic difference.

**Output:** `{ columns: string[], rows: string[][] }`

### Key-Value Extractor

Two detection strategies:

1. **Regex patterns** — match `Label: Value`, `Label = Value`, `Label - Value` on single lines
2. **Spatial pairing** — for documents with spatial data, detect bold/larger text near regular text in a horizontal pair (label left, value right)

**Output:** `Record<string, string>` with normalized lowercase keys

### List Extractor

1. **Marker detection** — lines starting with `-`, `*`, `->`, `=>` (unordered) or `1.`, `2.`, `a)`, `i.` (ordered)
2. **Grouping** — consecutive list items form one list. A gap or non-list line starts a new list.

**Output:** `string[][]` — array of lists, each list an array of items

### Paragraph Extractor

- Runs last, processes only unclaimed elements
- Groups remaining text elements by y-proximity (blank line / significant y-gap = new paragraph)

**Output:** `string[]` — array of paragraph strings

### Confidence Note

The delimiter-based table detection, regex KV patterns, and list markers are well-established heuristics. Column alignment and spatial KV pairing are sound approaches but will need empirical tuning against real documents using the companion web app.

---

## Output Formatters

### JSON

Pass-through — the internal extracted structure is already the JSON shape. Serialized with `JSON.stringify`.

### CSV

- Tables: headers as first row, data rows following
- Key-values: two-column CSV (`key,value`)
- Paragraphs: joined with newlines
- Lists: one item per row
- Multiple sections separated by blank row with section label

### Markdown

- Tables: pipe-delimited markdown tables with header separator
- Key-values: `**Key:** Value` format
- Paragraphs: as-is with blank line separation
- Lists: `- item` (unordered) or `1. item` (ordered)

---

## Error Handling

**Best-effort with warnings.** The parser never throws on partial failure.

- If a page fails OCR, the warning is logged and remaining pages are processed
- If an extractor finds no matches, the corresponding field is an empty array/object
- `warnings` array describes what went wrong: `"Page 4: OCR confidence below threshold"`
- The parser only throws on total failure (e.g., file not found, completely unreadable format, unsupported type)

---

## Project Structure

```
docstruct/
├── src/
│   ├── index.ts              # Main entry — exports parseDoc()
│   ├── parsers/
│   │   ├── pdf.ts            # PDF text extraction + OCR fallback
│   │   ├── image.ts          # JPG/PNG via Tesseract
│   │   ├── docx.ts           # Word document parser
│   │   ├── xlsx.ts           # Excel parser
│   │   ├── html.ts           # HTML parser
│   │   └── text.ts           # Plain text parser
│   ├── extractors/
│   │   ├── tables.ts         # Table detection + extraction
│   │   ├── keyValues.ts      # Key-value pair detection
│   │   ├── paragraphs.ts     # Paragraph chunking
│   │   └── lists.ts          # List detection
│   ├── formatters/
│   │   ├── json.ts           # Format output as JSON
│   │   ├── csv.ts            # Format output as CSV
│   │   └── markdown.ts       # Format output as Markdown
│   ├── ir.ts                 # Intermediate Representation types + utilities
│   └── types.ts              # Shared TypeScript types
├── tests/
│   └── ...
├── web/                      # Companion web app (TanStack Start + React)
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

| Purpose          | Library       | Notes                                    |
|------------------|---------------|------------------------------------------|
| PDF (text)       | `pdfjs-dist`  | Pure JS, no native deps                  |
| PDF/Image (OCR)  | `tesseract.js`| Pure JS OCR, lazy-loaded, workers reused |
| Word (.docx)     | `mammoth`     | Converts to HTML                         |
| Excel (.xlsx)    | `xlsx`        | SheetJS, mature and well maintained      |
| HTML             | `cheerio`     | Lightweight DOM parsing                  |
| Web app          | TanStack Start| Full-stack React framework               |

---

## Companion Web App

**Stack:** TanStack Start + React

**Purpose:** Side-by-side viewer for testing and validating extraction quality.

**Layout:**
- **Left pane** — document preview (PDF rendered in canvas, images displayed, text/HTML rendered)
- **Right pane** — structured output with tabs for JSON / CSV / Markdown views
- **Top bar** — drag-and-drop zone + file picker, output format toggle, extract filter checkboxes
- **Bottom bar** — warnings display, metadata info

**Key constraint:** Runs entirely client-side. `docstruct` is bundled directly into the app. No server, no uploads — stays true to the offline principle. Tesseract.js runs in the browser via web workers.

---

## Package Configuration

- **ESM only** — `"type": "module"` in package.json
- **Node 18+** — minimum supported version
- **TypeScript** — throughout, ships with type declarations
- **Tree-shakeable** — individual parsers can be imported independently

---

## Explicitly Out of Scope (V1)

- Multi-language OCR (English only)
- Named entity recognition
- Document type classification
- PowerPoint / `.pptx`
- Google Docs / Sheets
- Confidence scores on extracted elements (future version)
- Streaming / chunked processing
