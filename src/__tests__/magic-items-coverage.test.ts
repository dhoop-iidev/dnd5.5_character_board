// Every SRD magic item has an effect entry `item:<id>` in custom/effects/magic-items.json (what the engine computes, or
// `textOnly` saying why it is only described) and a bilingual one-line summary `item:<id>` in custom/summaries-items.json;
// no entry without an item; every spell an item casts exists.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'
import effects from '../data/custom/effects/magic-items.json'
import summaries from '../data/custom/summaries-items.json'
import type { EffectDef } from '../data/types'

const list = effects as unknown as EffectDef[]
const sums = summaries as Record<string, { en: string; fr: string }>

const computes = (e: EffectDef) =>
  !!(
    e.modifiers?.length ||
    e.grants?.length ||
    e.choices?.length ||
    e.computed?.length ||
    e.flags?.length ||
    e.acFormula ||
    e.spellItem
  )

describe('magic item effects and summaries', () => {
  const byId = new Map(list.map((e) => [e.id, e]))

  it('every magic item has an effect entry or a text-only reason', () => {
    const missing = [...rules.magicItems.keys()].filter((id) => {
      const e = byId.get(`item:${id}`)
      return !e || (!computes(e) && !e.textOnly?.en)
    })
    expect(missing).toEqual([])
  })

  it('every magic item has a bilingual summary', () => {
    const missing = [...rules.magicItems.keys()].filter((id) => !sums[`item:${id}`]?.en || !sums[`item:${id}`]?.fr)
    expect(missing).toEqual([])
  })

  it('no entry or summary without an item, every entry cites the SRD page in both languages', () => {
    expect(list.filter((e) => !rules.magicItems.has(e.id.replace(/^item:/, ''))).map((e) => e.id)).toEqual([])
    expect(Object.keys(sums).filter((k) => !rules.magicItems.has(k.replace(/^item:/, '')))).toEqual([])
    expect(list.filter((e) => !e.source?.page || !e.source?.frPage).map((e) => e.id)).toEqual([])
  })

  it('every spell an item casts exists', () => {
    const bad = list.flatMap((e) =>
      (e.spellItem?.spells ?? []).filter((s) => !rules.spells.has(s.spellId)).map((s) => `${e.id}: ${s.spellId}`),
    )
    expect(bad).toEqual([])
  })
})
