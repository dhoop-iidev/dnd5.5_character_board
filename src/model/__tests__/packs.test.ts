// Content packs (house rule #7, model/packs.ts) with a made-up test pack (no book content): installed into the rules,
// used by a character, copied into its file, and installed again from that copy on a device without the pack.
import { afterEach, describe, expect, it } from 'vitest'
import { buildRules } from '../../data/rules'
import type { I18n } from '../../data/types'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { newCharacter } from '../newCharacter'
import {
  installEmbedded,
  installPack,
  packContentOf,
  readPack,
  resetPacks,
  withPackContent,
  type ContentPack,
} from '../packs'
import { BACKGROUND_KITS } from '../startingEquipment'

const t = (s: string): I18n => ({ en: s, fr: `${s} (fr)`, es: `${s} (es)` })
const src = { pack: 'test-book', bookPage: 12 }

export const TEST_PACK: ContentPack = {
  kind: 'content-pack',
  format: 1,
  id: 'test-book',
  version: '2026-11-25',
  book: t('Test Book'),
  species: [
    {
      id: 'testfolk',
      name: t('Testfolk'),
      creatureType: t('Humanoid'),
      size: ['medium'],
      sizeText: t('Medium'),
      speed: { ft: 35, m: 10.5 },
      traits: [
        { id: 'testfolk:night-eyes', name: t('Night Eyes'), text: t('<p>Darkvision 60 feet.</p>'), source: src },
        { id: 'testfolk:spark', name: t('Spark'), text: t('<p>You know Test Spark.</p>'), source: src },
      ],
      text: t('<p>Test species.</p>'),
      source: src,
    },
  ],
  backgrounds: [
    {
      id: 'test-wanderer',
      name: t('Test Wanderer'),
      abilities: ['dex', 'wis', 'cha'],
      feat: 'test-luck',
      featText: t('Test Luck'),
      skills: ['insight', 'stealth'],
      tool: t('Thieves’ Tools'),
      equipment: t('A: Dagger, 10 GP; B: 50 GP'),
      text: t('<p>Test background.</p>'),
      source: src,
      kits: [
        { letter: 'A', gp: 10, items: [{ text: 'Dagger', kind: 'weapon', id: 'dagger' }] },
        { letter: 'B', gp: 50, items: [] },
      ],
    },
  ],
  feats: [
    {
      id: 'test-luck',
      name: t('Test Luck'),
      category: 'origin',
      categoryText: t('Origin Feat'),
      text: t('<p>Luck points.</p>'),
      source: src,
    },
    {
      id: 'test-unused',
      name: t('Test Unused'),
      category: 'general',
      categoryText: t('General Feat'),
      text: t('<p>Not taken.</p>'),
      source: src,
    },
  ],
  spells: [
    {
      id: 'test-spark',
      name: t('Test Spark'),
      level: 0,
      school: 'evocation',
      classes: ['wizard'],
      castingTime: t('Action'),
      castingKind: 'action',
      ritual: false,
      range: t('60 feet'),
      components: { v: true, s: true },
      duration: t('Instantaneous'),
      concentration: false,
      text: t('<p>A spark.</p>'),
      source: src,
    },
  ],
  subclasses: [
    {
      id: 'fighter:test-way',
      classId: 'fighter',
      name: t('Test Way'),
      text: t('<p>Test subclass.</p>'),
      features: [{ id: 'fighter:test-way:edge', level: 3, name: t('Edge'), text: t('<p>+1 AC.</p>'), source: src }],
      source: src,
    },
  ],
  effects: [
    { id: 'testfolk:night-eyes', grants: [{ kind: 'darkvision', value: 60 }], source: src },
    { id: 'testfolk:spark', spells: { always: ['test-spark'], ability: 'cha' }, source: src },
    { id: 'feat:test-luck', uses: { count: 'pb', per: 'long' }, source: src },
    { id: 'fighter:test-way:edge', modifiers: [{ target: 'ac', value: 1 }], source: src },
  ],
  summaries: {
    'species:testfolk': t('Test species.'),
    'trait:testfolk:night-eyes': t('Darkvision 60 ft.'),
    'feat:test-luck': t('Luck points.'),
    'feat:test-unused': t('Not taken.'),
    'spell:test-spark': t('A spark.'),
    'feature:fighter:test-way:edge': t('+1 AC.'),
  },
}

const ABIL = { str: 10, dex: 14, con: 12, int: 10, wis: 13, cha: 15 }

afterEach(() => {
  resetPacks()
  delete BACKGROUND_KITS['test-wanderer']
})

