// Custom feats (house rule #4): a feat from another book entered by the player replaces the level-4 Ability Score
// Improvement of the level-5 example Fighter; its +1, its modifiers, and its prerequisites are handled like
// an SRD feat's, and only for the character that holds it.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import type { Character, CustomFeat } from '../character'
import { migrate } from '../migrate'
import fighter from '../../../examples/guerriere-niveau-5.json'

const FEAT: CustomFeat = {
  id: 'custom-feat-1',
  name: 'Sharp Reflexes',
  category: 'general',
  book: 'Some Book p. 12',
  text: 'A player-written summary.',
  prereq: { level: 4 },
  abilityIncrease: ['str', 'dex'],
  modifiers: [{ target: 'initiative', value: 2 }],
}

function make(feat: CustomFeat = FEAT): Character {
  const c = migrate(structuredClone(fighter)) as Character
  c.customFeats = [feat]
  c.levels[3].feat = { featId: feat.id, abilities: { str: 1 } }
  return c
}

describe('custom feats', () => {
  it('is taken instead of the Ability Score Improvement: +1, modifiers, popup source', () => {
    const before = compute(migrate(structuredClone(fighter)) as Character, rules)
    const c = make()
    const s = compute(c, rules)
    expect(s.abilities.str.score.total).toBe(before.abilities.str.score.total - 1)
    expect(s.initiative.total).toBe(before.initiative.total + 2)
    const f = s.feats.find((x) => x.def.id === FEAT.id)!
    expect(f.def.name.fr).toBe('Sharp Reflexes')
    expect(f.def.source).toMatchObject({ book: 'Some Book p. 12', houseRule: 4 })
    expect(f.def.text.en).toBe('<p>A player-written summary.</p>')
    expect(validate(c, rules).filter((w) => /feat/.test(w.id))).toEqual([])
    // The shared rules are untouched.
    expect(rules.feats.has(FEAT.id)).toBe(false)
  })

  it('checks its prerequisites and its +1', () => {
    const ids = (c: Character) => validate(c, rules).map((w) => w.id)
    expect(ids(make({ ...FEAT, prereq: { level: 8 } }))).toContain('feat-prereq-level-4')
    expect(ids(make({ ...FEAT, prereq: { abilities: ['int'], min: 13 } }))).toContain('feat-prereq-ability-4')
    const wrong = make()
    wrong.levels[3].feat = { featId: FEAT.id, abilities: { cha: 1 } }
    expect(ids(wrong).some((id) => id.startsWith('feat-asi') || id.includes('asi'))).toBe(true)
  })

  it('escapes the player text', () => {
    const s = compute(make({ ...FEAT, text: '<b>x</b>\n\nsecond' }), rules)
    expect(s.feats.find((x) => x.def.id === FEAT.id)!.def.text.en).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p><p>second</p>')
  })
})
