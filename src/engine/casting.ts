// Casting a spell from the Spells pane: spend a spell slot (or a Pact Magic slot), start a timed active effect for a spell
// with a duration (1 round = 6 seconds, 1 minute = 10 rounds: Rules Glossary "Round"), Concentration on one effect at a
// time (Rules Glossary "Concentration", SRD 5.2.1 p. 179, FR p. 190: starting another Concentration spell ends the
// previous one), and the Sorcerer's Metamagic options paid with Sorcery Points (p. 66–67 "Metamagic Options", FR p. 52).
// Slots: one spell slot per turn (p. 105 "One Spell with a Spell Slot per Turn", FR p. 112); a spell can be cast with a
// slot of its level or higher (p. 104 "Spell Slots"); Pact Magic slots and Spellcasting slots can cast each other's
// spells (p. 26 "Pact Magic"). A leveled spell of a feat or species trait can also be cast without a slot: once per Long
// Rest for Elven Lineage (p. 84, FR p. 88), Fiendish Legacy (p. 86, FR p. 91) and Magic Initiate (p. 87, FR p. 92), or
// with the owner's uses when it has some (Forest Gnome's Speak with Animals, p. 85).
import type { Rules } from '../data/rules'
import type { I18n, SpellDef, Source } from '../data/types'
import type { ActiveEffect, Character } from '../model/character'
import type { Sheet } from './sheet/types'
import { esOf } from './stacking'
import { pruneSummons } from './summons'

export const SRC_ONE_SLOT_PER_TURN: Source = {
  page: 105,
  frPage: 112,
  section: 'Spells > Casting Time > One Spell with a Spell Slot per Turn',
}
export const SRC_METAMAGIC: Source = { page: 66, frPage: 51, section: 'Sorcerer > Level 2: Metamagic' }
export const FONT_OF_MAGIC = 'sorcerer:font-of-magic'
const METAMAGIC_PREFIX = 'sorcerer:metamagic:'

const UNIT_ROUNDS: Record<string, number> = { round: 1, minute: 10, hour: 600, day: 14400 }

/** Duration in rounds ("Concentration, up to 10 minutes" → 100), or undefined when the spell has no set duration
 * (Instantaneous, Until dispelled, Special). */
export function spellRounds(s: SpellDef): number | undefined {
  const m = s.duration.en.match(/(\d+)\s+(round|minute|hour|day)s?\b/i)
  if (!m) return undefined
  return parseInt(m[1], 10) * UNIT_ROUNDS[m[2].toLowerCase()]
}

/** A slot to cast with: a spell slot level, the Pact Magic slots, or `free`: no slot (a feat or species spell). */
export type SlotChoice = { level: number; pact?: boolean; free?: boolean }

/** The slot-free cast of a feat or species spell: the owner's uses when it has some, else once per Long Rest, tracked in
 * `Character.freeCasts` under `key`. Undefined for a cantrip or a class spell. */
export interface FreeCast {
  key: string
  resource?: string
  available: boolean
}
export function freeCast(char: Character, sheet: Sheet, s: SpellDef): FreeCast | undefined {
  if (s.level === 0) return undefined
  const x = sheet.extraSpells.find((e) => e.spells.includes(s.id))
  if (!x) return undefined
  const key = `${x.ownerId}:${s.id}`
  const r = sheet.resources.find((y) => y.id === x.ownerId)
  if (r) return { key, resource: r.id, available: r.spent < r.max }
  return { key, available: !(char.freeCasts ?? []).includes(key) }
}

/** Slots available to cast this spell (level 1+), lowest first; the pact slot first for a Pact Magic class. */
export function slotChoices(
  char: Character,
  sheet: Sheet,
  s: SpellDef,
  pactFirst = false,
  /** A feat or species spell (no class): its slot-free cast comes first while it is available. */
  extra = false,
): SlotChoice[] {
  if (s.level === 0) return []
  const out: SlotChoice[] = []
  sheet.slots.forEach((n, i) => {
    if (i + 1 >= s.level && n - (char.slotsUsed[i] ?? 0) > 0) out.push({ level: i + 1 })
  })
  const pact = sheet.pact
  if (pact && pact.level >= s.level && pact.slots - (char.pactUsed ?? 0) > 0) {
    const p = { level: pact.level, pact: true }
    if (pactFirst) out.unshift(p)
    else out.push(p)
  }
  if (extra && freeCast(char, sheet, s)?.available) out.unshift({ level: s.level, free: true })
  return out
}

