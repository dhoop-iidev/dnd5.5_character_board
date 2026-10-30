// Creation choices: languages (SRD p. 20, Common plus two, flagged until chosen), the tab where each warning is fixed,
// repeated feats (Magic Initiate twice, SRD p. 87) and Skilled's skills or tools.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { tabOfWarning } from '../../ui/spellChoices'
import { languageName, languageOf } from '../languages'
import { newCharacter } from '../newCharacter'
import { ALIGNMENTS, alignmentName, alignmentOf } from '../alignments'
import { toolChoicesOf } from '../toolChoices'
import { reconcile } from '../reconcile'

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

describe('languages from class features (SRD p. 62 Thieves’ Cant, p. 59 Deft Explorer)', () => {
  it('a Rogue knows Thieves’ Cant and the language picked with it, each once, custom ones too', () => {
    const c = fresh('rogue')
    c.identity.languages = ['common', 'elvish', 'Argot des voleurs', 'Valérien']
    c.featureChoices['rogue:thieves-cant'] = 'Valérien'
    const langs = compute(c, rules).proficiencies.languages
    expect(langs.map((l) => languageOf(l)?.id ?? l)).toEqual(['common', 'elvish', 'thieves-cant', 'Valérien'])
    c.identity.languages = ['common', 'elvish', 'dwarvish']
    c.featureChoices['rogue:thieves-cant'] = 'draconic'
    const ids = compute(c, rules).proficiencies.languages.map((l) => languageOf(l)?.id ?? l)
    expect(ids).toEqual(['common', 'elvish', 'dwarvish', 'thieves-cant', 'draconic'])
    expect(validate(c, rules).filter((w) => w.ownerId === 'rogue:thieves-cant')).toEqual([])
  })
  it('the other language is asked for until picked', () => {
    const c = fresh('rogue')
    expect(validate(c, rules).some((w) => w.ownerId === 'rogue:thieves-cant' && w.actionable)).toBe(true)
  })
})

describe('alignment (SRD p. 21)', () => {
  it('nine alignments, read from an id or a name in any language', () => {
    expect(ALIGNMENTS).toHaveLength(9)
    expect(alignmentOf('Loyal Bon')?.id).toBe('lawful-good')
    expect(alignmentOf('caótico malvado')?.id).toBe('chaotic-evil')
    expect(alignmentOf('NG')?.id).toBe('neutral-good')
    expect(alignmentName('neutral').fr).toBe('Neutre')
    expect(alignmentName('Pragmatique').fr).toBe('Pragmatique')
  })
})

describe('tool proficiencies to choose (model/toolChoices.ts)', () => {
  const tools = (c: ReturnType<typeof fresh>) => compute(c, rules).proficiencies.tools
  const ids = (c: ReturnType<typeof fresh>) => validate(c, rules).map((w) => w.id)
  it('Bard: three instruments in place of the sentence, flagged until chosen (SRD p. 31)', () => {
    const c = fresh('bard')
    expect(ids(c)).toContain('tools-bard')
    c.featureChoices['tools:bard'] = ['lute', 'flute', 'drum']
    expect(tools(c)).toEqual(expect.arrayContaining(['lute', 'flute', 'drum']))
    expect(tools(c).some((t) => t.startsWith('Choose'))).toBe(false)
    expect(ids(c)).not.toContain('tools-bard')
    c.featureChoices['tools:bard'] = ['lute', 'flute', 'smiths-tools']
    expect(ids(c)).toContain('tools-bard-smiths-tools')
  })
  it('Monk: one Artisan’s Tools or instrument; multiclassing into Bard: one instrument', () => {
    const c = fresh('monk')
    c.featureChoices['tools:monk'] = 'smiths-tools'
    expect(tools(c)).toContain('smiths-tools')
    c.levels.push({ classId: 'bard', hpRoll: 5, hpFixed: true })
    const bard = toolChoicesOf(c, rules).find((t) => t.key === 'tools:bard')!
    expect([bard.count, bard.place]).toEqual([1, 1])
  })
  it('Soldier: one Gaming Set; the pick goes when the background changes', () => {
    const c = fresh('fighter')
    c.background = { backgroundId: 'soldier', abilities: {}, feat: { featId: 'savage-attacker' } }
    expect(ids(c)).toContain('background-tools')
    c.featureChoices['tools:background'] = 'dragonchess'
    expect(tools(c)).toContain('dragonchess')
    expect(ids(c)).not.toContain('background-tools')
    expect(reconcile(c, rules)).toEqual([])
    c.background = { backgroundId: 'sage', abilities: {}, feat: { featId: 'magic-initiate' } }
    expect(reconcile(c, rules)).toContain('featureChoices.tools:background')
  })
})
