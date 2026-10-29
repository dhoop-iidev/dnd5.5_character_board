// Custom species (house rule #6): a species from another book entered by the player replaces the SRD species of an
// example character; its Speed, size, Darkvision, other speeds, skill proficiencies, resistances, uses, turn activation
// and traits from a later character level work like an SRD species's. No ability score increases (2024 rules).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { turnOptions } from '../../engine/turn'
import type { Character, CustomSpecies } from '../character'
import { customSpeciesDef, readSpeciesFile, speciesFile, withCustomSpecies } from '../customSpecies'
import { migrate } from '../migrate'
import fighter from '../../../examples/guerriere-niveau-5.json'

const CAT: CustomSpecies = {
  id: 'custom-species-1',
  name: 'Catfolk',
  book: 'Some Book p. 115',
  text: 'Player-written description.',
  creatureType: 'Humanoid',
  size: ['small', 'medium'],
  speedFt: 35,
  traits: [
    { id: 't1', level: 1, name: 'Darkvision', text: 'See in the dark.', darkvisionFt: 60 },
    { id: 't2', level: 1, name: 'Claws', text: 'Climb.', speeds: { climb: 'speed' } },
    { id: 't3', level: 1, name: 'Talent', text: 'Skills.', skills: ['perception', 'stealth'] },
    {
      id: 't4',
      level: 1,
      name: 'Agility',
      text: 'Double your Speed.',
      uses: { count: 'pb', per: 'long' },
      activation: { kind: 'free', trigger: 'on your turn' },
    },
    { id: 't5', level: 1, name: 'Hide', text: 'Tough.', resistances: ['poison'] },
    { id: 't6', level: 9, name: 'Later Trait', text: 'Not yet.' },
  ],
}

function withSpecies(base: unknown, sp: CustomSpecies): Character {
  const c = migrate(structuredClone(base)) as Character
  c.customSpecies = [sp]
  c.speciesId = sp.id
  c.speciesChoices = { size: 'medium' }
  return c
}

describe('custom species', () => {
  it('is a species with its Speed, size and traits up to the character level', () => {
    const c = withSpecies(fighter, CAT)
    const s = compute(c, rules)
    expect(s.species?.name.en).toBe('Catfolk')
    expect(s.species?.source).toMatchObject({ book: 'Some Book p. 115', houseRule: 6 })
    expect(s.speed.total).toBe(35)
    const ids = s.traits.map((t) => t.id)
    expect(ids).toContain('custom-species-1:t1')
    expect(ids).not.toContain('custom-species-1:t6')
    expect(ids.some((id) => id.startsWith('human:'))).toBe(false)
    expect(customSpeciesDef(CAT).sizeText.en).toBe('Small or Medium')
    expect(customSpeciesDef(CAT).speed).toEqual({ ft: 35, m: 10.5 })
  })

  it('gives Darkvision, a Climb Speed equal to the Speed, skills and resistances', () => {
    const s = compute(withSpecies(fighter, CAT), rules)
    const g = s.pool.grants.map((x) => x.grant)
    expect(g).toContainEqual({ kind: 'darkvision', value: 60 })
    expect(g).toContainEqual({ kind: 'resistance', on: 'poison' })
    expect(s.otherSpeeds).toContainEqual(expect.objectContaining({ kind: 'climb', ft: 35 }))
    for (const id of ['perception', 'stealth']) expect(s.skills.find((k) => k.id === id)!.proficiency).not.toBe('none')
  })

  it('counts uses by Proficiency Bonus and shows a turn card', () => {
    const c = withSpecies(fighter, CAT)
    const s = compute(c, rules)
    const r = s.resources.find((x) => x.id === 'custom-species-1:t4')!
    expect(r).toMatchObject({ max: s.pb, per: 'long' })
    expect(turnOptions(c, s).some((o) => o.ownerId === 'custom-species-1:t4')).toBe(true)
  })

  it('a trait with nothing for the engine is text only; no warning about the species', () => {
    const r = withCustomSpecies(rules, { customSpecies: [CAT] })
    expect(r.effects.get('custom-species-1:t6')?.textOnly).toBeTruthy()
    expect(withCustomSpecies(rules, { customSpecies: [] })).toBe(rules)
    const ws = validate(withSpecies(fighter, CAT), rules)
    expect(ws.filter((w) => JSON.stringify(w).includes('custom-species'))).toEqual([])
  })

  it('exports and imports a species file, with a fresh id on collision', () => {
    const file = JSON.parse(JSON.stringify(speciesFile(CAT)))
    const copy = readSpeciesFile(file, [CAT])
    expect(copy.id).toBe('custom-species-2')
    expect(copy.traits).toHaveLength(CAT.traits.length)
    expect(() => readSpeciesFile({ kind: 'other' }, [])).toThrow()
  })
})
