// Bard features against the SRD 5.2.1 text (Bard p. 31–35): Bardic Inspiration, Expertise, Jack of All Trades,
// Font of Inspiration, Magical Secrets, College of Lore (Bonus Proficiencies, Magical Discoveries); the
// examples/barde-niveau-10.json build.
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
const ABIL: Abilities = { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 }

/** A human bard of the given level (Lore from level 3, Ability Score Improvement on Cha at 4 and 8). */
const bard = (level: number, abilities: Partial<Abilities> = {}) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'criminal',
      classId: 'bard',
      lang: 'en',
      abilities: { ...ABIL, ...abilities },
    },
    rules,
  )
  c.background.abilities = { dex: 2, con: 1 }
  c.skillProficiencies = ['performance', 'persuasion', 'deception']
  c.featureChoices['human:skillful'] = 'insight'
  c.featureChoices['tools:bard'] = ['lute', 'flute', 'drum']
  c.extraFeats['human:versatile'] = { featId: 'skilled', choices: { choice: ['arcana', 'history', 'nature'] } }
  for (let i = 2; i <= level; i++)
    c.levels.push({
      classId: 'bard',
      hpRoll: 5,
      hpFixed: true,
      ...(i === 3 ? { subclassId: 'bard:college-of-lore' } : {}),
      ...(i === 4 || i === 8 ? { feat: { featId: 'ability-score-improvement', abilities: { cha: 2 } } } : {}),
    })
  c.spellcasting.bard = { prepared: [], cantrips: [] }
  return c
}

const actionable = (c: ReturnType<typeof bard>) =>
  validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))

describe('Bardic Inspiration (SRD p. 31–32)', () => {
  it('uses = Charisma modifier, regained on a Long Rest at level 1 (p. 31)', () => {
    const s = compute(bard(1), rules)
    const r = s.resources.find((x) => x.id === 'bard:bardic-inspiration')!
    expect(r.max).toBe(3)
    expect(r.per).toBe('long')
  })
  it('minimum of once with a Charisma modifier below +1 (p. 31)', () => {
    const s = compute(bard(1, { cha: 8 }), rules)
    expect(s.resources.find((x) => x.id === 'bard:bardic-inspiration')!.max).toBe(1)
  })
  it('Font of Inspiration: regained on a Short or Long Rest from level 5 (p. 32)', () => {
    expect(compute(bard(4), rules).resources.find((x) => x.id === 'bard:bardic-inspiration')!.per).toBe('long')
    const s = compute(bard(5), rules)
    expect(s.resources.find((x) => x.id === 'bard:bardic-inspiration')!.per).toBe('short')
    expect(s.resources.find((x) => x.id === 'bard:bardic-inspiration')!.max).toBe(4) // Cha 16 + 2 at level 4 → 18
  })
  it('Bardic Die column: d6, d8 at level 5, d10 at level 10 (Bard Features table p. 31)', () => {
    expect(compute(bard(1), rules).tableValues.bard.bardicDie).toBe('D6')
    expect(compute(bard(5), rules).tableValues.bard.bardicDie).toBe('D8')
    expect(compute(bard(10), rules).tableValues.bard.bardicDie).toBe('D10')
    expect(
      compute(bard(10), rules).featureValues.some((v) => v.ownerId === 'bard:bardic-inspiration' && v.id === 'die'),
    ).toBe(true)
  })
})

describe('Expertise and Jack of All Trades (SRD p. 32)', () => {
  it('Expertise: two skills at level 2, two more at level 9 (p. 32)', () => {
    expect(compute(bard(1), rules).expertiseMax).toBe(0)
    expect(compute(bard(2), rules).expertiseMax).toBe(2)
    expect(compute(bard(8), rules).expertiseMax).toBe(2)
    expect(compute(bard(9), rules).expertiseMax).toBe(4)
  })
  it('Expertise doubles the Proficiency Bonus; three picks at level 2 are flagged (p. 32, p. 181)', () => {
    const c = bard(2)
    c.featureChoices['bard:expertise'] = ['performance', 'persuasion']
    const s = compute(c, rules)
    expect(s.skills.find((k) => k.id === 'performance')!.total.total).toBe(3 + 2 * 2)
    expect(actionable(c).map((w) => w.id)).toEqual([])
    c.featureChoices['bard:expertise'] = ['performance', 'persuasion', 'deception']
    expect(validate(c, rules).map((w) => w.id)).toContain('choice-bard:expertise')
  })
  it('Jack of All Trades: half the Proficiency Bonus (round down) on checks without proficiency (p. 32)', () => {
    const s1 = compute(bard(1), rules)
    expect(s1.skills.find((k) => k.id === 'athletics')!.total.total).toBe(-1)
    const s2 = compute(bard(2), rules)
    const athletics = s2.skills.find((k) => k.id === 'athletics')!
    expect(athletics.proficiency).toBe('half')
    expect(athletics.total.total).toBe(-1 + 1)
    expect(compute(bard(5), rules).skills.find((k) => k.id === 'athletics')!.total.total).toBe(-1 + 1) // PB 3 → +1
  })
})

