// Languages (SRD 5.2.1 p. 20 "Choose Languages", FR p. 21–22, ES p. 22): every character knows Common plus two
// languages from the Standard Languages table; the Rare Languages table lists the others. The character stores what
// the player picked in `identity.languages`: a language id ('elvish') for a table language, or free text (a language
// from another book, or an older save's "Common"), which is matched to the table in any of the three languages.
import type { I18n, Source } from '../data/types'

export interface LanguageDef {
  id: string
  name: I18n
  rare?: boolean
}

export const SRC_LANGUAGES: Source = {
  page: 20,
  frPage: 21,
  esPage: 22,
  section: 'Character Creation > Step 2: Character Origin > Choose Languages',
}

const L = (id: string, en: string, fr: string, es: string, rare = false): LanguageDef => ({
  id,
  name: { en, fr, es },
  ...(rare ? { rare } : {}),
})

export const LANGUAGES: LanguageDef[] = [
  L('common', 'Common', 'Commun', 'Común'),
  L('common-sign-language', 'Common Sign Language', 'Langue multiverselle des signes', 'Lengua de signos común'),
  L('draconic', 'Draconic', 'Draconique', 'Dracónico'),
  L('dwarvish', 'Dwarvish', 'Nain', 'Enano'),
  L('elvish', 'Elvish', 'Elfique', 'Elfo'),
  L('giant', 'Giant', 'Gigant', 'Gigante'),
  L('gnomish', 'Gnomish', 'Gnome', 'Gnomo'),
  L('goblin', 'Goblin', 'Gobelin', 'Goblin'),
  L('halfling', 'Halfling', 'Halfelin', 'Mediano'),
  L('orc', 'Orc', 'Orc', 'Orco'),
  L('abyssal', 'Abyssal', 'Abyssal', 'Abisal', true),
  L('celestial', 'Celestial', 'Céleste', 'Celestial', true),
  L('deep-speech', 'Deep Speech', 'Profond', 'Habla de las profundidades', true),
  L('druidic', 'Druidic', 'Druidique', 'Druídico', true),
  L('infernal', 'Infernal', 'Infernal', 'Infernal', true),
  L('primordial', 'Primordial', 'Primordial', 'Primordial', true),
  L('sylvan', 'Sylvan', 'Sylvestre', 'Silvano', true),
  L('thieves-cant', 'Thieves’ Cant', 'Argot des voleurs', 'Jerga de ladrones', true),
  L('undercommon', 'Undercommon', 'Commun des profondeurs', 'Infracomún', true),
]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim()

/** The table language a stored value stands for (its id, or its name in English, French or Spanish). */
export function languageOf(value: string): LanguageDef | undefined {
  const v = norm(value)
  return LANGUAGES.find((l) => l.id === v || [l.name.en, l.name.fr, l.name.es ?? ''].some((n) => norm(n) === v))
}

/** A stored value as shown to the player: the table name in their language, else the text as entered. */
export const languageName = (value: string): I18n => languageOf(value)?.name ?? { en: value, fr: value, es: value }

/** Languages a character knows at creation: Common plus two (p. 20). */
export const STARTING_LANGUAGES = 3
