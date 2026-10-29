// Item helpers shared by the Equipment pane, the paper doll and the Combat pane: name, weight, cost, short stat
// line, popup content, what can be held or attuned, and the catalog of everything the SRD lets you add.
import { rules } from '../data/rules'
import type { ArmorDef, GearDef, I18n, Lang, MagicItemDef, Source, WeaponDef, Weight } from '../data/types'
import type { ItemInstance, WornKind } from '../model/character'
import {
  ammoBundle,
  customWeapon,
  magicBase,
  magicEffectOf,
  magicItemOf,
  requiresAttunement,
  SRC_WORN_KINDS,
  WORN_KINDS,
  wornKindOf as wornKindWith,
} from '../engine/items'
import { initialCharges, spellItemInfo, chargesLeft } from '../engine/spellItems'
import { fmtDistance, fmtWeight, locale } from './format'
import { openPopup } from './popupState.svelte'
import { app } from '../state.svelte'
import { summaryOf } from './summary'
import { effectLine, effectStatus, textOnlyOf } from './itemEffects'

export const newUid = () => Math.random().toString(36).slice(2, 10)

/** A new inventory item from the catalog. An SRD magic weapon or armor goes on its base item (`magicItemId`, engine/items.ts
 * `magicBase`), so it works in attacks, AC, hands and proficiency; an item with charges starts full (a dice maximum is
 * rolled, SRD "Charges"). A weapon or Shield goes on the body, ready to be taken in hand; anything else into the backpack
 * unless `location` says otherwise. */
export function newItem(kind: ItemInstance['kind'], refId: string, location?: ItemInstance['location']): ItemInstance {
  const item: ItemInstance = { uid: newUid(), kind, refId, quantity: 1, location: 'carried' }
  if (kind === 'magic') {
    const def = rules.magicItems.get(refId)
    const base = def ? magicBase(def, rules) : undefined
    if (def && base) {
      item.kind = base.kind
      item.refId = base.refId
      item.magicItemId = def.id
    }
    if (def?.variants?.length) item.variant = 0
    Object.assign(item, initialCharges(magicEffectOf(item, rules)?.spellItem))
  }
  const shield = item.kind === 'armor' && rules.armor.get(item.refId ?? '')?.category === 'shield'
  item.location = location ?? (item.kind === 'weapon' || shield ? 'worn' : 'carried')
  return item
}

/** One-line summary of a catalog entry or an item (custom/summaries-items.json for magic items). */
export function catalogSummary(kind: ItemInstance['kind'], id: string): I18n | undefined {
  return kind === 'magic' ? rules.summaries.get(`item:${id}`) : undefined
}

/** The short line under an item in the Equipment table: its computed effects ("+1 AC, +1 saving throws"), or its summary. */
export function itemEffectLine(item: ItemInstance): I18n | undefined {
  const line = effectLine(item, app.character?.featureChoices ?? {})
  if (line) return line
  const m = magicItemOf(item, rules)
  return m ? summaryOf(`item:${m.id}`) : undefined
}

/** Comparison key: lowercase, accents removed. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Def =
  | { kind: 'weapon'; def: WeaponDef }
  | { kind: 'armor'; def: ArmorDef }
  | { kind: 'gear'; def: GearDef }
  | { kind: 'magic'; def: MagicItemDef }

/** The SRD entry behind an inventory item, when it has one. */
export function itemDef(item: ItemInstance): Def | undefined {
  const id = item.refId ?? ''
  switch (item.kind) {
    case 'weapon': {
      const def = rules.weapons.get(id)
      return def && { kind: 'weapon', def }
    }
    case 'armor': {
      const def = rules.armor.get(id)
      return def && { kind: 'armor', def }
    }
    case 'gear': {
      const def = rules.gear.get(id)
      return def && { kind: 'gear', def }
    }
    case 'magic': {
      const def = rules.magicItems.get(id)
      return def && { kind: 'magic', def }
    }
  }
  return undefined
}

export function itemName(item: ItemInstance): I18n {
  if (item.custom?.name) return item.custom.name
  const base = itemDef(item)?.def.name ?? { en: item.refId ?? '?', fr: item.refId ?? '?', es: item.refId ?? '?' }
  // An SRD magic weapon or armor: "Flame Tongue (Longsword)".
  const m = item.kind !== 'magic' ? magicItemOf(item, rules) : undefined
  if (m)
    return m.name.en.includes(base.en)
      ? m.name
      : {
          en: `${m.name.en} (${base.en})`,
          fr: `${m.name.fr} (${base.fr})`,
          es: `${m.name.es ?? m.name.en} (${base.es ?? base.en})`,
        }
  return base
}

