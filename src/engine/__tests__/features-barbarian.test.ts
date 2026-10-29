// Barbarian features against the SRD 5.2.1 text (Barbarian p. 28–30, Path of the Berserker p. 30), as encoded in
// src/data/custom/effects/barbarian.json; spot values of examples/barbare-niveau-10.json.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

/** A human Soldier barbarian of the given level, Str 18 (+4), Dex 14 (+2), Con 15 (+2), greataxe in hand; Path of the
 * Berserker from level 3; Ability Score Improvements left empty (the scores stay put). */
const barbarian = (level: number) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'barbarian',
      lang: 'en',
      abilities: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
    },
    rules,
  )
  c.background.abilities = { str: 2, con: 1 }
  c.skillProficiencies = ['perception', 'survival']
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'barbarian',
      hpRoll: 7,
      hpFixed: true,
      choices: {},
      ...(i === 2 ? { subclassId: 'barbarian:path-of-the-berserker' } : {}),
    })
  c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'greataxe', quantity: 1, location: 'worn', equipped: true }]
  return c
}
const resource = (c: ReturnType<typeof barbarian>, id: string) => compute(c, rules).resources.find((r) => r.id === id)
const value = (c: ReturnType<typeof barbarian>, owner: string, id: string) =>
  compute(c, rules).featureValues.find((v) => v.ownerId === owner && v.id === id)

describe('level 1 (SRD p. 28–29)', () => {
  const c = barbarian(1)
  it('Rage: 2 uses at level 1, one back on a Short Rest, all on a Long Rest (p. 28, Rages column)', () => {
    const r = resource(c, 'barbarian:rage')!
    expect(r.max).toBe(2)
    expect(r.per).toBe('long')
    expect(r.shortRestRegain).toBe(1)
  })
  it('Rage Damage +2 on Strength attacks while raging, not otherwise (p. 28, Rage Damage column)', () => {
    expect(compute(c, rules).attacks[0].damage.bonus.total).toBe(4)
    c.toggles.rage = true
    const s = compute(c, rules)
    expect(s.attacks[0].damage.bonus.total).toBe(4 + 2)
    expect(s.unarmed!.damage.bonus.total).toBe(1 + 4 + 2)
    c.toggles.rage = false
  })
  it('Rage: Advantage on Strength checks and saves, Resistance to Bludgeoning, Piercing and Slashing while raging (p. 28)', () => {
    expect(compute(c, rules).abilities.str.save.advantage).toBeUndefined() // not raging: no Advantage
    c.toggles.rage = true
    const s = compute(c, rules)
    c.toggles.rage = false
    expect(s.abilities.str.save.advantage?.length).toBe(1)
    expect(s.skills.find((k) => k.id === 'athletics')!.total.advantage?.length).toBe(1)
    expect(
      s.pool.grants
        .filter((g) => g.grant.kind === 'resistance')
        .map((g) => g.grant.on)
        .sort(),
    ).toEqual(['bludgeoning', 'piercing', 'slashing'])
  })
  it('Unarmored Defense: 10 + Dex + Con, a Shield allowed (p. 29)', () => {
    expect(compute(c, rules).ac.total).toBe(10 + 2 + 2)
    c.inventory.push({ uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true })
    expect(compute(c, rules).ac.total).toBe(10 + 2 + 2 + 2)
    c.inventory.pop()
  })
  it('Weapon Mastery: two kinds of weapons at level 1 (p. 29, Weapon Mastery column)', () =>
    expect(compute(c, rules).masteryMax).toBe(2))
})

