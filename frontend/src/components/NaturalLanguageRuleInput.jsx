/**
 * NaturalLanguageRuleInput.jsx
 *
 * Parse plain-English discount rules via the backend Gemini translator.
 * Shows a confirmation preview before adding the rule to the engine.
 */

import { useState } from 'react'
import ErrorBanner from './ErrorBanner.jsx'
import { parseNaturalLanguageRule } from '../api/backendClient.js'
import { getNextRuleId } from '../engine/ruleIds.js'

const S = {
  wrap: { marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #eee' },
  label: { fontSize: 11, fontWeight: 700, color: '#131A48', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.65rem', fontSize: 13,
    border: '1px solid #CECECE', borderRadius: 4, fontFamily: 'Arial, sans-serif',
  },
  row: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  parseBtn: {
    background: '#131A48', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  parseBtnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'not-allowed',
  },
  preview: {
    marginTop: '0.75rem', padding: '0.75rem', background: '#f7f9ff',
    border: '1px solid #b8c4e8', borderRadius: 4,
  },
  previewTitle: { fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 8 },
  fieldRow: { display: 'flex', gap: '0.5rem', fontSize: 12, marginBottom: 4 },
  fieldLabel: { color: '#888', minWidth: 90 },
  fieldValue: { color: '#131A48', fontWeight: 600 },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
  confirmBtn: {
    background: '#1e5c2c', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  discardBtn: {
    background: '#fff', color: '#131A48', border: '1px solid #CECECE', borderRadius: 4,
    padding: '0.45rem 1rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  addedMsg: { fontSize: 12, color: '#1e5c2c', marginTop: 8, fontWeight: 600 },
  hint: { fontSize: 11, color: '#888', marginTop: 6 },
}

const PREVIEW_FIELDS = [
  { key: 'scope', label: 'Scope' },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type', label: 'Type' },
  { key: 'value', label: 'Value' },
  { key: 'stackable', label: 'Stackable' },
  { key: 'minCartValue', label: 'Min Cart' },
]

export default function NaturalLanguageRuleInput({ onAddRule, existingRules = [], hasCart = false }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [pending, setPending] = useState(null) // { rule, preview }
  const [addedMessage, setAddedMessage] = useState('')

  async function handleParse() {
    if (!text.trim()) return
    setLoading(true)
    setErrors([])
    setPending(null)
    setAddedMessage('')

    try {
      const result = await parseNaturalLanguageRule(text.trim())
      if (result.ok) {
        setPending({ rule: result.rule, preview: result.preview, warnings: result.warnings })
      } else {
        setErrors(result.errors)
      }
    } catch (err) {
      setErrors([err.message || 'Failed to parse rule. Is the backend running on port 8000?'])
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!pending) return
    const ruleId = getNextRuleId(existingRules)
    onAddRule(pending.rule)
    setPending(null)
    setText('')
    setErrors([])
    setAddedMessage(
      hasCart
        ? `Rule ${ruleId} added. Click Calculate Discounts to see updated results.`
        : `Rule ${ruleId} added. Upload a cart or click Calculate Discounts when ready.`
    )
  }

  function handleDiscard() {
    setPending(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleParse()
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.label}>Add rule in plain English</div>
      <textarea
        style={{ ...S.input, minHeight: 64, resize: 'vertical' }}
        placeholder='e.g. "20% off for Natura Casa brand, stackable with other offers"'
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
      />
      <div style={S.row}>
        <button
          style={text.trim() && !loading ? S.parseBtn : S.parseBtnDisabled}
          onClick={handleParse}
          disabled={!text.trim() || loading}
        >
          {loading ? 'Parsing…' : 'Parse Rule'}
        </button>
      </div>
      <div style={S.hint}>
        Try: &quot;Rs.100 flat discount on all Flipkart items&quot; or &quot;10% off if cart value is more than Rs.5,000&quot;
      </div>

      {addedMessage && <div style={S.addedMsg}>{addedMessage}</div>}

      <ErrorBanner errors={errors} />

      {pending && (
        <div style={S.preview}>
          <div style={S.previewTitle}>Confirm parsed rule</div>
          {PREVIEW_FIELDS.map(({ key, label }) => {
            const value = pending.preview[key]
            if (value == null || value === '—') return null
            return (
              <div key={key} style={S.fieldRow}>
                <span style={S.fieldLabel}>{label}</span>
                <span style={S.fieldValue}>{value}</span>
              </div>
            )
          })}
          <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
            Rule ID: {getNextRuleId(existingRules)}
          </div>
          {pending.warnings?.length > 0 && (
            <div style={{ fontSize: 11, color: '#886600', marginTop: 4 }}>
              {pending.warnings.join(' ')}
            </div>
          )}
          <div style={S.actions}>
            <button style={S.confirmBtn} onClick={handleConfirm}>Apply Rule</button>
            <button style={S.discardBtn} onClick={handleDiscard}>Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
