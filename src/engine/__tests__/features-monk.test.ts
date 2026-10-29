// Monk features against the SRD 5.2.1 text (Monk p. 49–52, Warrior of the Open Hand p. 52), as encoded in
// src/data/custom/effects/monk.json; spot values of examples/moine-niveau-10.json.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'

/** A human Acolyte monk of the given level, Str 10, Dex 16 (+3), Con 14 (+2), Wis 16 (+3), spear in hand; Warrior of the
 * Open Hand from level 3. The Acolyte's Magic Initiate choices are filled so the feat computes. */
const monk = (level: number, wis = 14) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'acolyte',
      classId: 'monk',
      lang: 'en',
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis, cha: 8 },
    },
    rules,
  )
  c.background.abilities = { wis: 2, int: 1 }
  c.background.feat.choices = {
    list: 'cleric',
    ability: 'wis',
    cantrips: ['guidance', 'sacred-flame'],
    spell: ['cure-wounds'],
  }
  c.skillProficiencies = ['acrobatics', 'stealth']
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'monk',
      hpRoll: 5,
      hpFixed: true,
      choices: {},
      ...(i === 2 ? { subclassId: 'monk:warrior-of-the-open-hand' } : {}),
    })
  c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'spear', quantity: 1, location: 'worn', equipped: true }]
  return c
}
const resource = (c: ReturnType<typeof monk>, id: string) => compute(c, rules).resources.find((r) => r.id === id)
const value = (c: ReturnType<typeof monk>, owner: string, id: string) =>
  compute(c, rules).featureValues.find((v) => v.ownerId === owner && v.id === id)

describe('level 1 (SRD p. 50)', () => {
  const c = monk(1)
  it('Unarmored Defense: 10 + Dex + Wis without armor or Shield (p. 50)', () => {
    expect(compute(c, rules).ac.total).toBe(10 + 3 + 3)
    c.inventory.push({ uid: 'a', kind: 'armor', refId: 'leather-armor', quantity: 1, location: 'worn' })
    expect(compute(c, rules).ac.total).toBe(11 + 3) // leather: no Unarmored Defense
    c.inventory.pop()
  })
  it('Martial Arts: Dexterous Attacks and a 1d6 Martial Arts die on Unarmed Strikes and Monk weapons (p. 50)', () => {
    const s = compute(c, rules)
    expect(s.unarmed!.ability).toBe('dex')
    expect(s.unarmed!.attack.total).toBe(3 + 2)
    expect(s.unarmed!.damage.dice).toBe('1d6')
    expect(s.unarmed!.damage.bonus.total).toBe(3)
    const spear = s.attacks[0]
    expect(spear.ability).toBe('dex')
    expect(spear.damage.dice).toBe('1d6') // the spear's own 1d6; the die only replaces smaller damage
    c.inventory = [{ uid: 'd', kind: 'weapon', refId: 'dagger', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).attacks[0].damage.dice).toBe('1d6') // dagger 1d4 → Martial Arts die
  })
  it('a Longsword is not a Monk weapon: no Martial Arts die (p. 50)', () => {
    c.inventory = [{ uid: 'l', kind: 'weapon', refId: 'longsword', quantity: 1, location: 'worn', equipped: true }]
    const s = compute(c, rules)
    expect(s.attacks[0].damage.dice).toBe('1d8')
    expect(s.attacks[0].ability).toBe('str')
  })
})

describe('levels 2–4 (SRD p. 50–51)', () => {
  it("Monk's Focus: Focus Points equal to the Focus Points column, back on a Short Rest; save DC 8 + Wis + PB (p. 50)", () => {
    expect(resource(monk(1), 'monk:monks-focus')).toBeUndefined()
    const c = monk(2)
    const r = resource(c, 'monk:monks-focus')!
    expect(r.max).toBe(2)
    expect(r.per).toBe('short')
    expect(value(c, 'monk:monks-focus', 'dc')!.stat.total).toBe(8 + 3 + 2)
    expect(resource(monk(10), 'monk:monks-focus')!.max).toBe(10)
  })
  it('Unarmored Movement: +10 feet at level 2, +15 at 6, +20 at 10; none in armor or with a Shield (p. 51)', () => {
    expect(compute(monk(1), rules).speed.total).toBe(30)
    const c = monk(2)
    expect(compute(c, rules).speed.total).toBe(40)
    c.inventory.push({ uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true })
    expect(compute(c, rules).speed.total).toBe(30)
    expect(compute(monk(6), rules).speed.total).toBe(45)
    expect(compute(monk(10), rules).speed.total).toBe(50)
  })
  it('Uncanny Metabolism: once per Long Rest, regain Monk level + a Martial Arts die of Hit Points (p. 51)', () => {
    const c = monk(2)
    expect(resource(c, 'monk:uncanny-metabolism')!.max).toBe(1)
    expect(resource(c, 'monk:uncanny-metabolism')!.per).toBe('long')
    const heal = value(c, 'monk:uncanny-metabolism', 'heal')!
    expect(heal.dice).toBe('1d6')
    expect(heal.stat.total).toBe(2)
  })
  it('Deflect Attacks: reduction 1d10 + Dex + Monk level (p. 51)', () => {
    expect(value(monk(2), 'monk:deflect-attacks', 'reduce')).toBeUndefined()
    const v = value(monk(3), 'monk:deflect-attacks', 'reduce')!
    expect(v.dice).toBe('1d10')
    expect(v.stat.total).toBe(3 + 3)
    const redirect = value(monk(3), 'monk:deflect-attacks', 'redirect')!
    expect(redirect.dice).toBe('1d6')
    expect(redirect.stat.total).toBe(3)
  })
  it('Slow Fall: reduce falling damage by five times the Monk level (p. 51)', () => {
    expect(value(monk(3), 'monk:slow-fall', 'reduce')).toBeUndefined()
    expect(value(monk(4), 'monk:slow-fall', 'reduce')!.stat.total).toBe(20)
    expect(value(monk(10), 'monk:slow-fall', 'reduce')!.stat.total).toBe(50)
  })
})

