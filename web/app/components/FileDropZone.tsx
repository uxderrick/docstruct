import { useCallback, useState, type DragEvent } from 'react'

interface FileDropZoneProps {
  onFile: (file: File) => void
}

export function FileDropZone({ onFile }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.jpg,.jpeg,.png,.txt,.docx,.xlsx,.html,.htm'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) onFile(file)
    }
    input.click()
  }, [onFile])

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
        borderRadius: '8px',
        padding: '1rem 2rem',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: isDragging ? '#eff6ff' : 'transparent',
        transition: 'all 150ms ease',
      }}
    >
      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
        Drop a file here or click to browse
      </span>
    </div>
  )
}
