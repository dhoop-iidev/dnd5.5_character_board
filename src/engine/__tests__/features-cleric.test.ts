// Cleric features against the SRD 5.2.1 text (Cleric p. 36–40): Divine Order, Channel Divinity, Sear Undead, Blessed
// Strikes, Divine Intervention, Life Domain (domain spells, Disciple of Life, Preserve Life, Blessed Healer); the
// examples/clerc-niveau-10.json build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'
// Spells still to choose (fewer cantrips, prepared or spellbook spells than allowed) are not what these tests check.
const toChoose = (w: { id: string }) => /^((prepared|cantrips|spellbook)-missing|background-languages)/.test(w.id)

type Abilities = Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
const ABIL: Abilities = { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }

/** A human cleric of the given level (Life Domain from level 3, Ability Score Improvement on Wis at 4 and 8). */
const cleric = (
  level: number,
  opts: {
    order?: 'protector' | 'thaumaturge'
    strikes?: 'divine-strike' | 'potent-spellcasting'
    abilities?: Partial<Abilities>
  } = {},
) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'cleric',
      lang: 'en',
      abilities: { ...ABIL, ...opts.abilities },
    },
    rules,
  )
  c.background.abilities = { str: 2, con: 1 }
  c.skillProficiencies = ['medicine', 'religion']
  c.featureChoices['human:skillful'] = 'insight'
  c.extraFeats['human:versatile'] = { featId: 'alert' }
  c.featureChoices['cleric:divine-order'] = opts.order ?? 'protector'
  if (level >= 7) c.featureChoices['cleric:blessed-strikes'] = opts.strikes ?? 'divine-strike'
  for (let i = 2; i <= level; i++)
    c.levels.push({
      classId: 'cleric',
      hpRoll: 5,
      hpFixed: true,
      ...(i === 3 ? { subclassId: 'cleric:life-domain' } : {}),
      ...(i === 4 || i === 8 ? { feat: { featId: 'ability-score-improvement', abilities: { wis: 2 } } } : {}),
    })
  c.spellcasting.cleric = { prepared: [], cantrips: [] }
  c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'mace', quantity: 1, location: 'worn', equipped: true }]
  return c
}

const actionable = (c: ReturnType<typeof cleric>) =>
  validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))
const value = (c: ReturnType<typeof cleric>, owner: string, id: string) =>
  compute(c, rules).featureValues.find((v) => v.ownerId === owner && v.id === id)

describe('Divine Order (SRD p. 37)', () => {
  it('Protector: Martial weapons and Heavy armor training', () => {
    const s = compute(cleric(1, { order: 'protector' }), rules)
    expect(s.proficiencies.weapons).toContain('martial')
    expect(s.proficiencies.armor).toContain('heavy')
    expect(s.spellcasting[0].cantripsMax).toBe(3)
  })
  it('Thaumaturge: one extra cantrip, Wisdom modifier (min +1) on Arcana and Religion checks', () => {
    const s = compute(cleric(1, { order: 'thaumaturge' }), rules)
    expect(s.spellcasting[0].cantripsMax).toBe(3 + 1)
    expect(s.proficiencies.armor).not.toContain('heavy')
    expect(s.skills.find((k) => k.id === 'arcana')!.total.total).toBe(0 + 3) // Int 10, Wis +3
    expect(s.skills.find((k) => k.id === 'religion')!.total.total).toBe(0 + 2 + 3) // proficient
    const low = compute(cleric(1, { order: 'thaumaturge', abilities: { wis: 10 } }), rules)
    expect(low.skills.find((k) => k.id === 'arcana')!.total.total).toBe(1)
  })
})

describe('Channel Divinity (SRD p. 37) and Sear Undead (p. 37)', () => {
  it('two uses at level 2, three at level 6 (Cleric Features table p. 36); one back per Short Rest', () => {
    expect(compute(cleric(1), rules).resources.find((r) => r.id === 'cleric:channel-divinity')).toBeUndefined()
    const r2 = compute(cleric(2), rules).resources.find((r) => r.id === 'cleric:channel-divinity')!
    expect(r2.max).toBe(2)
    expect(r2.per).toBe('long')
    expect(r2.shortRestRegain).toBe(1)
    expect(compute(cleric(5), rules).resources.find((r) => r.id === 'cleric:channel-divinity')!.max).toBe(2)
    expect(compute(cleric(6), rules).resources.find((r) => r.id === 'cleric:channel-divinity')!.max).toBe(3)
  })
  it('Divine Spark adds the Wisdom modifier to the d8s (p. 37)', () => {
    expect(value(cleric(2), 'cleric:channel-divinity', 'divine-spark')!.stat.total).toBe(3)
    expect(value(cleric(4), 'cleric:channel-divinity', 'divine-spark')!.stat.total).toBe(4) // Wis 18
  })
  it('Sear Undead (level 5): a number of d8s equal to the Wisdom modifier, minimum 1 (p. 37)', () => {
    expect(value(cleric(4), 'cleric:sear-undead', 'dice')).toBeUndefined()
    expect(value(cleric(5), 'cleric:sear-undead', 'dice')!.stat.total).toBe(4)
    expect(value(cleric(5, { abilities: { wis: 8 } }), 'cleric:sear-undead', 'dice')!.stat.total).toBe(1) // Wis 8 + 2 + 2 = 12 → +1
  })
})

