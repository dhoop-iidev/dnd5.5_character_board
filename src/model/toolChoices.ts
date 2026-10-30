// Tool proficiencies the player chooses (user request 2026-10-30), instead of the sentence of the class or background:
// Bard 3 Musical Instruments (SRD 5.2.1 p. 31), one when multiclassing into Bard (p. 31), Monk one type of
// Artisan's Tools or Musical Instrument (p. 49), Soldier one kind of Gaming Set (p. 83). The kinds of Musical
// Instrument and Gaming Set are the variants of SRD p. 94 (FR p. 100, ES p. 102). Picks are stored in
// `featureChoices[key]` (tool ids or variant ids); `sheet.proficiencies.tools` shows them in place of the sentence.
import type { Rules } from '../data/rules'
import type { I18n, Source } from '../data/types'
import type { Character } from './character'
import { ARTISAN_OR_INSTRUMENT } from './startingEquipment'

export interface ToolVariant {
  id: string
  /** The catalog tool it is a kind of (its ability, Utilize and price). */
  of: 'musical-instrument' | 'gaming-set'
  name: I18n
}

const V = (id: string, of: ToolVariant['of'], en: string, fr: string, es: string): ToolVariant => ({
  id,
  of,
  name: { en, fr, es },
})

export const TOOL_VARIANTS: ToolVariant[] = [
  V('bagpipes', 'musical-instrument', 'Bagpipes', 'Cornemuse', 'Gaita'),
  V('drum', 'musical-instrument', 'Drum', 'Tambour', 'Tambor'),
  V('dulcimer', 'musical-instrument', 'Dulcimer', 'Tympanon', 'Dulcémele'),
  V('flute', 'musical-instrument', 'Flute', 'Flûte', 'Flauta'),
  V('horn', 'musical-instrument', 'Horn', 'Cor', 'Cuerno'),
  V('lute', 'musical-instrument', 'Lute', 'Luth', 'Laúd'),
  V('lyre', 'musical-instrument', 'Lyre', 'Lyre', 'Lira'),
  V('pan-flute', 'musical-instrument', 'Pan Flute', 'Flûte de pan', 'Flauta de pan'),
  V('shawm', 'musical-instrument', 'Shawm', 'Chalemie', 'Chirimía'),
  V('viol', 'musical-instrument', 'Viol', 'Viole', 'Viola'),
  V('dice', 'gaming-set', 'Dice', 'Dés', 'Dados'),
  V('dragonchess', 'gaming-set', 'Dragonchess', 'Échecs draconiques', 'Ajedrez dragón'),
  V('playing-cards', 'gaming-set', 'Playing Cards', 'Cartes à jouer', 'Naipes'),
  V('three-dragon-ante', 'gaming-set', 'Three-Dragon Ante', 'Jeu des dragons', 'Apuesta de los tres dragones'),
]

const INSTRUMENTS = TOOL_VARIANTS.filter((v) => v.of === 'musical-instrument').map((v) => v.id)
const GAMING_SETS = TOOL_VARIANTS.filter((v) => v.of === 'gaming-set').map((v) => v.id)
/** Monk: an Artisan's Tools or a kind of Musical Instrument. */
const ARTISAN_TOOLS_OR_INSTRUMENTS = [
  ...ARTISAN_OR_INSTRUMENT.filter((id) => id !== 'musical-instrument'),
  ...INSTRUMENTS,
]

export interface ToolChoice {
  /** Key in `featureChoices`. */
  key: string
  count: number
  /** Tool ids (gear.json) or variant ids (TOOL_VARIANTS). */
  options: string[]
  /** The English sentence these picks replace in the proficiencies. */
  replaces: string
  name: I18n
  /** Where it is chosen: a level row (the level the class was taken at) or the Origin. */
  place: number | 'origin'
  source: Source
}

/** The tool choices the character has: its first class's, a class taken by multiclassing, its background's. */
export function toolChoicesOf(c: Character, rules: Rules): ToolChoice[] {
  const out: ToolChoice[] = []
  const seen = new Set<string>()
  ;(c.levels ?? []).forEach((l, i) => {
    if (seen.has(l.classId)) return
    seen.add(l.classId)
    const def = rules.classes.get(l.classId)
    if (!def) return
    const name = (n: number): I18n => ({
      en: `${def.name.en}: tool proficienc${n > 1 ? 'ies' : 'y'}`,
      fr: `${def.name.fr} : maîtrise${n > 1 ? 's' : ''} d’outils`,
      es: `${def.name.es ?? def.name.en}: competencia${n > 1 ? 's' : ''} con herramientas`,
    })
    if (i === 0 && l.classId === 'bard' && def.toolProficiencies)
      out.push({
        key: 'tools:bard',
        count: 3,
        options: INSTRUMENTS,
        replaces: def.toolProficiencies.en,
        name: name(3),
        place: i,
        source: def.source,
      })
    else if (i > 0 && l.classId === 'bard' && def.multiclass.tools?.length)
      out.push({
        key: 'tools:bard',
        count: 1,
        options: INSTRUMENTS,
        replaces: def.multiclass.tools[0].en,
        name: name(1),
        place: i,
        source: def.source,
      })
    else if (i === 0 && l.classId === 'monk' && def.toolProficiencies)
      out.push({
        key: 'tools:monk',
        count: 1,
        options: ARTISAN_TOOLS_OR_INSTRUMENTS,
        replaces: def.toolProficiencies.en,
        name: name(1),
        place: i,
        source: def.source,
      })
  })
  const bg = c.background?.backgroundId === 'soldier' ? rules.backgrounds.get('soldier') : undefined
  if (bg?.tool)
    out.push({
      key: 'tools:background',
      count: 1,
      options: GAMING_SETS,
      replaces: bg.tool.en,
      name: {
        en: `${bg.name.en}: Gaming Set`,
        fr: `${bg.name.fr} : boîte de jeux`,
        es: `${bg.name.es ?? bg.name.en}: juego`,
      },
      place: 'origin',
      source: bg.source,
    })
  return out
}

/** The picks of a tool choice, as stored. */
export const toolPicks = (c: Character, t: ToolChoice): string[] => {
  const v = c.featureChoices?.[t.key]
  return Array.isArray(v) ? v : v ? [v] : []
}

/** A tool or variant id as shown: its name, and the catalog tool for the popup. */
export function toolOption(id: string, rules: Rules): { name: I18n; toolId: string } | undefined {
  const v = TOOL_VARIANTS.find((x) => x.id === id)
  if (v) return { name: v.name, toolId: v.of }
  const g = rules.gear.get(id)
  return g?.kind === 'tool' ? { name: g.name, toolId: g.id } : undefined
}
