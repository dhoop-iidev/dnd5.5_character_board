// Starting equipment of level-1 creation (SRD 5.2.1 p. 20 "Choose Starting Equipment", FR p. 21): the class's options
// (each class's Core Traits table, "Starting Equipment") and the background's (each background, p. 83). Option A is a
// list of items plus GP, the last option only GP. `classes.json` / `backgrounds.json` carry the text; this table maps
// each printed item to the catalog (weapons.json, armor.json, gear.json). `text` repeats the English item as printed, so
// src/model/__tests__/startingEquipment.test.ts can check every option against the SRD text and every id against the
// catalog.
//
// Catalog notes:
// - A focus whose form is a Quarterstaff ("Druidic Focus (Quarterstaff)", "Arcane Focus (Quarterstaff)") is the
//   quarterstaff weapon: the focus tables say "Staff (also a Quarterstaff)" (p. 96–97), named after the focus.
// - Other focus forms (crystal, orb, sprig of mistletoe) are the focus gear entry with the form's weight (p. 96–97).
// - The Wizard's Spellbook has no catalog entry: a custom item, "a Tiny object that weighs 3 pounds" (Wizard
//   "Spellcasting", p. 78).
// - Packs (Explorer's Pack…) are one gear item, as the catalog lists them. Ammunition counts single pieces (20 Arrows =
//   quantity 20; the weight and price of a bundle of 20 are shared out, engine/items.ts `ammoBundle`).
import type { I18n } from '../data/types'
import type { ItemInstance } from './character'

export interface KitItem {
  /** The item as printed in the English SRD option ("20 Arrows"). */
  text: string
  kind: 'weapon' | 'armor' | 'gear' | 'custom'
  /** Catalog id (weapons/armor/gear); absent for a custom item. */
  id?: string
  qty?: number
  /** Taken in hand at creation (one weapon, and the Shield). */
  inHand?: boolean
  /** Name of a focus form, a book's topic, a custom item. */
  name?: I18n
  weightLb?: number
  /** A pick among gear ids (the Monk's Artisan's Tools or Musical Instrument); `id` is the default. */
  choose?: string[]
}

export interface KitOption {
  letter: 'A' | 'B' | 'C'
  items: KitItem[]
  gp: number
}

const w = (text: string, id: string, extra: Partial<KitItem> = {}): KitItem => ({ text, kind: 'weapon', id, ...extra })
const a = (text: string, id: string, extra: Partial<KitItem> = {}): KitItem => ({ text, kind: 'armor', id, ...extra })
const g = (text: string, id: string, extra: Partial<KitItem> = {}): KitItem => ({ text, kind: 'gear', id, ...extra })
const gpOnly = (letter: KitOption['letter'], gp: number): KitOption => ({ letter, items: [], gp })

/** Artisan's Tools (SRD p. 93–94, the tools with an "Artisan's Tools" heading) and the Musical Instrument. */
export const ARTISAN_OR_INSTRUMENT = [
  'musical-instrument',
  'alchemists-supplies',
  'brewers-supplies',
  'calligraphers-supplies',
  'carpenters-tools',
  'cartographers-tools',
  'cobblers-tools',
  'cooks-utensils',
  'glassblowers-tools',
  'jewelers-tools',
  'leatherworkers-tools',
  'masons-tools',
  'painters-supplies',
  'potters-tools',
  'smiths-tools',
  'tinkers-tools',
  'weavers-tools',
  'woodcarvers-tools',
]

const STAFF_ARCANE: I18n = {
  en: 'Arcane Focus (Quarterstaff)',
  fr: 'Focaliseur arcanique (bâton de combat)',
  es: 'Canalizador arcano (bastón)',
}
const STAFF_DRUIDIC: I18n = {
  en: 'Druidic Focus (Quarterstaff)',
  fr: 'Focaliseur druidique (bâton de combat)',
  es: 'Canalizador druídico (bastón)',
}

