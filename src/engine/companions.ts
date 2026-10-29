// Companions (SRD 5.2.1): Druid Wild Shape forms (p. 42 "Level 2: Wild Shape", Beast Shapes table), Find Familiar
// (p. 130), Pact of the Chain forms (p. 74), Find Steed and the Otherworldly Steed (p. 130, stat block p. 131).
import type { Rules } from '../data/rules'
import type { CreatureDef, I18n, Source } from '../data/types'
import type { Character, Companion } from '../model/character'
import { grantTempHp } from './hitPoints'
import type { Sheet } from './sheet/types'
import { esOf } from './stacking'

export const SRC_WILD_SHAPE: Source = { page: 42, frPage: 44, section: 'Classes > Druid > Level 2: Wild Shape' }
export const SRC_WILD_COMPANION: Source = { page: 42, frPage: 44, section: 'Classes > Druid > Level 2: Wild Companion' }
export const SRC_FIND_FAMILIAR: Source = { page: 130, frPage: 117, section: 'Spells > Find Familiar' }
export const SRC_FIND_STEED: Source = { page: 130, frPage: 117, section: 'Spells > Find Steed' }
export const SRC_PACT_OF_THE_CHAIN: Source = {
  page: 74,
  frPage: 72,
  section: 'Classes > Warlock > Eldritch Invocation Options > Pact of the Chain',
}
export const SRC_ROUND_DOWN: Source = { page: 5, frPage: 5, section: 'Playing the Game > Round Down' }

export const WILD_SHAPE_ID = 'druid:wild-shape'

/** Beast Shapes table (SRD p. 42): known forms, maximum Challenge Rating and whether a Fly Speed is allowed. */
export const BEAST_SHAPES: { level: number; known: number; maxCr: number; fly: boolean }[] = [
  { level: 2, known: 4, maxCr: 0.25, fly: false },
  { level: 4, known: 6, maxCr: 0.5, fly: false },
  { level: 8, known: 8, maxCr: 1, fly: true },
]

export interface WildShapeLimits {
  druidLevel: number
  known: number
  maxCr: number
  fly: boolean
  /** Hours a form lasts: half the Druid level, rounded down (p. 42; "Round Down", p. 5). */
  hours: number
  /** Temporary Hit Points gained when assuming a form: the Druid level (p. 42). */
  tempHp: number
}

/** Wild Shape limits at this Druid level; undefined below level 2. */
export function wildShapeLimits(druidLevel: number): WildShapeLimits | undefined {
  let row: (typeof BEAST_SHAPES)[number] | undefined
  for (const r of BEAST_SHAPES) if (druidLevel >= r.level) row = r
  if (!row) return undefined
  return {
    druidLevel,
    known: row.known,
    maxCr: row.maxCr,
    fly: row.fly,
    hours: Math.floor(druidLevel / 2),
    tempHp: druidLevel,
  }
}

export const crText = (cr: number | null | undefined): string =>
  cr === null || cr === undefined ? '—' : cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr)

/** Why a creature can't be a known Wild Shape form at these limits (p. 42 "Known Forms"); undefined when it can. */
export function wildShapeIneligible(c: CreatureDef, lim: WildShapeLimits): I18n | undefined {
  if (!c.tags.includes('beast'))
    return {
      en: `${c.name.en} is not a Beast.`,
      fr: `${c.name.fr} n’est pas une Bête.`,
      es: `${esOf(c.name)} no es una Bestia.`,
    }
  if (c.cr === null || c.cr > lim.maxCr)
    return {
      en: `${c.name.en} is CR ${crText(c.cr)}; the maximum at Druid level ${lim.druidLevel} is ${crText(lim.maxCr)}.`,
      fr: `${c.name.fr} est de FP ${crText(c.cr)} ; le maximum au niveau ${lim.druidLevel} de Druide est ${crText(lim.maxCr)}.`,
      es: `${esOf(c.name)} tiene VD ${crText(c.cr)}; el máximo con druida de nivel ${lim.druidLevel} es ${crText(lim.maxCr)}.`,
    }
  if (c.speed.fly && !lim.fly)
    return {
      en: `${c.name.en} has a Fly Speed: such forms are allowed from Druid level 8.`,
      fr: `${c.name.fr} a une Vitesse de vol : ces formes sont permises à partir du niveau 8 de Druide.`,
      es: `${esOf(c.name)} tiene Velocidad volando: estas formas se permiten a partir de druida de nivel 8.`,
    }
  return undefined
}

/** Beasts a Druid may learn as Wild Shape forms at these limits. */
export function eligibleForms(rules: Rules, lim: WildShapeLimits): CreatureDef[] {
  return [...rules.creatures.values()].filter((c) => !wildShapeIneligible(c, lim))
}

/** Assume a known form: spends one use of Wild Shape and grants Temporary Hit Points equal to the Druid level (p. 42).
 * Returns false when no use is left. */
export function assumeForm(char: Character, sheet: Sheet, creatureId: string): boolean {
  const res = sheet.resources.find((r) => r.id === WILD_SHAPE_ID)
  const lim = wildShapeLimits(sheet.classLevels.druid ?? 0)
  if (!res || !lim || res.spent >= res.max) return false
  char.resources[WILD_SHAPE_ID] = res.spent + 1
  grantTempHp(char.hp, lim.tempHp)
  char.wildShape.active = creatureId
  return true
}

