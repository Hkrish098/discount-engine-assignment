/**
 * CartUploader.jsx — accepts CSV or PDF cart files.
 */

import { useRef } from 'react'

export default function CartUploader({
  label,
  description,
  onCsvLoad,
  onPdfSelect,
  hasData,
  fileName,
  loading,
  loadingMessage = 'Extracting items from PDF…',
}) {
  const inputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf')) {
      onPdfSelect(file)
    } else if (name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (evt) => onCsvLoad(evt.target.result, file.name)
      reader.readAsText(file)
    }

    e.target.value = ''
  }

  const borderColor = loading ? '#c9a000' : hasData ? '#1e5c2c' : '#CECECE'
  const bg = loading ? '#fff8e6' : hasData ? '#f0faf2' : '#fafafa'

  return (
    <div
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 6,
        padding: '1rem 1.2rem',
        background: bg,
        cursor: loading ? 'wait' : 'pointer',
        transition: 'border-color 0.15s',
        opacity: loading ? 0.9 : 1,
      }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.pdf"
        style={{ display: 'none' }}
        onChange={handleFile}
        disabled={loading}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: 20 }}>{loading ? '⏳' : hasData ? '✅' : '📄'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>{label}</div>
          <div style={{ fontSize: 11, color: loading ? '#886600' : '#888', marginTop: 2 }}>
            {loading ? loadingMessage : hasData ? fileName : description}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: loading ? '#886600' : hasData ? '#1e5c2c' : '#FF5800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Processing' : hasData ? 'Change' : 'Upload'}
          </span>
        </div>
      </div>
    </div>
  )
}
