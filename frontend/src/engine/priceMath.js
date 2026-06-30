/**
 * Shared currency helpers — whole rupees, consistent rounding.
 */

export function roundCurrency(amount) {
  return Math.round(amount)
}

/**
 * Parses common rupee price formats into whole rupees.
 * Supports: 1299, Rs.1,299, Rs 1299, ₹1,299
 */
export function parsePrice(raw) {
  if (typeof raw === 'number') {
    return raw > 0 ? roundCurrency(raw) : null
  }

  const text = String(raw).trim()
  if (!text) return null

  const match = text.replace(/₹/g, '').replace(/Rs\.?/gi, '').match(/[\d,]+(?:\.\d+)?/)
  if (!match) return null

  const value = parseFloat(match[0].replace(/,/g, ''))
  return !isNaN(value) && value > 0 ? roundCurrency(value) : null
}
