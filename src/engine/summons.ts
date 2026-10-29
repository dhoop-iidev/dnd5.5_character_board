// Creatures summoned or created by a spell that points to a stat block (SRD 5.2.1 "Spells"): Summon Dragon → Draconic
// Spirit (p. 166, FR p. 131), Giant Insect (p. 135–136, FR p. 151), Animate Objects → Animated Object (p. 108–109,
// FR p. 116), Animate Dead → Skeleton / Zombie (p. 108, FR p. 115), Create Undead → Ghoul, Ghast, Wight, Mummy (p. 121,
// FR p. 133), Finger of Death → Zombie (p. 131, FR p. 138), Phantom Steed → Riding Horse (p. 152, FR p. 161). Find
// Familiar and Find Steed stay in the Companions pane (engine/companions.ts). Awaken is left out: the GM chooses the
// awakened plant's statistics and the creature is only Charmed, not controlled (p. 111).
// The three spell stat blocks scale with "the spell's level", i.e. the level of the slot used ("Using a Higher-Level
// Spell Slot" of Summon Dragon and Giant Insect).
import type { CreatureDef, I18n, Source } from '../data/types'
import type { ActiveEffect, Character, Summon } from '../model/character'
import type { Sheet } from './sheet/types'
import { esOf } from './stacking'

export interface SummonVariant {
  id: string
  name: I18n
}

export interface SummonSpell {
  spellId: string
  /** Creatures the spell can produce; `minSlot` = the lowest slot level that allows it (Create Undead). */
  creatures: { creatureId: string; minSlot?: number }[]
  /** How long the creature lasts, in rounds (1 minute = 10 rounds); undefined = until destroyed (control renewed by
   * recasting, see `note`). */
  rounds?: number
  concentration: boolean
  /** The slot level changes the creature (stat block, choice of creature or number of creatures). */
  scales: boolean
  variants?: SummonVariant[]
  note?: I18n
  source: Source
}

const INSECT_FORMS: SummonVariant[] = [
  { id: 'centipede', name: { en: 'Centipede', fr: 'Mille-pattes', es: 'Ciempiés' } },
  { id: 'spider', name: { en: 'Spider', fr: 'Araignée', es: 'Araña' } },
  { id: 'wasp', name: { en: 'Wasp', fr: 'Guêpe', es: 'Avispa' } },
]
const OBJECT_SIZES: SummonVariant[] = [
  { id: 'medium', name: { en: 'Medium or smaller', fr: 'Taille M ou inférieure', es: 'Mediano o más pequeño' } },
  { id: 'large', name: { en: 'Large', fr: 'Taille G', es: 'Grande' } },
  { id: 'huge', name: { en: 'Huge', fr: 'Taille TG', es: 'Enorme' } },
]
const CONTROL_24H: I18n = {
  en: 'Under your control for 24 hours (Bonus Action to command it); recast the spell on it to keep control.',
  fr: 'Sous votre contrôle pendant 24 heures (action Bonus pour le commander) ; relancez le sort sur lui pour garder le contrôle.',
  es: 'Bajo tu control durante 24 horas (Acción adicional para darle órdenes); vuelve a lanzarle el conjuro para mantener el control.',
}

