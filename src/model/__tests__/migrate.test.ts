// Schema 5 migration: level choices and the flat Expertise list of an older save move into `featureChoices`, the
// Expertise picks split between features in the order the levels gained them (as the progression showed them).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { SCHEMA_VERSION } from '../character'
import { migrate } from '../migrate'

const v5 = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'voleuse-niveau-10.json'), 'utf8'))

/** The rogue example written back in the schema 4 shape. */
function asSchema4(extra: (c: Record<string, unknown>) => void = () => {}) {
  const c = structuredClone(v5)
  c.schemaVersion = 4
  c.expertise = c.featureChoices['rogue:expertise']
  delete c.featureChoices['rogue:expertise']
  for (const l of c.levels) l.choices = {}
  c.levels[0].choices['rogue:thieves-cant'] = c.featureChoices['rogue:thieves-cant']
  delete c.featureChoices['rogue:thieves-cant']
  extra(c)
  return c
}

describe('schema 5 migration', () => {
  it('moves level choices and the Expertise list into featureChoices', () => {
    const m = migrate(asSchema4())
    expect(m.schemaVersion).toBe(SCHEMA_VERSION)
    expect(m.featureChoices['rogue:thieves-cant']).toBe(v5.featureChoices['rogue:thieves-cant'])
    expect(m.featureChoices['rogue:expertise']).toEqual(v5.featureChoices['rogue:expertise'])
    expect(m.levels.every((l) => !('choices' in l))).toBe(true)
    expect('expertise' in m).toBe(false)
    expect(JSON.stringify(compute(m, rules).skills)).toBe(
      JSON.stringify(compute(migrate(structuredClone(v5)), rules).skills),
    )
  })

  it('splits Expertise between a Rogue and a Bard in level order', () => {
    const m = migrate(
      asSchema4((c) => {
        const levels = c.levels as { classId: string }[]
        levels.splice(1, 0, { ...levels[1], classId: 'bard' }, { ...levels[1], classId: 'bard' })
        c.expertise = ['stealth', 'sleight-of-hand', 'persuasion', 'deception', 'perception', 'acrobatics']
      }),
    )
    expect(m.featureChoices['rogue:expertise']).toEqual(['stealth', 'sleight-of-hand', 'perception', 'acrobatics'])
    expect(m.featureChoices['bard:expertise']).toEqual(['persuasion', 'deception'])
  })
})
