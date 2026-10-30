// Core formulas against the SRD 5.2.1 text: level 1 characters of several classes, then a few multiclass cases.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

const make = (
  classId: string,
  abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {},
  speciesId = 'human',
  backgroundId = 'soldier',
) =>
  newCharacter(
    {
      name: 'Test',
      speciesId,
      backgroundId,
      classId,
      lang: 'en',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...abilities },
    },
    rules,
  )

describe('level 1 fighter', () => {
  const c = make('fighter', { str: 16, dex: 14, con: 15 })
  c.background.abilities = { str: 1, dex: 1, con: 1 } // Soldier: Str, Dex, Con, +1 to all three (SRD p. 20, 83)
  c.background.feat.abilities = {}
  c.skillProficiencies = ['perception', 'survival']
  const s = compute(c, rules)
  it('Proficiency Bonus +2 at level 1 (SRD p. 23)', () => expect(s.pb).toBe(2))
  it('ability scores with the background increase (SRD p. 20)', () => {
    expect(s.abilities.str.score.total).toBe(17)
    expect(s.abilities.str.mod).toBe(3)
    expect(s.abilities.con.score.total).toBe(16)
  })
  it('hit points: d10 maximum + Con at level 1 (SRD p. 22)', () => expect(s.hpMax.total).toBe(10 + 3))
  it('saving throws: Str and Con proficient (fighter Core Traits, SRD p. 47)', () => {
    expect(s.abilities.str.save.total).toBe(3 + 2)
    expect(s.abilities.con.save.total).toBe(3 + 2)
    expect(s.abilities.dex.save.total).toBe(2)
  })
  it('AC without armor: 10 + Dex (SRD p. 177)', () => expect(s.ac.total).toBe(12))
  it('skills: proficient ones add the Proficiency Bonus (SRD p. 9); Soldier grants Athletics and Intimidation', () => {
    const athletics = s.skills.find((k) => k.id === 'athletics')!
    expect(athletics.proficiency).toBe('proficient')
    expect(athletics.total.total).toBe(3 + 2)
    expect(s.skills.find((k) => k.id === 'perception')!.total.total).toBe(2)
    expect(s.skills.find((k) => k.id === 'arcana')!.total.total).toBe(0)
    expect(s.passivePerception).toBe(12)
  })
  it('initiative = Dex modifier (SRD p. 13)', () => expect(s.initiative.total).toBe(2))
  it('speed 30 ft for a Human (SRD p. 86), carrying capacity Str × 15 lb (SRD p. 178)', () => {
    expect(s.speed.total).toBe(30)
    expect(s.carry.capacity.lb).toBe(17 * 15)
  })
  it('Unarmed Strike: Str + PB to hit, 1 + Str damage (SRD p. 190)', () => {
    expect(s.unarmed!.attack.total).toBe(5)
    expect(s.unarmed!.damage.bonus.total).toBe(4)
  })
  it('no warnings for a legal build apart from informative ones', () => {
    const errs = validate(c, rules).filter((x) => x.severity === 'error')
    expect(errs.map((x) => x.id)).toEqual([])
  })
})

describe('equipment', () => {
  it('chain mail AC 16, no Dex; shield +2; Str 13 or Speed −10 (SRD p. 92)', () => {
    const c = make('fighter', { str: 12, dex: 16 })
    c.inventory = [
      { uid: 'a', kind: 'armor', refId: 'chain-mail', quantity: 1, location: 'worn' },
      { uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true },
      { uid: 'w', kind: 'weapon', refId: 'longsword', quantity: 1, location: 'worn', equipped: true },
    ]
    const s = compute(c, rules)
    expect(s.ac.total).toBe(16 + 2)
    expect(s.speed.total).toBe(20)
    const atk = s.attacks[0]
    expect(atk.ability).toBe('str')
    expect(atk.attack.total).toBe(1 + 2)
    expect(atk.damage.dice).toBe('1d8')
    expect(atk.damage.versatile).toBe('1d10')
  })
  it('a Finesse weapon uses the better of Str and Dex (SRD p. 89)', () => {
    const c = make('rogue', { str: 10, dex: 17 })
    c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'rapier', quantity: 1, location: 'worn', equipped: true }]
    const s = compute(c, rules)
    expect(s.attacks[0].ability).toBe('dex')
    expect(s.attacks[0].attack.total).toBe(3 + 2)
  })
  it('medium armor adds Dex up to 2 (SRD p. 92)', () => {
    const c = make('fighter', { dex: 18 })
    c.inventory = [{ uid: 'a', kind: 'armor', refId: 'breastplate', quantity: 1, location: 'worn' }]
    expect(compute(c, rules).ac.total).toBe(14 + 2)
  })
})

