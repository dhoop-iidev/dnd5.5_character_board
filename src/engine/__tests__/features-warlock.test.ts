// Warlock features against the SRD 5.2.1 text: Warlock Features table and Eldritch Invocations (p. 70), Pact Magic (p. 71),
// Magical Cunning and Contact Patron (p. 72), Eldritch Invocation Options (p. 72–74), Fiend Patron (p. 76); the level 10
// example in examples/.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

const INV = (name: string) => `warlock:eldritch-invocation:${name}`

const warlock = (
  level: number,
  invocations: string[] = [],
  abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {},
) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'criminal',
      classId: 'warlock',
      lang: 'en',
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16, ...abilities },
    },
    rules,
  )
  c.background.abilities = { dex: 2, con: 1 }
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'warlock',
      hpRoll: 5,
      hpFixed: true,
      choices: {},
      ...(i === 2 ? { subclassId: 'warlock:fiend-patron' } : {}),
    })
  c.spellcasting.warlock = { prepared: [], cantrips: ['eldritch-blast'] }
  c.featureChoices['warlock:eldritch-invocations'] = invocations.map(INV)
  return c
}
const invocationWarnings = (c: ReturnType<typeof warlock>) =>
  validate(c, rules).filter((w) => w.id.startsWith('choice-warlock:eldritch-invocations'))

describe('Pact Magic slots: number and level by Warlock level (Warlock Features table, SRD p. 70–71)', () => {
  const cases: [number, number, number][] = [
    [1, 1, 1],
    [2, 2, 1],
    [3, 2, 2],
    [5, 2, 3],
    [7, 2, 4],
    [9, 2, 5],
    [11, 3, 5],
    [17, 4, 5],
  ]
  for (const [level, slots, slotLevel] of cases)
    it(`level ${level}: ${slots} slot(s) of level ${slotLevel}, no Spellcasting slots`, () => {
      const s = compute(warlock(level), rules)
      expect(s.pact).toMatchObject({ slots, level: slotLevel, used: 0 })
      expect(s.slots).toEqual([])
      expect(s.spellcasting[0].maxSpellLevel).toBe(slotLevel)
    })
})

describe('Eldritch Invocations: count from the Invocations column (SRD p. 70)', () => {
  it('1 at level 1, 3 at level 2, 5 at level 5, 7 at level 10', () => {
    expect(invocationWarnings(warlock(1, ['pact-of-the-tome']))).toEqual([])
    expect(invocationWarnings(warlock(2, ['pact-of-the-tome', 'armor-of-shadows', 'eldritch-mind']))).toEqual([])
    expect(
      invocationWarnings(
        warlock(5, ['pact-of-the-tome', 'armor-of-shadows', 'eldritch-mind', 'agonizing-blast', 'devils-sight']),
      ),
    ).toEqual([])
    const w = invocationWarnings(warlock(10, ['pact-of-the-tome']))
    expect(w.length).toBe(1)
    expect(w[0].message.en).toContain('choose 7')
  })
  it('too many invocations is an error', () => {
    const w = invocationWarnings(warlock(1, ['pact-of-the-tome', 'armor-of-shadows']))
    expect(w.map((x) => x.severity)).toEqual(['error'])
    expect(w[0].id).toBe('choice-warlock:eldritch-invocations')
  })
  it('a "Level 5+ Warlock" prerequisite is checked against the Warlock level (SRD p. 70 "Prerequisites")', () => {
    const w = invocationWarnings(warlock(2, ['eldritch-smite', 'pact-of-the-blade', 'eldritch-mind']))
    expect(w.map((x) => x.id)).toEqual([`choice-warlock:eldritch-invocations-${INV('eldritch-smite')}-level`])
    expect(
      invocationWarnings(
        warlock(5, ['eldritch-smite', 'pact-of-the-blade', 'eldritch-mind', 'devils-sight', 'agonizing-blast']),
      ),
    ).toEqual([])
  })
  it('the chosen invocations become owners of the Eldritch Invocations feature', () => {
    const s = compute(warlock(2, ['pact-of-the-tome', 'armor-of-shadows', 'eldritch-mind']), rules)
    expect(s.owners.filter((o) => o.optionOf === 'warlock:eldritch-invocations').map((o) => o.id)).toEqual([
      INV('pact-of-the-tome'),
      INV('armor-of-shadows'),
      INV('eldritch-mind'),
    ])
  })
})