describe('levels 2–3 (SRD p. 29)', () => {
  it('Danger Sense: Advantage on Dexterity saving throws (p. 29)', () => {
    expect(compute(barbarian(1), rules).abilities.dex.save.advantage).toBeUndefined()
    expect(compute(barbarian(2), rules).abilities.dex.save.advantage?.length).toBe(1)
  })
  it('Reckless Attack: a Combat-pane toggle; on, Advantage on melee attack rolls and on attack rolls against you (p. 29)', () => {
    const c = barbarian(2)
    let s = compute(c, rules)
    expect(s.pool.toggles.map((t) => t.key)).toContain('reckless-attack')
    expect(s.attacks[0].attack.advantage).toBeUndefined()
    c.toggles['reckless-attack'] = true
    s = compute(c, rules)
    expect(s.attacks[0].attack.advantage?.length).toBe(1)
    expect(s.pool.advantage('attacks-against').length).toBe(1)
  })
  it('Primal Knowledge: one more skill from the Barbarian list (p. 29); the Strength-check swap is text only', () => {
    const c = barbarian(3)
    c.featureChoices['barbarian:primal-knowledge'] = 'nature'
    const s = compute(c, rules)
    expect(s.skills.find((k) => k.id === 'nature')!.proficiency).toBe('proficient')
    expect(s.skills.find((k) => k.id === 'nature')!.total.total).toBe(-1 + 2) // Int 8 + PB
    expect(rules.effects.get('barbarian:primal-knowledge')!.textOnly!.en).toMatch(/^Needs engine/)
    expect(validate(c, rules).filter((w) => w.id.startsWith('choice-barbarian:primal-knowledge'))).toEqual([])
  })
  it('Frenzy (Berserker 3): extra d6s equal to the Rage Damage bonus while raging, 2d6 at level 3 and 3d6 at level 9 (p. 30)', () => {
    for (const [lvl, dice] of [
      [3, '2d6'],
      [9, '3d6'],
    ] as const) {
      const c = barbarian(lvl)
      c.levels[2].subclassId = 'barbarian:path-of-the-berserker'
      c.toggles.rage = true
      const s = compute(c, rules)
      const frenzy = s.unarmed!.extraDamage.find((x) => x.label.en === 'Frenzy')
      expect(frenzy?.dice).toBe(dice)
      c.toggles.rage = false
      expect(compute(c, rules).unarmed!.extraDamage.some((x) => x.label.en === 'Frenzy')).toBe(false)
    }
  })
})

describe('levels 5–9 (SRD p. 29–30)', () => {
  it('Extra Attack: two attacks with the Attack action (p. 29)', () => {
    expect(compute(barbarian(4), rules).attacksPerAction).toBe(1)
    expect(compute(barbarian(5), rules).attacksPerAction).toBe(2)
  })
  it('Fast Movement: +10 feet unless wearing Heavy armor (p. 29)', () => {
    const c = barbarian(5)
    expect(compute(c, rules).speed.total).toBe(40)
    c.inventory.push({ uid: 'a', kind: 'armor', refId: 'chain-mail', quantity: 1, location: 'worn' })
    expect(compute(c, rules).speed.total).toBe(30)
    c.inventory.pop()
    c.inventory.push({ uid: 'a', kind: 'armor', refId: 'hide-armor', quantity: 1, location: 'worn' })
    expect(compute(c, rules).speed.total).toBe(40)
  })
  it('Mindless Rage (Berserker 6): Immunity to Charmed and Frightened while raging (p. 30)', () => {
    const c = barbarian(6)
    const imm = (s: ReturnType<typeof compute>) =>
      s.pool.grants
        .filter((g) => g.grant.kind === 'immunity')
        .map((g) => g.grant.on)
        .sort()
    expect(imm(compute(c, rules))).toEqual([])
    c.toggles.rage = true
    expect(imm(compute(c, rules))).toEqual(['charmed', 'frightened'])
  })
  it('Feral Instinct: Advantage on Initiative rolls (p. 29)', () => {
    expect(compute(barbarian(6), rules).initiative.advantage).toBeUndefined()
    expect(compute(barbarian(7), rules).initiative.advantage?.length).toBe(1)
  })
  it('Brutal Strike: an extra 1d10 while using Reckless Attack (p. 29); Rage Damage +3 from level 9 (table)', () => {
    const c = barbarian(9)
    let s = compute(c, rules)
    expect(s.attacks[0].extraDamage.map((e) => e.dice)).toEqual([])
    c.toggles['reckless-attack'] = true
    s = compute(c, rules)
    expect(s.attacks[0].extraDamage.map((e) => e.dice)).toEqual(['1d10'])
    expect(s.unarmed!.extraDamage.map((e) => e.dice)).toEqual(['1d10'])
    c.toggles.rage = true
    expect(compute(c, rules).attacks[0].damage.bonus.total).toBe(4 + 3)
  })
  it('Rages: 3 at level 3, 4 at level 6; Weapon Mastery 3 at level 4, 4 at level 10 (Barbarian Features table p. 28)', () => {
    expect(resource(barbarian(3), 'barbarian:rage')!.max).toBe(3)
    expect(resource(barbarian(6), 'barbarian:rage')!.max).toBe(4)
    expect(compute(barbarian(4), rules).masteryMax).toBe(3)
    expect(compute(barbarian(10), rules).masteryMax).toBe(4)
  })
})