// ---------- Metamagic ----------

export interface MetamagicOption {
  id: string
  name: I18n
  cost: number
  /** Can be added even when another option is used on the same spell (Empowered Spell, Seeking Spell). */
  combines: boolean
  /** Why the option doesn't apply to this spell (undefined = it applies). */
  notApplicable?: I18n
  source?: Source
}

const strip = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ')
const savingThrow = (s: SpellDef) => /saving throw/i.test(strip(s.text.en))
const damage = (s: SpellDef) => /\d+d\d+[^.]*\bdamage\b/i.test(strip(s.text.en))

/** Whether each Metamagic option's condition holds for this spell, read from the option's text (p. 66–67). */
function notApplicable(optionId: string, s: SpellDef): I18n | undefined {
  const key = optionId.slice(METAMAGIC_PREFIX.length)
  switch (key) {
    case 'careful-spell':
    case 'heightened-spell':
      return savingThrow(s)
        ? undefined
        : {
            en: 'the spell forces no saving throw',
            fr: 'le sort n’impose aucun jet de sauvegarde',
            es: 'el conjuro no obliga a hacer ninguna tirada de salvación',
          }
    case 'distant-spell':
      return /^touch$/i.test(s.range.en) || /\d+\s*(feet|foot|miles?)\b/i.test(s.range.en)
        ? undefined
        : {
            en: 'range is not 5 feet or more, nor Touch',
            fr: 'portée ni d’au moins 1,50 m, ni contact',
            es: 'el alcance no es de 1,5 m o más, ni de toque',
          }
    case 'empowered-spell':
      return damage(s)
        ? undefined
        : {
            en: 'the spell rolls no damage',
            fr: 'le sort ne lance aucun dé de dégâts',
            es: 'el conjuro no tira dados de daño',
          }
    case 'extended-spell': {
      const r = spellRounds(s)
      return r !== undefined && r >= 10
        ? undefined
        : { en: 'duration under 1 minute', fr: 'durée inférieure à 1 minute', es: 'duración inferior a 1 minuto' }
    }
    case 'quickened-spell':
      return s.castingKind === 'action'
        ? undefined
        : {
            en: 'casting time is not an action',
            fr: 'le temps d’incantation n’est pas une action',
            es: 'el tiempo de lanzamiento no es una acción',
          }
    case 'seeking-spell':
      return /spell attack/i.test(strip(s.text.en))
        ? undefined
        : {
            en: 'the spell makes no attack roll',
            fr: 'le sort n’implique aucun jet d’attaque',
            es: 'el conjuro no hace ninguna tirada de ataque',
          }
    case 'transmuted-spell':
      return /\b(Acid|Cold|Fire|Lightning|Poison|Thunder) damage\b/.test(strip(s.text.en))
        ? undefined
        : {
            en: 'no Acid, Cold, Fire, Lightning, Poison or Thunder damage',
            fr: 'aucun dégât d’acide, de froid, de feu, de foudre, de poison ou de tonnerre',
            es: 'ningún daño de ácido, frío, fuego, relámpago, veneno o trueno',
          }
    case 'twinned-spell':
      return /\b(target|affect) one additional (creature|Beast|Humanoid)/i.test(strip(s.upcast?.en))
        ? undefined
        : {
            en: 'a higher slot doesn’t target an additional creature',
            fr: 'un emplacement supérieur ne cible pas une créature de plus',
            es: 'un espacio de conjuro superior no permite elegir una criatura más como objetivo',
          }
    default:
      return undefined
  }
}

/** The Metamagic options the character knows (the Sorcerer's chosen options), with their cost and whether each applies
 * to this spell. */
export function metamagicOptions(sheet: Sheet, rules: Rules, s: SpellDef): MetamagicOption[] {
  const known = sheet.owners.filter((o) => o.id.startsWith(METAMAGIC_PREFIX))
  const defs = rules.classes.get('sorcerer')?.options?.metamagic ?? []
  return known.map((o) => {
    const def = defs.find((d) => d.id === o.id)
    const text = strip(def?.text?.en ?? o.text?.en)
    const cost = parseInt(text.match(/Cost:\s*(\d+)\s*Sorcery Point/i)?.[1] ?? '1', 10)
    return {
      id: o.id,
      name: def?.name ?? o.name,
      cost,
      combines: /even if you’ve already used a different Metamagic option|even if you've already used/i.test(text),
      notApplicable: notApplicable(o.id, s),
      source: def?.source ?? o.source,
    }
  })
}

