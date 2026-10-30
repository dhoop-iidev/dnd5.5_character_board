// Ranger features (custom/effects/ranger.json) against the SRD 5.2.1 text: Favored Enemy (Hunter's Mark), Deft Explorer,
// Roving, Expertise, Tireless, the Hunter subclass options; then the examples/rodeur-niveau-10.json build.
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

type Abilities = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>

/** A Human Soldier Ranger of the given level, Hunter from level 3, Archery, fixed Hit Points, ASI (+2 Wis) at 4 and 8. */
function ranger(level: number, abilities: Abilities = {}, armor = 'studded-leather-armor') {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'ranger',
      lang: 'en',
      abilities: { str: 13, dex: 16, con: 14, int: 8, wis: 14, cha: 10, ...abilities },
    },
    rules,
  )
  c.background.abilities = { dex: 2, con: 1 }
  c.skillProficiencies = ['perception', 'stealth', 'survival']
  c.featureChoices['human:skillful'] = 'nature'
  c.extraFeats['human:versatile'] = { featId: 'alert' }
  c.weaponMastery = ['longbow', 'shortsword']
  if (level >= 2) c.featureChoices['ranger:fighting-style'] = 'archery'
  for (let i = 2; i <= level; i++) {
    c.levels.push({
      classId: 'ranger',
      hpRoll: 6,
      hpFixed: true,
      ...(i === 3 ? { subclassId: 'ranger:hunter' } : {}),
      ...(i === 4 || i === 8 || i === 12
        ? { feat: { featId: 'ability-score-improvement', abilities: { wis: 2 } } }
        : {}),
    })
  }
  c.inventory = [
    { uid: 'a', kind: 'armor', refId: armor, quantity: 1, location: 'worn' },
    { uid: 'w', kind: 'weapon', refId: 'shortsword', quantity: 1, location: 'worn', equipped: true },
  ]
  return c
}

describe('Favored Enemy (SRD p. 58)', () => {
  it("Hunter's Mark is always prepared; free casts follow the Favored Enemy column: 2 at level 1, 3 at 5, 4 at 9", () => {
    for (const [lv, n] of [
      [1, 2],
      [5, 3],
      [9, 4],
    ] as const) {
      const s = compute(ranger(lv), rules)
      expect(s.spellcasting[0].alwaysPrepared).toContain('hunters-mark')
      const r = s.resources.find((x) => x.id === 'ranger:favored-enemy')!
      expect(r.max).toBe(n)
      expect(r.per).toBe('long')
    }
  })
})

describe('Deft Explorer (SRD p. 59) and Expertise (SRD p. 59)', () => {
  it('one Expertise pick at level 2, two more at level 9 (counted in sheet.expertiseMax)', () => {
    expect(compute(ranger(1), rules).expertiseMax).toBe(0)
    expect(compute(ranger(2), rules).expertiseMax).toBe(1)
    expect(compute(ranger(8), rules).expertiseMax).toBe(1)
    expect(compute(ranger(9), rules).expertiseMax).toBe(3)
  })
  it('Expertise doubles the Proficiency Bonus on the chosen skill (SRD p. 181)', () => {
    const c = ranger(2)
    c.featureChoices['ranger:deft-explorer#expertise'] = ['perception']
    const s = compute(c, rules)
    const perception = s.skills.find((k) => k.id === 'perception')!
    expect(perception.proficiency).toBe('expertise')
    expect(perception.total.total).toBe(2 + 2 * 2) // Wis 14 → +2, PB 2 × 2
    expect(validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))).toEqual([])
  })
})

describe('Roving (SRD p. 59)', () => {
  it('level 6: Speed +10 (Human 30 → 40) and a Climb Speed and a Swim Speed equal to the Speed', () => {
    expect(compute(ranger(5), rules).speed.total).toBe(30)
    const s = compute(ranger(6), rules)
    expect(s.speed.total).toBe(40)
    expect(s.otherSpeeds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'climb', ft: 40 }),
        expect.objectContaining({ kind: 'swim', ft: 40 }),
      ]),
    )
  })
  it('no Speed increase in Heavy armor; the Climb and Swim Speeds still equal the Speed', () => {
    const s = compute(ranger(6, { str: 13 }, 'chain-mail'), rules)
    expect(s.speed.total).toBe(30)
    expect(s.otherSpeeds.find((o) => o.kind === 'climb')?.ft).toBe(30)
  })
})

describe('Tireless (SRD p. 59)', () => {
  it('level 10: uses equal the Wisdom modifier (Wis 14 + 2 + 2 = 18 → 4), minimum 1; Temporary HP 1d8 + Wis', () => {
    const s = compute(ranger(10), rules)
    expect(s.abilities.wis.mod).toBe(4)
    const r = s.resources.find((x) => x.id === 'ranger:tireless')!
    expect(r.max).toBe(4)
    expect(r.per).toBe('long')
    expect(s.pool.flags.has('tireless')).toBe(true)
    const temp = s.featureValues.find((v) => v.ownerId === 'ranger:tireless' && v.id === 'temp')!
    expect(temp.dice).toBe('1d8')
    expect(temp.stat.total).toBe(4)
    expect(compute(ranger(10, { wis: 6 }), rules).resources.find((x) => x.id === 'ranger:tireless')?.max).toBe(1)
  })
})

