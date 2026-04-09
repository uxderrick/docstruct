import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>docstruct</h1>
      <p>Document Structure Viewer — drag and drop a file to get started.</p>
    </div>
  )
}
