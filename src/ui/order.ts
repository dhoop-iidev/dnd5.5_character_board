// Stable order of the lists on the character sheet: sorted by the English name in every language, so an item keeps its
// position when the player switches EN / FR (and later ES). Long pickers where the player searches by name stay sorted
// in the displayed language.
import type { I18n } from '../data/types'

/** Comparator on the English name (`name.en`). */
export const byEnglishName = <T extends { name: I18n }>(a: T, b: T): number =>
  a.name.en.localeCompare(b.name.en, 'en', { sensitivity: 'base' })