export const CLASS_KITS: Record<string, KitOption[]> = {
  barbarian: [
    {
      letter: 'A',
      gp: 15,
      items: [
        w('Greataxe', 'greataxe', { inHand: true }),
        w('4 Handaxes', 'handaxe', { qty: 4 }),
        g('Explorer’s Pack', 'explorers-pack'),
      ],
    },
    gpOnly('B', 75),
  ],
  bard: [
    {
      letter: 'A',
      gp: 19,
      items: [
        a('Leather Armor', 'leather-armor'),
        w('2 Daggers', 'dagger', { qty: 2, inHand: true }),
        g('Musical Instrument of your choice', 'musical-instrument'),
        g('Entertainer’s Pack', 'entertainers-pack'),
      ],
    },
    gpOnly('B', 90),
  ],
  cleric: [
    {
      letter: 'A',
      gp: 7,
      items: [
        a('Chain Shirt', 'chain-shirt'),
        a('Shield', 'shield', { inHand: true }),
        w('Mace', 'mace', { inHand: true }),
        g('Holy Symbol', 'holy-symbol'),
        g('Priest’s Pack', 'priests-pack'),
      ],
    },
    gpOnly('B', 110),
  ],
  druid: [
    {
      letter: 'A',
      gp: 9,
      items: [
        a('Leather Armor', 'leather-armor'),
        a('Shield', 'shield', { inHand: true }),
        w('Sickle', 'sickle', { inHand: true }),
        w('Druidic Focus (Quarterstaff)', 'quarterstaff', { name: STAFF_DRUIDIC }),
        g('Explorer’s Pack', 'explorers-pack'),
        g('Herbalism Kit', 'herbalism-kit'),
      ],
    },
    gpOnly('B', 50),
  ],
  fighter: [
    {
      letter: 'A',
      gp: 4,
      items: [
        a('Chain Mail', 'chain-mail'),
        w('Greatsword', 'greatsword', { inHand: true }),
        w('Flail', 'flail'),
        w('8 Javelins', 'javelin', { qty: 8 }),
        g('Dungeoneer’s Pack', 'dungeoneers-pack'),
      ],
    },
    {
      letter: 'B',
      gp: 11,
      items: [
        a('Studded Leather Armor', 'studded-leather-armor'),
        w('Scimitar', 'scimitar'),
        w('Shortsword', 'shortsword'),
        w('Longbow', 'longbow', { inHand: true }),
        g('20 Arrows', 'arrows', { qty: 20 }),
        g('Quiver', 'quiver'),
        g('Dungeoneer’s Pack', 'dungeoneers-pack'),
      ],
    },
    gpOnly('C', 155),
  ],
  monk: [
    {
      letter: 'A',
      gp: 11,
      items: [
        w('Spear', 'spear', { inHand: true }),
        w('5 Daggers', 'dagger', { qty: 5 }),
        g('Artisan’s Tools or Musical Instrument chosen for the tool proficiency above', 'musical-instrument', {
          choose: ARTISAN_OR_INSTRUMENT,
        }),
        g('Explorer’s Pack', 'explorers-pack'),
      ],
    },
    gpOnly('B', 50),
  ],
  paladin: [
    {
      letter: 'A',
      gp: 9,
      items: [
        a('Chain Mail', 'chain-mail'),
        a('Shield', 'shield', { inHand: true }),
        w('Longsword', 'longsword', { inHand: true }),
        w('6 Javelins', 'javelin', { qty: 6 }),
        g('Holy Symbol', 'holy-symbol'),
        g('Priest’s Pack', 'priests-pack'),
      ],
    },
    gpOnly('B', 150),
  ],
  ranger: [
    {
      letter: 'A',
      gp: 7,
      items: [
        a('Studded Leather Armor', 'studded-leather-armor'),
        w('Scimitar', 'scimitar'),
        w('Shortsword', 'shortsword'),
        w('Longbow', 'longbow', { inHand: true }),
        g('20 Arrows', 'arrows', { qty: 20 }),
        g('Quiver', 'quiver'),
        g('Druidic Focus (sprig of mistletoe)', 'druidic-focus', {
          name: {
            en: 'Druidic Focus (sprig of mistletoe)',
            fr: 'Focaliseur druidique (branche de gui)',
            es: 'Canalizador druídico (rama de muérdago)',
          },
          weightLb: 0,
        }),
        g('Explorer’s Pack', 'explorers-pack'),
      ],
    },
    gpOnly('B', 150),
  ],
  rogue: [
    {
      letter: 'A',
      gp: 8,
      items: [
        a('Leather Armor', 'leather-armor'),
        w('2 Daggers', 'dagger', { qty: 2 }),
        w('Shortsword', 'shortsword', { inHand: true }),
        w('Shortbow', 'shortbow'),
        g('20 Arrows', 'arrows', { qty: 20 }),
        g('Quiver', 'quiver'),
        g('Thieves’ Tools', 'thieves-tools'),
        g('Burglar’s Pack', 'burglars-pack'),
      ],
    },
    gpOnly('B', 100),
  ],
  sorcerer: [
    {
      letter: 'A',
      gp: 28,
      items: [
        w('Spear', 'spear', { inHand: true }),
        w('2 Daggers', 'dagger', { qty: 2 }),
        g('Arcane Focus (crystal)', 'arcane-focus', {
          name: {
            en: 'Arcane Focus (crystal)',
            fr: 'Focaliseur arcanique (cristal)',
            es: 'Canalizador arcano (cristal)',
          },
          weightLb: 1,
        }),
        g('Dungeoneer’s Pack', 'dungeoneers-pack'),
      ],
    },
    gpOnly('B', 50),
  ],
  warlock: [
    {
      letter: 'A',
      gp: 15,
      items: [
        a('Leather Armor', 'leather-armor'),
        w('Sickle', 'sickle', { inHand: true }),
        w('2 Daggers', 'dagger', { qty: 2 }),
        g('Arcane Focus (orb)', 'arcane-focus', {
          name: { en: 'Arcane Focus (orb)', fr: 'Focaliseur arcanique (orbe)', es: 'Canalizador arcano (orbe)' },
          weightLb: 3,
        }),
        g('Book (occult lore)', 'book', {
          name: { en: 'Book (occult lore)', fr: 'Livre (savoir occulte)', es: 'Libro (de conocimiento oculto)' },
        }),
        g('Scholar’s Pack', 'scholars-pack'),
      ],
    },
    gpOnly('B', 100),
  ],
  wizard: [
    {
      letter: 'A',
      gp: 5,
      items: [
        w('2 Daggers', 'dagger', { qty: 2 }),
        w('Arcane Focus (Quarterstaff)', 'quarterstaff', { name: STAFF_ARCANE, inHand: true }),
        g('Robe', 'robe'),
        {
          text: 'Spellbook',
          kind: 'custom',
          name: { en: 'Spellbook', fr: 'Grimoire', es: 'Libro de conjuros' },
          weightLb: 3,
        },
        g('Scholar’s Pack', 'scholars-pack'),
      ],
    },
    gpOnly('B', 55),
  ],
}

