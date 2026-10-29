// Wizard features against the SRD 5.2.1 text: Wizard Features table and Spellcasting / Spellbook (p. 77), Ritual Adept and
// Arcane Recovery (p. 78), Scholar (p. 78), Evoker (p. 82); the level 10 example in examples/.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'
// Spells still to choose (fewer cantrips, prepared or spellbook spells than allowed) are not what these tests check.
const toChoose = (w: { id: string }) => /^(prepared|cantrips|spellbook)-missing/.test(w.id)

const wizard = (
  level: number,
  abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {},
) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'sage',
      classId: 'wizard',
      lang: 'en',
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10, ...abilities },
    },
    rules,
  )
  c.background.abilities = { int: 2, con: 1 }
  c.skillProficiencies = ['investigation', 'insight']
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'wizard',
      hpRoll: 4,
      hpFixed: true,
      choices: {},
      ...(i === 2 ? { subclassId: 'wizard:evoker' } : {}),
    })
  c.spellcasting.wizard = {
    prepared: ['mage-armor', 'shield'],
    cantrips: ['fire-bolt', 'light', 'mage-hand'],
    spellbook: ['mage-armor', 'shield', 'magic-missile', 'detect-magic', 'sleep', 'thunderwave'],
  }
  return c
}
const spellWarnings = (c: ReturnType<typeof wizard>) =>
  validate(c, rules).filter((w) => w.area === 'spells' && !toChoose(w))

describe('Wizard Features table: cantrips and prepared spells by level (SRD p. 77)', () => {
  const cases: [number, number, number, number[]][] = [
    [1, 3, 4, [2]],
    [4, 4, 7, [4, 3]],
    [5, 4, 9, [4, 3, 2]],
    [10, 5, 15, [4, 3, 3, 3, 2]],
  ]
  for (const [level, cantrips, prepared, slots] of cases)
    it(`level ${level}: ${cantrips} cantrips, ${prepared} prepared spells, slots ${slots.join('/')}`, () => {
      const s = compute(wizard(level), rules)
      expect(s.spellcasting[0].cantripsMax).toBe(cantrips)
      expect(s.spellcasting[0].preparedMax).toBe(prepared)
      expect(s.slots).toEqual(slots)
      expect(s.spellcasting[0].maxSpellLevel).toBe(slots.length)
    })
  it('spell save DC 8 + PB + Int, spell attack PB + Int (SRD p. 77)', () => {
    const s = compute(wizard(1), rules) // Int 18 → +4
    expect(s.spellcasting[0].dc.total).toBe(8 + 2 + 4)
    expect(s.spellcasting[0].attack.total).toBe(2 + 4)
  })
})

describe('Spellbook checks (SRD p. 77 "Spellbook")', () => {
  it('a legal spellbook and preparation give no spell warning', () => expect(spellWarnings(wizard(3))).toEqual([]))
  it('a prepared spell must be in the spellbook', () => {
    const c = wizard(3)
    c.spellcasting.wizard!.prepared = ['mage-armor', 'magic-missile', 'burning-hands']
    expect(spellWarnings(c).map((w) => w.id)).toEqual(['spellbook-burning-hands'])
  })
  it('cantrips are not written in the spellbook; only Wizard spells are', () => {
    const c = wizard(3)
    c.spellcasting.wizard!.spellbook!.push('fire-bolt', 'cure-wounds')
    expect(
      spellWarnings(c)
        .map((w) => w.id)
        .sort(),
    ).toEqual(['spellbook-cantrip-fire-bolt', 'spellbook-list-cure-wounds'])
  })
  it('a prepared spell above the highest slot level of the class is flagged (SRD p. 25, 77)', () => {
    const c = wizard(3)
    c.spellcasting.wizard!.spellbook!.push('fireball')
    c.spellcasting.wizard!.prepared.push('fireball')
    expect(spellWarnings(c).map((w) => w.id)).toEqual(['spell-level-wizard-fireball'])
  })
  it('too many prepared spells or cantrips are flagged', () => {
    const c = wizard(1)
    c.spellcasting.wizard!.prepared = ['mage-armor', 'shield', 'magic-missile', 'detect-magic', 'sleep']
    c.spellcasting.wizard!.cantrips = ['fire-bolt', 'light', 'mage-hand', 'ray-of-frost']
    expect(
      spellWarnings(c)
        .map((w) => w.id)
        .sort(),
    ).toEqual(['cantrips-wizard', 'prepared-wizard'])
  })
})

