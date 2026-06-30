/**
 * Sequential rule IDs — RULE-01, RULE-02, … continuing from loaded CSV rules.
 */

const RULE_NUM_RE = /^RULE-(\d+)$/i

export function getNextRuleId(existingRules) {
  let max = 0
  for (const rule of existingRules) {
    const match = rule.ruleId?.match(RULE_NUM_RE)
    if (match) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }
  return `RULE-${String(max + 1).padStart(2, '0')}`
}
