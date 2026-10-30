// Creation choices: languages (SRD p. 20, Common plus two, flagged until chosen), the tab where each warning is fixed,
// repeated feats (Magic Initiate twice, SRD p. 87) and Skilled's skills or tools.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { tabOfWarning } from '../../ui/spellChoices'
import { languageName, languageOf } from '../languages'
import { newCharacter } from '../newCharacter'

const fresh = (classId: string) =>
  newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'sage',
      classId,
      lang: 'fr',
      abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 15, cha: 8 },
    },
    rules,
  )

describe('languages', () => {
  it('reads ids and names in the three languages', () => {
    expect(languageOf('Commun')?.id).toBe('common')
    expect(languageOf("Thieves' Cant")?.id).toBe('thieves-cant')
    expect(languageName('elvish').fr).toBe('Elfique')
    expect(languageName('Klingon').fr).toBe('Klingon')
  })

  it('flags a new character until it knows Common plus two languages', () => {
    const c = fresh('fighter')
    expect(c.identity.languages).toEqual(['common'])
    expect(validate(c, rules).map((w) => w.id)).toContain('background-languages')
    c.identity.languages = ['common', 'elvish', 'Klingon']
    expect(validate(c, rules).map((w) => w.id)).not.toContain('background-languages')
    c.identity.languages = ['elvish', 'dwarvish', 'giant']
    expect(validate(c, rules).map((w) => w.id)).toContain('background-languages')
  })
})

describe('warning tabs', () => {
  it('sends spell picks to Spells, Weapon Mastery to Combat, the rest to General', () => {
    const c = fresh('cleric')
    const s = compute(c, rules)
    const tabs = Object.fromEntries(validate(c, rules).map((w) => [w.id, tabOfWarning(w, s)]))
    expect(tabs['background-languages']).toBe('general')
    expect(
      Object.entries(tabs)
        .filter(([id]) => id.startsWith('cantrips-missing'))
        .map(([, t]) => t),
    ).toEqual(['spells'])
    const f = fresh('fighter')
    const fs = compute(f, rules)
    const m = validate(f, rules).find((w) => w.id.startsWith('mastery'))
    if (m) expect(tabOfWarning(m, fs)).toBe('combat')
  })
})

describe('repeated feats', () => {
  it('Magic Initiate from the background and from Versatile are two owners, each with its own list', () => {
    const c = fresh('cleric')
    c.extraFeats = { 'human:versatile': { featId: 'magic-initiate' } }
    const s = compute(c, rules)
    const ids = s.owners.filter((o) => o.feat?.id === 'magic-initiate').map((o) => o.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    c.extraFeats['human:versatile'].choices = { list: 'wizard' }
    expect(validate(c, rules).some((w) => w.id.startsWith('feat-list-'))).toBe(true)
    c.extraFeats['human:versatile'].choices = { list: 'cleric' }
    expect(validate(c, rules).some((w) => w.id.startsWith('feat-list-'))).toBe(false)
  })

  it('Skilled takes skills or tools (SRD p. 87)', () => {
    const c = fresh('rogue')
    c.extraFeats = {
      'human:versatile': { featId: 'skilled', choices: { choice: ['stealth', 'thieves-tools', 'insight'] } },
    }
    const s = compute(c, rules)
    expect(s.proficiencies.tools).toContain('Thieves’ Tools')
    expect(validate(c, rules).filter((w) => w.id.includes('skilled') && w.severity === 'error')).toEqual([])
  })
})