export const BACKGROUND_KITS: Record<string, KitOption[]> = {
  acolyte: [
    {
      letter: 'A',
      gp: 8,
      items: [
        g('Calligrapher’s Supplies', 'calligraphers-supplies'),
        g('Book (prayers)', 'book', {
          name: { en: 'Book (prayers)', fr: 'Livre (de prières)', es: 'Libro (de oraciones)' },
        }),
        g('Holy Symbol', 'holy-symbol'),
        g('Parchment (10 sheets)', 'parchment', { qty: 10 }),
        g('Robe', 'robe'),
      ],
    },
    gpOnly('B', 50),
  ],
  criminal: [
    {
      letter: 'A',
      gp: 16,
      items: [
        w('2 Daggers', 'dagger', { qty: 2 }),
        g('Thieves’Tools', 'thieves-tools'),
        g('Crowbar', 'crowbar'),
        g('2 Pouches', 'pouch', { qty: 2 }),
        g('Traveler’s Clothes', 'clothes-travelers'),
      ],
    },
    gpOnly('B', 50),
  ],
  sage: [
    {
      letter: 'A',
      gp: 8,
      items: [
        w('Quarterstaff', 'quarterstaff'),
        g('Calligrapher’s Supplies', 'calligraphers-supplies'),
        g('Book (history)', 'book', {
          name: { en: 'Book (history)', fr: 'Livre (d’histoire)', es: 'Libro (de historia)' },
        }),
        g('Parchment (8 sheets)', 'parchment', { qty: 8 }),
        g('Robe', 'robe'),
      ],
    },
    gpOnly('B', 50),
  ],
  soldier: [
    {
      letter: 'A',
      gp: 14,
      items: [
        w('Spear', 'spear'),
        w('Shortbow', 'shortbow'),
        g('20 Arrows', 'arrows', { qty: 20 }),
        g('Gaming Set (same as above)', 'gaming-set'),
        g('Healer’s Kit', 'healers-kit'),
        g('Quiver', 'quiver'),
        g('Traveler’s Clothes', 'clothes-travelers'),
      ],
    },
    gpOnly('B', 50),
  ],
}