/** Weight of one unit. Same rule as the engine's load (engine/sheet/defense.ts `itemWeightLb`): the custom weight when
 * set, the SRD entry's weight otherwise. */
export function itemWeight(item: ItemInstance): Weight | undefined {
  if (item.custom?.weightLb !== undefined) return { lb: item.custom.weightLb, kg: item.custom.weightLb / 2 }
  const d = itemDef(item)
  const n = d?.kind === 'gear' ? ammoBundle(d.def) : 1
  const w = d?.def.weight
  return w && n > 1 ? { lb: w.lb / n, kg: w.kg / n } : w
}

export function itemText(item: ItemInstance): I18n | undefined {
  if (item.custom?.text && (item.custom.text.en || item.custom.text.fr)) return item.custom.text
  const m = magicItemOf(item, rules)
  if (m) return m.text
  const d = itemDef(item)
  if (d?.kind === 'gear' || d?.kind === 'magic') return d.def.text
  return undefined
}

export function itemSource(item: ItemInstance): Source | undefined {
  return magicItemOf(item, rules)?.source ?? itemDef(item)?.def.source
}

/** Price in GP of one unit; undefined when the SRD gives none (magic items have a rarity, not a price). */
export function itemCostGp(item: ItemInstance): number | undefined {
  if (item.custom?.costGp !== undefined) return item.custom.costGp
  const d = itemDef(item)
  if (d?.kind === 'weapon' || d?.kind === 'armor') return d.def.cost.gp
  if (d?.kind === 'gear') return d.def.cost?.gp === undefined ? undefined : d.def.cost.gp / ammoBundle(d.def)
  return undefined
}

export const fmtGp = (n: number, lang: Lang) =>
  `${n.toLocaleString(locale(lang), { maximumFractionDigits: 2 })} ${lang === 'en' ? 'GP' : 'po'}`

/** Magic item rarities (SRD 5.2.1 "Magic Item Rarity", official French terms). */
export const RARITY: Record<string, I18n> = {
  common: { en: 'Common', fr: 'Courant', es: 'Común' },
  uncommon: { en: 'Uncommon', fr: 'Peu courant', es: 'Poco común' },
  rare: { en: 'Rare', fr: 'Rare', es: 'Raro' },
  'very-rare': { en: 'Very Rare', fr: 'Très rare', es: 'Muy raro' },
  legendary: { en: 'Legendary', fr: 'Légendaire', es: 'Legendario' },
  artifact: { en: 'Artifact', fr: 'Artefact', es: 'Artefacto' },
  varies: { en: 'Varies', fr: 'Variable', es: 'Variable' },
}

/** Magic item kinds (the "Armor, Potion, Ring…" line of each entry). */
export const MAGIC_KIND: Record<string, I18n> = {
  armor: { en: 'Armor', fr: 'Armure', es: 'Armadura' },
  potion: { en: 'Potion', fr: 'Potion', es: 'Poción' },
  ring: { en: 'Ring', fr: 'Anneau', es: 'Anillo' },
  rod: { en: 'Rod', fr: 'Sceptre', es: 'Vara' },
  scroll: { en: 'Scroll', fr: 'Parchemin', es: 'Pergamino' },
  staff: { en: 'Staff', fr: 'Bâton', es: 'Bastón' },
  wand: { en: 'Wand', fr: 'Baguette', es: 'Varita' },
  weapon: { en: 'Weapon', fr: 'Arme', es: 'Arma' },
  wondrous: { en: 'Wondrous Item', fr: 'Objet merveilleux', es: 'Objeto maravilloso' },
}

const ABILITY_NAMES: Record<string, I18n> = {
  str: { en: 'Strength', fr: 'Force', es: 'Fuerza' },
  dex: { en: 'Dexterity', fr: 'Dextérité', es: 'Destreza' },
  con: { en: 'Constitution', fr: 'Constitution', es: 'Constitución' },
  int: { en: 'Intelligence', fr: 'Intelligence', es: 'Inteligencia' },
  wis: { en: 'Wisdom', fr: 'Sagesse', es: 'Sabiduría' },
  cha: { en: 'Charisma', fr: 'Charisme', es: 'Carisma' },
}

