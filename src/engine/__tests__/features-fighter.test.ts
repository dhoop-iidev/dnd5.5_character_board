// Fighter features against the SRD 5.2.1 text (Fighter p. 47–48, Champion p. 49), as encoded in
// src/data/custom/effects/fighter.json; spot values of examples/guerrier-niveau-10.json.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'

/** A human Soldier fighter of the given level, Str 17 (+3), Dex 14 (+2), Con 15 (+2), chain mail and longsword, the
 * Defense Fighting Style; Champion from level 3. */
const fighter = (level: number) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'fighter',
      lang: 'en',
      abilities: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    },
    rules,
  )
  c.background.abilities = { str: 2, con: 1 }
  c.skillProficiencies = ['perception', 'survival']
  c.featureChoices['fighter:fighting-style'] = 'defense'
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'fighter',
      hpRoll: 6,
      hpFixed: true,
      ...(i === 2 ? { subclassId: 'fighter:champion' } : {}),
    })
  c.inventory = [
    { uid: 'a', kind: 'armor', refId: 'chain-mail', quantity: 1, location: 'worn' },
    { uid: 'w', kind: 'weapon', refId: 'longsword', quantity: 1, location: 'worn', equipped: true },
  ]
  return c
}
const resource = (c: ReturnType<typeof fighter>, id: string) => compute(c, rules).resources.find((r) => r.id === id)
const value = (c: ReturnType<typeof fighter>, owner: string, id: string) =>
  compute(c, rules).featureValues.find((v) => v.ownerId === owner && v.id === id)

describe('levels 1–2 (SRD p. 47–48)', () => {
  const c = fighter(1)
  it('Fighting Style: the chosen feat applies (Defense: +1 AC in armor, p. 87)', () => {
    expect(compute(c, rules).ac.total).toBe(16 + 1)
    expect(compute(c, rules).feats.map((f) => f.def.id)).toContain('defense')
  })
  it('Second Wind: 2 uses, 1d10 + Fighter level, one back on a Short Rest (p. 48)', () => {
    const r = resource(c, 'fighter:second-wind')!
    expect(r.max).toBe(2)
    expect(r.per).toBe('long')
    expect(r.shortRestRegain).toBe(1)
    const heal = value(c, 'fighter:second-wind', 'heal')!
    expect(heal.dice).toBe('1d10')
    expect(heal.stat.total).toBe(1)
  })
  it('Weapon Mastery: three kinds of weapons at level 1 (p. 48, Weapon Mastery column)', () =>
    expect(compute(c, rules).masteryMax).toBe(3))
  it('Action Surge: once per Short or Long Rest from level 2 (p. 48)', () => {
    expect(resource(fighter(1), 'fighter:action-surge')).toBeUndefined()
    const r = resource(fighter(2), 'fighter:action-surge')!
    expect(r.max).toBe(1)
    expect(r.per).toBe('short')
  })
  it('Tactical Mind: text only (1d10 on a failed check, paid with Second Wind, p. 48)', () =>
    expect(rules.effects.get('fighter:tactical-mind')!.textOnly).toBeDefined())
})