/** Sorcery Points left (Font of Magic). */
export function sorceryPointsLeft(sheet: Sheet): number {
  const r = sheet.resources.find((x) => x.id === FONT_OF_MAGIC)
  return r ? Math.max(0, r.max - r.spent) : 0
}

/** Why an option can't be added to the current selection (undefined = it can). Only one option per spell unless an
 * option says otherwise (p. 66 "Metamagic"). */
export function metamagicBlocker(
  o: MetamagicOption,
  selected: MetamagicOption[],
  pointsLeft: number,
): I18n | undefined {
  if (o.notApplicable) return o.notApplicable
  if (selected.some((x) => x.id === o.id)) return undefined
  const spent = selected.reduce((n, x) => n + x.cost, 0)
  if (spent + o.cost > pointsLeft)
    return {
      en: `${o.cost} Sorcery Point${o.cost > 1 ? 's' : ''} needed, ${pointsLeft - spent} left`,
      fr: `${o.cost} point${o.cost > 1 ? 's' : ''} de sorcellerie requis, ${pointsLeft - spent} restant${pointsLeft - spent > 1 ? 's' : ''}`,
      es: `se necesita${o.cost > 1 ? 'n' : ''} ${o.cost} punto${o.cost > 1 ? 's' : ''} de hechicería, queda${pointsLeft - spent === 1 ? '' : 'n'} ${pointsLeft - spent}`,
    }
  if (!o.combines && selected.some((x) => !x.combines))
    return {
      en: 'one Metamagic option per spell',
      fr: 'une seule option de Métamagie par sort',
      es: 'una sola opción de Metamagia por conjuro',
    }
  return undefined
}

// ---------- casting ----------

export interface CastResult {
  /** What the casting spent (to undo it). */
  cast: NonNullable<ActiveEffect['cast']>
  effect?: ActiveEffect
  /** What happened, for the message line. */
  message: I18n
}

/** Casts a spell: spends the slot and the Sorcery Points, starts the timed effect (Concentration replaces the previous
 * one). `newUid` makes the effect id. */
