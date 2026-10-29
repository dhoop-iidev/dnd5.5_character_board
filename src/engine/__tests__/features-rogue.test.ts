// Rogue features (custom/effects/rogue.json) against the SRD 5.2.1 text: Expertise picks, Sneak Attack dice, Weapon
// Mastery, Cunning Strike DC, Reliable Talent, the Thief's Second-Story Work; then the examples/voleuse-niveau-10.json build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

type Abilities = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>

/** A Human Criminal Rogue of the given level, Thief from level 3, fixed Hit Points, ASI (+2 Dex) at 4, 8, 10 and 12. */
function rogue(level: number, abilities: Abilities = {}) {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'criminal',
      classId: 'rogue',
      lang: 'en',
      abilities: { str: 8, dex: 15, con: 14, int: 12, wis: 12, cha: 10, ...abilities },
    },
    rules,
  )
  c.background.abilities = { dex: 2, con: 1 }
  c.skillProficiencies = ['acrobatics', 'deception', 'insight', 'perception']
  c.featureChoices['human:skillful'] = 'athletics'
  c.extraFeats['human:versatile'] = { featId: 'savage-attacker' }
  c.weaponMastery = ['shortsword', 'dagger']
  c.expertise = ['stealth', 'sleight-of-hand']
  c.featureChoices['rogue:expertise'] = ['stealth', 'sleight-of-hand']
  for (let i = 2; i <= level; i++) {
    c.levels.push({
      classId: 'rogue',
      hpRoll: 5,
      hpFixed: true,
      choices: {},
      ...(i === 3 ? { subclassId: 'rogue:thief' } : {}),
      ...(i === 4 || i === 8 || i === 10 || i === 12
        ? { feat: { featId: 'ability-score-improvement', abilities: { dex: 2 } } }
        : {}),
    })
  }
  if (level >= 6) {
    c.expertise.push('perception', 'acrobatics')
    c.featureChoices['rogue:expertise'] = [...c.expertise]
  }
  c.inventory = [
    { uid: 'a', kind: 'armor', refId: 'leather-armor', quantity: 1, location: 'worn' },
    { uid: 'w', kind: 'weapon', refId: 'shortsword', quantity: 1, location: 'worn', equipped: true },
  ]
  return c
}

describe('Expertise (SRD p. 61)', () => {
  it('two skill proficiencies at level 1, two more at Rogue level 6 (sheet.expertiseMax 2 then 4)', () => {
    expect(compute(rogue(1), rules).expertiseMax).toBe(2)
    expect(compute(rogue(5), rules).expertiseMax).toBe(2)
    expect(compute(rogue(6), rules).expertiseMax).toBe(4)
  })
  it('Expertise doubles the Proficiency Bonus (SRD p. 181): Stealth at level 1 = Dex 17 (+3) + 2 × 2', () => {
    const s = compute(rogue(1), rules)
    const stealth = s.skills.find((k) => k.id === 'stealth')!
    expect(stealth.proficiency).toBe('expertise')
    expect(stealth.total.total).toBe(3 + 4)
    expect(s.skills.find((k) => k.id === 'perception')!.total.total).toBe(1 + 2)
  })
  it('a fifth pick, or Expertise in a skill without proficiency, is flagged', () => {
    const c = rogue(6)
    c.expertise.push('arcana')
    const ids = validate(c, rules).map((w) => w.id)
    expect(ids).toContain('expertise-count')
    expect(ids).toContain('expertise-arcana')
  })
})

