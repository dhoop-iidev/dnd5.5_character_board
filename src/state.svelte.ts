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
  if (!app.loaded) return // welcome screen: nothing to save
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.character))
  } catch {
    // Private mode or quota: nothing to do, the JSON export still works.
  }
}

/** Open an imported character (already migrated). */
export function openCharacter(character: Character) {
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
    save()
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
