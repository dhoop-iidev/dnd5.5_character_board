// Every SRD 5.2.1 spell has a one-line summary (src/data/custom/summaries-spells.json) in English, French and Spanish, shown on the
// spell rows of the Spells pane, and no spell summary points at a missing spell.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'

describe('spell summaries', () => {
  it('every spell has a non-empty summary in English, French and Spanish', () => {
    const missing = [...rules.spells.keys()].filter((id) => {
      const s = rules.summaries.get(`spell:${id}`)
      return !s || !s.en.trim() || !s.fr.trim() || !s.es?.trim()
    })
    expect(missing).toEqual([])
  })
  it('no spell summary points at a missing spell', () => {
    const orphans = [...rules.summaries.keys()].filter(
      (k) => k.startsWith('spell:') && !rules.spells.has(k.slice('spell:'.length)),
    )
    expect(orphans).toEqual([])
  })
  it('summaries stay one line (at most 120 characters)', () => {
    const long = [...rules.spells.keys()].filter((id) => {
      const s = rules.summaries.get(`spell:${id}`)
      return !!s && (s.en.length > 120 || s.fr.length > 120 || (s.es?.length ?? 0) > 120)
    })
    expect(long).toEqual([])
  })
})