describe('Blessed Strikes (SRD p. 38) and Divine Intervention (p. 38)', () => {
  it('Divine Strike: an extra 1d8 Necrotic or Radiant on a weapon hit, once per turn', () => {
    const s = compute(cleric(7, { strikes: 'divine-strike' }), rules)
    const mace = s.attacks.find((a) => a.weapon.id === 'mace')!
    expect(mace.extraDamage.map((d) => d.dice)).toContain('1d8')
    expect(compute(cleric(6), rules).attacks[0].extraDamage).toEqual([])
  })
  it('Potent Spellcasting: Wisdom modifier added to Cleric cantrip damage', () => {
    const c = cleric(7, { strikes: 'potent-spellcasting' })
    expect(value(c, 'cleric:blessed-strikes', 'potent-spellcasting')!.stat.total).toBe(4) // Wis 16 + 2 (level 4) = 18
    expect(compute(c, rules).attacks[0].extraDamage).toEqual([])
  })
  it('the choice is required at level 7', () => {
    const c = cleric(7)
    delete c.featureChoices['cleric:blessed-strikes']
    expect(validate(c, rules).map((w) => w.id)).toContain('choice-cleric:blessed-strikes')
  })
  it('Divine Intervention: once per Long Rest from level 10', () => {
    expect(compute(cleric(9), rules).resources.find((r) => r.id === 'cleric:divine-intervention')).toBeUndefined()
    const r = compute(cleric(10), rules).resources.find((r) => r.id === 'cleric:divine-intervention')!
    expect(r.max).toBe(1)
    expect(r.per).toBe('long')
  })
})

describe('Life Domain (SRD p. 40)', () => {
  it('Life Domain Spells: always prepared by Cleric level, not counted (p. 40)', () => {
    expect(compute(cleric(2), rules).spellcasting[0].alwaysPrepared).toEqual([])
    expect(compute(cleric(3), rules).spellcasting[0].alwaysPrepared).toEqual([
      'aid',
      'bless',
      'cure-wounds',
      'lesser-restoration',
    ])
    expect(compute(cleric(5), rules).spellcasting[0].alwaysPrepared).toEqual([
      'aid',
      'bless',
      'cure-wounds',
      'lesser-restoration',
      'mass-healing-word',
      'revivify',
    ])
    expect(compute(cleric(7), rules).spellcasting[0].alwaysPrepared).toContain('death-ward')
    const s9 = compute(cleric(9), rules).spellcasting[0]
    expect(s9.alwaysPrepared).toHaveLength(10)
    expect(s9.alwaysPrepared).toContain('mass-cure-wounds')
    const c = cleric(3)
    c.spellcasting.cleric = {
      prepared: [
        'aid',
        'bless',
        'cure-wounds',
        'lesser-restoration',
        'healing-word',
        'guiding-bolt',
        'shield-of-faith',
        'command',
        'sanctuary',
        'bane',
      ],
      cantrips: [],
    }
    expect(validate(c, rules).filter((w) => w.area === 'spells' && !toChoose(w))).toEqual([]) // 6 counted out of 6 at level 3
  })
  it('Disciple of Life: 2 + the slot level (p. 40); Blessed Healer from level 6 (p. 40)', () => {
    expect(value(cleric(3), 'cleric:life-domain:disciple-of-life', 'bonus')!.stat.total).toBe(2)
    expect(value(cleric(5), 'cleric:life-domain:blessed-healer', 'bonus')).toBeUndefined()
    expect(value(cleric(6), 'cleric:life-domain:blessed-healer', 'bonus')!.stat.total).toBe(2)
  })
  it('Preserve Life: five times the Cleric level (p. 40)', () => {
    expect(value(cleric(3), 'cleric:life-domain:preserve-life', 'pool')!.stat.total).toBe(15)
    expect(value(cleric(10), 'cleric:life-domain:preserve-life', 'pool')!.stat.total).toBe(50)
  })
  it('spell save DC 8 + PB + Wis (p. 36); prepared spells 4 at level 1, 15 at level 10 (table p. 36)', () => {
    const s1 = compute(cleric(1), rules).spellcasting[0]
    expect(s1.dc.total).toBe(8 + 2 + 3)
    expect(s1.preparedMax).toBe(4)
    const s10 = compute(cleric(10), rules).spellcasting[0]
    expect(s10.dc.total).toBe(8 + 4 + 5)
    expect(s10.preparedMax).toBe(15)
    expect(s10.cantripsMax).toBe(5)
    expect(s10.maxSpellLevel).toBe(5)
  })
})

describe('examples/clerc-niveau-10.json: dwarf Cleric 10, Life Domain, Protector, Sage', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'clerc-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, PB +4, Wis 20 (15 + 2 Sage + 2 + 1), hit points 8 + 9 × 5 + 10 × 2 + 10 (Dwarven Toughness)', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.wis.score.total).toBe(20)
    expect(s.hpMax.total).toBe(73 + 10)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('AC 16 (chain mail, Protector) + 2 (Shield); Channel Divinity 3; Preserve Life 50; Divine Strike 1d8 on the mace', () => {
    expect(s.ac.total).toBe(18)
    expect(s.speed.total).toBe(30) // Str 15 ≥ 13: no Speed penalty from chain mail
    expect(s.resources.find((r) => r.id === 'cleric:channel-divinity')!.max).toBe(3)
    expect(s.featureValues.find((v) => v.ownerId === 'cleric:life-domain:preserve-life')!.stat.total).toBe(50)
    expect(s.attacks.find((a) => a.weapon.id === 'mace')!.extraDamage.map((d) => d.dice)).toContain('1d8')
  })
  it('spells: 5 cantrips, 15 prepared, 10 domain spells always prepared, DC 17', () => {
    const sc = s.spellcasting[0]
    expect(sc.cantrips.length).toBe(sc.cantripsMax)
    expect(sc.prepared.length).toBe(sc.preparedMax)
    expect(sc.alwaysPrepared).toHaveLength(10)
    expect(sc.dc.total).toBe(17)
  })
  it('no error or actionable warning', () => {
    expect(actionable(c).map((w) => `${w.id}: ${w.message.en}`)).toEqual([])
  })
})