describe('Sneak Attack (SRD p. 61)', () => {
  it('extra damage follows the Sneak Attack column: 1d6 at level 1, 3d6 at 5, 5d6 at 9', () => {
    for (const [lv, dice] of [
      [1, '1d6'],
      [5, '3d6'],
      [9, '5d6'],
    ] as const) {
      const s = compute(rogue(lv), rules)
      const sneak = s.attacks[0].extraDamage.find((d) => d.label.en === 'Sneak Attack')!
      expect(sneak.dice).toBe(dice)
      expect(sneak.condition?.en).toBe('Finesse or Ranged weapon, Advantage or an ally adjacent, once per turn')
    }
  })
  it('listed on ranged weapons too', () => {
    const c = rogue(3)
    c.inventory = [{ uid: 'b', kind: 'weapon', refId: 'shortbow', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).attacks[0].extraDamage.map((d) => d.dice)).toEqual(['2d6'])
  })
})

describe('Weapon Mastery (SRD p. 62)', () => {
  it('two kinds of weapons; a Shortsword (Martial, Finesse) is a Rogue weapon and its mastery is usable', () => {
    const s = compute(rogue(1), rules)
    expect(s.masteryMax).toBe(2)
    expect(s.attacks[0].proficient).toBe(true)
    expect(s.attacks[0].mastery.usable).toBe(true)
    expect(s.attacks[0].ability).toBe('dex')
  })
})

describe('Cunning Strike (SRD p. 63) and Reliable Talent (SRD p. 63)', () => {
  it('level 5: save DC 8 + Dex (17 + 2 = 19 → +4) + PB 3 = 15', () => {
    const s = compute(rogue(5), rules)
    expect(s.featureValues.find((v) => v.ownerId === 'rogue:cunning-strike' && v.id === 'dc')?.stat.total).toBe(
      8 + 4 + 3,
    )
  })
  it('level 7: the reliable-talent flag is set (minimum 10 on the d20 for proficient checks)', () => {
    expect(compute(rogue(6), rules).pool.flags.has('reliable-talent')).toBe(false)
    expect(compute(rogue(7), rules).pool.flags.has('reliable-talent')).toBe(true)
  })
})

describe('Thief: Second-Story Work (SRD p. 64)', () => {
  it('level 3: a Climb Speed equal to the Speed (30)', () => {
    expect(compute(rogue(2), rules).otherSpeeds).toEqual([])
    const s = compute(rogue(3), rules)
    expect(s.otherSpeeds).toEqual([expect.objectContaining({ kind: 'climb', ft: 30 })])
  })
})

describe('examples/voleuse-niveau-10.json (Tiefling Criminal, Thief)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'voleuse-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('is legal', () => expect(validate(c, rules).filter((w) => w.severity === 'error' || w.actionable)).toEqual([]))
  it('level 10, PB +4, Dex 20 (15 + 2 Criminal + 2 + 1), Con 16', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.dex.score.total).toBe(20)
    expect(s.abilities.con.score.total).toBe(16)
  })
  it('Hit Points 83: 8 + 3 at level 1, then 9 × (5 + 3)', () => {
    expect(s.hpMax.total).toBe(11 + 72)
    expect(c.hp.current).toBe(83)
  })
  it('AC 16 (Leather 11 + Dex 5), initiative 5 + 4 (Alert), Climb Speed 30', () => {
    expect(s.ac.total).toBe(16)
    expect(s.initiative.total).toBe(9)
    expect(s.otherSpeeds).toEqual([expect.objectContaining({ kind: 'climb', ft: 30 })])
  })
  it('Sneak Attack 5d6, four Expertise picks (Stealth 5 + 8 = 13), two masteries, Fire Resistance and Fire Bolt (Infernal legacy)', () => {
    expect(s.attacks[0].extraDamage.find((d) => d.label.en === 'Sneak Attack')?.dice).toBe('5d6')
    expect(s.expertiseMax).toBe(4)
    expect(s.skills.find((k) => k.id === 'stealth')!.total.total).toBe(13)
    expect(s.masteryMax).toBe(2)
    expect(s.pool.grants.some((g) => g.grant.kind === 'resistance' && g.grant.on === 'fire')).toBe(true)
    expect(s.extraSpells.flatMap((x) => x.spells)).toEqual(expect.arrayContaining(['fire-bolt', 'thaumaturgy']))
  })
})
