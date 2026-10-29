// Sorcerer features against the SRD 5.2.1 text: Sorcerer Features table (p. 64), Innate Sorcery (p. 65), Font of Magic and
// Metamagic (p. 66), Sorcerous Restoration (p. 66), Draconic Sorcery (p. 69–70); the level 10 example in examples/.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

const sorcerer = (
  level: number,
  abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {},
) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'acolyte',
      classId: 'sorcerer',
      lang: 'en',
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16, ...abilities },
    },
    rules,
  )
  c.background.abilities = { cha: 2, wis: 1 }
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'sorcerer',
      hpRoll: 4,
      hpFixed: true,
      choices: {},
      ...(i === 2 ? { subclassId: 'sorcerer:draconic-sorcery' } : {}),
    })
  c.spellcasting.sorcerer = { prepared: [], cantrips: [] }
  return c
}
const resource = (c: ReturnType<typeof sorcerer>, id: string) => compute(c, rules).resources.find((r) => r.id === id)

describe('Sorcery Points = Sorcerer level from level 2 (Sorcerer Features table, SRD p. 64; Font of Magic p. 66)', () => {
  it('no Font of Magic at level 1', () => expect(resource(sorcerer(1), 'sorcerer:font-of-magic')).toBeUndefined())
  it('2 points at level 2, 5 at level 5, 10 at level 10, regained on a Long Rest', () => {
    expect(resource(sorcerer(2), 'sorcerer:font-of-magic')).toMatchObject({ max: 2, per: 'long' })
    expect(resource(sorcerer(5), 'sorcerer:font-of-magic')?.max).toBe(5)
    expect(resource(sorcerer(10), 'sorcerer:font-of-magic')?.max).toBe(10)
  })
})

describe('Innate Sorcery (SRD p. 65)', () => {
  it('two uses per Long Rest', () =>
    expect(resource(sorcerer(1), 'sorcerer:innate-sorcery')).toMatchObject({ max: 2, per: 'long' }))
  it('+1 spell save DC and Advantage on Sorcerer spell attacks only while the toggle is on', () => {
    const c = sorcerer(1) // Cha 18 → +4, PB +2: DC 14
    let s = compute(c, rules)
    expect(s.spellcasting[0].dc.total).toBe(8 + 2 + 4)
    expect(s.pool.advantage('attack.spell')).toEqual([])
    expect(s.pool.toggles.map((t) => t.key)).toContain('innate-sorcery')
    c.toggles['innate-sorcery'] = true
    s = compute(c, rules)
    expect(s.spellcasting[0].dc.total).toBe(8 + 2 + 4 + 1)
    expect(s.pool.advantage('attack.spell').length).toBe(1)
  })
})

describe('Metamagic: two options at level 2, two more at 10 and 17 (SRD p. 66)', () => {
  const ids = [
    'sorcerer:metamagic:quickened-spell',
    'sorcerer:metamagic:twinned-spell',
    'sorcerer:metamagic:subtle-spell',
    'sorcerer:metamagic:careful-spell',
  ]
  const countWarnings = (c: ReturnType<typeof sorcerer>) =>
    validate(c, rules).filter((w) => w.id === 'choice-sorcerer:metamagic')
  it('level 2: two options, no warning; the chosen options become owners', () => {
    const c = sorcerer(2)
    c.featureChoices['sorcerer:metamagic'] = ids.slice(0, 2)
    expect(countWarnings(c)).toEqual([])
    expect(compute(c, rules).owners.some((o) => o.id === ids[0] && o.optionOf === 'sorcerer:metamagic')).toBe(true)
  })
  it('level 2 with three options: error; level 10 expects four', () => {
    const c = sorcerer(2)
    c.featureChoices['sorcerer:metamagic'] = ids.slice(0, 3)
    expect(countWarnings(c).map((w) => w.severity)).toEqual(['error'])
    const d = sorcerer(10)
    d.featureChoices['sorcerer:metamagic'] = ids.slice(0, 2)
    expect(countWarnings(d)[0]?.message.en).toContain('choose 4')
    d.featureChoices['sorcerer:metamagic'] = ids
    expect(countWarnings(d)).toEqual([])
  })
  it('Careful Spell protects Cha modifier creatures (minimum 1) (SRD p. 66)', () => {
    const c = sorcerer(2)
    c.featureChoices['sorcerer:metamagic'] = ['sorcerer:metamagic:careful-spell', 'sorcerer:metamagic:subtle-spell']
    expect(
      compute(c, rules).featureValues.find((v) => v.ownerId === 'sorcerer:metamagic:careful-spell')?.stat.total,
    ).toBe(4)
  })
})

