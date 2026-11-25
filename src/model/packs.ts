// Content packs (house rule #7, user decision 2026-11-25): the content of a book outside the SRD (Player's Handbook
// 2024, Monsters of the Multiverse…), one pack per book, in the same shapes as the SRD data (src/data/types.ts) plus its
// effects (docs/effects.md) and one-line summaries. Packs are private files of the player's own books: nothing of them
// ships with the app or lives in this repository (docs/packs.md). The app loads them into the rules registry at start
// (model/packStore.ts, the browser's IndexedDB), and every saved character embeds the pack entries it uses
// (`Character.packContent`), so its file opens on any device, even one without the pack.
import type { Rules } from '../data/rules'
import type {
  BackgroundDef,
  ClassOptionDef,
  EffectDef,
  FeatDef,
  I18n,
  MagicItemDef,
  SpeciesDef,
  SpellDef,
  SubclassDef,
} from '../data/types'
import type { Character } from './character'
import { BACKGROUND_KITS, type KitOption } from './startingEquipment'

export const PACK_KIND = 'content-pack'
export const PACK_FORMAT = 1
export const PACK_HOUSE_RULE = 7

/** A background with its starting equipment options (A: items + GP, B: 50 GP), as `BACKGROUND_KITS` has them. */
export interface PackBackground extends BackgroundDef {
  kits?: KitOption[]
}
/** A subclass and the class it belongs to. */
export interface PackSubclass extends SubclassDef {
  classId: string
}
/** A class option (Eldritch Invocation, Metamagic…) for `ClassDef.options[kind]`. */
export interface PackClassOption extends ClassOptionDef {
  classId: string
  kind: string
}

export interface ContentPack {
  kind: typeof PACK_KIND
  format: typeof PACK_FORMAT
  /** 'phb-2024', 'motm'. */
  id: string
  /** Date of the build ('2026-11-25'): a newer pack replaces the older one. */
  version: string
  /** The book's title, shown in source lines ("Player's Handbook (2024) p. 201"). */
  book: I18n
  species?: SpeciesDef[]
  backgrounds?: PackBackground[]
  feats?: FeatDef[]
  spells?: SpellDef[]
  subclasses?: PackSubclass[]
  classOptions?: PackClassOption[]
  magicItems?: MagicItemDef[]
  effects?: EffectDef[]
  /** One-line summaries, keyed as custom/summaries.json (`species:<id>`, `trait:<id>`, `feat:<id>`, `spell:<id>`…). */
  summaries?: Record<string, I18n>
}

type EntryKind = 'species' | 'backgrounds' | 'feats' | 'spells' | 'subclasses' | 'classOptions' | 'magicItems'
const ENTRY_KINDS: EntryKind[] = [
  'species',
  'backgrounds',
  'feats',
  'spells',
  'subclasses',
  'classOptions',
  'magicItems',
]

/** The packs installed in this session: their metadata, and which pack each entry came from (`<kind>:<id>`). */
const installed = new Map<string, Pick<ContentPack, 'id' | 'version' | 'book'>>()
const origin = new Map<string, string>()
/** Every entry installed from a pack, for embedding (kept even when the entry came from a character's copy). */
const entries = new Map<string, { kind: EntryKind; value: { id: string } }>()

export const installedPacks = () => [...installed.values()]
export const packBook = (id: string | undefined) => (id ? installed.get(id)?.book : undefined)

const isI18n = (v: unknown): v is I18n => !!v && typeof (v as I18n).en === 'string'

/** Checks the shape of a pack file; throws with a short reason. */
export function readPack(raw: unknown): ContentPack {
  const p = raw as Partial<ContentPack>
  if (!p || p.kind !== PACK_KIND) throw new Error('not a content pack file')
  if (p.format !== PACK_FORMAT) throw new Error(`unknown pack format ${String(p.format)}`)
  if (!p.id || typeof p.id !== 'string') throw new Error('the pack has no id')
  if (!isI18n(p.book)) throw new Error('the pack has no book title')
  for (const k of [...ENTRY_KINDS, 'effects'] as const) {
    const list = p[k]
    if (list === undefined) continue
    if (!Array.isArray(list)) throw new Error(`${k} is not a list`)
    for (const e of list as { id?: unknown; name?: unknown }[])
      if (!e || typeof e.id !== 'string') throw new Error(`${k}: an entry has no id`)
  }
  if (p.summaries !== undefined && (typeof p.summaries !== 'object' || Array.isArray(p.summaries)))
    throw new Error('summaries is not an object')
  return p as ContentPack
}