const join = (parts: I18n[], sep = ' · '): I18n => ({
  en: parts.map((p) => p.en).join(sep),
  fr: parts.map((p) => p.fr).join(sep),
  es: parts.map((p) => p.es ?? p.en).join(sep),
})

/** Short stat line under the name: damage and properties, AC, rarity… */
export function itemStats(item: ItemInstance): I18n | undefined {
  const d = itemDef(item)
  if (!d) return customStats(item)
  if (d.kind === 'weapon') {
    const w = customWeapon(d.def, item)
    const parts: I18n[] = []
    const bonus = item.custom?.magicBonus
    if (bonus) parts.push({ en: `+${bonus}`, fr: `+${bonus}`, es: `+${bonus}` })
    if (w.damage) {
      const type = w.damageType ? rules.damageTypeNames[w.damageType] : undefined
      parts.push({
        en: `${w.damage}${type ? ` ${type.en}` : ''}${w.versatile ? ` (${w.versatile})` : ''}`,
        fr: `${w.damage}${type ? ` ${type.fr}` : ''}${w.versatile ? ` (${w.versatile})` : ''}`,
        es: `${w.damage}${type ? ` ${type.es ?? type.en}` : ''}${w.versatile ? ` (${w.versatile})` : ''}`,
      })
    }
    for (const x of item.custom?.extraDamage ?? []) {
      if (!x.dice?.trim()) continue
      const type = x.type ? rules.damageTypeNames[x.type] : undefined
      parts.push({
        en: `+${x.dice}${type ? ` ${type.en}` : ''}`,
        fr: `+${x.dice}${type ? ` ${type.fr}` : ''}`,
        es: `+${x.dice}${type ? ` ${type.es ?? type.en}` : ''}`,
      })
    }
    const props = w.properties.map((p) => rules.weaponProperties.get(p)?.name).filter((x): x is I18n => !!x)
    if (props.length) parts.push(join(props, ', '))
    if (w.range)
      parts.push({
        en: `${fmtDistance(w.range.normal, 'en')} / ${fmtDistance(w.range.long, 'en')}`,
        fr: `${fmtDistance(w.range.normal, 'fr')} / ${fmtDistance(w.range.long, 'fr')}`,
        es: `${fmtDistance(w.range.normal, 'es')} / ${fmtDistance(w.range.long, 'es')}`,
      })
    parts.push(...magicTags(item))
    return join(parts)
  }
  if (d.kind === 'armor') {
    const a = d.def
    const bonus = item.custom?.magicBonus ?? 0
    if (a.category === 'shield')
      return {
        en: `+${(a.bonus ?? 2) + bonus} AC`,
        fr: `+${(a.bonus ?? 2) + bonus} CA`,
        es: `+${(a.bonus ?? 2) + bonus} CA`,
      }
    const dex =
      a.dex === 'full'
        ? { en: ' + Dex', fr: ' + Dex', es: ' + Des' }
        : a.dex === 'max2'
          ? { en: ' + Dex (max 2)', fr: ' + Dex (max 2)', es: ' + Des (máx. 2)' }
          : { en: '', fr: '', es: '' }
    const parts: I18n[] = [
      {
        en: `AC ${(a.baseAc ?? 10) + bonus}${dex.en}`,
        fr: `CA ${(a.baseAc ?? 10) + bonus}${dex.fr}`,
        es: `CA ${(a.baseAc ?? 10) + bonus}${dex.es ?? dex.en}`,
      },
    ]
    if (a.strength) parts.push({ en: `Str ${a.strength}`, fr: `For ${a.strength}`, es: `Fue ${a.strength}` })
    if (a.stealthDisadvantage)
      parts.push({ en: 'Stealth Disadvantage', fr: 'Désavantage en Discrétion', es: 'Desventaja en Sigilo' })
    parts.push(...magicTags(item))
    return join(parts)
  }
  if (d.kind === 'magic')
    return join([MAGIC_KIND[d.def.kind] ?? { en: d.def.kind, fr: d.def.kind, es: d.def.kind }, ...magicTags(item)])
  if (d.kind === 'gear' && d.def.tool) return { en: 'Tool', fr: 'Outil', es: 'Herramienta' }
  return undefined
}

