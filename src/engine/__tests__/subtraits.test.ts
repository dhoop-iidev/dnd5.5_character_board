// Species traits that depend on a choice or a level: a Goliath has only the Giant Ancestry benefit chosen (SRD 5.2.1
// p. 86), a Gnome only the chosen Gnomish Lineage (p. 85) (`withOption`); Large Form (p. 86) and Draconic Flight
// (p. 84) only from character level 5 (`minLevel`): listed before, but no uses, switch or Combat card.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { compute } from '../compute'
import { turnOptions } from '../turn'

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

describe('species traits from character level 5', () => {
  const inPlay = (c: ReturnType<typeof goliath>, level: number, id: string) => {
    const s = compute(c, rules, { level })
    return {
      listed: s.traits.some((t) => t.id === id),
      resource: s.resources.some((r) => r.id === id),
      toggle: s.pool.toggles.some((t) => t.owner.id === id),
      card: turnOptions(c, s).some((o) => o.ownerId === id),
    }
  }
  it('Large Form: listed at level 1 with nothing to use; uses, switch and card at level 5', () => {
    expect(inPlay(goliath(), 1, 'goliath:large-form')).toEqual({
      listed: true,
      resource: false,
      toggle: false,
      card: false,
    })
    expect(inPlay(goliath(), 4, 'goliath:large-form').resource).toBe(false)
    expect(inPlay(goliath(), 5, 'goliath:large-form')).toEqual({
      listed: true,
      resource: true,
      toggle: true,
      card: true,
    })
  })
  it('Draconic Flight: no use before level 5', () => {
    const c = goliath()
    c.speciesId = 'dragonborn'
    c.featureChoices['dragonborn:draconic-ancestry'] = 'red'
    expect(inPlay(c, 4, 'dragonborn:draconic-flight')).toMatchObject({ listed: true, resource: false, card: false })
    expect(inPlay(c, 5, 'dragonborn:draconic-flight')).toMatchObject({ resource: true, card: true })
  })
})