describe('levels 11–20 (SRD p. 30)', () => {
  it('Relentless Rage: DC 10 Con save, Hit Points become twice the Barbarian level; the DC counter resets on any rest (p. 30)', () => {
    const c = barbarian(11)
    expect(value(c, 'barbarian:relentless-rage', 'dc')!.stat.total).toBe(10)
    expect(value(c, 'barbarian:relentless-rage', 'hp')!.stat.total).toBe(22)
    expect(resource(c, 'barbarian:relentless-rage')!.per).toBe('short')
  })
  it('Intimidating Presence (Berserker 14): Wis save DC 8 + Str + PB, once per Long Rest (p. 30)', () => {
    const c = barbarian(14)
    expect(value(c, 'barbarian:path-of-the-berserker:intimidating-presence', 'dc')!.stat.total).toBe(8 + 4 + 5)
    expect(resource(c, 'barbarian:path-of-the-berserker:intimidating-presence')!.max).toBe(1)
  })
  it('Primal Champion: Strength and Constitution +4, maximum 25 (p. 30)', () => {
    const c = barbarian(20)
    c.levels[3].feat = { featId: 'ability-score-improvement', abilities: { str: 2 } } // Str 20 before the capstone
    const s = compute(c, rules)
    expect(s.abilities.str.score.total).toBe(24)
    expect(s.abilities.con.score.total).toBe(19)
    expect(s.abilities.str.score.parts.some((p) => p.sourceId === 'max')).toBe(false)
  })
})

describe('examples/barbare-niveau-10.json (goliath Berserker 10)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'barbare-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, Proficiency Bonus +4 (p. 23)', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
  })
  it('Str 20 (15 + 2 Soldier + 2 + 1 ASI), Con 16; 105 hit points (12 + 3, then 9 × (7 + 3)) (p. 22–23)', () => {
    expect(s.abilities.str.score.total).toBe(20)
    expect(s.abilities.con.score.total).toBe(16)
    expect(s.hpMax.total).toBe(15 + 9 * 10)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('AC 15 unarmored (10 + 2 + 3), Speed 45 (goliath 35 + Fast Movement 10), 4 Rages, 4 weapon masteries', () => {
    expect(s.ac.total).toBe(15)
    expect(s.speed.total).toBe(45)
    expect(s.resources.find((r) => r.id === 'barbarian:rage')!.max).toBe(4)
    expect(s.masteryMax).toBe(4)
    expect(c.weaponMastery.length).toBe(4)
  })
  it('greataxe +9 to hit, 1d12 + 5, mastery usable; two attacks', () => {
    const axe = s.attacks.find((a) => a.weapon.id === 'greataxe')!
    expect(axe.attack.total).toBe(5 + 4)
    expect(axe.damage.bonus.total).toBe(5)
    expect(axe.mastery.usable).toBe(true)
    expect(s.attacksPerAction).toBe(2)
  })
})
