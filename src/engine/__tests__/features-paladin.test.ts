// Paladin features (custom/effects/paladin.json) against the SRD 5.2.1 text: Lay On Hands pool, Paladin's Smite and
// Faithful Steed always-prepared spells and free casts, Aura of Protection on saves, Aura of Courage, Radiant Strikes,
// Oath of Devotion (Sacred Weapon, Aura of Devotion, subclass spells); then the examples/paladine-niveau-10.json build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

type Abilities = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>

/** A Human Soldier Paladin of the given level, Oath of Devotion from level 3, fixed Hit Points, ASI (+2 Str) at 4 and 8. */
function paladin(level: number, abilities: Abilities = {}) {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'paladin',
      lang: 'en',
      abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16, ...abilities },
    },
    rules,
  )
  c.background.abilities = { str: 2, con: 1 }
  c.skillProficiencies = ['insight', 'religion']
  c.featureChoices['human:skillful'] = 'medicine'
  c.extraFeats['human:versatile'] = { featId: 'alert' }
  c.weaponMastery = ['longsword', 'javelin']
  if (level >= 2) c.featureChoices['paladin:fighting-style'] = 'defense'
  for (let i = 2; i <= level; i++) {
    c.levels.push({
      classId: 'paladin',
      hpRoll: 6,
      hpFixed: true,
      ...(i === 3 ? { subclassId: 'paladin:oath-of-devotion' } : {}),
      ...(i === 4 || i === 8 || i === 12
        ? { feat: { featId: 'ability-score-improvement', abilities: { str: 2 } } }
        : {}),
    })
  }
  c.inventory = [
    { uid: 'a', kind: 'armor', refId: 'chain-mail', quantity: 1, location: 'worn' },
    { uid: 's', kind: 'armor', refId: 'shield', quantity: 1, location: 'worn', equipped: true },
    { uid: 'w', kind: 'weapon', refId: 'longsword', quantity: 1, location: 'worn', equipped: true },
  ]
  return c
}

describe('Lay On Hands (SRD p. 53)', () => {
  it('the pool holds five times the Paladin level: 5 at level 1, 30 at level 6, 50 at level 10', () => {
    for (const [lv, pool] of [
      [1, 5],
      [6, 30],
      [10, 50],
    ] as const) {
      const s = compute(paladin(lv), rules)
      expect(s.resources.find((r) => r.id === 'paladin:lay-on-hands')?.max).toBe(pool)
      expect(s.resources.find((r) => r.id === 'paladin:lay-on-hands')?.per).toBe('long')
    }
  })
})

describe("Paladin's Smite (SRD p. 54) and Faithful Steed (SRD p. 55)", () => {
  it('Divine Smite is always prepared from level 2 with one free cast per Long Rest', () => {
    const s = compute(paladin(2), rules)
    const sc = s.spellcasting.find((x) => x.classId === 'paladin')!
    expect(sc.alwaysPrepared).toContain('divine-smite')
    const smite = s.resources.find((r) => r.id === 'paladin:paladins-smite')!
    expect(smite.max).toBe(1)
    expect(smite.per).toBe('long')
    expect(s.spellcasting[0].alwaysPrepared).not.toContain('find-steed')
  })
  it('Find Steed is always prepared from level 5 with one free cast per Long Rest; the Oath spells of levels 3 and 5 are listed too', () => {
    const s = compute(paladin(5), rules)
    const sc = s.spellcasting.find((x) => x.classId === 'paladin')!
    expect(sc.alwaysPrepared).toEqual(
      expect.arrayContaining([
        'divine-smite',
        'find-steed',
        'protection-from-evil-and-good',
        'shield-of-faith',
        'aid',
        'zone-of-truth',
      ]),
    )
    expect(sc.alwaysPrepared).not.toContain('beacon-of-hope')
    expect(s.resources.find((r) => r.id === 'paladin:faithful-steed')?.max).toBe(1)
    // Prepared Spells column at Paladin 5: 6 (SRD p. 53 Paladin Features table).
    expect(sc.preparedMax).toBe(6)
  })
})

describe('Channel Divinity (SRD p. 54)', () => {
  it('two uses at level 3 (three at 11), one regained on a Short Rest; its save DC is the spell save DC', () => {
    const s3 = compute(paladin(3), rules)
    const cd = s3.resources.find((r) => r.id === 'paladin:channel-divinity')!
    expect(cd.max).toBe(2)
    expect(cd.shortRestRegain).toBe(1)
    expect(s3.featureValues.find((v) => v.ownerId === 'paladin:channel-divinity' && v.id === 'dc')?.stat.total).toBe(
      8 + 2 + 3,
    )
    expect(compute(paladin(11), rules).resources.find((r) => r.id === 'paladin:channel-divinity')?.max).toBe(3)
  })
})

describe('Aura of Protection (SRD p. 55)', () => {
  it('level 6: every saving throw gains the Charisma modifier (Cha 16 → +3), proficient or not', () => {
    const s = compute(paladin(6), rules)
    expect(s.abilities.cha.mod).toBe(3)
    // Str 16 + 2 (Soldier) + 2 (ASI 4) = 20 → +5, not a proficient save: 5 + 3.
    expect(s.abilities.str.save.total).toBe(5 + 3)
    // Wis 10 → +0, proficient (Paladin): 0 + PB 3 + 3.
    expect(s.abilities.wis.save.total).toBe(0 + 3 + 3)
    expect(s.abilities.dex.save.parts.some((p) => p.sourceId === 'paladin:aura-of-protection' && p.value === 3)).toBe(
      true,
    )
  })
  it('minimum bonus of +1 with a Charisma modifier of 0 or less', () => {
    const s = compute(paladin(6, { cha: 8 }), rules)
    expect(s.abilities.cha.mod).toBe(-1)
    expect(s.abilities.dex.save.total).toBe(0 + 1)
  })
  it('no aura before level 6', () => {
    const s = compute(paladin(5), rules)
    expect(s.abilities.dex.save.total).toBe(0)
  })
})

