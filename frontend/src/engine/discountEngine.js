/**
 * discountEngine.js
 *
 * Pure discount calculation logic. No UI, no side effects.
 * All functions take plain objects and return plain objects.
 *
 * Data shapes:
 *
 * DiscountRule {
 *   ruleId:       string       — e.g. "RULE-01"
 *   scope:        "brand" | "platform" | "cart"
 *   appliesTo:    string       — e.g. "Natura Casa", "Amazon India" (not used for cart)
 *   type:         "percentage" | "flat"
 *   value:        number       — percentage as integer (15 = 15%), flat in rupees
 *   stackable:    boolean
 *   minCartValue: number       — required for cart scope; threshold in rupees
 * }
 *
 * CartItem {
 *   itemId:    string       — e.g. "ITEM-01"
 *   product:   string
 *   brand:     string
 *   platform:  string
 *   basePrice: number       — in rupees
 * }
 *
 * DiscountResult {
 *   itemId:        string
 *   product:       string
 *   brand:         string
 *   platform:      string
 *   basePrice:     number
 *   finalPrice:    number
 *   totalDiscount: number
 *   appliedRules:  string[]
 *   skippedRules:  string[]
 *   reasoning:     string   — customer-readable explanation
 * }
 *
 * CartCalculation {
 *   items:      DiscountResult[]
 *   subtotal:   number          — sum of item final prices after item-level discounts
 *   cartOffer:  CartOffer | null
 *   finalTotal: number          — subtotal minus cart offer (if any)
 * }
 *
 * CartOffer {
 *   ruleId:     string
 *   discount:   number
 *   reasoning:  string
 * }
 */

import { roundCurrency } from './priceMath.js'

function itemLevelRules(rules) {
  return rules.filter((r) => r.scope !== 'cart')
}

function cartLevelRules(rules) {
  return rules.filter((r) => r.scope === 'cart')
}

/**
 * Returns true if the rule applies to this cart item.
 */
export function ruleMatchesItem(item, rule) {
  const normalise = (s) => s.trim().toLowerCase()
  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }
  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }
  return false
}

/**
 * Calculates the rupee discount a rule gives on a given price.
 * Uses the provided price, not the original base price — important for stacking.
 */
export function calculateDiscountAmount(price, rule) {
  if (rule.type === 'percentage') {
    return roundCurrency(price * rule.value / 100)
  }
  if (rule.type === 'flat') {
    return roundCurrency(rule.value)
  }
  return 0
}

/**
 * Builds the customer-facing reasoning string for an applied rule.
 */
function ruleToReasoning(rule) {
  const scopeLabel = rule.scope === 'brand' ? 'Brand' : 'Platform'
  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }
  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }
  return `${scopeLabel} offer applied`
}

/**
 * Applies the active discount rules to a single cart item.
 * Returns a DiscountResult.
 *
 * Logic:
 *   1. Find all rules that match this item.
 *   2. Among non-stackable rules, pick the one giving the largest discount.
 *   3. Apply any stackable rules on top of that price.
 *   4. Build the reasoning string from what was applied.
 */
export function applyDiscounts(item, rules) {
  const matchingRules = itemLevelRules(rules).filter((r) => ruleMatchesItem(item, r))

  // No rules match — return base price with explanation
  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((r) => !r.stackable)
  const stackable = matchingRules.filter((r) => r.stackable)

  // Pick the non-stackable rule that gives the largest saving
  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a)
    )
    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  // Apply winner first, then stack on top
  let price = item.basePrice
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    price -= calculateDiscountAmount(price, winner)
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    price -= calculateDiscountAmount(price, rule)
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = roundCurrency(price)

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount: item.basePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((r) => r.ruleId),
    reasoning: reasoningParts.join(' + '),
  }
}

/**
 * Evaluates cart-level rules against the post-item-discount subtotal.
 * When multiple cart rules qualify, picks the one with the largest rupee saving.
 */
export function applyCartOffer(subtotal, rules) {
  const qualifying = cartLevelRules(rules).filter(
    (rule) => subtotal >= rule.minCartValue
  )

  if (qualifying.length === 0) {
    return null
  }

  const winner = qualifying.reduce((best, rule) => {
    const discount = calculateDiscountAmount(subtotal, rule)
    if (!best || discount > best.discount) {
      return { rule, discount }
    }
    return best
  }, null)

  const { rule, discount } = winner
  const threshold = rule.minCartValue.toLocaleString('en-IN')
  let reasoning

  if (rule.type === 'percentage') {
    reasoning = `Cart offer: ${rule.value}% off — Rs.${discount.toLocaleString('en-IN')} saved (cart total ≥ Rs.${threshold})`
  } else {
    reasoning = `Cart offer: Rs.${rule.value} off — Rs.${discount.toLocaleString('en-IN')} saved (cart total ≥ Rs.${threshold})`
  }

  return {
    ruleId: rule.ruleId,
    discount,
    reasoning,
  }
}

/**
 * Full cart calculation: item-level discounts first, then cart-level offer.
 */
export function calculateCart(cartItems, rules) {
  const items = cartItems.map((item) => applyDiscounts(item, rules))
  const subtotal = cartTotal(items)
  const cartOffer = applyCartOffer(subtotal, rules)
  const finalTotal = cartOffer ? subtotal - cartOffer.discount : subtotal

  return {
    items,
    subtotal,
    cartOffer,
    finalTotal,
  }
}

/**
 * Runs applyDiscounts across every item in the cart.
 * Returns an array of DiscountResult objects (item-level only).
 */
export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

/**
 * Sums the final prices across all item results.
 */
export function cartTotal(results) {
  return results.reduce((sum, r) => sum + r.finalPrice, 0)
}
