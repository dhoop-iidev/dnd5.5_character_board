// Inventory items as the rules see them: the worn kind of an item (one of each at a time, SRD 5.2.1 p. 103), whether it
// requires Attunement, whether its effects apply right now, and a custom weapon's statistics (base weapon + overrides).
// Shared by the engine stages, the checks and the UI (ui/items.ts re-exports these).
import type { Rules } from '../data/rules'
import type { EffectDef, GearDef, I18n, MagicItemDef, ModifierSpec, WeaponDef } from '../data/types'
import type { ItemInstance, WornKind } from '../model/character'

/** SRD 5.2.1 p. 103 "Multiple Items of the Same Kind" / FR p. 109 "Plusieurs objets du même type". */
export const SRC_WORN_KINDS = {
  page: 103,
  frPage: 109,
  section: 'Magic Items > Wearing and Wielding Items > Multiple Items of the Same Kind',
}

/** The six kinds, head to toe, with the official French terms of p. 109. */
export const WORN_KINDS: { id: WornKind; name: I18n; hint: I18n }[] = [
  {
    id: 'headwear',
    name: { en: 'Headwear', fr: 'Couvre-chef', es: 'Objeto para la cabeza' },
    hint: {
      en: 'Helm, hat, circlet, headband',
      fr: 'Casque, chapeau, diadème, bandeau',
      es: 'Casco, sombrero, diadema, cinta',
    },
  },
  {
    id: 'cloak',
    name: { en: 'Cloak', fr: 'Cape', es: 'Capa' },
    hint: { en: 'Cloak, cape, mantle', fr: 'Cape, manteau, mantelet', es: 'Capa, manto, esclavina' },
  },
  {
    id: 'armor',
    name: { en: 'Armor', fr: 'Armure', es: 'Armadura' },
    hint: {
      en: 'One suit; donning takes 1 to 10 minutes',
      fr: 'Une seule ; la revêtir prend 1 à 10 minutes',
      es: 'Solo una; ponérsela lleva de 1 a 10 minutos',
    },
  },
  {
    id: 'bracers',
    name: { en: 'Bracers', fr: 'Brassards', es: 'Brazales' },
    hint: { en: 'One pair', fr: 'Une paire', es: 'Un par' },
  },
  {
    id: 'gloves',
    name: { en: 'Gloves or gauntlets', fr: 'Gants ou gantelets', es: 'Guantes o guanteletes' },
    hint: { en: 'One pair', fr: 'Une paire', es: 'Un par' },
  },
  {
    id: 'footwear',
    name: { en: 'Footwear', fr: 'Chaussures', es: 'Zapatos' },
    hint: { en: 'Boots, slippers (one pair)', fr: 'Bottes, chaussons (une paire)', es: 'Botas, zapatillas (un par)' },
  },
]

// Name patterns, English and French (custom items often carry a French name). Order matters: the first match wins.
const NAME_KINDS: [WornKind, RegExp][] = [
  ['footwear', /\b(boots?|slippers?|shoes|sandals?|bottes?|chaussons?|chaussures?|sandales?)\b/i],
  ['gloves', /\b(gloves?|gauntlets?|gants?|gantelets?)\b/i],
  ['bracers', /\b(bracers?|brassards?)\b/i],
  ['cloak', /\b(cloak|cape|mantle|manteau|mantelet)\b/i],
  [
    'headwear',
    /\b(helm|helmet|hat|circlet|headband|crown|diadem|tiara|casque|heaume|chapeau|diad[eè]me|bandeau|couronne|tiare)\b/i,
  ],
]

/** Pieces in one bundle of ammunition (SRD 5.2.1 p. 94 "Ammunition" table, "Amount: 20"): the catalog gives the weight
 * and price of a bundle, an inventory line counts single pieces (20 Arrows = quantity 20). 1 for anything else. */