describe('Wizard class features', () => {
  it('Arcane Recovery: once per Long Rest (SRD p. 78)', () =>
    expect(compute(wizard(1), rules).resources.find((r) => r.id === 'wizard:arcane-recovery')).toMatchObject({
      max: 1,
      per: 'long',
    }))
  it('Scholar: Expertise in one proficient skill among Arcana, History, Investigation, Medicine, Nature, Religion (SRD p. 78)', () => {
    const c = wizard(2)
    expect(validate(c, rules).some((w) => w.id === 'choice-wizard:scholar')).toBe(true) // not chosen yet
    c.featureChoices['wizard:scholar'] = 'investigation'
    const s = compute(c, rules)
    const inv = s.skills.find((k) => k.id === 'investigation')!
    expect(inv.proficiency).toBe('expertise')
    expect(inv.total.total).toBe(4 + 2 * 2)
    expect(validate(c, rules).filter((w) => w.id.startsWith('choice-wizard:scholar'))).toEqual([])
    c.featureChoices['wizard:scholar'] = 'stealth'
    expect(validate(c, rules).map((w) => w.id)).toContain('choice-wizard:scholar-stealth')
    c.featureChoices['wizard:scholar'] = 'medicine' // on the list, but not proficient
    expect(validate(c, rules).find((w) => w.id === 'choice-wizard:scholar-medicine')?.message.en).toContain(
      'requires proficiency',
    )
  })
  it('Empowered Evocation: Int modifier to one damage roll (SRD p. 82)', () => {
    expect(
      compute(wizard(6), rules).featureValues.find((v) => v.ownerId === 'wizard:evoker:empowered-evocation'),
    ).toBeUndefined()
    expect(
      compute(wizard(10), rules).featureValues.find((v) => v.ownerId === 'wizard:evoker:empowered-evocation')?.stat
        .total,
    ).toBe(4)
  })
})

describe('examples/magicien-niveau-10.json: Rock Gnome Evoker 10', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'magicien-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('Int 20 (15 + 2 Sage + 2 + 1 ASIs), PB +4, spell save DC 17, spell attack +9 (SRD p. 77)', () => {
    expect(s.abilities.int.score.total).toBe(20)
    expect(s.spellcasting[0].dc.total).toBe(17)
    expect(s.spellcasting[0].attack.total).toBe(9)
  })
  it('hit points 62: 6 + 2, then 9 × (4 + 2) (SRD p. 22)', () => expect(s.hpMax.total).toBe(62))
  it('level 10 row: 5 cantrips, 15 prepared spells, slots 4/3/3/3/2; every prepared spell is in the spellbook', () => {
    expect(s.spellcasting[0].cantripsMax).toBe(5)
    expect(s.spellcasting[0].preparedMax).toBe(15)
    expect(s.slots).toEqual([4, 3, 3, 3, 2])
    for (const id of s.spellcasting[0].prepared) expect(s.spellcasting[0].spellbook).toContain(id)
  })
  it('Scholar: Expertise in Arcana (+4 Int, PB × 2 = +12); Empowered Evocation +5', () => {
    expect(s.skills.find((k) => k.id === 'arcana')?.total.total).toBe(5 + 8)
    expect(s.featureValues.find((v) => v.ownerId === 'wizard:evoker:empowered-evocation')?.stat.total).toBe(5)
  })
  it('Rock Gnome: Mending and Prestidigitation from the lineage; Gnomish Cunning on Int, Wis and Cha saves', () => {
    expect(s.extraSpells.find((e) => e.ownerId === 'gnome:gnomish-lineage')?.spells).toEqual([
      'mending',
      'prestidigitation',
    ])
    expect(s.pool.advantage('save.wis').length).toBe(1)
  })
})