/** Leave the form (Bonus Action, or when the duration ends; p. 42). */
export function revertForm(char: Character) {
  delete char.wildShape.active
}

/** Find Familiar forms (p. 130): the named animals, or any Beast with a Challenge Rating of 0. */
export const FAMILIAR_FORMS = [
  'bat',
  'cat',
  'frog',
  'hawk',
  'lizard',
  'octopus',
  'owl',
  'rat',
  'raven',
  'spider',
  'weasel',
]
/** Pact of the Chain special forms (p. 74). */
export const CHAIN_FORMS = ['imp', 'pseudodragon', 'quasit', 'skeleton', 'sphinx-of-wonder', 'sprite', 'venomous-snake']

/** Why a creature can't be the familiar's form; undefined when it can. Pact of the Chain forms need a Warlock (the app
 * doesn't track Eldritch Invocations yet, CLAUDE.md). */
export function familiarIneligible(c: CreatureDef, warlock: boolean): I18n | undefined {
  if (FAMILIAR_FORMS.includes(c.id)) return undefined
  if (c.tags.includes('beast') && c.cr === 0) return undefined
  if (CHAIN_FORMS.includes(c.id)) {
    if (warlock) return undefined
    return {
      en: `${c.name.en} is a Pact of the Chain form (Warlock invocation).`,
      fr: `${c.name.fr} est une forme du Pacte de la chaîne (invocation d’Occultiste).`,
      es: `${esOf(c.name)} es una forma del Pacto de la cadena (invocación de brujo).`,
    }
  }
  return {
    en: `${c.name.en} is not a Find Familiar form (a named animal or a Beast of CR 0).`,
    fr: `${c.name.fr} n’est pas une forme de Trouver un familier (animal nommé ou Bête de FP 0).`,
    es: `${esOf(c.name)} no es una forma de Encontrar familiar (un animal de la lista o una Bestia de VD 0).`,
  }
}

export function eligibleFamiliars(rules: Rules, warlock: boolean): CreatureDef[] {
  return [...rules.creatures.values()]
    .filter((c) => !familiarIneligible(c, warlock))
    .sort(
      (a, b) =>
        Number(CHAIN_FORMS.includes(a.id)) - Number(CHAIN_FORMS.includes(b.id)) || a.name.en.localeCompare(b.name.en),
    )
}

const hasSpell = (char: Character, id: string) =>
  Object.values(char.spellcasting ?? {}).some((s) => s.prepared.includes(id) || s.spellbook?.includes(id))

/** Why this character can have a familiar (empty when nothing grants one): Find Familiar prepared or in a spellbook,
 * Wild Companion (Druid 2, p. 42), or a Warlock (Pact of the Chain, p. 74). */
export function familiarSources(char: Character, sheet: Sheet): { text: I18n; source: Source }[] {
  const out: { text: I18n; source: Source }[] = []
  if (hasSpell(char, 'find-familiar'))
    out.push({
      text: { en: 'Find Familiar', fr: 'Trouver un familier', es: 'Encontrar familiar' },
      source: SRC_FIND_FAMILIAR,
    })
  if ((sheet.classLevels.druid ?? 0) >= 2)
    out.push({
      text: {
        en: 'Wild Companion (a spell slot or a use of Wild Shape; the familiar is Fey and vanishes after a Long Rest)',
        fr: 'Compagnon sauvage (un emplacement de sort ou une utilisation de Forme sauvage ; le familier est une Fée et disparaît après un repos long)',
        es: 'Compañero salvaje (un espacio de conjuro o un uso de Forma salvaje; el familiar es un Feérico y desaparece tras un descanso largo)',
      },
      source: SRC_WILD_COMPANION,
    })
  if ((sheet.classLevels.warlock ?? 0) >= 1)
    out.push({
      text: {
        en: 'Pact of the Chain (Eldritch Invocation, if taken)',
        fr: 'Pacte de la chaîne (invocation occulte, si choisie)',
        es: 'Pacto de la cadena (invocación sobrenatural, si se ha elegido)',
      },
      source: SRC_PACT_OF_THE_CHAIN,
    })
  return out
}

export const canHaveSteed = (char: Character) => hasSpell(char, 'find-steed')

/** Maximum Hit Points of a companion: the stat block's average, or the Otherworldly Steed formula 5 + 10 per spell
 * level (p. 131). Undefined when the stat block gives a formula the app doesn't model. */
export function companionHpMax(def: CreatureDef, spellLevel?: number): number | undefined {
  if (def.hp) return def.hp.average
  if (def.id === 'otherworldly-steed' && spellLevel) return 5 + 10 * spellLevel
  return undefined
}

/** AC of a companion: the stat block's, or 10 + 1 per spell level for the Otherworldly Steed (p. 131). */
export function companionAc(def: CreatureDef, spellLevel?: number): number | undefined {
  if (def.ac !== null) return def.ac
  if (def.id === 'otherworldly-steed' && spellLevel) return 10 + spellLevel
  return undefined
}

export function newCompanion(def: CreatureDef, kind: Companion['kind'], extra: Partial<Companion> = {}): Companion {
  const max = companionHpMax(def, extra.spellLevel) ?? 1
  return {
    uid: Math.random().toString(36).slice(2, 10),
    kind,
    creatureId: def.id,
    hp: { current: max, temp: 0, max },
    ...extra,
  }
}