describe("Hunter: Hunter's Prey (SRD p. 61) and Defensive Tactics (SRD p. 61)", () => {
  it('Colossus Slayer adds 1d8 to weapon hits (once per turn) on any weapon; Horde Breaker adds no dice', () => {
    const c = ranger(3)
    c.featureChoices['ranger:hunter:hunters-prey'] = 'colossus-slayer'
    const s = compute(c, rules)
    expect(s.attacks[0].extraDamage).toEqual([expect.objectContaining({ dice: '1d8' })])
    expect(s.attacks[0].extraDamage[0].condition?.en).toContain('Colossus Slayer')
    c.featureChoices['ranger:hunter:hunters-prey'] = 'horde-breaker'
    expect(compute(c, rules).attacks[0].extraDamage).toEqual([])
  })
  it('Escape the Horde / Multiattack Defense: Disadvantage on attack rolls against you (situational)', () => {
    const c = ranger(7)
    c.featureChoices['ranger:deft-explorer#expertise'] = ['survival']
    c.featureChoices['ranger:hunter:hunters-prey'] = 'horde-breaker'
    expect(compute(c, rules).pool.disadvantage('attacks-against')).toEqual([])
    c.featureChoices['ranger:hunter:defensive-tactics'] = 'escape-the-horde'
    expect(
      compute(c, rules)
        .pool.disadvantage('attacks-against')
        .map((x) => x.en),
    ).toEqual([expect.stringContaining('Opportunity Attacks')])
    c.featureChoices['ranger:hunter:defensive-tactics'] = 'multiattack-defense'
    expect(compute(c, rules).pool.disadvantage('attacks-against')).toHaveLength(1)
    expect(validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))).toEqual([])
  })
})

describe('Extra Attack (SRD p. 59), Weapon Mastery (SRD p. 58), Archery (SRD p. 87)', () => {
  it('two attacks from level 5; two masteries; Archery +2 on ranged weapons only', () => {
    const c = ranger(5)
    c.inventory.push({ uid: 'b', kind: 'weapon', refId: 'longbow', quantity: 1, location: 'worn', equipped: true })
    c.inventory = c.inventory.filter((i) => i.uid !== 'w')
    const s = compute(c, rules)
    expect(s.attacksPerAction).toBe(2)
    expect(s.masteryMax).toBe(2)
    const bow = s.attacks.find((a) => a.weapon.id === 'longbow')!
    expect(bow.attack.total).toBe(4 + 3 + 2) // Dex 16 + 2 = 18 → +4, PB 3, Archery
    expect(bow.mastery.usable).toBe(true)
  })
})

describe('examples/rodeur-niveau-10.json (Orc Soldier, Hunter)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'rodeur-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('is legal', () =>
    expect(validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))).toEqual([]))
  it('level 10, PB +4, Dex 18 and Wis 18', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.dex.score.total).toBe(18)
    expect(s.abilities.wis.score.total).toBe(18)
  })
  it('Hit Points 84: 10 + 2 at level 1, then 9 × (6 + 2)', () => {
    expect(s.hpMax.total).toBe(84)
    expect(c.hp.current).toBe(84)
  })
  it('Speed 40 with Climb and Swim 40 (Roving in Studded Leather); AC 12 + 4 = 16', () => {
    expect(s.speed.total).toBe(40)
    expect(s.otherSpeeds.map((o) => [o.kind, o.ft])).toEqual(
      expect.arrayContaining([
        ['climb', 40],
        ['swim', 40],
      ]),
    )
    expect(s.ac.total).toBe(16)
  })
  it('three Expertise picks (Deft Explorer + Expertise), Stealth 4 + 8 = 12; Longbow +10 with Archery and Colossus Slayer 1d8', () => {
    expect(s.expertiseMax).toBe(3)
    expect(s.skills.find((k) => k.id === 'stealth')!.total.total).toBe(12)
    const bow = s.attacks.find((a) => a.weapon.id === 'longbow')!
    expect(bow.attack.total).toBe(4 + 4 + 2)
    expect(bow.extraDamage.map((d) => d.dice)).toEqual(['1d8'])
  })
  it('Favored Enemy 4 free casts, Tireless 4 uses, 9 prepared spells plus Hunter’s Mark', () => {
    expect(s.resources.find((r) => r.id === 'ranger:favored-enemy')?.max).toBe(4)
    expect(s.resources.find((r) => r.id === 'ranger:tireless')?.max).toBe(4)
    expect(s.spellcasting[0].preparedMax).toBe(9)
    expect(s.spellcasting[0].prepared).toHaveLength(9)
    expect(s.spellcasting[0].alwaysPrepared).toEqual(['hunters-mark'])
  })
})
