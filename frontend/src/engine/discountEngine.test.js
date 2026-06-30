import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCartCSV, parseRulesCSV } from './csvParser.js'
import {
  applyDiscounts,
  applyCartOffer,
  calculateCart,
} from './discountEngine.js'
import { parsePrice } from './priceMath.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sampleDir = join(__dirname, '..', '..', 'sample-data')

function loadSampleData() {
  const rulesCsv = readFileSync(join(sampleDir, 'rules.csv'), 'utf8')
  const cartCsv = readFileSync(join(sampleDir, 'cart.csv'), 'utf8')
  const { data: rules } = parseRulesCSV(rulesCsv)
  const { data: cartItems } = parseCartCSV(cartCsv)
  return { rules, cartItems }
}

describe('priceMath', () => {
  it('parses rupee formats', () => {
    expect(parsePrice('1299')).toBe(1299)
    expect(parsePrice('Rs.1,299')).toBe(1299)
    expect(parsePrice('Rs 1299')).toBe(1299)
    expect(parsePrice('₹1,299')).toBe(1299)
  })
})

describe('item-level discounts', () => {
  const { rules, cartItems } = loadSampleData()
  const itemRules = rules.filter((r) => r.scope !== 'cart')

  it('picks the best non-stackable discount', () => {
    const item = cartItems.find((i) => i.itemId === 'ITEM-01')
    const result = applyDiscounts(item, itemRules)
    expect(result.finalPrice).toBe(1104)
    expect(result.reasoning).toContain('15% off')
  })

  it('stacks a stackable rule after the winning non-stackable rule', () => {
    const item = cartItems.find((i) => i.itemId === 'ITEM-02')
    const result = applyDiscounts(item, itemRules)
    expect(result.finalPrice).toBe(629)
    expect(result.reasoning).toContain('Rs.150 off')
    expect(result.reasoning).toContain('10% off')
  })

  it('applies a stackable rule on its own when no non-stackable rule matches', () => {
    const item = cartItems.find((i) => i.itemId === 'ITEM-06')
    const result = applyDiscounts(item, itemRules)
    expect(result.finalPrice).toBe(809)
  })

  it('returns base price when no rules match', () => {
    const item = cartItems.find((i) => i.itemId === 'ITEM-04')
    const result = applyDiscounts(item, itemRules)
    expect(result.finalPrice).toBe(2499)
    expect(result.reasoning).toBe('No offers available')
  })
})

describe('cart-level discounts', () => {
  const { rules, cartItems } = loadSampleData()

  it('applies cart offer after item-level discounts', () => {
    const result = calculateCart(cartItems, rules)
    expect(result.subtotal).toBe(5932)
    expect(result.cartOffer).not.toBeNull()
    expect(result.cartOffer.ruleId).toBe('RULE-04')
    expect(result.cartOffer.discount).toBe(593)
    expect(result.finalTotal).toBe(5339)
  })

  it('does not apply cart offer below threshold', () => {
    const smallCart = [cartItems[0]] // Rs.1,104 after discount
    const offer = applyCartOffer(1104, rules)
    expect(offer).toBeNull()
  })

  it('applies cart offer at exact threshold', () => {
    const offer = applyCartOffer(4000, rules)
    expect(offer).not.toBeNull()
    expect(offer.discount).toBe(400)
  })
})