/** Rarity (the variant's when it has one) and Attunement of an SRD magic item. */
function magicTags(item: ItemInstance): I18n[] {
  const m = magicItemOf(item, rules)
  if (!m) return []
  const v = item.variant !== undefined ? m.variants?.[item.variant] : undefined
  const parts: I18n[] = []
  if (v) parts.push(v.name)
  const rarity = v?.rarity ?? m.rarity
  parts.push(RARITY[rarity] ?? { en: rarity, fr: rarity, es: rarity })
  if (m.attunement)
    parts.push(
      m.attunementBy
        ? {
            en: `requires Attunement ${m.attunementBy.en}`,
            fr: `harmonisation requise ${m.attunementBy.fr}`,
            es: `requiere sintonización ${m.attunementBy.es ?? m.attunementBy.en}`,
          }
        : { en: 'requires Attunement', fr: 'harmonisation requise', es: 'requiere sintonización' },
    )
  return parts
}

/** Stat line of a custom item (kind 'custom'): magic, Attunement, its modifiers. */
function customStats(item: ItemInstance): I18n | undefined {
  const c = item.custom
  if (!c) return undefined
  const parts: I18n[] = []
  if (c.magic) parts.push({ en: 'Magic item', fr: 'Objet magique', es: 'Objeto mágico' })
  if (c.attunement) parts.push({ en: 'requires Attunement', fr: 'harmonisation requise', es: 'requiere sintonización' })
  const mods = modifiersText(item)
  if (mods) parts.push(mods)
  return parts.length ? join(parts) : undefined
}

/** "+1 AC, +1 all saving throws": the item's custom modifiers, short. */
export function modifiersText(item: ItemInstance): I18n | undefined {
  const mods = item.custom?.modifiers ?? []
  if (!mods.length) return undefined
  return join(
    mods.map((m) => {
      const t = MODIFIER_TARGETS.find((x) => x.id === m.target)?.name ?? { en: m.target, fr: m.target, es: m.target }
      const v = typeof m.value === 'number' ? (m.value >= 0 ? `+${m.value}` : `${m.value}`) : m.value
      const cond = m.condition
        ? { en: ` (${m.condition.en})`, fr: ` (${m.condition.fr})`, es: ` (${m.condition.es ?? m.condition.en})` }
        : { en: '', fr: '', es: '' }
      return {
        en: `${v} ${t.en}${cond.en}`,
        fr: `${v} ${t.fr}${cond.fr}`,
        es: `${v} ${t.es ?? t.en}${cond.es ?? cond.en}`,
      }
    }),
    ', ',
  )
}

/** Targets offered for a custom item's modifiers (docs/effects.md vocabulary; the engine stages read these). */
export const MODIFIER_TARGETS: { id: string; name: I18n }[] = [
  { id: 'ac', name: { en: 'AC', fr: 'CA', es: 'CA' } },
  {
    id: 'save.all',
    name: { en: 'all saving throws', fr: 'tous les jets de sauvegarde', es: 'todas las tiradas de salvación' },
  },
  ...(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => ({
    id: `save.${a}`,
    name: {
      en: `${ABILITY_NAMES[a].en} saving throw`,
      fr: `jet de sauvegarde ${a === 'int' ? 'd’' : 'de '}${ABILITY_NAMES[a].fr}`,
      es: `Tirada de salvación de ${ABILITY_NAMES[a].es ?? ABILITY_NAMES[a].en}`,
    },
  })),
  ...(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => ({
    id: `ability.${a}`,
    name: ABILITY_NAMES[a],
  })),
  { id: 'initiative', name: { en: 'Initiative', fr: 'Initiative', es: 'Iniciativa' } },
  { id: 'speed', name: { en: 'Speed (ft)', fr: 'Vitesse (pieds)', es: 'Velocidad (pies)' } },
  { id: 'hp.max', name: { en: 'Hit Point maximum', fr: 'points de vie maximum', es: 'puntos de golpe máximos' } },
  { id: 'attack.all', name: { en: 'attack rolls', fr: 'jets d’attaque', es: 'tiradas de ataque' } },
  {
    id: 'attack.melee',
    name: { en: 'melee attack rolls', fr: 'jets d’attaque au corps à corps', es: 'tiradas de ataque cuerpo a cuerpo' },
  },
  {
    id: 'attack.ranged',
    name: { en: 'ranged attack rolls', fr: 'jets d’attaque à distance', es: 'tiradas de ataque a distancia' },
  },
  {
    id: 'attack.spell',
    name: { en: 'spell attack rolls', fr: 'jets d’attaque de sort', es: 'tiradas de ataque de conjuro' },
  },
  { id: 'damage.all', name: { en: 'weapon damage', fr: 'dégâts des armes', es: 'daño de las armas' } },
  {
    id: 'damage.melee',
    name: {
      en: 'melee weapon damage',
      fr: 'dégâts des armes de corps à corps',
      es: 'daño de las armas cuerpo a cuerpo',
    },
  },
  {
    id: 'damage.ranged',
    name: { en: 'ranged weapon damage', fr: 'dégâts des armes à distance', es: 'daño de las armas a distancia' },
  },
  { id: 'spell.dc', name: { en: 'spell save DC', fr: 'DD des sorts', es: 'CD de salvación de conjuros' } },
  {
    id: 'check.all',
    name: {
      en: 'all ability checks',
      fr: 'tous les tests de caractéristique',
      es: 'todas las pruebas de característica',
    },
  },
  ...[...rules.skills.values()].map((k) => ({ id: `skill.${k.id}`, name: k.name })),
  {
    id: 'attunement.max',
    name: { en: 'items attuned (maximum)', fr: 'objets harmonisés (maximum)', es: 'objetos sintonizados (máximo)' },
  },
]

