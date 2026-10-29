// Summoned creatures against the SRD 5.2.1 text: Draconic Spirit (Summon Dragon, p. 166), Giant Insect (p. 136),
// Animated Object (Animate Objects, p. 109), Animate Dead (p. 108), Create Undead (p. 121).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { newCharacter } from '../../model/newCharacter'
import type { ActiveEffect } from '../../model/character'
import { compute } from '../compute'
import {
  SUMMON_SPELLS,
  availableSummonSpells,
  newSummon,
  pruneSummons,
  summonAc,
  summonAttacks,
  summonCount,
  summonCreatures,
  summonHpMax,
  summonSpell,
  tickSummons,
} from '../summons'

const def = (id: string) => {
  const d = rules.creatures.get(id)
  if (!d) throw new Error(id)
  return d
}
const caster = { attack: 7, dc: 15, mod: 4 }

describe('summoning spells data', () => {
  it('every spell and creature exists in the SRD data', () => {
    for (const s of SUMMON_SPELLS) {
      expect(rules.spells.get(s.spellId), s.spellId).toBeDefined()
      for (const c of s.creatures) expect(rules.creatures.get(c.creatureId), c.creatureId).toBeDefined()
    }
  })
})

describe('Draconic Spirit (p. 166)', () => {
  const d = def('draconic-spirit')
  it('AC 14 + spell level, HP 50 + 10 per level above 5', () => {
    expect(summonAc(d, 5)).toBe(19)
    expect(summonHpMax(d, 5)).toBe(50)
    expect(summonAc(d, 7)).toBe(21)
    expect(summonHpMax(d, 7)).toBe(70)
  })
  it('Rend: half the spell level attacks, spell attack bonus, 1d6 + 4 + level Piercing', () => {
    const [rend, breath] = summonAttacks(d, 7, undefined, caster)
    expect(rend.count).toBe(3)
    expect(rend.toHit).toBe(7)
    expect(rend.hit.en).toBe('1d6 + 11 Piercing damage')
    expect(breath.dc).toBe(15)
  })
})

describe('Giant Insect (p. 136)', () => {
  const d = def('giant-insect')
  it('AC 11 + spell level, HP 30 + 10 per level above 4', () => {
    expect(summonAc(d, 4)).toBe(15)
    expect(summonHpMax(d, 4)).toBe(30)
    expect(summonHpMax(d, 6)).toBe(50)
  })
  it('Poison Jab and the form-only attacks', () => {
    const spider = summonAttacks(d, 4, 'spider', caster)
    expect(spider[0].count).toBe(2)
    expect(spider[0].hit.en).toBe('1d6 + 7 Piercing damage plus 1d4 Poison damage')
    expect(spider.map((a) => a.name.en)).toContain('Web Bolt')
    expect(summonAttacks(d, 4, 'wasp', caster)).toHaveLength(1)
    expect(summonAttacks(d, 4, 'centipede', caster)[1].dc).toBe(15)
  })
})

describe('Animated Object (p. 109)', () => {
  const d = def('animated-object')
  it('HP by size, AC 15', () => {
    expect(summonHpMax(d, 5, 'medium')).toBe(10)
    expect(summonHpMax(d, 5, 'large')).toBe(20)
    expect(summonHpMax(d, 5, 'huge')).toBe(40)
    expect(summonAc(d, 5)).toBe(15)
  })
  it('Slam by size, + 1d4 / 1d6 / 1d12 per slot level above 5', () => {
    expect(summonAttacks(d, 5, 'medium', caster)[0].hit.en).toBe('1d4 + 3 Force damage')
    expect(summonAttacks(d, 5, 'large', caster)[0].hit.en).toBe('2d6 + 7 Force damage')
    expect(summonAttacks(d, 7, 'huge', caster)[0].hit.en).toBe('4d12 + 7 Force damage')
  })
})

describe('Undead (Animate Dead p. 108, Create Undead p. 121)', () => {
  it('printed stat block attacks are read', () => {
    const atk = summonAttacks(def('skeleton'), 3, undefined, caster)
    expect(atk[0].toHit).toBe(5)
    expect(atk[0].hit.en).toBe('6 (1d6 + 3) Piercing damage')
    expect(atk[0].hit.fr).toBe('6 (1d6 + 3) dégâts perforants')
  })
  it('creature counts and choices by slot level', () => {
    expect(summonCount('animate-dead', 3)).toBe(1)
    expect(summonCount('animate-dead', 5)).toBe(5)
    const cu = summonSpell('create-undead')!
    expect(summonCreatures(cu, 6)).toEqual(['ghoul'])
    expect(summonCreatures(cu, 8)).toEqual(['ghoul', 'ghast', 'wight'])
    expect(summonCreatures(cu, 9)).toContain('mummy')
    expect(summonCount('create-undead', 7, 'ghoul')).toBe(4)
    expect(summonCount('create-undead', 9, 'mummy')).toBe(2)
  })
})

describe('duration', () => {
  const char = () =>
    newCharacter(
      {
        name: 'T',
        speciesId: 'human',
        backgroundId: 'sage',
        classId: 'wizard',
        lang: 'en',
        abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
      },
      rules,
    )
  it('counts down and vanishes at 0; disappears when its Concentration effect ends', () => {
    const c = char()
    const sp = summonSpell('animate-objects')!
    const e: ActiveEffect = { uid: 'e1', kind: 'spell', enabled: true, concentration: true, rounds: 10 }
    c.activeEffects.push(e)
    c.summons = [newSummon(sp, def('animated-object'), 5, 'large', 'e1')]
    expect(c.summons[0].rounds).toBe(10)
    expect(c.summons[0].hp.max).toBe(20)
    tickSummons(c)
    expect(c.summons[0].rounds).toBe(9)
    c.activeEffects = []
    expect(pruneSummons(c)).toBe(true)
    expect(c.summons).toHaveLength(0)
    c.summons = [newSummon(summonSpell('phantom-steed')!, def('riding-horse'), 3)]
    c.summons[0].rounds = 1
    expect(tickSummons(c)).toEqual(['riding-horse'])
    expect(c.summons).toHaveLength(0)
  })
})

describe('summoning block', () => {
  it('offers no summoning spell to a character who has none (the block is hidden)', () => {
    const c = newCharacter(
      {
        name: 'F',
        speciesId: 'human',
        backgroundId: 'soldier',
        classId: 'fighter',
        lang: 'en',
        abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
      },
      rules,
    )
    expect(availableSummonSpells(compute(c, rules))).toEqual([])
  })
})