export function castSpell(
  char: Character,
  sheet: Sheet,
  rules: Rules,
  s: SpellDef,
  opts: { classId?: string; slot?: SlotChoice; metamagic?: MetamagicOption[]; newUid: () => string },
): CastResult {
  const parts: I18n[] = []
  const cast: NonNullable<ActiveEffect['cast']> = { classId: opts.classId }
  const free = opts.slot?.free ? freeCast(char, sheet, s) : undefined
  if (free) {
    if (free.resource) {
      char.resources[free.resource] = (char.resources[free.resource] ?? 0) + 1
      cast.freeResource = free.resource
    } else {
      char.freeCasts = [...(char.freeCasts ?? []), free.key]
      cast.free = free.key
    }
    parts.push({ en: 'without a spell slot', fr: 'sans emplacement de sort', es: 'sin espacio de conjuro' })
  } else if (opts.slot) {
    if (opts.slot.pact) {
      char.pactUsed = (char.pactUsed ?? 0) + 1
      cast.pact = true
      parts.push({
        en: `Pact Magic slot (level ${opts.slot.level})`,
        fr: `emplacement de Magie du pacte (niveau ${opts.slot.level})`,
        es: `espacio de Magia del pacto (nivel ${opts.slot.level})`,
      })
    } else {
      const i = opts.slot.level - 1
      char.slotsUsed[i] = (char.slotsUsed[i] ?? 0) + 1
      parts.push({
        en: `level ${opts.slot.level} slot`,
        fr: `emplacement de niveau ${opts.slot.level}`,
        es: `espacio de conjuro de nivel ${opts.slot.level}`,
      })
    }
    cast.slot = opts.slot.level
  }
  const mm = opts.metamagic ?? []
  if (mm.length) {
    const points = mm.reduce((n, o) => n + o.cost, 0)
    const r = sheet.resources.find((x) => x.id === FONT_OF_MAGIC)
    char.resources[FONT_OF_MAGIC] = Math.min(r?.max ?? Infinity, (char.resources[FONT_OF_MAGIC] ?? 0) + points)
    cast.sorceryPoints = points
    cast.metamagic = mm.map((o) => o.id)
    parts.push({
      en: `${mm.map((o) => o.name.en).join(' + ')} (${points} Sorcery Point${points > 1 ? 's' : ''})`,
      fr: `${mm.map((o) => o.name.fr).join(' + ')} (${points} point${points > 1 ? 's' : ''} de sorcellerie)`,
      es: `${mm.map((o) => esOf(o.name)).join(' + ')} (${points} punto${points > 1 ? 's' : ''} de hechicería)`,
    })
  }
  let rounds = spellRounds(s)
  // Extended Spell: double the duration, 24 hours at most (p. 67).
  if (rounds !== undefined && mm.some((o) => o.id === `${METAMAGIC_PREFIX}extended-spell`))
    rounds = Math.min(rounds * 2, 24 * UNIT_ROUNDS.hour)
  let effect: ActiveEffect | undefined
  let ended: ActiveEffect | undefined
  if (rounds !== undefined) {
    effect = { uid: opts.newUid(), kind: 'spell', refId: s.id, enabled: true, rounds, cast }
    if (s.concentration) {
      effect.concentration = true
      ended = char.activeEffects.find((e) => e.uid === char.concentration && e.concentration)
      if (ended) char.activeEffects = char.activeEffects.filter((e) => e.uid !== ended!.uid)
      char.concentration = effect.uid
    }
    char.activeEffects.push(effect)
  }
  const spent = parts.length
    ? {
        en: ` · ${parts.map((p) => p.en).join(', ')}`,
        fr: ` · ${parts.map((p) => p.fr).join(', ')}`,
        es: ` · ${parts.map((p) => esOf(p)).join(', ')}`,
      }
    : { en: '', fr: '', es: '' }
  const dur = effect
    ? { en: ` · ${rounds} rounds`, fr: ` · ${rounds} rounds`, es: ` · ${rounds} asaltos` }
    : { en: '', fr: '', es: '' }
  const endedName = ended?.refId ? rules.spells.get(ended.refId)?.name : undefined
  const conc = ended
    ? {
        en: ` · Concentration on ${endedName?.en ?? ended.name?.en ?? '?'} ends`,
        fr: ` · fin de la Concentration sur ${endedName?.fr ?? ended.name?.fr ?? '?'}`,
        es: ` · termina la Concentración en ${esOf(endedName ?? ended.name) || '?'}`,
      }
    : { en: '', fr: '', es: '' }
  return {
    cast,
    effect,
    message: {
      en: `${s.name.en} cast${spent.en}${dur.en}${conc.en}`,
      fr: `${s.name.fr} lancé${spent.fr}${dur.fr}${conc.fr}`,
      es: `${esOf(s.name)} lanzado${spent.es}${dur.es}${conc.es}`,
    },
  }
}

/** Undoes a cast: gives back the slot and the Sorcery Points, ends its effect. */
export function undoCast(char: Character, cast: NonNullable<ActiveEffect['cast']>, effectUid?: string) {
  if (cast.free) char.freeCasts = (char.freeCasts ?? []).filter((k) => k !== cast.free)
  if (cast.freeResource) char.resources[cast.freeResource] = Math.max(0, (char.resources[cast.freeResource] ?? 0) - 1)
  if (cast.pact) char.pactUsed = Math.max(0, (char.pactUsed ?? 0) - 1)
  else if (cast.slot) char.slotsUsed[cast.slot - 1] = Math.max(0, (char.slotsUsed[cast.slot - 1] ?? 0) - 1)
  if (cast.sorceryPoints)
    char.resources[FONT_OF_MAGIC] = Math.max(0, (char.resources[FONT_OF_MAGIC] ?? 0) - cast.sorceryPoints)
  if (effectUid) {
    char.activeEffects = char.activeEffects.filter((e) => e.uid !== effectUid)
    if (char.concentration === effectUid) char.concentration = undefined
  }
}

// ---------- Concentration ----------

/** Conditions that include Incapacitated, which ends Concentration (Rules Glossary "Concentration" p. 179; Paralyzed,
 * Petrified, Stunned and Unconscious all give the Incapacitated condition, p. 186, 189, 191). */
export const INCAPACITATING = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']

/** Constitution saving throw DC to keep Concentration after damage: 10 or half the damage (round down), whichever is
 * higher, 30 at most (p. 179). */
export function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)))
}

/** Concentration ends: the effect concentrated on ends with it (p. 179). Returns the effect that ended. */
export function endConcentration(char: Character): ActiveEffect | undefined {
  const e = char.activeEffects.find((x) => x.uid === char.concentration)
  char.concentration = undefined
  if (e) char.activeEffects = char.activeEffects.filter((x) => x.uid !== e.uid)
  pruneSummons(char)
  return e
}