/** Extra lines for the popup: weight, price, don/doff, mastery, charges. */
export function itemLines(item: ItemInstance): I18n[] {
  const lines: I18n[] = []
  const w = itemWeight(item)
  const cost = itemCostGp(item)
  const first: I18n[] = []
  if (w)
    first.push({
      en: `Weight ${fmtWeight(w, 'en')}`,
      fr: `Poids ${fmtWeight(w, 'fr')}`,
      es: `Peso ${fmtWeight(w, 'es')}`,
    })
  if (cost !== undefined) first.push({ en: fmtGp(cost, 'en'), fr: fmtGp(cost, 'fr'), es: fmtGp(cost, 'es') })
  if (item.quantity > 1) first.push({ en: `× ${item.quantity}`, fr: `× ${item.quantity}`, es: `× ${item.quantity}` })
  if (first.length) lines.push(join(first))
  const d = itemDef(item)
  if (d?.kind === 'weapon') {
    const mastery = rules.weaponProperties.get(d.def.mastery)?.name
    if (mastery)
      lines.push({
        en: `Mastery: ${mastery.en}`,
        fr: `Botte d’arme : ${mastery.fr}`,
        es: `Maestría: ${mastery.es ?? mastery.en}`,
      })
    if (d.def.ammunition)
      lines.push({
        en: `Ammunition: ${d.def.ammunition}`,
        fr: `Munitions : ${d.def.ammunition}`,
        es: `Munición: ${d.def.ammunition}`,
      })
  }
  if (d?.kind === 'armor')
    lines.push({
      en: `Don ${d.def.don.en}, doff ${d.def.doff.en}`,
      fr: `Revêtir ${d.def.don.fr}, ôter ${d.def.doff.fr}`,
      es: `Ponerse ${d.def.don.es ?? d.def.don.en}, quitarse ${d.def.doff.es ?? d.def.doff.en}`,
    })
  const kind = wornKindOf(item)
  if (kind) {
    const k = WORN_KINDS.find((x) => x.id === kind)!.name
    lines.push({
      en: `Worn kind: ${k.en} (one at a time)`,
      fr: `Type porté : ${k.fr} (un seul à la fois)`,
      es: `Tipo llevado: ${k.es ?? k.en} (uno a la vez)`,
    })
  }
  lines.push(...effectLines(item))
  const info = spellItemInfo(item, rules)
  if (info) {
    const left = chargesLeft(item, info)
    const m = magicItemOf(item, rules)
    if (info.maxCharges !== undefined || left !== undefined)
      lines.push({
        en: `Charges: ${left ?? '?'} / ${info.maxCharges ?? info.chargesDice ?? '?'}${m?.charges ? ` — ${m.charges.recharge.en}` : ''}`,
        fr: `Charges : ${left ?? '?'} / ${info.maxCharges ?? info.chargesDice ?? '?'}${m?.charges ? ` — ${m.charges.recharge.fr}` : ''}`,
        es: `Cargas: ${left ?? '?'} / ${info.maxCharges ?? info.chargesDice ?? '?'}${m?.charges ? ` — ${m.charges.recharge.es ?? m.charges.recharge.en}` : ''}`,
      })
    const names = info.spells.map((s) => rules.spells.get(s.spellId)?.name).filter((x): x is I18n => !!x)
    if (names.length)
      lines.push({
        en: `Spells: ${names.map((n) => n.en).join(', ')}`,
        fr: `Sorts : ${names.map((n) => n.fr).join(', ')}`,
        es: `Conjuros: ${names.map((n) => n.es ?? n.en).join(', ')}`,
      })
  }
  return lines
}

