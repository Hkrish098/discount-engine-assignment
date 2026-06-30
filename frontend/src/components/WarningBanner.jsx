/**
 * WarningBanner.jsx — non-fatal notices (e.g. skipped PDF rows).
 */

export default function WarningBanner({ messages }) {
  if (!messages || messages.length === 0) return null
  return (
    <div
      style={{
        background: '#fff8e6',
        border: '1px solid #e6c200',
        borderLeft: '3px solid #c9a000',
        borderRadius: 4,
        padding: '0.6rem 0.9rem',
        marginTop: '0.5rem',
      }}
    >
      {messages.map((msg, i) => (
        <div key={i} style={{ fontSize: 12, color: '#5a4800', marginTop: i ? 4 : 0 }}>
          {msg}
        </div>
      ))}
    </div>
  )
}
