/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV upload → parse → engine → display.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import CartUploader from './components/CartUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import WarningBanner from './components/WarningBanner.jsx'
import LoadingPanel from './components/LoadingPanel.jsx'
import NaturalLanguageRuleInput from './components/NaturalLanguageRuleInput.jsx'
import { parsePdfCart } from './api/backendClient.js'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { calculateCart } from './engine/discountEngine.js'
import { getNextRuleId } from './engine/ruleIds.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
  {
    key: 'minCartValue',
    label: 'Min Cart',
    render: (v) => (v != null ? `Rs.${v.toLocaleString('en-IN')}` : '—'),
  },
]

const CART_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'brand',     label: 'Brand' },
  { key: 'platform',  label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  { key: 'finalPrice',label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  tag: (color, bg) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 20, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }),
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartWarnings, setCartWarnings] = useState([])
  const [cartFileName, setCartFileName]   = useState('')
  const [cartLoading, setCartLoading] = useState(false)
  const [pendingCartFileName, setPendingCartFileName] = useState('')

  const [cartResult, setCartResult] = useState(null)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setCartResult(null) // clear stale results
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartWarnings([])
    setCartFileName(fileName)
    setCartResult(null)
  }

  async function handleCartPdf(file) {
    setCartLoading(true)
    setCartItems([])
    setCartFileName('')
    setPendingCartFileName(file.name)
    setCartErrors([])
    setCartWarnings([])
    setCartResult(null)

    try {
      const result = await parsePdfCart(file)
      if (result.ok) {
        setCartItems(result.items)
        setCartFileName(file.name)
        setCartWarnings([
          ...result.warnings,
          ...(result.rowErrors?.length
            ? result.rowErrors.map((e) => `Row ${e.row}: ${e.message}`)
            : []),
        ])
        setCartResult(null)
      } else {
        setCartErrors(result.errors)
      }
    } catch (err) {
      setCartErrors([err.message || 'PDF upload failed. Is the backend running on port 8000?'])
    } finally {
      setCartLoading(false)
      setPendingCartFileName('')
    }
  }

  function handleCalculate() {
    setCartResult(calculateCart(cartItems, rules))
  }

  function handleAddRule(rule) {
    setRules((prev) => {
      const ruleId = getNextRuleId(prev)
      return [...prev, { ...rule, ruleId }]
    })
    setCartResult(null)
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />
            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
            <NaturalLanguageRuleInput
              onAddRule={handleAddRule}
              existingRules={rules}
              hasCart={cartItems.length > 0}
            />
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CartUploader
              label="cart.csv or cart.pdf"
              description="Upload cart CSV or PDF"
              onCsvLoad={handleCartLoad}
              onPdfSelect={handleCartPdf}
              hasData={cartItems.length > 0 && !cartLoading}
              fileName={cartLoading ? pendingCartFileName : cartFileName}
              loading={cartLoading}
              loadingMessage="Extracting items from PDF…"
            />
            <ErrorBanner errors={cartErrors} />

            {cartLoading && (
              <LoadingPanel
                title="Extracting items from PDF…"
                subtitle={pendingCartFileName ? `Replacing cart with ${pendingCartFileName}` : undefined}
              />
            )}

            {!cartLoading && <WarningBanner messages={cartWarnings} />}

            {!cartLoading && cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                  {cartFileName.toLowerCase().endsWith('.pdf') ? ' from PDF' : ''}
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>

        {/* Results — hidden while PDF is processing */}
        {!cartLoading && cartResult && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={RESULTS_COLUMNS} rows={cartResult.items} />

            {cartResult.cartOffer && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  background: '#f0faf2',
                  border: '1px solid #b8dfc4',
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600, color: '#131A48' }}>
                  {cartResult.cartOffer.reasoning}
                </span>
                <span style={{ color: '#1e5c2c', fontWeight: 700 }}>
                  −Rs.{cartResult.cartOffer.discount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div style={S.totalRow}>
              {cartResult.cartOffer ? (
                <>
                  <span style={{ fontSize: 13, color: '#666' }}>
                    Subtotal Rs.{cartResult.subtotal.toLocaleString('en-IN')}
                  </span>
                  <span style={S.totalLabel}>Final Cart Total</span>
                  <span style={{ ...S.totalValue, color: '#1e5c2c' }}>
                    Rs.{cartResult.finalTotal.toLocaleString('en-IN')}
                  </span>
                </>
              ) : (
                <>
                  <span style={S.totalLabel}>Cart Total</span>
                  <span style={S.totalValue}>
                    Rs.{cartResult.finalTotal.toLocaleString('en-IN')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
