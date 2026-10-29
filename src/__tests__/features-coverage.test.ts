// Every class feature and subclass feature up to level 12 has an effect entry (src/data/custom/effects/<class>.json):
// computed (modifiers, grants, uses, flags, AC formula, choices, computed values, spells, mastery, overrides) or
// explicitly text-only with the reason. Structural features (Ability Score Improvement, "<Class> Subclass") are exempt.
// Species traits, feats and conditions must have an entry too. Option ids referenced by choices must exist.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'
import type { EffectDef } from '../data/types'

const MAX_LEVEL = 12
const EXEMPT = /:ability-score-improvement$|-subclass$|:epic-boon$/

const modelled = (e: EffectDef | undefined) =>
  !!e &&
  !!(
    e.modifiers?.length ||
    e.grants?.length ||
    e.uses ||
    e.flags?.length ||
    e.acFormula ||
    e.choices?.length ||
    e.computed?.length ||
    e.spells ||
    e.mastery !== undefined ||
    e.overrides?.length ||
    e.textOnly
  )

describe('feature coverage (levels 1–12)', () => {
  for (const cls of rules.classes.values()) {
    it(`${cls.id}: every feature up to level ${MAX_LEVEL} has an effect entry`, () => {
      const missing: string[] = []
      for (const f of cls.features)
        if (f.level <= MAX_LEVEL && !EXEMPT.test(f.id) && !modelled(rules.effects.get(f.id)))
          missing.push(`${f.id} (level ${f.level})`)
      for (const sub of cls.subclasses)
        for (const f of sub.features)
          if (f.level <= MAX_LEVEL && !modelled(rules.effects.get(f.id))) missing.push(`${f.id} (level ${f.level})`)
      expect(missing).toEqual([])
    })
  }
  it('every species trait has an effect entry', () => {
    const missing: string[] = []
    for (const sp of rules.species.values())
      for (const t of sp.traits) if (!modelled(rules.effects.get(t.id))) missing.push(t.id)
    expect(missing).toEqual([])
  })
  it('every feat and condition has an effect entry', () => {
    const missing: string[] = []
    for (const f of rules.feats.values()) if (!modelled(rules.effects.get(`feat:${f.id}`))) missing.push(`feat:${f.id}`)
    for (const c of rules.conditions.values())
      if (!modelled(rules.effects.get(`condition:${c.id}`))) missing.push(`condition:${c.id}`)
    expect(missing).toEqual([])
  })
  it('effect ids point at real owners, and option choices at real class options', () => {
    const owners = new Set<string>()
    for (const cls of rules.classes.values()) {
      for (const f of cls.features) owners.add(f.id)
      for (const sub of cls.subclasses) for (const f of sub.features) owners.add(f.id)
      for (const list of Object.values(cls.options ?? {})) for (const o of list) owners.add(o.id)
    }
    for (const sp of rules.species.values()) for (const t of sp.traits) owners.add(t.id)
    for (const f of rules.feats.values()) owners.add(`feat:${f.id}`)
    for (const c of rules.conditions.values()) owners.add(`condition:${c.id}`)
    // Magic items (custom/effects/magic-items.json; coverage in magic-items-coverage.test.ts).
    for (const m of rules.magicItems.values()) owners.add(`item:${m.id}`)
    const bad: string[] = []
    for (const e of rules.effects.values()) {
      if (!owners.has(e.id)) bad.push(`unknown owner ${e.id}`)
      for (const ch of e.choices ?? []) {
        if (ch.kind !== 'option' || !ch.from) continue
        const cid = e.id.split(':')[0]
        for (const k of Array.isArray(ch.from) ? ch.from : [ch.from])
          if (!rules.classes.get(cid)?.options?.[k]) bad.push(`${e.id}: no option list ${k}`)
      }
      for (const s of [...(e.spells?.always ?? [])]) if (!rules.spells.has(s)) bad.push(`${e.id}: unknown spell ${s}`)
    }
    expect(bad).toEqual([])
  })
})