/** Gear that is worn or ready on the body rather than in the backpack: clothes, a quiver and its arrows, a holy symbol
 * (amulet), a spellcasting focus. Armor, Shields and weapons are always worn. */
const WORN_GEAR = new Set([
  'robe',
  'clothes-travelers',
  'quiver',
  'arrows',
  'holy-symbol',
  'arcane-focus',
  'druidic-focus',
])

export interface KitChoice {
  classId: string
  /** Letter of the class option ('A', 'B', 'C'). */
  classOption: string
  backgroundId: string
  backgroundOption: string
  /** Picks for items with `choose`, keyed by the item's `text`. */
  picks?: Record<string, string>
}

const optionOf = (kits: KitOption[] | undefined, letter: string) => kits?.find((o) => o.letter === letter)

/** The inventory and GP the chosen options give. Identical catalog items are merged (Rogue + Criminal: 4 Daggers); one
 * weapon is taken in hand (the class's, else the background's first), and the Shield. */
export function kitInventory(choice: KitChoice): { items: ItemInstance[]; gp: number } {
  const cls = optionOf(CLASS_KITS[choice.classId], choice.classOption)
  const bg = optionOf(BACKGROUND_KITS[choice.backgroundId], choice.backgroundOption)
  const items: ItemInstance[] = []
  let n = 0
  const add = (k: KitItem, fromBackground: boolean) => {
    const id = k.choose ? (choice.picks?.[k.text] ?? k.id) : k.id
    const qty = k.qty ?? 1
    const plain = k.kind !== 'custom' && !k.name && k.weightLb === undefined
    const same = plain && items.find((i) => i.kind === k.kind && i.refId === id && !i.custom)
    if (same) {
      same.quantity += qty
      return
    }
    const worn = k.kind === 'weapon' || k.kind === 'armor' || WORN_GEAR.has(id ?? '')
    const item: ItemInstance = {
      uid: `kit${++n}`,
      kind: k.kind,
      quantity: qty,
      location: worn ? 'worn' : 'carried',
    }
    if (id) item.refId = id
    if (k.inHand && !fromBackground) item.equipped = true
    if (k.name || k.weightLb !== undefined)
      item.custom = {
        ...(k.name ? { name: k.name } : {}),
        ...(k.weightLb !== undefined ? { weightLb: k.weightLb } : {}),
      }
    items.push(item)
  }
  for (const k of cls?.items ?? []) add(k, false)
  for (const k of bg?.items ?? []) add(k, true)
  // No weapon in hand from the class (option B): take the background's first weapon.
  if (!items.some((i) => i.kind === 'weapon' && i.equipped)) {
    const first = items.find((i) => i.kind === 'weapon')
    if (first) first.equipped = true
  }
  return { items, gp: (cls?.gp ?? 0) + (bg?.gp ?? 0) }
}
