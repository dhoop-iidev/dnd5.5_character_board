// "＋ New custom …" in the Builder's menus (user request 2026-11-23): a custom species (house rule #6) or a custom feat
// (house rule #4) is created where it is picked, the species menu of the Origin step, the custom background's Origin
// feat, a level's feat, and edited right there (ui/CustomSpeciesEditor.svelte, ui/CustomFeatsEditor.svelte with
// `only`). The full lists stay under the progression in the General pane.
import type { FeatCategory, I18n } from '../data/types'
import type { Character } from '../model/character'
import { newCustomFeat } from '../model/customFeats'
import { newCustomSpecies } from '../model/customSpecies'

/** Value of the "＋ New custom …" option of a menu. */
export const NEW_CUSTOM = '__new-custom__'

export const UNNAMED: I18n = { en: '(unnamed)', fr: '(sans nom)', es: '(sin nombre)' }

/** Adds an empty custom feat of that category to the character and returns its id. */
export function addCustomFeat(c: Character, category: FeatCategory): string {
  c.customFeats ??= []
  const f = { ...newCustomFeat(c.customFeats), category }
  c.customFeats.push(f)
  return f.id
}

/** Adds an empty custom species to the character and returns its id. */
export function addCustomSpecies(c: Character): string {
  c.customSpecies ??= []
  const sp = newCustomSpecies(c.customSpecies)
  c.customSpecies.push(sp)
  return sp.id
}