describe('content packs (model/packs.ts)', () => {
  it('reads only pack files', () => {
    expect(() => readPack({ kind: 'custom-species' })).toThrow()
    expect(() => readPack({ ...TEST_PACK, format: 2 })).toThrow()
    expect(() => readPack({ ...TEST_PACK, feats: [{ name: 'x' }] })).toThrow()
    expect(readPack(structuredClone(TEST_PACK)).id).toBe('test-book')
  })

  it('installs species, background (with kits), feats, spells in the class lists, subclasses and effects', () => {
    const rules = buildRules()
    expect(installPack(rules, structuredClone(TEST_PACK))).toEqual([])
    expect(rules.species.get('testfolk')?.speed.ft).toBe(35)
    expect(rules.backgrounds.get('test-wanderer')?.feat).toBe('test-luck')
    expect(BACKGROUND_KITS['test-wanderer']?.[0].gp).toBe(10)
    expect(rules.feats.get('test-luck')?.category).toBe('origin')
    expect(rules.classes.get('wizard')?.spellList?.find((r) => r.level === 0)?.spells).toContain('test-spark')
    expect(rules.classes.get('fighter')?.subclasses.map((s) => s.id)).toContain('fighter:test-way')
    expect(rules.summaries.get('spell:test-spark')?.en).toBe('A spark.')
    // An SRD id is never replaced; installing the same pack twice changes nothing.
    expect(
      installPack(rules, { ...structuredClone(TEST_PACK), species: [{ ...TEST_PACK.species![0], id: 'elf' }] }),
    ).toContain('species:elf')
    expect(rules.species.get('elf')?.name.en).toBe('Elf')
  })

  it('a character uses them, and its file carries what it uses (and nothing else)', () => {
    const rules = buildRules()
    installPack(rules, structuredClone(TEST_PACK))
    const c = newCharacter(
      {
        name: 'T',
        speciesId: 'testfolk',
        backgroundId: 'test-wanderer',
        classId: 'fighter',
        lang: 'fr',
        abilities: ABIL,
        backgroundKit: 'A',
      },
      rules,
    )
    expect(c.background.feat.featId).toBe('test-luck')
    expect(c.inventory.some((i) => i.refId === 'dagger')).toBe(true)
    let s = compute(c, rules)
    expect(s.speed.total).toBe(35)
    expect(s.pool.grants.some((g) => g.grant.kind === 'darkvision' && g.grant.value === 60)).toBe(true)
    expect(s.feats.some((f) => f.def.id === 'test-luck')).toBe(true)
    expect(() => validate(c, rules)).not.toThrow()
    // Fighter 3 with the pack's subclass: its feature applies.
    c.levels.push(
      { classId: 'fighter', hpRoll: 0, hpFixed: true },
      { classId: 'fighter', hpRoll: 0, hpFixed: true, subclassId: 'fighter:test-way' },
    )
    s = compute(c, rules)
    expect(s.ac.parts.some((p) => p.value === 1)).toBe(true)

    const [copy] = packContentOf(c, rules)
    expect(copy.id).toBe('test-book')
    expect(copy.species?.map((x) => x.id)).toEqual(['testfolk'])
    expect(copy.backgrounds?.map((x) => x.id)).toEqual(['test-wanderer'])
    expect(copy.feats?.map((x) => x.id)).toEqual(['test-luck'])
    expect(copy.spells?.map((x) => x.id)).toEqual(['test-spark']) // given by a picked trait
    expect(copy.subclasses?.map((x) => x.id)).toEqual(['fighter:test-way'])
    expect(copy.effects?.map((e) => e.id).sort()).toEqual(
      ['feat:test-luck', 'fighter:test-way:edge', 'testfolk:night-eyes', 'testfolk:spark'].sort(),
    )
    expect(Object.keys(copy.summaries ?? {})).not.toContain('feat:test-unused')
    expect(Object.keys(copy.summaries ?? {})).toContain('trait:testfolk:night-eyes')

    // Another device, without the pack: the file's copy is enough.
    const saved = JSON.parse(JSON.stringify(withPackContent(c, rules)))
    resetPacks()
    const bare = buildRules()
    installEmbedded(bare, saved)
    const s2 = compute(saved, bare)
    expect(s2.speed.total).toBe(35)
    expect(s2.ac.total).toBe(s.ac.total)
    expect(bare.spells.has('test-spark')).toBe(true)
    // Saved again on that device: the copy is kept.
    expect(packContentOf(saved, bare)[0].species?.map((x) => x.id)).toEqual(['testfolk'])
  })

  it('a character with no pack entry gets no copy', () => {
    const rules = buildRules()
    installPack(rules, structuredClone(TEST_PACK))
    const c = newCharacter(
      { name: 'T', speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', lang: 'fr', abilities: ABIL },
      rules,
    )
    expect(withPackContent(c, rules).packContent).toBeUndefined()
  })
})