describe('Sorcerous Restoration (SRD p. 66): once per Long Rest, half the Sorcerer level rounded down', () => {
  it('level 5: 2 points; level 10: 5 points', () => {
    expect(resource(sorcerer(5), 'sorcerer:sorcerous-restoration')).toMatchObject({ max: 1, per: 'long' })
    expect(
      compute(sorcerer(5), rules).featureValues.find((v) => v.ownerId === 'sorcerer:sorcerous-restoration')?.stat.total,
    ).toBe(2)
    expect(
      compute(sorcerer(10), rules).featureValues.find((v) => v.ownerId === 'sorcerer:sorcerous-restoration')?.stat
        .total,
    ).toBe(5)
  })
})

describe('Draconic Sorcery', () => {
  it('Draconic Resilience: +1 HP per Sorcerer level (3 at level 3) and base AC 10 + Dex + Cha without armor (SRD p. 69)', () => {
    const c = sorcerer(3) // Con 14 → +2: 6 + 2 + 2 × (4 + 2) = 20, +3
    const s = compute(c, rules)
    expect(s.hpMax.total).toBe(20 + 3)
    expect(s.hpMax.parts.find((p) => p.sourceId === 'sorcerer:draconic-sorcery:draconic-resilience')?.value).toBe(3)
    const scales = s.acOptions.find((o) => o.id === 'sorcerer:draconic-sorcery:draconic-resilience')!
    expect(scales.stat.total).toBe(10 + 2 + 4)
    expect(s.ac.total).toBe(16)
    c.inventory = [{ uid: 'a', kind: 'armor', refId: 'leather-armor', quantity: 1, location: 'worn' }]
    expect(
      compute(c, rules).acOptions.find((o) => o.id === 'sorcerer:draconic-sorcery:draconic-resilience')?.available,
    ).toBe(false)
  })
  it('Draconic Spells are always prepared and do not count (SRD p. 70)', () => {
    const s = compute(sorcerer(5), rules)
    expect(s.spellcasting[0].alwaysPrepared).toEqual([
      'alter-self',
      'chromatic-orb',
      'command',
      'dragons-breath',
      'fear',
      'fly',
    ])
  })
  it('Elemental Affinity: Resistance to the chosen type and Cha to one damage roll (SRD p. 70)', () => {
    const c = sorcerer(6)
    c.featureChoices['sorcerer:draconic-sorcery:elemental-affinity'] = 'cold'
    const s = compute(c, rules)
    expect(
      s.pool.grants.some(
        (g) =>
          g.owner.id === 'sorcerer:draconic-sorcery:elemental-affinity' &&
          g.grant.kind === 'resistance' &&
          g.grant.on === 'cold',
      ),
    ).toBe(true)
    expect(s.featureValues.find((v) => v.ownerId === 'sorcerer:draconic-sorcery:elemental-affinity')?.stat.total).toBe(
      4,
    )
    expect(
      validate(c, rules).filter((w) => w.id.startsWith('choice-sorcerer:draconic-sorcery:elemental-affinity')),
    ).toEqual([])
  })
})

describe('examples/ensorceleuse-niveau-10.json: Dragonborn Draconic Sorcerer 10', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'ensorceleuse-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('Cha 20 (15 + 2 Acolyte + 2 + 1 ASIs), PB +4, spell save DC 17, spell attack +9 (SRD p. 64)', () => {
    expect(s.abilities.cha.score.total).toBe(20)
    expect(s.pb).toBe(4)
    expect(s.spellcasting[0].dc.total).toBe(17)
    expect(s.spellcasting[0].attack.total).toBe(9)
  })
  it('hit points 72: 6 + 2, then 9 × (4 + 2), plus 10 from Draconic Resilience (SRD p. 22, 69)', () =>
    expect(s.hpMax.total).toBe(72))
  it('level 10 table row: 6 cantrips, 15 prepared spells, slots 4/3/3/3/2, 10 Sorcery Points (SRD p. 64)', () => {
    expect(s.spellcasting[0].cantripsMax).toBe(6)
    expect(s.spellcasting[0].preparedMax).toBe(15)
    expect(s.slots).toEqual([4, 3, 3, 3, 2])
    expect(s.resources.find((r) => r.id === 'sorcerer:font-of-magic')?.max).toBe(10)
  })
  it('AC 17 from dragon scales (10 + 2 Dex + 5 Cha), Fire Resistance from both ancestry and affinity', () => {
    expect(s.ac.total).toBe(17)
    expect(s.pool.grants.filter((g) => g.grant.kind === 'resistance' && g.grant.on === 'fire').length).toBe(2)
  })
})