describe('Bard Spellcasting (Bard Features table p. 31, Spellcasting p. 32)', () => {
  it('cantrips 2 → 3 at level 4 → 4 at level 10; prepared spells 4 → 15 at level 10; spell levels', () => {
    const s1 = compute(bard(1), rules).spellcasting[0]
    expect(s1.ability).toBe('cha')
    expect(s1.cantripsMax).toBe(2)
    expect(s1.preparedMax).toBe(4)
    expect(s1.maxSpellLevel).toBe(1)
    expect(s1.dc.total).toBe(8 + 2 + 3)
    const s4 = compute(bard(4), rules).spellcasting[0]
    expect(s4.cantripsMax).toBe(3)
    expect(s4.preparedMax).toBe(7)
    const s10 = compute(bard(10), rules).spellcasting[0]
    expect(s10.cantripsMax).toBe(4)
    expect(s10.preparedMax).toBe(15)
    expect(s10.maxSpellLevel).toBe(5)
  })
  it('Magical Secrets (level 10): the Cleric, Druid and Wizard lists open up (p. 33)', () => {
    const c9 = bard(9)
    c9.spellcasting.bard = { prepared: ['revivify'], cantrips: [] }
    expect(compute(c9, rules).spellcasting[0].extraLists).toEqual([])
    expect(validate(c9, rules).map((w) => w.id)).toContain('spell-list-bard-revivify')
    const c10 = bard(10)
    c10.spellcasting.bard = { prepared: ['revivify', 'fireball', 'moonbeam'], cantrips: [] }
    expect(compute(c10, rules).spellcasting[0].extraLists).toEqual(['cleric', 'druid', 'wizard'])
    expect(validate(c10, rules).filter((w) => w.id.startsWith('spell-list-'))).toEqual([])
  })
})

describe('College of Lore (SRD p. 35)', () => {
  it('Bonus Proficiencies: three skills of your choice at level 3 (p. 35)', () => {
    const c = bard(3)
    expect(validate(c, rules).map((w) => w.id)).toContain('choice-bard:college-of-lore:bonus-proficiencies')
    c.featureChoices['bard:college-of-lore:bonus-proficiencies'] = ['athletics', 'stealth', 'survival']
    const s = compute(c, rules)
    expect(s.skills.find((k) => k.id === 'athletics')!.proficiency).toBe('proficient')
    expect(s.skills.find((k) => k.id === 'stealth')!.total.total).toBe(3 + 2)
    expect(validate(c, rules).map((w) => w.id)).not.toContain('choice-bard:college-of-lore:bonus-proficiencies')
  })
  it('Magical Discoveries: two Cleric/Druid/Wizard spells always prepared, not counted (p. 35)', () => {
    const c = bard(6)
    c.featureChoices['bard:college-of-lore:bonus-proficiencies'] = ['athletics', 'stealth', 'survival']
    c.featureChoices['bard:college-of-lore:magical-discoveries'] = ['fireball', 'spirit-guardians']
    c.spellcasting.bard = { prepared: ['fireball', 'spirit-guardians', 'healing-word'], cantrips: [] }
    const s = compute(c, rules)
    expect(s.spellcasting[0].alwaysPrepared).toEqual(['fireball', 'spirit-guardians'])
    expect(validate(c, rules).filter((w) => w.area === 'spells' && !toChoose(w))).toEqual([])
    c.featureChoices['bard:college-of-lore:magical-discoveries'] = ['fireball', 'vicious-mockery'] // a Bard-only cantrip
    expect(validate(c, rules).map((w) => w.id)).toContain(
      'choice-bard:college-of-lore:magical-discoveries-vicious-mockery-list',
    )
  })
  it('Cutting Words and Countercharm are text-only (reaction at the dice, p. 35 and p. 33)', () => {
    expect(rules.effects.get('bard:college-of-lore:cutting-words')?.textOnly).toBeDefined()
    expect(rules.effects.get('bard:countercharm')?.textOnly).toBeDefined()
  })
})

describe('examples/barde-niveau-10.json: halfling Bard 10, College of Lore, Acolyte', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'barde-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, PB +4, Cha 20 (15 + 2 Acolyte + 2 + 1), hit points 8 + 9 × 5 + 10 × 2', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.cha.score.total).toBe(20)
    expect(s.hpMax.total).toBe(73)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('Bardic Inspiration: 5 uses (Cha +5), d10, Short Rest; 4 Expertise skills', () => {
    const r = s.resources.find((x) => x.id === 'bard:bardic-inspiration')!
    expect(r.max).toBe(5)
    expect(r.per).toBe('short')
    expect(s.tableValues.bard.bardicDie).toBe('D10')
    expect(s.expertiseMax).toBe(4)
    expect(s.skills.find((k) => k.id === 'performance')!.total.total).toBe(5 + 8)
  })
  it('spells: 4 cantrips, 15 prepared (Revivify through Magical Secrets), Fireball and Spirit Guardians always prepared', () => {
    const sc = s.spellcasting[0]
    expect(sc.cantrips.length).toBe(sc.cantripsMax)
    expect(sc.prepared.length).toBe(sc.preparedMax)
    expect(sc.alwaysPrepared).toEqual(['fireball', 'spirit-guardians'])
    expect(sc.extraLists).toContain('cleric')
    expect(s.slots).toEqual([4, 3, 3, 3, 2])
  })
  it('AC 11 + 2 (leather armor, Dex 14); no error or actionable warning', () => {
    expect(s.ac.total).toBe(13)
    expect(actionable(c).map((w) => `${w.id}: ${w.message.en}`)).toEqual([])
  })
})
