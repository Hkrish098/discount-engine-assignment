/**
 * LoadingPanel.jsx — shown while async cart extraction runs.
 */

export default function LoadingPanel({ title, subtitle }) {
  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '1.5rem 1rem',
        textAlign: 'center',
        background: '#fff8e6',
        border: '1px solid #e6c200',
        borderRadius: 6,
      }}
    >
      <div className="cart-spinner" aria-hidden="true" />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#5a4800', marginTop: 12 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#886600', marginTop: 6 }}>{subtitle}</div>
      )}
    </div>
  )
}