/** Class definitions are shared with the imported JSON (buildRules indexes the same objects): before adding a spell,
 * a subclass or an option to one, give the rules their own copy of it. */
const owned = new WeakSet<object>()
function ownClass(rules: Rules, id: string) {
  const cls = rules.classes.get(id)
  if (!cls || owned.has(cls)) return cls
  const copy = {
    ...cls,
    subclasses: [...cls.subclasses],
    spellList: cls.spellList?.map((r) => ({ ...r, spells: [...r.spells] })),
    options: cls.options ? Object.fromEntries(Object.entries(cls.options).map(([k, v]) => [k, [...v]])) : undefined,
  }
  owned.add(copy)
  rules.classes.set(id, copy)
  return copy
}

/** Adds a pack's content to the rules (in place). Entries whose id already exists (SRD, or an earlier pack) are kept as
 * they are: the first wins. Returns the ids skipped that way. */
export function installPack(rules: Rules, pack: ContentPack): string[] {
  const skipped: string[] = []
  if (!installed.has(pack.id)) installed.set(pack.id, { id: pack.id, version: pack.version, book: pack.book })
  const add = <T extends { id: string }>(kind: EntryKind, map: Map<string, T>, list: T[] | undefined) => {
    for (const e of list ?? []) {
      if (map.has(e.id)) {
        if (origin.get(`${kind}:${e.id}`) !== pack.id) skipped.push(`${kind}:${e.id}`)
        continue
      }
      map.set(e.id, e)
      note(kind, e, pack.id)
    }
  }
  add('species', rules.species, pack.species)
  add('feats', rules.feats, pack.feats)
  add('magicItems', rules.magicItems, pack.magicItems)
  for (const b of pack.backgrounds ?? []) {
    if (rules.backgrounds.has(b.id)) {
      if (origin.get(`backgrounds:${b.id}`) !== pack.id) skipped.push(`backgrounds:${b.id}`)
      continue
    }
    rules.backgrounds.set(b.id, b)
    if (b.kits?.length && !BACKGROUND_KITS[b.id]) BACKGROUND_KITS[b.id] = b.kits
    note('backgrounds', b, pack.id)
  }
  for (const s of pack.spells ?? []) {
    if (rules.spells.has(s.id)) {
      if (origin.get(`spells:${s.id}`) !== pack.id) skipped.push(`spells:${s.id}`)
      continue
    }
    rules.spells.set(s.id, s)
    // The class spell lists (Spells pane, prepared-spell checks) are the classes' tables: add the spell to each.
    for (const cid of s.classes) {
      const cls = ownClass(rules, cid)
      if (!cls) continue
      cls.spellList ??= []
      let row = cls.spellList.find((r) => r.level === s.level)
      if (!row) cls.spellList.push((row = { level: s.level, spells: [] }))
      if (!row.spells.includes(s.id)) row.spells.push(s.id)
    }
    note('spells', s, pack.id)
  }
  for (const sc of pack.subclasses ?? []) {
    const cls = ownClass(rules, sc.classId)
    if (!cls) {
      skipped.push(`subclasses:${sc.id}`)
      continue
    }
    if (cls.subclasses.some((x) => x.id === sc.id)) {
      if (origin.get(`subclasses:${sc.id}`) !== pack.id) skipped.push(`subclasses:${sc.id}`)
      continue
    }
    cls.subclasses.push(sc)
    note('subclasses', sc, pack.id)
  }
  for (const o of pack.classOptions ?? []) {
    const cls = ownClass(rules, o.classId)
    if (!cls) {
      skipped.push(`classOptions:${o.id}`)
      continue
    }
    cls.options ??= {}
    const list = (cls.options[o.kind] ??= [])
    if (list.some((x) => x.id === o.id)) {
      if (origin.get(`classOptions:${o.id}`) !== pack.id) skipped.push(`classOptions:${o.id}`)
      continue
    }
    list.push(o)
    note('classOptions', o, pack.id)
  }
  for (const e of pack.effects ?? []) if (!rules.effects.has(e.id)) rules.effects.set(e.id, e)
  for (const [k, v] of Object.entries(pack.summaries ?? {})) if (!rules.summaries.has(k)) rules.summaries.set(k, v)
  return skipped
}

function note(kind: EntryKind, value: { id: string }, packId: string) {
  origin.set(`${kind}:${value.id}`, packId)
  entries.set(`${kind}:${value.id}`, { kind, value })
}