describe('Aura of Courage (SRD p. 55) and Aura of Devotion (SRD p. 56)', () => {
  it('level 7 Oath of Devotion: Immunity to the Charmed condition; level 10: Immunity to the Frightened condition', () => {
    const immune = (lv: number) =>
      compute(paladin(lv), rules)
        .pool.grants.filter((g) => g.grant.kind === 'immunity')
        .map((g) => g.grant.on)
    expect(immune(6)).toEqual([])
    expect(immune(7)).toEqual(['charmed'])
    expect(immune(10)).toEqual(expect.arrayContaining(['charmed', 'frightened']))
  })
})

describe('Radiant Strikes (SRD p. 55)', () => {
  it('level 11: an extra 1d8 Radiant on melee weapon hits and Unarmed Strikes, not before', () => {
    const s10 = compute(paladin(10), rules)
    expect(s10.attacks[0].extraDamage).toEqual([])
    const s = compute(paladin(11), rules)
    const sword = s.attacks.find((a) => a.weapon.id === 'longsword')!
    expect(sword.extraDamage).toEqual([
      expect.objectContaining({ dice: '1d8', label: expect.objectContaining({ en: 'Radiant Strikes' }) }),
    ])
    expect(sword.extraDamage[0].condition?.en).toContain('Radiant')
    expect(s.unarmed!.extraDamage.map((d) => d.dice)).toEqual(['1d8'])
    // Not on a ranged weapon.
    const c = paladin(11)
    c.inventory = [{ uid: 'b', kind: 'weapon', refId: 'longbow', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).attacks[0].extraDamage).toEqual([])
  })
})

describe('Abjure Foes (SRD p. 55)', () => {
  it('level 9: Wisdom save DC = spell save DC (8 + PB 4 + Cha 3) and Cha modifier targets (minimum 1)', () => {
    const s = compute(paladin(9), rules)
    const values = s.featureValues.filter((v) => v.ownerId === 'paladin:abjure-foes')
    expect(values.find((v) => v.id === 'dc')?.stat.total).toBe(8 + 4 + 3)
    expect(values.find((v) => v.id === 'targets')?.stat.total).toBe(3)
    expect(
      compute(paladin(9, { cha: 8 }), rules).featureValues.find(
        (v) => v.ownerId === 'paladin:abjure-foes' && v.id === 'targets',
      )?.stat.total,
    ).toBe(1)
  })
})

describe('Oath of Devotion: Sacred Weapon (SRD p. 56)', () => {
  it('a Combat-pane toggle adds the Charisma modifier (minimum +1) to melee weapon attack rolls', () => {
    const c = paladin(3)
    let s = compute(c, rules)
    expect(s.pool.toggles.some((t) => t.key === 'sacred-weapon')).toBe(true)
    // Str 18 → +4, PB 2.
    expect(s.attacks[0].attack.total).toBe(4 + 2)
    c.toggles['sacred-weapon'] = true
    s = compute(c, rules)
    expect(s.attacks[0].attack.total).toBe(4 + 2 + 3)
    // Melee only: a bow gets nothing.
    c.inventory = [{ uid: 'b', kind: 'weapon', refId: 'longbow', quantity: 1, location: 'worn', equipped: true }]
    expect(compute(c, rules).attacks[0].attack.total).toBe(0 + 2)
  })
})

describe('Extra Attack (SRD p. 55) and Weapon Mastery (SRD p. 54)', () => {
  it('two attacks from level 5; two weapon masteries', () => {
    expect(compute(paladin(4), rules).attacksPerAction).toBe(1)
    const s = compute(paladin(5), rules)
    expect(s.attacksPerAction).toBe(2)
    expect(s.masteryMax).toBe(2)
  })
})

describe('examples/paladine-niveau-10.json (Dragonborn Acolyte, Oath of Devotion)', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'paladine-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('is legal', () => expect(validate(c, rules).filter((w) => w.severity === 'error' || w.actionable)).toEqual([]))
  it('level 10, PB +4, Str 18 and Cha 18 after the Acolyte +2 Cha / +1 Wis and two ASIs', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.str.score.total).toBe(18)
    expect(s.abilities.cha.score.total).toBe(18)
  })
  it('Hit Points 84: 10 + 2 at level 1, then 9 × (6 + 2)', () => {
    expect(s.hpMax.total).toBe(12 + 9 * 8)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('AC 19: Chain Mail 16 + Shield 2 + Defense 1', () => expect(s.ac.total).toBe(19))
  it('saves with Aura of Protection (+4): Wis 1 + 4 + 4 = 9, Dex 0 + 4', () => {
    expect(s.abilities.wis.save.total).toBe(9)
    expect(s.abilities.dex.save.total).toBe(4)
  })
  it('Lay On Hands 50, Channel Divinity 2, 9 prepared spells plus 8 always prepared, Fire Resistance (Gold dragon)', () => {
    expect(s.resources.find((r) => r.id === 'paladin:lay-on-hands')?.max).toBe(50)
    expect(s.resources.find((r) => r.id === 'paladin:channel-divinity')?.max).toBe(2)
    const sc = s.spellcasting[0]
    expect(sc.preparedMax).toBe(9)
    expect(sc.prepared).toHaveLength(9)
    expect(sc.alwaysPrepared).toHaveLength(8)
    expect(s.pool.grants.some((g) => g.grant.kind === 'resistance' && g.grant.on === 'fire')).toBe(true)
  })
})
