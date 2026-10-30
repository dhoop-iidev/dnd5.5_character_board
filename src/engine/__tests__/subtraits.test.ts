// Species sub-traits tied to an option (`withOption` in custom/effects/species.json): a Goliath has only the Giant
// Ancestry benefit chosen (SRD 5.2.1 p. 86), a Gnome only the chosen Gnomish Lineage (p. 85), listed and in play.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { compute } from '../compute'

const goliath = () =>
  migrate(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'barbare-niveau-10.json'), 'utf8')))
const ANCESTRY = ['cloud', 'fire', 'frost', 'hill', 'stone', 'storm']
const benefits = (ids: string[]) => ids.filter((id) => /^goliath:.*-giant$/.test(id))

describe('species sub-traits', () => {
  it('a Stone Giant goliath has Stone’s Endurance only, as trait and as owner', () => {
    const s = compute(goliath(), rules)
    expect(benefits(s.traits.map((t) => t.id))).toEqual(['goliath:stones-endurance-stone-giant'])
    expect(benefits(s.owners.map((o) => o.id))).toEqual(['goliath:stones-endurance-stone-giant'])
  })
  it('each ancestry brings its own benefit; none before the choice', () => {
    for (const a of ANCESTRY) {
      const c = goliath()
      c.featureChoices['goliath:giant-ancestry'] = a
      const ids = benefits(compute(c, rules).traits.map((t) => t.id))
      expect(ids).toHaveLength(1)
      expect(ids[0]).toContain(`-${a}-giant`)
    }
    const c = goliath()
    delete c.featureChoices['goliath:giant-ancestry']
    expect(benefits(compute(c, rules).owners.map((o) => o.id))).toEqual([])
  })
  it('a forest gnome lists Forest Gnome, not Rock Gnome', () => {
    const c = goliath()
    c.speciesId = 'gnome'
    c.featureChoices['gnome:gnomish-lineage'] = 'forest-gnome'
    const ids = compute(c, rules).traits.map((t) => t.id)
    expect(ids).toContain('gnome:forest-gnome')
    expect(ids).not.toContain('gnome:rock-gnome')
  })
})
