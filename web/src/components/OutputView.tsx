import { useState, useCallback } from 'react'

type Tab = 'json' | 'csv' | 'markdown'

const FILE_EXT: Record<Tab, string> = { json: '.json', csv: '.csv', markdown: '.md' }
const MIME_TYPE: Record<Tab, string> = { json: 'application/json', csv: 'text/csv', markdown: 'text/markdown' }

interface OutputViewProps {
  jsonOutput: string
  csvOutput: string
  markdownOutput: string
  isLoading: boolean
}

export function OutputView({ jsonOutput, csvOutput, markdownOutput, isLoading }: OutputViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('json')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'json', label: 'JSON' },
    { key: 'csv', label: 'CSV' },
    { key: 'markdown', label: 'Markdown' },
  ]

  const content = {
    json: jsonOutput,
    csv: csvOutput,
    markdown: markdownOutput,
  }

  const [copied, setCopied] = useState(false)

  const hasOutput = content[activeTab] && content[activeTab] !== 'No output yet'

  const handleCopy = useCallback(async () => {
    const text = content[activeTab]
    if (!text || text === 'No output yet') return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeTab, content])

  const handleDownload = useCallback(() => {
    const text = content[activeTab]
    if (!text || text === 'No output yet') return
    const blob = new Blob([text], { type: MIME_TYPE[activeTab] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docstruct-output${FILE_EXT[activeTab]}`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeTab, content])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', padding: '0 0.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#3b82f6' : '#6b7280',
              fontSize: '0.875rem',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            disabled={!hasOutput}
            title="Copy to clipboard"
            style={{
              padding: '0.375rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: copied ? '#dcfce7' : 'none',
              cursor: hasOutput ? 'pointer' : 'default',
              color: copied ? '#16a34a' : hasOutput ? '#374151' : '#d1d5db',
              fontSize: '0.75rem',
              transition: 'all 150ms ease',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasOutput}
            title="Download file"
            style={{
              padding: '0.375rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: 'none',
              cursor: hasOutput ? 'pointer' : 'default',
              color: hasOutput ? '#374151' : '#d1d5db',
              fontSize: '0.75rem',
            }}
          >
            Download {FILE_EXT[activeTab]}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {isLoading ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', paddingTop: '2rem' }}>
            Processing...
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content[activeTab] || 'No output yet'}
          </pre>
        )}
      </div>
    </div>
  )
}
