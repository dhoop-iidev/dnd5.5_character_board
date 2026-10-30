// Build warnings sit where they can be fixed (ui/progression.ts, user request 2026-10-28): the Origin block of the level-1
// row (species, background, ability scores, traits, the background's feat), the row of the level that gained the
// feature or feat, the level-1 skills; Expertise picks are split by the rows that grant them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import type { Character } from '../../model/character'
import { migrate } from '../../model/migrate'
import { progressionPlaces } from '../progression'

const example = (file: string): Character =>
  migrate(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', file), 'utf8')))
const placesOf = (c: Character) => progressionPlaces(c, compute(c, rules), rules)

describe('progression places', () => {
  it('origin warnings go to the Origin block, skill warnings to the level-1 row', () => {
    const c = example('guerrier-niveau-10.json')
    c.background.abilities = {}
    c.baseAbilities.str = 25
    c.skillProficiencies.push('arcana' as never)
    const p = placesOf(c)
    const at = (id: string) => p.placeOfWarning(validate(c, rules).find((w) => w.id === id)!)
    expect(at('background-abilities')).toBe('origin')
    expect(at('ability-str')).toBe('origin')
    expect(at('skill-list-arcana')).toBe(0)
  })

  it('a missing feature choice goes to the row where the feature was gained', () => {
    const c = example('occultiste-niveau-10.json')
    for (const k of Object.keys(c.featureChoices)) if (k.includes('invocation')) delete c.featureChoices[k]
    const p = placesOf(c)
    const ws = validate(c, rules).filter((w) => w.id.startsWith('choice-warlock:eldritch-invocations'))
    expect(ws.length).toBeGreaterThan(0)
    for (const w of ws) expect(p.placeOfWarning(w)).toBe(0)
  })

  it('Rogue Expertise: the old flat list becomes the feature’s choice; picks missing at Rogue 6 go to that row', () => {
    const c = example('voleuse-niveau-10.json')
    expect(c.featureChoices['rogue:expertise']).toHaveLength(4)
    c.featureChoices['rogue:expertise'] = (c.featureChoices['rogue:expertise'] as string[]).slice(0, 2)
    const p = placesOf(c)
    const w = validate(c, rules).find((x) => x.id === 'choice-rogue:expertise')!
    expect(p.placeOfWarning(w)).toBe(c.levels.findIndex((_, i) => p.classLevelAt(i) === 6))
  })

  it('every build warning of the examples has a place', () => {
    for (const f of [
      'barbare-niveau-10.json',
      'barde-niveau-10.json',
      'magicien-niveau-10.json',
      'rodeur-niveau-10.json',
    ]) {
      const c = example(f)
      c.background.abilities = {}
      const p = placesOf(c)
      const lost = validate(c, rules).filter(
        (w) => ['abilities', 'skills', 'feats'].includes(w.area) && p.placeOfWarning(w) === undefined,
      )
      expect(lost.map((w) => `${f}: ${w.id}`)).toEqual([])
    }
  })
})
