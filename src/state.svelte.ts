// App state: the current character (autosaved in the browser), derived sheet and rule warnings.
import { rules } from './data/rules'
import type { I18n, Lang } from './data/types'
import type { Character } from './model/character'
import { migrate } from './model/migrate'
import { compute } from './engine/compute'
import { validate } from './engine/validate'
import { withCustom } from './model/custom'
import { reconcile, structureOf } from './model/reconcile'
import { untrack } from 'svelte'
import { installEmbedded, installPack, withPackContent, type ContentPack } from './model/packs'
import { storedPacks } from './model/packStore'

const STORAGE_KEY = 'dnd55-playboard:character'

// No character ships with the app (the user's character stays private): until one is imported, the app
// shows the welcome screen and `character` is a placeholder that only carries the interface language.
function placeholder(): Character {
  const nav = navigator.language ?? ''
  const lang: Lang = nav.startsWith('fr') ? 'fr' : nav.startsWith('es') ? 'es' : 'en'
  return { settings: { lang } } as unknown as Character
}

function load(): Character | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    // Storage unavailable or corrupt: start from the welcome screen.
  }
  return null
}

const stored = load()
export const app = $state<{ character: Character; loaded: boolean }>({
  character: stored ?? placeholder(),
  loaded: !!stored,
})

/** Content packs stored in this browser (house rule #7), for the packs panel. */
export const packs = $state<{ ready: boolean; stored: Pick<ContentPack, 'id' | 'version' | 'book'>[] }>({
  ready: false,
  stored: [],
})

/** Before the app mounts (main.ts): install the stored packs, then the pack entries the stored character carries.
 * Nothing is saved until then, so a save can't drop the entries of a pack not installed yet. */
export async function initPacks() {
  const list = await storedPacks()
  for (const p of list) installPack(rules, p)
  packs.stored = list.map((p) => ({ id: p.id, version: p.version, book: p.book }))
  if (app.loaded) installEmbedded(rules, app.character)
  packs.ready = true
}

/** The character as written to a file or to the browser: with a copy of the pack entries it uses. */
export function serialize(character: Character, space?: number): string {
  return JSON.stringify(withPackContent(character, rules), null, space)
}

/** The rules with the character's custom feats (house rule #4): use it wherever feats are listed. */
const rulesState = $derived(withCustom(rules, app.character))
const sheetState = $derived(compute(app.character, rules))
const warningState = $derived(validate(app.character, rules))

/** Computed sheet and warnings (modules can't export derived state directly). */
export const view = {
  get rules() {
    return rulesState
  },
  get sheet() {
    return sheetState
  },
  get warnings() {
    return warningState
  },
}

export function lang(): Lang {
  return app.character.settings.lang
}

/** Pick the text in a given language, falling back to English when that translation is missing or empty. */
export function trIn(text: I18n | undefined, l: Lang): string {
  if (!text) return ''
  return text[l] || text.en
}

/** Pick the text in the current language (English when missing, e.g. Spanish not yet provided). */
export function tr(text: I18n | undefined): string {
  return trIn(text, app.character.settings.lang)
}

export function save() {
  if (!app.loaded || !packs.ready) return // welcome screen, or packs not installed yet: nothing to save
  try {
    localStorage.setItem(STORAGE_KEY, serialize(app.character))
  } catch {
    // Private mode or quota: nothing to do, the JSON export still works.
  }
}

/** Open an imported character (already migrated). */
export function openCharacter(character: Character) {
  installEmbedded(rules, character)
  app.character = character
  app.loaded = true
}

/** Close the character: forget it in this browser and go back to the welcome screen. */
export function closeCharacter() {
  const lang = app.character.settings.lang
  app.loaded = false
  app.character = { settings: { lang } } as unknown as Character
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

$effect.root(() => {
  $effect(() => {
    JSON.stringify(app.character) // track deep changes
    if (packs.ready) save()
  })
  // After a structural change (a level's class, subclass or feat, a level removed, species, background, a granted
  // feat), remove the choices that no longer belong to anything (model/reconcile.ts). Not on load or import: a file is
  // never changed just by opening it (its leftovers show as warnings).
  let last: { character: Character; structure: string } | undefined
  $effect(() => {
    if (!app.loaded) return
    const character = app.character
    const structure = structureOf(character)
    if (last?.character === character && last.structure !== structure) untrack(() => reconcile(character, rules))
    last = { character, structure }
  })
})
