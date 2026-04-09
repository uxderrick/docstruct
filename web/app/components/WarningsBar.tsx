interface WarningsBarProps {
  warnings: string[]
  metadata: Record<string, unknown> | null
}

export function WarningsBar({ warnings, metadata }: WarningsBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        borderTop: '1px solid #e5e7eb',
        fontSize: '0.75rem',
        color: '#6b7280',
        backgroundColor: warnings.length > 0 ? '#fef3c7' : '#f9fafb',
      }}
    >
      <div>
        {warnings.length > 0
          ? warnings.join(' | ')
          : 'No warnings'}
      </div>
      {metadata && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key}>
              <strong>{key}:</strong> {String(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
