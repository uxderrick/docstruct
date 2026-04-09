import { useState } from 'react'

type Tab = 'json' | 'csv' | 'markdown'

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 0.5rem' }}>
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
