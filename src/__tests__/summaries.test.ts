// Every class and subclass feature, species trait, species, background, feat, Eldritch Invocation and Metamagic option has
// a one-line summary (src/data/custom/summaries.json) in English, French and Spanish, as has every card of the Combat pane's "Your turn"
// box, and no summary points at a missing id.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'
import { TURN_CARDS } from '../engine/turn'

const has = (key: string) => {
  const s = rules.summaries.get(key)
  return !!s && s.en.trim() !== '' && s.fr.trim() !== '' && !!s.es?.trim()
}

function expectedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const cls of rules.classes.values()) {
    for (const f of cls.features) keys.add(`feature:${f.id}`)
    for (const sub of cls.subclasses) for (const f of sub.features) keys.add(`feature:${f.id}`)
    for (const [kind, list] of Object.entries(cls.options ?? {}))
      for (const o of list) keys.add(`${kind === 'eldritch-invocation' ? 'invocation' : kind}:${o.id}`)
  }
  for (const sp of rules.species.values()) {
    keys.add(`species:${sp.id}`)
    for (const t of sp.traits) keys.add(`trait:${t.id}`)
  }
  for (const b of rules.backgrounds.values()) keys.add(`background:${b.id}`)
  for (const f of rules.feats.values()) keys.add(`feat:${f.id}`)
  // Cards of the Combat pane's "Your turn" box.
  for (const id of TURN_CARDS) keys.add(`action:${id}`)
  return keys
}

/** Resource ids are the ids of the features, traits and feats that carry `uses` (custom/effects/*.json). */
function resourceOwners(): Set<string> {
  const ids = new Set<string>()
  for (const [id, e] of rules.effects) if (e.uses) ids.add(id)
  return ids
}

describe('one-line summaries', () => {
  const expected = expectedKeys()

  it('every feature, trait, species, background, feat and class option has a summary in English, French and Spanish', () => {
    const missing = [...expected].filter((k) => !has(k))
    expect(missing).toEqual([])
  })

  it('no summary points at a missing id', () => {
    const resources = resourceOwners()
    // `spell:` keys are checked by summaries-spells.test.ts, `item:` keys by magic-items-coverage.test.ts.
    const orphans = [...rules.summaries.keys()].filter(
      (k) =>
        !k.startsWith('spell:') &&
        !k.startsWith('item:') &&
        (k.startsWith('resource:') ? !resources.has(k.slice('resource:'.length)) : !expected.has(k)),
    )
    expect(orphans).toEqual([])
  })

  it('resource summaries are not empty', () => {
    const empty = [...rules.summaries.keys()].filter((k) => k.startsWith('resource:') && !has(k))
    expect(empty).toEqual([])
  })
})
