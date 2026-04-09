import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { FileDropZone } from '../components/FileDropZone'
import { DocumentPreview } from '../components/DocumentPreview'
import { OutputView } from '../components/OutputView'
import { WarningsBar } from '../components/WarningsBar'

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
      const text = await selectedFile.text()

      // For V1: client-side processing for text files only
      // Full docstruct integration requires a server-side API route
      const ext = selectedFile.name.split('.').pop()?.toLowerCase()

      if (ext === 'txt' || ext === 'html' || ext === 'htm') {
        // Simple client-side display of file content
        setJsonOutput(JSON.stringify({
          message: 'Client-side parsing - use the docstruct CLI for full extraction',
          fileType: ext,
          contentPreview: text.substring(0, 2000)
        }, null, 2))
        setCsvOutput(`File: ${selectedFile.name}\nType: ${ext}\n\n${text.substring(0, 2000)}`)
        setMarkdownOutput(`# ${selectedFile.name}\n\n**Type:** ${ext}\n\n\`\`\`\n${text.substring(0, 2000)}\n\`\`\``)
        setWarnings([])
        setMetadata({ sourceType: ext, pages: 1, extractionMethod: 'text' })
      } else {
        setJsonOutput(JSON.stringify({
          message: `${ext} files require server-side processing with docstruct`,
          suggestion: 'Use parseDoc() from the docstruct package directly'
        }, null, 2))
        setCsvOutput('')
        setMarkdownOutput('')
        setWarnings([`${ext} format requires Node.js environment for full parsing`])
        setMetadata({ sourceType: ext ?? 'unknown' })
      }
    } catch (err) {
      setJsonOutput(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setCsvOutput('')
      setMarkdownOutput('')
      setWarnings([`Parse error: ${err instanceof Error ? err.message : String(err)}`])
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
