interface DocumentPreviewProps {
  file: File | null
  previewUrl: string | null
}

export function DocumentPreview({ file, previewUrl }: DocumentPreviewProps) {
  if (!file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
        No file selected
      </div>
    )
  }

  const type = file.type

  if (type === 'application/pdf') {
    return (
      <iframe
        src={previewUrl ?? ''}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="PDF Preview"
      />
    )
  }

  if (type.startsWith('image/')) {
    return (
      <img
        src={previewUrl ?? ''}
        alt="Document preview"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    )
  }

  if (type === 'text/plain' || type === 'text/html') {
    return (
      <iframe
        src={previewUrl ?? ''}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Text Preview"
      />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
        <div>{file.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Preview not available for this format</div>
      </div>
    </div>
  )
}