export const SUMMON_SPELLS: SummonSpell[] = [
  {
    spellId: 'summon-dragon',
    creatures: [{ creatureId: 'draconic-spirit' }],
    rounds: 600,
    concentration: true,
    scales: true,
    source: { page: 166, frPage: 131, section: 'Spells > Summon Dragon' },
  },
  {
    spellId: 'giant-insect',
    creatures: [{ creatureId: 'giant-insect' }],
    rounds: 100,
    concentration: true,
    scales: true,
    variants: INSECT_FORMS,
    source: { page: 135, frPage: 151, section: 'Spells > Giant Insect' },
  },
  {
    spellId: 'animate-objects',
    creatures: [{ creatureId: 'animated-object' }],
    rounds: 10,
    concentration: true,
    scales: true,
    variants: OBJECT_SIZES,
    note: {
      en: 'Objects up to your spellcasting ability modifier (Medium or smaller = 1, Large = 2, Huge = 3). At 0 HP the creature reverts to its object form.',
      fr: 'Objets jusqu’à votre modificateur de caractéristique d’incantation (taille M ou inférieure = 1, G = 2, TG = 3). À 0 pv, la créature redevient un objet.',
      es: 'Objetos hasta tu modificador por aptitud mágica (Mediano o más pequeño = 1, Grande = 2, Enorme = 3). A 0 PG, la criatura vuelve a su forma de objeto.',
    },
    source: { page: 108, frPage: 116, section: 'Spells > Animate Objects' },
  },
  {
    spellId: 'animate-dead',
    creatures: [{ creatureId: 'skeleton' }, { creatureId: 'zombie' }],
    concentration: false,
    scales: true,
    note: CONTROL_24H,
    source: { page: 108, frPage: 115, section: 'Spells > Animate Dead' },
  },
  {
    spellId: 'create-undead',
    creatures: [
      { creatureId: 'ghoul' },
      { creatureId: 'ghast', minSlot: 8 },
      { creatureId: 'wight', minSlot: 8 },
      { creatureId: 'mummy', minSlot: 9 },
    ],
    concentration: false,
    scales: true,
    note: CONTROL_24H,
    source: { page: 121, frPage: 133, section: 'Spells > Create Undead' },
  },
  {
    spellId: 'finger-of-death',
    creatures: [{ creatureId: 'zombie' }],
    concentration: false,
    scales: false,
    note: {
      en: 'A Humanoid killed by the spell rises as a Zombie that follows your verbal orders.',
      fr: 'Un Humanoïde tué par le sort se relève en zombi obéissant à vos instructions verbales.',
      es: 'Un Humanoide al que mate el conjuro se alza como un zombi que sigue tus órdenes verbales.',
    },
    source: { page: 131, frPage: 138, section: 'Spells > Finger of Death' },
  },
  {
    spellId: 'phantom-steed',
    creatures: [{ creatureId: 'riding-horse' }],
    rounds: 600,
    concentration: false,
    scales: false,
    note: {
      en: 'Speed 100 ft. (13 miles in an hour); the spell ends early if the steed takes any damage.',
      fr: 'Vitesse 30 m (19,5 km en une heure) ; le sort prend fin si la monture subit le moindre dégât.',
      es: 'Velocidad 30 m (21 km en una hora); el conjuro termina antes si el corcel recibe cualquier daño.',
    },
    source: { page: 152, frPage: 161, section: 'Spells > Phantom Steed' },
  },
]

export const summonSpell = (spellId: string) => SUMMON_SPELLS.find((s) => s.spellId === spellId)

/** Creatures of this spell available with this slot level (Create Undead: Ghasts and Wights from a level 8 slot,
 * Mummies from level 9). */
export const summonCreatures = (spell: SummonSpell, slot: number) =>
  spell.creatures.filter((c) => slot >= (c.minSlot ?? 0)).map((c) => c.creatureId)

/** How many creatures one casting gives at this slot level, when the spell says so (Animate Dead: 1 + 2 per slot level
 * above 3; Create Undead: its table by creature). Undefined when the spell gives one creature or another limit. */
export function summonCount(spellId: string, slot: number, creatureId?: string): number | undefined {
  if (spellId === 'animate-dead') return 1 + 2 * Math.max(0, slot - 3)
  if (spellId === 'create-undead') {
    if (creatureId === 'mummy') return slot >= 9 ? 2 : 0
    if (creatureId === 'ghast' || creatureId === 'wight') return slot >= 9 ? 3 : slot >= 8 ? 2 : 0
    return slot >= 9 ? 6 : slot >= 8 ? 5 : slot >= 7 ? 4 : 3
  }
  return undefined
}

/** Armor Class: "14 + the spell's level" (Draconic Spirit, p. 166), "11 + the spell's level" (Giant Insect, p. 136),
 * otherwise the stat block's. */
export function summonAc(def: CreatureDef, slot: number): number | undefined {
  if (def.id === 'draconic-spirit') return 14 + slot
  if (def.id === 'giant-insect') return 11 + slot
  return def.ac ?? undefined
}

/** Hit Points: "50 + 10 for each spell level above 5" (Draconic Spirit), "30 + 10 for each spell level above 4" (Giant
 * Insect), "10 (Medium or smaller), 20 (Large), 40 (Huge)" (Animated Object, p. 109), otherwise the stat block's
 * average. */
export function summonHpMax(def: CreatureDef, slot: number, variant?: string): number | undefined {
  if (def.id === 'draconic-spirit') return 50 + 10 * Math.max(0, slot - 5)
  if (def.id === 'giant-insect') return 30 + 10 * Math.max(0, slot - 4)
  if (def.id === 'animated-object') return variant === 'huge' ? 40 : variant === 'large' ? 20 : 10
  return def.hp?.average
}

export interface SummonAttack {
  name: I18n
  /** Number of these attacks per Multiattack, when it depends on the spell's level. */
  count?: number
  toHit?: number
  dc?: number
  hit: I18n
}

/** The caster's numbers used by the spell stat blocks ("Bonus equals your spell attack modifier", "your spell save DC",
 * "your spellcasting ability modifier"). */
