import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { FileDropZone } from '../components/FileDropZone'
import { DocumentPreview } from '../components/DocumentPreview'
import { OutputView } from '../components/OutputView'
import { WarningsBar } from '../components/WarningsBar'
import { parseDocument } from '../server/parseDocument'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [jsonOutput, setJsonOutput] = useState('')
  const [csvOutput, setCsvOutput] = useState('')
  const [markdownOutput, setMarkdownOutput] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)

    // Create preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(selectedFile))

    setIsLoading(true)
    try {
      // Read file as base64 and send to server function
      const arrayBuffer = await selectedFile.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )

      const result = await parseDocument({
        data: { data: base64, fileName: selectedFile.name },
      })

      setJsonOutput(JSON.stringify(result.json, null, 2))
      setCsvOutput(result.csv)
      setMarkdownOutput(result.markdown)

      const parsed = result.json as Record<string, unknown>
      setWarnings((parsed.warnings as string[]) ?? [])
      setMetadata((parsed.metadata as Record<string, unknown>) ?? null)
    } catch (err) {
      setJsonOutput(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setCsvOutput('')
      setMarkdownOutput('')
      setWarnings([`Parse error: ${err instanceof Error ? err.message : String(err)}`])
      setMetadata(null)
    } finally {
      setIsLoading(false)
    }
  }, [previewUrl])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>docstruct</h1>
        <FileDropZone onFile={handleFile} />
        {file && (
          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>

      {/* Main content — side by side */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Document preview */}
        <div style={{ flex: 1, borderRight: '1px solid #e5e7eb', overflow: 'auto', padding: '1rem' }}>
          <DocumentPreview file={file} previewUrl={previewUrl} />
        </div>

        {/* Right: Structured output */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <OutputView
            jsonOutput={jsonOutput}
            csvOutput={csvOutput}
            markdownOutput={markdownOutput}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <WarningsBar warnings={warnings} metadata={metadata} />
    </div>
  )
}
