// Items that hold spells and charges (wands, staffs, rods, rings, Spell Scrolls, potions, any item that says "cast X from
// it"), used from the Combat pane (ui/SpellItemsBlock.svelte). The SRD data of each item is `spellItem` in its effect
// entry (custom/effects/magic-items.json); the instance keeps its own state (`charges`, `usedToday`, `quantity`) and may
// hold more spells (`ItemInstance.spells`: a Spell Scroll's spell, a Ring of Spell Storing's, a custom wand's).
// Rules: SRD 5.2.1 "Magic Items" > "Spells Cast from Items" (EN p. 206 / FR p. 217 "Sorts lancés depuis un objet": cast at
// the lowest possible level, no spell slot, no components unless the item says otherwise; an item may use the user's own
// spellcasting ability, and a user without one uses +0 and their Proficiency Bonus), "Charges" (same page), each item's
// text (its fixed DC and attack bonus when printed), and "Spell Scroll" (p. 244: DC and attack bonus by spell level).
import type { Rules } from '../data/rules'
import type { I18n, ItemSpellDef, SpellItemDef } from '../data/types'
import type { ItemInstance } from '../model/character'
import { inactiveReason, magicEffectOf, magicItemOf, requiresAttunement, variantOf } from './items'

/** A spell the item can cast, with what it costs. */
export interface ItemSpell extends ItemSpellDef {
  /** The spell comes from the instance (a scroll's, a stored one), not from the SRD entry. */
  fromInstance?: boolean
}

export interface SpellItemInfo {
  def?: SpellItemDef
  spells: ItemSpell[]
  /** Maximum charges (a dice maximum is rolled when the item is added and kept in `ItemInstance.maxCharges`). */
  maxCharges?: number
  /** Dice of a maximum still to roll ('1d3'). */
  chargesDice?: string
  recharge?: string
  rechargeAt: 'dawn' | 'dusk'
  consumable: boolean
  scroll: boolean
  stores: boolean
  wielderDc: boolean
  note?: I18n
  /** The variant's line (Potion of Healing (greater): "Regain 4d4 + 4 Hit Points"). */
  variantNote?: I18n
}

/** Spell Scroll table (SRD p. 244): save DC and attack bonus by spell level (index 0 = cantrip). */
export const SCROLL_TABLE: { dc: number; attack: number }[] = [
  { dc: 13, attack: 5 },
  { dc: 13, attack: 5 },
  { dc: 13, attack: 5 },
  { dc: 15, attack: 7 },
  { dc: 15, attack: 7 },
  { dc: 17, attack: 9 },
  { dc: 17, attack: 9 },
  { dc: 18, attack: 10 },
  { dc: 18, attack: 10 },
  { dc: 19, attack: 11 },
]

export const SRC_SPELL_SCROLL = { page: 244, frPage: 250, section: 'Magic Items > Spell Scroll' }

/** What an item can cast and its charges, or undefined for an item with neither. */
export function spellItemInfo(item: ItemInstance, rules: Rules): SpellItemInfo | undefined {
  const mdef = magicItemOf(item, rules)
  const def = magicEffectOf(item, rules)?.spellItem
  const own = item.spells ?? []
  if (!def && !own.length && item.maxCharges === undefined) return undefined
  const fixedMax = typeof def?.charges === 'number' ? def.charges : undefined
  const maxCharges = item.maxCharges ?? fixedMax
  const hasCharges = maxCharges !== undefined || typeof def?.charges === 'string'
  const spells: ItemSpell[] = [...(def?.spells ?? [])]
  for (const s of own) {
    if (!rules.spells.has(s.spellId)) continue
    spells.push({
      spellId: s.spellId,
      fromInstance: true,
      ...(s.level !== undefined ? { level: s.level } : {}),
      ...(s.perDay
        ? { perDay: s.perDay }
        : s.atWill
          ? { atWill: true }
          : hasCharges
            ? { cost: s.chargeCost ?? 1 }
            : {}),
      ...(s.dc !== undefined ? { dc: s.dc } : {}),
      ...(s.attack !== undefined ? { attack: s.attack } : {}),
    })
  }
  const variant = variantOf(item, mdef)
  return {
    def,
    spells,
    maxCharges,
    chargesDice: maxCharges === undefined && typeof def?.charges === 'string' ? def.charges : undefined,
    recharge: item.recharge ?? def?.recharge,
    rechargeAt: def?.rechargeAt ?? 'dawn',
    consumable: !!def?.consumable,
    scroll: !!def?.scroll,
    stores: !!def?.stores,
    wielderDc: !!def?.wielderDc,
    note: def?.note,
    variantNote: def?.variantNotes?.[variant],
  }
}