/** Installs the pack entries a character file carries (those of packs not loaded on this device). */
export function installEmbedded(rules: Rules, char: Pick<Character, 'packContent'> | undefined) {
  for (const raw of char?.packContent ?? []) {
    try {
      installPack(rules, readPack(raw))
    } catch {
      // A damaged copy: the character opens with its entries missing (the rule checks say what).
    }
  }
}

/** Every string value of the character (ids of what it picked), except its embedded copy and its pictures. */
function idsOf(char: Character): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, key?: string) => {
    if (key === 'packContent' || key === 'images') return
    if (typeof v === 'string') out.add(v)
    else if (Array.isArray(v)) for (const x of v) walk(x)
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(char)
  return out
}

/** Spell ids named by an effect (always-prepared spells of a trait, a feat, a subclass feature, an option). */
function spellsOfEffect(e: EffectDef | undefined, out: Set<string>) {
  if (!e) return
  const add = (s?: EffectDef['spells']) => {
    for (const id of s?.always ?? []) out.add(id)
    for (const l of Object.values(s?.byLevel ?? {})) for (const id of l) out.add(id)
  }
  add(e.spells)
  for (const c of e.choices ?? []) for (const o of Object.values(c.options ?? {})) add(o.spells)
}

/** The pack entries the character uses, one partial pack per book, to store in its file: what it picked (any string
 * of the file equal to an entry id), the Origin feat of a picked background, the spells its picked entries give, and
 * the effects and summaries of all of them. */
export function packContentOf(char: Character, rules: Rules): ContentPack[] {
  if (!entries.size) return []
  const ids = idsOf(char)
  const picked = new Map<string, { kind: EntryKind; value: { id: string } }>()
  const pick = (key: string) => {
    const e = entries.get(key)
    if (e) picked.set(key, e)
  }
  for (const [key, e] of entries) if (ids.has(e.value.id)) picked.set(key, e)
  for (const { kind, value } of [...picked.values()]) {
    if (kind === 'backgrounds') pick(`feats:${(value as BackgroundDef).feat}`)
    if (kind === 'subclasses')
      for (const l of (value as SubclassDef).spells ?? []) for (const id of l.spells) pick(`spells:${id}`)
  }
  /** The picked entry an effect or summary id belongs to. */
  const related = (id: string, kind: EntryKind, v: string) =>
    id === v ||
    id.startsWith(`${v}:`) ||
    (kind === 'feats' && (id === `feat:${v}` || id.startsWith(`feat:${v}:`))) ||
    (kind === 'classOptions' && id.endsWith(`:${v}`))
  const ownerOf = (id: string): string | undefined => {
    for (const [key, { kind, value }] of picked) if (related(id, kind, value.id)) return origin.get(key)
    return undefined
  }
  const effects: [string, EffectDef][] = []
  const spells = new Set<string>()
  for (const e of rules.effects.values()) {
    const pid = ownerOf(e.id)
    if (!pid) continue
    effects.push([pid, e])
    spellsOfEffect(e, spells)
  }
  for (const id of spells) pick(`spells:${id}`)

  const byPack = new Map<string, ContentPack>()
  const packOf = (packId: string) => {
    let p = byPack.get(packId)
    if (!p) {
      const meta = installed.get(packId)!
      p = { kind: PACK_KIND, format: PACK_FORMAT, id: meta.id, version: meta.version, book: meta.book }
      byPack.set(packId, p)
    }
    return p
  }
  for (const [key, { kind, value }] of picked) {
    const p = packOf(origin.get(key)!)
    ;((p[kind] ??= []) as { id: string }[]).push(value)
  }
  for (const [pid, e] of effects) (packOf(pid).effects ??= []).push(e)
  // Summaries: `<kind>:<id>` keys whose id is a picked entry or one of its parts (`trait:<species>:…`).
  for (const [k, v] of rules.summaries) {
    const sid = k.slice(k.indexOf(':') + 1)
    for (const [key, { value }] of picked)
      if (sid === value.id || sid.startsWith(`${value.id}:`)) {
        ;(packOf(origin.get(key)!).summaries ??= {})[k] = v
        break
      }
  }
  return [...byPack.values()]
}

/** The character as saved: with a fresh copy of the pack entries it uses (none when it uses none). */
export function withPackContent(char: Character, rules: Rules): Character {
  const content = packContentOf(char, rules)
  const out = { ...char }
  if (content.length) out.packContent = content
  else delete out.packContent
  return out
}

/** Forget every installed pack (tests). */
export function resetPacks() {
  installed.clear()
  origin.clear()
  entries.clear()
}