describe('Champion levels 3–10 (SRD p. 49)', () => {
  it('Improved Critical: Critical Hit on 19 or 20 with weapons and Unarmed Strikes (p. 49)', () => {
    expect(compute(fighter(2), rules).attacks[0].critRange).toBe(20)
    const s = compute(fighter(3), rules)
    expect(s.attacks[0].critRange).toBe(19)
    expect(s.unarmed!.critRange).toBe(19)
  })
  it('Remarkable Athlete: Advantage on Initiative and Strength (Athletics) checks (p. 49)', () => {
    const s = compute(fighter(3), rules)
    expect(s.initiative.advantage?.length).toBe(1)
    expect(s.skills.find((k) => k.id === 'athletics')!.total.advantage?.length).toBe(1)
    expect(s.skills.find((k) => k.id === 'acrobatics')!.total.advantage).toBeUndefined()
  })
  it('Extra Attack at level 5, Two Extra Attacks at 11, Three Extra Attacks at 20 (p. 48)', () => {
    expect(compute(fighter(4), rules).attacksPerAction).toBe(1)
    expect(compute(fighter(5), rules).attacksPerAction).toBe(2)
    expect(compute(fighter(11), rules).attacksPerAction).toBe(3)
    expect(compute(fighter(20), rules).attacksPerAction).toBe(4)
  })
  it('Additional Fighting Style (Champion 7): a second Fighting Style feat, stored in extraFeats (p. 49)', () => {
    const c = fighter(7)
    c.extraFeats['fighter:champion:additional-fighting-style'] = { featId: 'archery' }
    c.inventory.push({ uid: 'b', kind: 'weapon', refId: 'longbow', quantity: 1, location: 'worn', equipped: true })
    const s = compute(c, rules)
    expect(
      s.feats
        .filter((f) => f.def.category === 'fighting-style')
        .map((f) => f.def.id)
        .sort(),
    ).toEqual(['archery', 'defense'])
    const bow = s.attacks.find((a) => a.weapon.id === 'longbow')!
    expect(bow.attack.total).toBe(2 + 3 + 2) // Dex + PB + Archery (p. 87)
    expect(s.attacks.find((a) => a.weapon.id === 'longsword')!.attack.total).toBe(3 + 3)
  })
  it('Indomitable: one reroll per Long Rest with a bonus equal to the Fighter level; 2 uses at 13, 3 at 17 (p. 48)', () => {
    expect(resource(fighter(8), 'fighter:indomitable')).toBeUndefined()
    const c = fighter(9)
    expect(resource(c, 'fighter:indomitable')!.max).toBe(1)
    expect(resource(c, 'fighter:indomitable')!.per).toBe('long')
    expect(value(c, 'fighter:indomitable', 'bonus')!.stat.total).toBe(9)
    expect(resource(fighter(13), 'fighter:indomitable')!.max).toBe(2)
    expect(resource(fighter(17), 'fighter:indomitable')!.max).toBe(3)
  })
  it('Second Wind 3 uses at level 4, 4 at level 10; Weapon Mastery 4 at level 4, 5 at level 10 (Fighter Features table p. 47)', () => {
    expect(resource(fighter(4), 'fighter:second-wind')!.max).toBe(3)
    expect(resource(fighter(10), 'fighter:second-wind')!.max).toBe(4)
    expect(compute(fighter(4), rules).masteryMax).toBe(4)
    expect(compute(fighter(10), rules).masteryMax).toBe(5)
  })
  it('Heroic Warrior (Champion 10) and Tactical Master are text only (p. 48–49)', () => {
    expect(rules.effects.get('fighter:champion:heroic-warrior')!.textOnly).toBeDefined()
    expect(rules.effects.get('fighter:tactical-master')!.textOnly).toBeDefined()
  })
})

describe('levels 15–18 (SRD p. 48–49)', () => {
  it('Superior Critical: Critical Hit on 18–20 (p. 49); Action Surge twice from level 17 (p. 48)', () => {
    expect(compute(fighter(15), rules).attacks[0].critRange).toBe(18)
    expect(resource(fighter(17), 'fighter:action-surge')!.max).toBe(2)
  })
  it('Survivor: Heroic Rally regains 5 + Con each turn while Bloodied (p. 49)', () => {
    expect(value(fighter(18), 'fighter:champion:survivor', 'rally')!.stat.total).toBe(5 + 2)
  })
})

describe('examples/guerrier-niveau-10.json (dwarf Champion 10)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'guerrier-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, Proficiency Bonus +4 (p. 23)', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
  })
  it('Str 20 (15 + 2 + 2 + 1 ASI), Con 16 (14 + 2 Criminal); 104 hit points (10 + 3, 9 × (6 + 3), +10 Dwarven Toughness)', () => {
    expect(s.abilities.str.score.total).toBe(20)
    expect(s.abilities.con.score.total).toBe(16)
    expect(s.hpMax.total).toBe(13 + 81 + 10)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('AC 17 (chain mail 16 + Defense), initiative +6 (Dex +2, Alert +4), Speed 30', () => {
    expect(s.ac.total).toBe(17)
    expect(s.initiative.total).toBe(6)
    expect(s.speed.total).toBe(30)
  })
  it('greatsword +9, 2d6 + 5, crit 19–20, mastery usable; two attacks; Second Wind 4, Indomitable 1, 5 masteries', () => {
    const sword = s.attacks.find((a) => a.weapon.id === 'greatsword')!
    expect(sword.attack.total).toBe(9)
    expect(sword.damage.dice).toBe('2d6')
    expect(sword.damage.bonus.total).toBe(5)
    expect(sword.critRange).toBe(19)
    expect(sword.mastery.usable).toBe(true)
    expect(s.attacksPerAction).toBe(2)
    expect(s.resources.find((r) => r.id === 'fighter:second-wind')!.max).toBe(4)
    expect(s.resources.find((r) => r.id === 'fighter:indomitable')!.max).toBe(1)
    expect(s.masteryMax).toBe(5)
    expect(c.weaponMastery.length).toBe(5)
  })
})