/** The spell's own level (0 = cantrip). */
const baseLevel = (s: ItemSpell, rules: Rules) => rules.spells.get(s.spellId)?.level ?? 0

/** Levels the spell can be cast at from the item: one level, or a range when extra charges raise it. A Spell Scroll's
 * spell is cast at the scroll's level (its variant: 0 = cantrip). */
export function castLevels(s: ItemSpell, rules: Rules, item?: ItemInstance): number[] {
  if (s.fromInstance && item && magicEffectOf(item, rules)?.spellItem?.scroll) {
    const lv = Math.max(baseLevel(s, rules), variantOf(item, magicItemOf(item, rules)))
    return [lv]
  }
  const lo = s.level ?? baseLevel(s, rules)
  const hi = s.maxLevel ?? lo
  const out: number[] = []
  for (let l = lo; l <= hi; l++) out.push(l)
  return out
}

/** Charges spent to cast the spell at a level: 'level' = one per spell level; with a level range each level above the
 * lowest costs one more charge (Wand of Fireballs); none for a once-per-dawn or at-will property. */
export function chargeCost(s: ItemSpell, level: number, rules: Rules): number {
  if (s.cost === undefined) return 0
  if (s.cost === 'level') return Math.max(1, level)
  const lo = s.level ?? baseLevel(s, rules)
  return s.cost + Math.max(0, level - lo)
}

/** Save DC and attack bonus of a spell cast from the item: the item's fixed numbers, the Spell Scroll table by level, the
 * original caster's (stored spells), or the wielder's own (`wielderDc`, or no number printed). */
export function itemSpellNumbers(
  s: ItemSpell,
  info: SpellItemInfo,
  level: number,
  wielder: { dc?: number; attack?: number },
): { dc?: number; attack?: number; from: 'item' | 'scroll' | 'wielder' | 'original' } {
  if (info.scroll) {
    const row = SCROLL_TABLE[Math.min(9, Math.max(0, level))]
    return { dc: row.dc, attack: row.attack, from: 'scroll' }
  }
  if (s.fromInstance && info.stores) return { from: 'original' }
  if (s.dc !== undefined || s.attack !== undefined) return { dc: s.dc, attack: s.attack, from: 'item' }
  return { dc: wielder.dc, attack: wielder.attack, from: 'wielder' }
}

/** Why the item can't be used right now (undefined = it can). Items used from the Combat pane must be on you (worn or in
 * the backpack); one that requires Attunement must be attuned (Rules Glossary "Attunement", SRD p. 177). */
export function unusableReason(item: ItemInstance, rules: Rules): I18n | undefined {
  if (item.location === 'stored') return { en: 'not on your person', fr: 'pas sur vous', es: 'no lo llevas encima' }
  if (requiresAttunement(item, rules) && !item.attuned)
    return { en: 'requires Attunement', fr: 'harmonisation requise', es: 'requiere sintonización' }
  return undefined
}

/** Charges left (the maximum when never spent). */
export function chargesLeft(item: ItemInstance, info: SpellItemInfo): number | undefined {
  if (info.maxCharges === undefined) return item.charges
  return Math.min(info.maxCharges, item.charges ?? info.maxCharges)
}