/** The item's effects for the popup: what it does on the sheet and whether it applies now (and why not), or why the
 * engine only describes it. */
export function effectLines(item: ItemInstance): I18n[] {
  const line = effectLine(item, app.character?.featureChoices ?? {})
  const out: I18n[] = []
  if (line) {
    const st = effectStatus(item)
    out.push(
      st.active
        ? {
            en: `Effects (active): ${line.en}`,
            fr: `Effets (actifs) : ${line.fr}`,
            es: `Efectos (activos): ${line.es ?? line.en}`,
          }
        : {
            en: `Effects (inactive: ${st.reason?.en}): ${line.en}`,
            fr: `Effets (inactifs : ${st.reason?.fr}) : ${line.fr}`,
            es: `Efectos (inactivos: ${st.reason?.es ?? st.reason?.en}): ${line.es ?? line.en}`,
          },
    )
  }
  const t = textOnlyOf(item)
  if (t) out.push({ en: `Not computed: ${t.en}`, fr: `Non calculé : ${t.fr}`, es: `No calculado: ${t.es ?? t.en}` })
  return out
}

/** Open the item's popup: name, stat line, SRD text and source, campaign note. */
export function openItem(item: ItemInstance) {
  openPopup({
    title: itemName(item),
    summary: itemStats(item),
    lines: itemLines(item),
    html: itemText(item),
    source: itemSource(item),
    noteKey: `item:${item.uid}`,
  })
}

/** A magic item: from the SRD, or a custom one (marked magic, with a magic bonus, or requiring Attunement). */
export const isMagic = (item: ItemInstance) =>
  item.kind === 'magic' ||
  !!item.magicItemId ||
  !!item.custom?.magic ||
  !!item.custom?.magicBonus ||
  !!item.custom?.attunement

/** The worn kind of an item (one of each at a time, SRD p. 103), or undefined (an "other worn item"). */
export const wornKindOf = (item: ItemInstance): WornKind | undefined => wornKindWith(item, rules)
export { SRC_WORN_KINDS, WORN_KINDS }

/** Body armor (not a Shield). */
export const isBodyArmor = (item: ItemInstance) => {
  const d = itemDef(item)
  return d?.kind === 'armor' && d.def.category !== 'shield'
}
export const isShield = (item: ItemInstance) => {
  const d = itemDef(item)
  return d?.kind === 'armor' && d.def.category === 'shield'
}
export const isWeapon = (item: ItemInstance) => itemDef(item)?.kind === 'weapon'

/** Weapons and Shields can be taken in hand (`equipped`). */
export const canHold = (item: ItemInstance) => isWeapon(item) || isShield(item)

/** Hands used when held: two for a Two-Handed weapon (SRD "Properties"). */
export function handsNeeded(item: ItemInstance): number {
  const d = itemDef(item)
  return d?.kind === 'weapon' && d.def.properties.includes('two-handed') ? 2 : 1
}

/** Can be attuned: an item that requires Attunement (the SRD entry, or a custom item created so). */
export function canAttune(item: ItemInstance): boolean {
  if (item.kind === 'magic' && !itemDef(item)) return true
  return requiresAttunement(item, rules)
}

export interface CatalogEntry {
  kind: ItemInstance['kind']
  id: string
  name: I18n
  group: I18n
}

/** Everything that can be added from the SRD: {kind, id, name, group}. */
export function catalog(): CatalogEntry[] {
  const out: CatalogEntry[] = []
  for (const w of rules.weapons.values())
    out.push({ kind: 'weapon', id: w.id, name: w.name, group: { en: 'Weapons', fr: 'Armes', es: 'Armas' } })
  for (const a of rules.armor.values())
    out.push({ kind: 'armor', id: a.id, name: a.name, group: { en: 'Armor', fr: 'Armures', es: 'Armaduras' } })
  for (const g of rules.gear.values())
    out.push({ kind: 'gear', id: g.id, name: g.name, group: { en: 'Gear', fr: 'Équipement', es: 'Equipo' } })
  for (const m of rules.magicItems.values())
    out.push({
      kind: 'magic',
      id: m.id,
      name: m.name,
      group: { en: 'Magic items', fr: 'Objets magiques', es: 'Objetos mágicos' },
    })
  return out
}