export function ammoBundle(def: GearDef | undefined): number {
  if (def?.kind !== 'ammunition') return 1
  const m = def.text?.en.match(/Amount:\s*(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

const isShieldName = (s: string) => /shield|bouclier/i.test(s)

/** The worn kind of an item, or undefined for an "other worn item" (rings, amulets, belts, weapons…).
 * - a custom override (`custom.wornKind`, 'none' = no kind) wins;
 * - body armor (SRD armor that isn't a Shield; a magic item of the Armor kind that isn't a Shield) → armor;
 * - a magic item, gear or custom item whose name (EN or FR) says Boots/Slippers, Gloves/Gauntlets, Bracers,
 *   Cloak/Cape/Mantle, Helm/Hat/Circlet/Headband/Crown → that kind. Weapons never have one. */
export function wornKindOf(item: ItemInstance, rules: Rules): WornKind | undefined {
  const o = item.custom?.wornKind
  if (o) return o === 'none' ? undefined : o
  const id = item.refId ?? ''
  if (item.kind === 'weapon') return undefined
  if (item.kind === 'armor') {
    const def = rules.armor.get(id)
    return def && def.category !== 'shield' ? 'armor' : undefined
  }
  let names: I18n | undefined
  if (item.kind === 'magic') {
    const def = rules.magicItems.get(id)
    if (!def) return undefined
    if (def.kind === 'armor')
      return def.baseItem === 'shield' || isShieldName(def.name.en) || isShieldName(id) ? undefined : 'armor'
    if (def.kind !== 'wondrous') return undefined
    names = def.name
  } else if (item.kind === 'gear') names = rules.gear.get(id)?.name
  if (item.custom?.name) names = item.custom.name
  if (!names) return undefined
  for (const [kind, re] of NAME_KINDS) if (re.test(names.en) || re.test(names.fr)) return kind
  return undefined
}

/** The SRD magic item an inventory item is: a 'magic' item, or a weapon / armor on its base item (`magicItemId`). */
export function magicItemOf(item: ItemInstance, rules: Rules): MagicItemDef | undefined {
  const id = item.magicItemId ?? (item.kind === 'magic' ? item.refId : undefined)
  return id ? rules.magicItems.get(id) : undefined
}

/** The effects entry of the item's SRD magic item (`item:<id>`, custom/effects/magic-items.json). */
export function magicEffectOf(item: ItemInstance, rules: Rules): EffectDef | undefined {
  const def = magicItemOf(item, rules)
  return def ? rules.effects.get(`item:${def.id}`) : undefined
}

/** Index of the item's variant in its variant table (0 when it has none or none was chosen). */
export function variantOf(item: ItemInstance, def: MagicItemDef | undefined): number {
  const n = def?.variants?.length ?? 0
  if (!n) return 0
  return Math.min(n - 1, Math.max(0, Math.floor(item.variant ?? 0)))
}

/** A modifier's value for the item's variant (`byVariant`), or its plain value. */
export function variantValue(m: ModifierSpec, variant: number): number | string {
  if (!m.byVariant?.length) return m.value
  return m.byVariant[Math.min(variant, m.byVariant.length - 1)]
}

/** Default base item of an SRD magic weapon, armor, or staff wielded as a weapon, when the entry names none ("Weapon (Any
 * Sword)", "Armor (Any Medium or Heavy)"): the player can pick another base in the item's edit form. Ammunition stays a
 * magic item (it isn't held). Staffs that "can be wielded as a magic Quarterstaff" and the Rod of Lordly Might (a magic
 * Mace) are held as weapons. */
const MAGIC_BASES: Record<string, string> = {
  'berserker-axe': 'battleaxe',
  'dancing-sword': 'longsword',
  defender: 'longsword',
  'dragon-slayer': 'longsword',
  'energy-bow': 'longbow',
  'flame-tongue': 'longsword',
  'frost-brand': 'longsword',
  'giant-slayer': 'longsword',
  'holy-avenger': 'longsword',
  'luck-blade': 'longsword',
  'nine-lives-stealer': 'longsword',
  oathbow: 'longbow',
  'sword-of-life-stealing': 'longsword',
  'sword-of-sharpness': 'longsword',
  'sword-of-wounding': 'longsword',
  'vicious-weapon': 'longsword',
  'vorpal-sword': 'longsword',
  'weapon-1-2-or-3': 'longsword',
  'weapon-of-warning': 'longsword',
  'staff-of-power': 'quarterstaff',
  'staff-of-striking': 'quarterstaff',
  'staff-of-the-magi': 'quarterstaff',
  'staff-of-the-woodlands': 'quarterstaff',
  'staff-of-thunder-and-lightning': 'quarterstaff',
  'staff-of-withering': 'quarterstaff',
  'rod-of-lordly-might': 'mace',
  'adamantine-armor': 'chain-mail',
  'armor-1-2-or-3': 'chain-mail',
  'armor-of-resistance': 'chain-mail',
  'armor-of-vulnerability': 'chain-mail',
  'demon-armor': 'plate-armor',
  'dwarven-plate': 'plate-armor',
  'elven-chain': 'chain-shirt',
  'mithral-armor': 'chain-mail',
  'plate-armor-of-etherealness': 'plate-armor',
}

/** How an SRD magic item goes into the inventory: a weapon or armor on its base item (`magicItemId` set), or a plain
 * 'magic' item. */
export function magicBase(def: MagicItemDef, rules: Rules): { kind: 'weapon' | 'armor'; refId: string } | undefined {
  const base = def.baseItem ?? MAGIC_BASES[def.id]
  if (!base) return undefined
  if (rules.weapons.has(base)) return { kind: 'weapon', refId: base }
  if (rules.armor.has(base)) return { kind: 'armor', refId: base }
  return undefined
}

/** Requires Attunement: the SRD entry says so, or the custom item was created so. */
export function requiresAttunement(item: ItemInstance, rules: Rules): boolean {
  if (item.custom?.attunement !== undefined) return item.custom.attunement
  return !!magicItemOf(item, rules)?.attunement
}

/** Weapons and Shields work in hand (`equipped`); anything else when worn. */
export function isHoldable(item: ItemInstance, rules: Rules): boolean {
  if (item.kind === 'weapon') return true
  if (item.kind === 'armor') return rules.armor.get(item.refId ?? '')?.category === 'shield'
  return false
}

/** Why an item's effects don't apply right now (undefined = they do): worn (a weapon or Shield: in hand), and attuned
 * when it requires Attunement (Rules Glossary "Attunement", SRD p. 177: without it, only its nonmagical benefits). An
 * SRD item whose text says otherwise (`activeWhen`): "while attuned" (Thunderous Greatclub, Weapon of Warning) or "while
 * on your person" (Stone of Good Luck, Luck Blade). */
export function inactiveReason(item: ItemInstance, rules: Rules): I18n | undefined {
  const needsAttune = requiresAttunement(item, rules)
  const mode = magicEffectOf(item, rules)?.activeWhen
  if (mode) {
    if (item.location === 'stored') return { en: 'not on your person', fr: 'pas sur vous', es: 'no lo llevas encima' }
    if (needsAttune && !item.attuned) return { en: 'not attuned', fr: 'non harmonisé', es: 'no sintonizado' }
    if (mode === 'attuned' && !needsAttune && item.location !== 'worn')
      return { en: 'not worn', fr: 'non porté', es: 'no se lleva puesto' }
    return undefined
  }
  if (item.location !== 'worn') return { en: 'not worn', fr: 'non porté', es: 'no se lleva puesto' }
  if (isHoldable(item, rules) && !item.equipped)
    return { en: 'not in hand', fr: 'pas en main', es: 'no está en la mano' }
  if (needsAttune && !item.attuned) return { en: 'not attuned', fr: 'non harmonisé', es: 'no sintonizado' }
  return undefined
}

export function itemActive(item: ItemInstance, rules: Rules): boolean {
  return !inactiveReason(item, rules)
}

/** A custom weapon's statistics: the base weapon with the overrides (name, damage, type, properties, mastery). The id and
 * category stay the base weapon's (proficiency and Weapon Mastery follow the base weapon). */
export function customWeapon(def: WeaponDef, item: ItemInstance): WeaponDef {
  const c = item.custom
  if (!c) return def
  return {
    ...def,
    name: c.name ?? def.name,
    damage: c.damage?.trim() || def.damage,
    damageType: c.damageType ?? def.damageType,
    properties: c.properties ?? def.properties,
    mastery: c.mastery ?? def.mastery,
  }
}