describe('Eldritch Invocation Options (SRD p. 72–74)', () => {
  it('Armor of Shadows: Mage Armor at will, base AC 13 + Dex among the AC options, not while wearing armor (p. 72)', () => {
    const c = warlock(1, ['armor-of-shadows']) // Dex 16 → +3
    let s = compute(c, rules)
    const shadows = s.acOptions.find((o) => o.id === INV('armor-of-shadows'))!
    expect(shadows.stat.total).toBe(13 + 3)
    expect(shadows.available).toBe(true)
    expect(s.ac.total).toBe(16)
    c.inventory = [{ uid: 'a', kind: 'armor', refId: 'leather-armor', quantity: 1, location: 'worn' }]
    s = compute(c, rules)
    expect(s.acOptions.find((o) => o.id === INV('armor-of-shadows'))?.available).toBe(false)
    expect(s.ac.total).toBe(11 + 3)
  })
  it("Devil's Sight: 120 feet (p. 72); Eldritch Mind: Advantage on Con saves to keep Concentration (p. 72)", () => {
    const s = compute(warlock(2, ['devils-sight', 'eldritch-mind', 'pact-of-the-tome']), rules)
    expect(
      s.pool.grants.some(
        (g) => g.owner.id === INV('devils-sight') && g.grant.kind === 'darkvision' && g.grant.value === 120,
      ),
    ).toBe(true)
    expect(s.pool.advantage('save.con').length).toBe(1)
  })
  it('Thirsting Blade: two attacks (p. 74); Devouring Blade: three (p. 72)', () => {
    expect(compute(warlock(1), rules).attacksPerAction).toBe(1)
    expect(compute(warlock(5, ['pact-of-the-blade', 'thirsting-blade']), rules).attacksPerAction).toBe(2)
    expect(
      compute(warlock(12, ['pact-of-the-blade', 'thirsting-blade', 'devouring-blade']), rules).attacksPerAction,
    ).toBe(3)
  })
  it('Pact of the Blade: the pact-weapon flag only while the bond toggle is on (p. 74)', () => {
    const c = warlock(1, ['pact-of-the-blade'])
    let s = compute(c, rules)
    expect(s.pool.flags.has('pact-weapon')).toBe(false)
    expect(s.pool.toggles.map((t) => t.key)).toContain('pact-weapon')
    c.toggles['pact-weapon'] = true
    s = compute(c, rules)
    expect(s.pool.flags.has('pact-weapon')).toBe(true)
  })
  it('Pact of the Tome: three cantrips and two level 1 rituals, always prepared and not counted (p. 74)', () => {
    const c = warlock(1, ['pact-of-the-tome'])
    c.featureChoices[`${INV('pact-of-the-tome')}#cantrips`] = ['guidance', 'light', 'mending']
    c.featureChoices[`${INV('pact-of-the-tome')}#rituals`] = ['detect-magic', 'find-familiar']
    c.spellcasting.warlock = { prepared: ['hex', 'charm-person'], cantrips: ['eldritch-blast', 'prestidigitation'] }
    const s = compute(c, rules)
    expect(s.spellcasting[0].alwaysPrepared).toEqual(['guidance', 'light', 'mending', 'detect-magic', 'find-familiar'])
    expect(validate(c, rules).filter((w) => w.area === 'spells' || w.id.includes('pact-of-the-tome'))).toEqual([])
    c.featureChoices[`${INV('pact-of-the-tome')}#cantrips`] = ['guidance', 'light']
    expect(validate(c, rules).some((w) => w.id === `choice-${INV('pact-of-the-tome')}#cantrips`)).toBe(true)
  })
  it('Gift of the Depths: Swim Speed equal to the Speed, Water Breathing once per Long Rest (p. 73)', () => {
    const s = compute(warlock(5, ['gift-of-the-depths']), rules)
    expect(s.otherSpeeds).toEqual([{ kind: 'swim', ft: 30, from: [expect.anything()] }])
    expect(s.resources.find((r) => r.id === INV('gift-of-the-depths'))).toMatchObject({ max: 1, per: 'long' })
  })
  it('Fiendish Vigor: 8 Temporary HP (False Life maximized, p. 73); Agonizing Blast adds Cha (p. 72)', () => {
    const s = compute(warlock(2, ['fiendish-vigor', 'agonizing-blast', 'pact-of-the-tome']), rules)
    expect(s.featureValues.find((v) => v.ownerId === INV('fiendish-vigor'))?.stat.total).toBe(8)
    expect(s.featureValues.find((v) => v.ownerId === INV('agonizing-blast'))?.stat.total).toBe(3)
  })
  it('Lessons of the First Ones grants an Origin feat, stored in extraFeats (p. 73)', () => {
    const c = warlock(2, ['lessons-of-the-first-ones', 'pact-of-the-tome', 'eldritch-mind'])
    expect(validate(c, rules).some((w) => w.id === `choice-${INV('lessons-of-the-first-ones')}`)).toBe(true)
    c.extraFeats[INV('lessons-of-the-first-ones')] = { featId: 'alert' }
    const s = compute(c, rules)
    expect(s.feats.some((f) => f.def.id === 'alert' && f.grantedBy === INV('lessons-of-the-first-ones'))).toBe(true)
    expect(s.initiative.total).toBe(3 + 2) // Dex +3, Alert adds the Proficiency Bonus
  })
})