describe('class features computed from custom/effects.json', () => {
  it('barbarian Unarmored Defense: 10 + Dex + Con, Shield allowed (SRD p. 29)', () => {
    const c = make('barbarian', { dex: 14, con: 16 })
    c.inventory = [{ uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).ac.total).toBe(10 + 2 + 3 + 2)
  })
  it('monk Unarmored Defense needs no Shield (SRD p. 50)', () => {
    const c = make('monk', { dex: 16, wis: 14 })
    expect(compute(c, rules).ac.total).toBe(10 + 3 + 2)
    c.inventory = [{ uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).ac.total).toBe(10 + 3) // Unarmored Defense off; a Monk has no Shield training, so no +2 (SRD p. 92)
  })
  it('dwarf: +1 HP per level (Dwarven Toughness, SRD p. 84)', () => {
    const c = make('fighter', { con: 10 }, 'dwarf')
    expect(compute(c, rules).hpMax.total).toBe(10 + 1)
  })
  it('Alert adds the Proficiency Bonus to initiative (SRD p. 87)', () => {
    const c = make('fighter', { dex: 12 }, 'human', 'criminal') // Criminal grants Alert
    expect(compute(c, rules).initiative.total).toBe(1 + 2)
  })
  it('Rage: 2 uses at level 1, Rage Damage +2 when raging (SRD p. 28)', () => {
    const c = make('barbarian', { str: 16 })
    c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'greataxe', quantity: 1, location: 'worn', equipped: true }]
    let s = compute(c, rules)
    const rage = s.resources.find((r) => r.id === 'barbarian:rage')!
    expect(rage.max).toBe(2)
    expect(s.attacks[0].damage.bonus.total).toBe(3)
    c.toggles.rage = true
    s = compute(c, rules)
    expect(s.attacks[0].damage.bonus.total).toBe(5)
  })
})

describe('leveling and multiclassing', () => {
  it('fixed hit points: half the die + 1 + Con per level, minimum 1 (SRD p. 23)', () => {
    const c = make('wizard', { con: 8 })
    c.levels.push({ classId: 'wizard', hpRoll: 0, hpFixed: true }, { classId: 'wizard', hpRoll: 1, hpFixed: false })
    const s = compute(c, rules)
    expect(s.level).toBe(3)
    expect(s.hpMax.total).toBe(6 - 1 + (4 - 1) + 1) // level 1: 6 − 1; level 2 fixed 4 − 1 = 3; level 3 roll 1 − 1 → minimum 1
  })
  it('Proficiency Bonus follows the total level (SRD p. 24)', () => {
    const c = make('fighter')
    for (let i = 0; i < 4; i++) c.levels.push({ classId: i < 2 ? 'fighter' : 'rogue', hpRoll: 5, hpFixed: false })
    expect(compute(c, rules).pb).toBe(3)
  })
  it('spell slots of a cleric 3 / paladin 2: full levels + half the Paladin levels rounded up → level 4 of the table (SRD p. 25)', () => {
    const c = make('cleric', { wis: 16, str: 13, cha: 13 })
    c.levels.push({ classId: 'cleric', hpRoll: 5, hpFixed: false }, { classId: 'cleric', hpRoll: 5, hpFixed: false })
    c.levels.push({ classId: 'paladin', hpRoll: 6, hpFixed: false }, { classId: 'paladin', hpRoll: 6, hpFixed: false })
    const s = compute(c, rules)
    expect(s.casterLevel).toBe(4)
    expect(s.slots).toEqual([4, 3])
    const cleric = s.spellcasting.find((x) => x.classId === 'cleric')!
    expect(cleric.dc.total).toBe(8 + 3 + 3)
    expect(cleric.attack.total).toBe(3 + 3)
  })
  it('a single-class caster uses its own table; a warlock has Pact Magic slots (SRD p. 71)', () => {
    const w = make('warlock', { cha: 14 })
    const s = compute(w, rules)
    expect(s.slots).toEqual([])
    expect(s.pact).toEqual({ slots: 1, level: 1, used: 0 })
    const b = make('bard', { cha: 14 })
    expect(compute(b, rules).slots).toEqual([2])
  })
  it('saving throw proficiencies come from the first class only (SRD p. 25)', () => {
    const c = make('fighter', { str: 13, int: 13 })
    c.levels.push({ classId: 'wizard', hpRoll: 4, hpFixed: false })
    const s = compute(c, rules)
    expect(s.abilities.str.saveProficient).toBe(true)
    expect(s.abilities.int.saveProficient).toBe(false)
  })
  it('multiclass prerequisites: 13 in the primary abilities of both classes (SRD p. 24)', () => {
    const c = make('fighter', { str: 13, int: 11 })
    c.levels.push({ classId: 'wizard', hpRoll: 4, hpFixed: false })
    const ids = validate(c, rules).map((x) => x.id)
    expect(ids).toContain('multiclass-2')
  })
})

describe('Exhaustion (SRD p. 181)', () => {
  it('−2 per level on D20 Tests and −5 ft of Speed per level', () => {
    const c = make('fighter', { dex: 10 })
    c.exhaustion = 2
    const s = compute(c, rules)
    expect(s.initiative.total).toBe(-4)
    expect(s.abilities.str.save.total).toBe(2 - 4)
    expect(s.speed.total).toBe(20)
  })
})