export interface SummonCaster {
  attack: number
  dc: number
  mod: number
}

const DMG: Record<string, I18n> = {
  piercing: { en: 'Piercing', fr: 'perforants', es: 'perforante' },
  bludgeoning: { en: 'Bludgeoning', fr: 'contondants', es: 'contundente' },
  force: { en: 'Force', fr: 'de force', es: 'de fuerza' },
  poison: { en: 'Poison', fr: 'de poison', es: 'de veneno' },
}
const dmg = (dice: string, type: string): I18n => ({
  en: `${dice} ${DMG[type].en} damage`,
  fr: `${dice} dégâts ${DMG[type].fr}`,
  es: `${dice} de daño ${DMG[type].es}`,
})
const plus = (a: I18n, b: I18n): I18n => ({
  en: `${a.en} plus ${b.en}`,
  fr: `${a.fr}, plus ${b.fr}`,
  es: `${esOf(a)} más ${esOf(b)}`,
})
const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The "Hit:" part of an attack's text, up to the end of its first sentence. */
function hitPart(text: string, marker: RegExp): string {
  const m = text.match(marker)
  if (!m || m.index === undefined) return ''
  const rest = strip(text.slice(m.index + m[0].length))
  const end = rest.search(/\.(\s|$)/)
  return end >= 0 ? rest.slice(0, end) : rest
}

/** Attacks of a summoned creature at this slot level. The three spell stat blocks are computed from their formulas
 * (Rend "1d6 + 4 + the spell's level", Poison Jab "1d6 + 3 plus the spell's level", Slam by size + 1d4/1d6/1d12 per slot
 * level above 5); other stat blocks list their printed attack rolls. */
export function summonAttacks(
  def: CreatureDef,
  slot: number,
  variant: string | undefined,
  caster: SummonCaster | undefined,
): SummonAttack[] {
  const atk = caster?.attack
  const dc = caster?.dc
  const half = Math.floor(slot / 2)
  if (def.id === 'draconic-spirit')
    return [
      {
        name: { en: 'Rend', fr: 'Saignée', es: 'Desgarrar' },
        count: half,
        toHit: atk,
        hit: dmg(`1d6 + ${4 + slot}`, 'piercing'),
      },
      {
        name: { en: 'Breath Weapon (30-ft. Cone)', fr: 'Souffle (cône de 9 m)', es: 'Arma de aliento (cono de 9 m)' },
        dc,
        hit: {
          en: '2d6 damage of a type it resists (chosen when casting); half on a success',
          fr: '2d6 dégâts d’un type auquel il résiste (choisi à l’incantation) ; moitié en cas de réussite',
          es: '2d6 de daño de un tipo al que es resistente (elegido al lanzar el conjuro); la mitad si se supera',
        },
      },
    ]
  if (def.id === 'giant-insect') {
    const out: SummonAttack[] = [
      {
        name: { en: 'Poison Jab', fr: 'Piqûre toxique', es: 'Pinchazo venenoso' },
        count: half,
        toHit: atk,
        hit: plus(dmg(`1d6 + ${3 + slot}`, 'piercing'), dmg('1d4', 'poison')),
      },
    ]
    if (variant === 'spider')
      out.push({
        name: { en: 'Web Bolt', fr: 'Jet de toile', es: 'Proyectil de telaraña' },
        toHit: atk,
        hit: {
          en: `${dmg(`1d10 + ${3 + slot}`, 'bludgeoning').en}; Speed 0 until the insect's next turn`,
          fr: `${dmg(`1d10 + ${3 + slot}`, 'bludgeoning').fr} ; vitesse 0 jusqu’au tour suivant de l’insecte`,
          es: `${esOf(dmg(`1d10 + ${3 + slot}`, 'bludgeoning'))}; Velocidad 0 hasta el siguiente turno del insecto`,
        },
      })
    if (variant === 'centipede')
      out.push({
        name: {
          en: 'Venomous Spew (Bonus Action)',
          fr: 'Crachat venimeux (action Bonus)',
          es: 'Escupitajo venenoso (Acción adicional)',
        },
        dc,
        hit: {
          en: 'Constitution save or Poisoned',
          fr: 'JS de Constitution ou Empoisonné',
          es: 'tirada de salvación de Constitución o Envenenado',
        },
      })
    return out
  }
  if (def.id === 'animated-object') {
    const extra = Math.max(0, slot - 5)
    const mod = caster?.mod ?? 0
    const dice =
      variant === 'huge'
        ? `${2 + extra}d12 + ${3 + mod}`
        : variant === 'large'
          ? `${2 + extra}d6 + ${3 + mod}`
          : `${1 + extra}d4 + 3`
    return [{ name: { en: 'Slam', fr: 'Coup', es: 'Golpe' }, toHit: atk, hit: dmg(dice, 'force') }]
  }
  const out: SummonAttack[] = []
  for (const a of def.actions) {
    const m = a.text.en.match(/Attack Roll:<\/em>\s*([+−-])(\d+)/)
    if (!m) continue
    const toHit = (m[1] === '+' ? 1 : -1) * Number(m[2])
    out.push({
      name: a.name,
      toHit,
      hit: {
        en: hitPart(a.text.en, /Hit:<\/em>/),
        fr: hitPart(a.text.fr, /Touché\s*:<\/em>/),
        es: hitPart(a.text.es ?? a.text.en, a.text.es ? /Acierto\s*:<\/em>/ : /Hit:<\/em>/),
      },
    })
  }
  return out
}

