// House rule #8 (docs/house-rules.md, 2026-11-25): a skill proficiency two fixed sources give may be swapped for another.
import { describe, expect, it } from 'vitest'
import { buildRules } from '../../data/rules'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { duplicateKey } from '../sheet/skills'
import { validate } from '../validate'

const base = buildRules()
// A test grant of Stealth on the Criminal's Origin feat (Alert); the Criminal already gives Stealth (SRD p. 83).
const rules = { ...base, effects: new Map(base.effects) }
rules.effects.set('feat:alert', { id: 'feat:alert', grants: [{ kind: 'proficiency', on: 'skill.stealth' }] })

const mk = () =>
  newCharacter(
    {
      name: 'T',
      speciesId: 'human',
      backgroundId: 'criminal',
      classId: 'fighter',
      lang: 'en',
      abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      speciesChoices: { size: 'medium' },
      backgroundKit: 'B',
    },
    rules,
  )
const prof = (c: ReturnType<typeof mk>, id: string) => compute(c, rules).skills.find((s) => s.id === id)!.proficiency
const swaps = (c: ReturnType<typeof mk>) => validate(c, rules).filter((w) => w.id.startsWith('skill-swap-'))

describe('house rule #8: a skill given twice', () => {
  it('lists the duplicate with its sources, no warning while unswapped', () => {
    const c = mk()
    const d = compute(c, rules).duplicateSkills
    expect(d.map((x) => [x.skill, x.sources.length, x.replacement])).toEqual([['stealth', 2, undefined]])
    expect(swaps(c)).toEqual([])
  })

  it('the replacement becomes proficient', () => {
    const c = mk()
    expect(prof(c, 'medicine')).toBe('none')
    c.featureChoices[duplicateKey('stealth')] = 'medicine'
    expect(prof(c, 'medicine')).toBe('proficient')
    expect(prof(c, 'stealth')).toBe('proficient')
    expect(swaps(c)).toEqual([])
    expect(validate(c, rules).filter((w) => w.id.includes('skills:duplicate'))).toEqual([]) // not a stale choice
  })

  it('flags a replacement already proficient, and one whose duplicate is gone', () => {
    const c = mk()
    c.featureChoices[duplicateKey('stealth')] = 'sleight-of-hand' // the Criminal's other skill
    expect(swaps(c).map((w) => w.id)).toEqual(['skill-swap-stealth-already'])
    c.featureChoices = { [duplicateKey('athletics')]: 'medicine' }
    expect(swaps(c).map((w) => w.id)).toEqual(['skill-swap-athletics-stale'])
    expect(prof(c, 'medicine')).toBe('none')
  })
})