describe('Warlock class features', () => {
  it('Magical Cunning: once per Long Rest (SRD p. 72)', () =>
    expect(compute(warlock(2), rules).resources.find((r) => r.id === 'warlock:magical-cunning')).toMatchObject({
      max: 1,
      per: 'long',
    }))
  it('Contact Patron: Contact Other Plane always prepared, one free casting per Long Rest (SRD p. 72)', () => {
    const s = compute(warlock(9), rules)
    expect(s.spellcasting[0].alwaysPrepared).toContain('contact-other-plane')
    expect(s.resources.find((r) => r.id === 'warlock:contact-patron')?.max).toBe(1)
  })
  it('Mystic Arcanum: one use at level 11, two at 13 (SRD p. 72)', () => {
    expect(compute(warlock(10), rules).resources.find((r) => r.id === 'warlock:mystic-arcanum')).toBeUndefined()
    expect(compute(warlock(11), rules).resources.find((r) => r.id === 'warlock:mystic-arcanum')?.max).toBe(1)
    expect(compute(warlock(13), rules).resources.find((r) => r.id === 'warlock:mystic-arcanum')?.max).toBe(2)
  })
})

describe('Fiend Patron (SRD p. 76)', () => {
  it("Dark One's Blessing: Temporary HP = Cha modifier + Warlock level", () => {
    const s = compute(warlock(3), rules) // Cha 16 → +3
    expect(s.featureValues.find((v) => v.ownerId === 'warlock:fiend-patron:dark-ones-blessing')?.stat.total).toBe(3 + 3)
  })
  it('Fiend Spells are always prepared by level and do not count', () => {
    expect(compute(warlock(3), rules).spellcasting[0].alwaysPrepared).toEqual([
      'burning-hands',
      'command',
      'scorching-ray',
      'suggestion',
    ])
    expect(compute(warlock(5), rules).spellcasting[0].alwaysPrepared).toContain('fireball')
  })
  it("Dark One's Own Luck: Cha modifier uses (minimum 1) per Long Rest, 1d10", () => {
    const r = compute(warlock(6), rules).resources.find((x) => x.id === 'warlock:fiend-patron:dark-ones-own-luck')
    expect(r).toMatchObject({ max: 3, per: 'long' })
    expect(
      compute(warlock(6, [], { cha: 8 }), rules).resources.find(
        (x) => x.id === 'warlock:fiend-patron:dark-ones-own-luck',
      )?.max,
    ).toBe(1)
    expect(
      compute(warlock(6), rules).featureValues.find((v) => v.ownerId === 'warlock:fiend-patron:dark-ones-own-luck')
        ?.dice,
    ).toBe('1d10')
  })
  it('Fiendish Resilience: Resistance to the chosen damage type', () => {
    const c = warlock(10)
    c.featureChoices['warlock:fiend-patron:fiendish-resilience'] = 'cold'
    expect(
      compute(c, rules).pool.grants.some(
        (g) =>
          g.owner.id === 'warlock:fiend-patron:fiendish-resilience' &&
          g.grant.kind === 'resistance' &&
          g.grant.on === 'cold',
      ),
    ).toBe(true)
  })
})

describe('examples/occultiste-niveau-10.json: Tiefling Fiend Warlock 10', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'occultiste-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('Cha 20, PB +4, spell save DC 17, spell attack +9 (SRD p. 71)', () => {
    expect(s.abilities.cha.score.total).toBe(20)
    expect(s.spellcasting[0].dc.total).toBe(17)
    expect(s.spellcasting[0].attack.total).toBe(9)
  })
  it('hit points 73: 8 + 2, then 9 × (5 + 2) (SRD p. 22)', () => expect(s.hpMax.total).toBe(73))
  it('level 10 row: two level 5 Pact Magic slots, 4 cantrips, 10 prepared spells, 7 invocations (SRD p. 70)', () => {
    expect(s.pact).toMatchObject({ slots: 2, level: 5 })
    expect(s.spellcasting[0].cantripsMax).toBe(4)
    expect(s.spellcasting[0].preparedMax).toBe(10)
    expect(s.owners.filter((o) => o.optionOf === 'warlock:eldritch-invocations').length).toBe(7)
  })
  it('AC 16 from Armor of Shadows (13 + 3 Dex), the leather armor staying in the pack', () =>
    expect(s.ac.total).toBe(16))
  it("Dark One's Blessing 15 Temporary HP (Cha +5 + level 10); Fire (Infernal legacy) and Cold (Fiendish Resilience) Resistance", () => {
    expect(s.featureValues.find((v) => v.ownerId === 'warlock:fiend-patron:dark-ones-blessing')?.stat.total).toBe(15)
    expect(
      s.pool.grants
        .filter((g) => g.grant.kind === 'resistance')
        .map((g) => g.grant.on)
        .sort(),
    ).toEqual(['cold', 'fire'])
  })
})