/** Can this spell be cast now at this level (charges left, once-per-dawn property unused, item usable)? */
export function canCast(item: ItemInstance, info: SpellItemInfo, s: ItemSpell, level: number, rules: Rules): boolean {
  if (unusableReason(item, rules)) return false
  if (info.consumable && item.quantity < 1) return false
  if (s.perDay && (item.usedToday ?? []).filter((x) => x === s.spellId).length >= s.perDay) return false
  const cost = chargeCost(s, level, rules)
  if (cost > 0) return (chargesLeft(item, info) ?? 0) >= cost
  return true
}

/** Cast a spell from the item: spend its charges, mark a once-per-dawn property, use up a scroll or a potion. */
export function castFromItem(item: ItemInstance, info: SpellItemInfo, s: ItemSpell, level: number, rules: Rules) {
  const cost = chargeCost(s, level, rules)
  if (cost > 0) item.charges = Math.max(0, (chargesLeft(item, info) ?? 0) - cost)
  if (s.perDay) item.usedToday = [...(item.usedToday ?? []), s.spellId]
  if (info.consumable) item.quantity = Math.max(0, item.quantity - 1)
}

/** Roll a dice expression ('1d6 + 4', '2d8+4', '1d3', '5'). */
export function rollDice(expr: string, rng: () => number = Math.random): number {
  let total = 0
  for (const term of expr
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .split(/(?=[+-])/)) {
    const m = term.match(/^([+-]?)(\d*)d(\d+)$/i)
    const sign = term.startsWith('-') ? -1 : 1
    if (m) {
      const n = m[2] ? parseInt(m[2], 10) : 1
      const die = parseInt(m[3], 10)
      for (let i = 0; i < n; i++) total += sign * (1 + Math.floor(rng() * die))
    } else if (/^[+-]?\d+$/.test(term)) total += parseInt(term, 10)
  }
  return total
}

/** Daily regain ("regains 1d6 + 1 expended charges daily at dawn"): charges back (capped at the maximum) and the
 * once-per-dawn properties renewed. Returns the charges regained. */
export function rechargeItem(item: ItemInstance, info: SpellItemInfo, rng: () => number = Math.random): number {
  item.usedToday = []
  if (info.maxCharges === undefined || !info.recharge) return 0
  const left = chargesLeft(item, info) ?? 0
  const gain = info.recharge === 'all' ? info.maxCharges : rollDice(info.recharge, rng)
  const next = Math.min(info.maxCharges, left + Math.max(0, gain))
  item.charges = next
  return next - left
}

/** A new item's starting charges: the maximum, rolled when it is dice (Luck Blade "1d3 charges", Necklace of Fireballs
 * "1d6 + 3 beads"). */
export function initialCharges(
  def: SpellItemDef | undefined,
  rng: () => number = Math.random,
): { charges?: number; maxCharges?: number } {
  if (def?.charges === undefined) return {}
  if (typeof def.charges === 'number') return { charges: def.charges }
  const n = Math.max(1, rollDice(def.charges, rng))
  return { charges: n, maxCharges: n }
}

/** SRD p. 206 "Spells Cast from Items". */
export const SRC_ITEM_SPELLS = { page: 206, frPage: 217, section: 'Magic Items > Spells Cast from Items' }

/** The wielder's save DC and attack bonus for an item that uses "your spell save DC": the best of the character's
 * Spellcasting classes (the user chooses which ability, SRD p. 206); without one, 8 + Proficiency Bonus and + Proficiency
 * Bonus ("their spellcasting ability modifier is +0 for the item, and the user's Proficiency Bonus applies"). */
export function wielderNumbers(sheet: {
  pb: number
  spellcasting: { dc: { total: number }; attack: { total: number } }[]
}): { dc: number; attack: number } {
  if (!sheet.spellcasting.length) return { dc: 8 + sheet.pb, attack: sheet.pb }
  return {
    dc: Math.max(...sheet.spellcasting.map((s) => s.dc.total)),
    attack: Math.max(...sheet.spellcasting.map((s) => s.attack.total)),
  }
}

export { inactiveReason }
