import { describe, expect, it } from 'vitest'
import { getNextRuleId } from './ruleIds.js'

describe('getNextRuleId', () => {
  it('continues after RULE-04 from CSV', () => {
    const rules = [
      { ruleId: 'RULE-01' },
      { ruleId: 'RULE-02' },
      { ruleId: 'RULE-03' },
      { ruleId: 'RULE-04' },
    ]
    expect(getNextRuleId(rules)).toBe('RULE-05')
  })

  it('increments after each NL add', () => {
    const rules = [{ ruleId: 'RULE-01' }, { ruleId: 'RULE-05' }]
    expect(getNextRuleId(rules)).toBe('RULE-06')
  })

  it('ignores non-sequential RULE-NL ids when finding max', () => {
    const rules = [
      { ruleId: 'RULE-04' },
      { ruleId: 'RULE-NL-F63BBC' },
    ]
    expect(getNextRuleId(rules)).toBe('RULE-05')
  })
})
