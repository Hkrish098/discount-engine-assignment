import Papa from 'papaparse'
import { parsePrice } from './priceMath.js'

/**
 * csvParser.js
 *
 * Converts raw CSV text into the typed objects the discount engine expects.
 *
 * Expected rules.csv columns:
 *   rule_id, scope, applies_to, type, value, stackable, min_cart_value
 *
 * Expected cart.csv columns:
 *   item_id, product, brand, platform, base_price
 */

function parseStackable(raw) {
  const stackableStr = String(raw).trim().toLowerCase()
  return stackableStr === 'true' || stackableStr === '1' || stackableStr === 'yes'
}

/**
 * Parses the raw text of rules.csv into an array of DiscountRule objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseRulesCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.rule_id) missing.push('rule_id')
    if (!row.scope) missing.push('scope')
    if (!row.type) missing.push('type')
    if (row.value === undefined || row.value === '') missing.push('value')
    if (row.stackable === undefined || row.stackable === '') missing.push('stackable')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const scope = row.scope.trim().toLowerCase()
    if (scope !== 'brand' && scope !== 'platform' && scope !== 'cart') {
      errors.push(`Row ${rowNum}: scope must be "brand", "platform", or "cart", got "${row.scope}"`)
      return
    }

    const type = row.type.trim().toLowerCase()
    if (type !== 'percentage' && type !== 'flat') {
      errors.push(`Row ${rowNum}: type must be "percentage" or "flat", got "${row.type}"`)
      return
    }

    const value = parseFloat(row.value)
    if (isNaN(value) || value <= 0) {
      errors.push(`Row ${rowNum}: value must be a positive number, got "${row.value}"`)
      return
    }

    if (type === 'percentage' && value > 100) {
      errors.push(`Row ${rowNum}: percentage value must be ≤ 100, got "${row.value}"`)
      return
    }

    const appliesTo = row.applies_to ? row.applies_to.trim() : ''
    if ((scope === 'brand' || scope === 'platform') && !appliesTo) {
      errors.push(`Row ${rowNum}: applies_to is required for ${scope} rules`)
      return
    }

    let minCartValue = null
    if (scope === 'cart') {
      if (row.min_cart_value === undefined || row.min_cart_value === '') {
        errors.push(`Row ${rowNum}: min_cart_value is required for cart rules`)
        return
      }
      minCartValue = parsePrice(row.min_cart_value)
      if (minCartValue === null) {
        errors.push(`Row ${rowNum}: min_cart_value must be a positive number, got "${row.min_cart_value}"`)
        return
      }
    }

    const rule = {
      ruleId: row.rule_id.trim(),
      scope,
      appliesTo,
      type,
      value,
      stackable: parseStackable(row.stackable),
    }

    if (minCartValue !== null) {
      rule.minCartValue = minCartValue
    }

    data.push(rule)
  })

  return { data, errors }
}

/**
 * Parses the raw text of cart.csv into an array of CartItem objects.
 */
export function parseCartCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.item_id) missing.push('item_id')
    if (!row.product) missing.push('product')
    if (!row.brand) missing.push('brand')
    if (!row.platform) missing.push('platform')
    if (row.base_price === undefined || row.base_price === '') missing.push('base_price')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const basePrice = parsePrice(row.base_price)
    if (basePrice === null) {
      errors.push(`Row ${rowNum}: base_price must be a positive number, got "${row.base_price}"`)
      return
    }

    data.push({
      itemId: row.item_id.trim(),
      product: row.product.trim(),
      brand: row.brand.trim(),
      platform: row.platform.trim(),
      basePrice,
    })
  })

  return { data, errors }
}