/** The Multiattack line of a stat block, when it has one. */
export function multiattack(def: CreatureDef): I18n | undefined {
  const a = def.actions.find((x) => x.name.en === 'Multiattack')
  return a ? { en: strip(a.text.en), fr: strip(a.text.fr), es: strip(a.text.es ?? a.text.en) } : undefined
}

/** Spells of the character (prepared, always prepared, cantrips, spellbook, granted). */
function characterSpells(sheet: Sheet): Set<string> {
  const out = new Set<string>()
  for (const b of sheet.spellcasting)
    for (const id of [...b.prepared, ...b.alwaysPrepared, ...b.cantrips, ...(b.spellbook ?? [])]) out.add(id)
  for (const x of sheet.extraSpells) for (const id of x.spells) out.add(id)
  return out
}

/** Summoning spells to offer: the character's own (none for a character who can't summon, user request 2026-10-29). */
export function availableSummonSpells(sheet: Sheet): SummonSpell[] {
  const mine = characterSpells(sheet)
  return SUMMON_SPELLS.filter((s) => mine.has(s.spellId))
}

/** The caster numbers for this spell: the Spellcasting class that has it, else the best spell attack. */
export function summonCaster(sheet: Sheet, spellId: string): SummonCaster | undefined {
  const blocks = sheet.spellcasting
  if (!blocks.length) return undefined
  const has = blocks.find((b) => [...b.prepared, ...b.alwaysPrepared, ...(b.spellbook ?? [])].includes(spellId))
  const b = has ?? [...blocks].sort((x, y) => y.attack.total - x.attack.total)[0]
  return { attack: b.attack.total, dc: b.dc.total, mod: b.mod }
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** A new summoned creature at full Hit Points, lasting the spell's duration. */
export function newSummon(
  spell: SummonSpell,
  def: CreatureDef,
  slot: number,
  variant?: string,
  effectUid?: string,
): Summon {
  const max = summonHpMax(def, slot, variant) ?? 1
  const s: Summon = {
    uid: uid(),
    spellId: spell.spellId,
    creatureId: def.id,
    slotLevel: slot,
    hp: { current: max, temp: 0, max },
  }
  if (variant) s.variant = variant
  if (spell.rounds !== undefined) s.rounds = spell.rounds
  if (effectUid) s.effectUid = effectUid
  return s
}

/** The Concentration effect of a summoning spell (shown in the turn bar and the active effects; Rules Glossary
 * "Concentration", p. 180: starting another Concentration effect ends the first). */
export function summonEffect(spell: SummonSpell, name: I18n): ActiveEffect {
  const e: ActiveEffect = { uid: uid(), kind: 'spell', refId: spell.spellId, name, enabled: true, concentration: true }
  if (spell.rounds !== undefined) e.rounds = spell.rounds
  return e
}

/** Remove the creatures whose Concentration effect has ended (the creature disappears when the spell ends). Returns
 * true when something was removed. */
export function pruneSummons(char: Character): boolean {
  if (!char.summons?.length) return false
  const live = new Set(char.activeEffects.map((e) => e.uid))
  const kept = char.summons.filter((s) => !s.effectUid || live.has(s.effectUid))
  if (kept.length === char.summons.length) return false
  char.summons = kept
  return true
}

/** Next round: timed creatures lose 1 round and vanish at 0 (the spell's duration ends). Returns the creature ids that
 * vanished. */
export function tickSummons(char: Character): string[] {
  if (!char.summons?.length) return []
  const gone: string[] = []
  for (const s of char.summons) {
    if (s.rounds === undefined) continue
    s.rounds -= 1
    if (s.rounds <= 0) gone.push(s.creatureId)
  }
  char.summons = char.summons.filter((s) => s.rounds === undefined || s.rounds > 0)
  pruneSummons(char)
  return gone
}