describe('levels 5–11 (SRD p. 51–52)', () => {
  it('Extra Attack at level 5; the Martial Arts die becomes 1d8 at 5 and 1d10 at 11 (p. 49 table, p. 51)', () => {
    expect(compute(monk(4), rules).attacksPerAction).toBe(1)
    const s = compute(monk(5), rules)
    expect(s.attacksPerAction).toBe(2)
    expect(s.unarmed!.damage.dice).toBe('1d8')
    expect(s.attacks[0].damage.dice).toBe('1d8') // spear 1d6 → 1d8
    expect(compute(monk(11), rules).unarmed!.damage.dice).toBe('1d10')
  })
  it("Stunning Strike: Con save against the Monk's Focus DC (p. 51)", () => {
    expect(value(monk(4), 'monk:stunning-strike', 'dc')).toBeUndefined()
    expect(value(monk(5), 'monk:stunning-strike', 'dc')!.stat.total).toBe(8 + 3 + 3)
  })
  it('Wholeness of Body (Open Hand 6): Wis modifier uses (minimum 1) per Long Rest, Martial Arts die + Wis (p. 52)', () => {
    const c = monk(6)
    expect(resource(c, 'monk:warrior-of-the-open-hand:wholeness-of-body')!.max).toBe(3)
    const heal = value(c, 'monk:warrior-of-the-open-hand:wholeness-of-body', 'heal')!
    expect(heal.dice).toBe('1d8')
    expect(heal.stat.total).toBe(3)
    expect(resource(monk(6, 8), 'monk:warrior-of-the-open-hand:wholeness-of-body')!.max).toBe(1) // Wis 10: minimum once
  })
  it('Heightened Focus (10): Temporary Hit Points of two Martial Arts dice (p. 51)', () => {
    expect(value(monk(10), 'monk:heightened-focus', 'temp')!.dice).toBe('1d8')
  })
  it('Empowered Strikes, Evasion, Acrobatic Movement, Self-Restoration, Open Hand Technique, Fleet Step: text only', () => {
    for (const id of [
      'monk:empowered-strikes',
      'monk:evasion',
      'monk:acrobatic-movement',
      'monk:self-restoration',
      'monk:warrior-of-the-open-hand:open-hand-technique',
      'monk:warrior-of-the-open-hand:fleet-step',
    ])
      expect(rules.effects.get(id)!.textOnly, id).toBeDefined()
  })
  it('Disciplined Survivor (14) needs the engine: proficiency in all saving throws (p. 52)', () => {
    expect(rules.effects.get('monk:disciplined-survivor')!.textOnly!.en).toMatch(/^Needs engine/)
  })
})

describe('level 20 (SRD p. 52)', () => {
  it('Body and Mind: Dexterity and Wisdom +4, maximum 25', () => {
    const c = monk(20, 16)
    c.levels[3].feat = { featId: 'ability-score-improvement', abilities: { dex: 2 } } // Dex 18, Wis 18 before the capstone
    const s = compute(c, rules)
    expect(s.abilities.dex.score.total).toBe(22)
    expect(s.abilities.wis.score.total).toBe(22)
    expect(s.abilities.dex.score.parts.some((p) => p.sourceId === 'max')).toBe(false)
  })
})

describe('examples/moine-niveau-10.json (wood elf Warrior of the Open Hand 10)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'moine-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, Proficiency Bonus +4 (p. 23)', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
  })
  it('Dex 18 and Wis 18; 73 hit points (8 + 2, then 9 × (5 + 2)) (p. 22–23)', () => {
    expect(s.abilities.dex.score.total).toBe(18)
    expect(s.abilities.wis.score.total).toBe(18)
    expect(s.hpMax.total).toBe(10 + 9 * 7)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('AC 18 (10 + 4 + 4), Speed 55 (30 + 5 Wood Elf + 20 Unarmored Movement), 10 Focus Points, no Weapon Mastery', () => {
    expect(s.ac.total).toBe(18)
    expect(s.speed.total).toBe(55)
    expect(s.resources.find((r) => r.id === 'monk:monks-focus')!.max).toBe(10)
    expect(s.masteryMax).toBe(0)
  })
  it("Monk's Focus DC 16, Deflect Attacks 1d10 + 14, Slow Fall 50, Wholeness of Body 4 uses; spear and Unarmed Strike +8, 1d8 + 4", () => {
    expect(s.featureValues.find((v) => v.ownerId === 'monk:monks-focus')!.stat.total).toBe(16)
    expect(s.featureValues.find((v) => v.ownerId === 'monk:deflect-attacks' && v.id === 'reduce')!.stat.total).toBe(14)
    expect(s.featureValues.find((v) => v.ownerId === 'monk:slow-fall')!.stat.total).toBe(50)
    expect(s.resources.find((r) => r.id === 'monk:warrior-of-the-open-hand:wholeness-of-body')!.max).toBe(4)
    expect(s.attacks[0].attack.total).toBe(8)
    expect(s.attacks[0].damage.dice).toBe('1d8')
    expect(s.unarmed!.attack.total).toBe(8)
    expect(s.unarmed!.damage.bonus.total).toBe(4)
  })
})
