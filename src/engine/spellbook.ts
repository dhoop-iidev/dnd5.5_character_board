// Wizard spellbook, level by level (SRD 5.2.1 p. 78 "Spellbook", FR p. 59 "Grimoire"): "It starts with six level 1
// Wizard spells of your choice. Whenever you gain a Wizard level after 1, add two Wizard spells of your choice to your
// spellbook. Each of these spells must be of a level for which you have spell slots, as shown in the Wizard Features
// table." The spells added at a level are `LevelEntry.spellsLearned` of that Wizard level; spells copied into the book
// ("Expanding the Book", p. 78) or entered without a level are `SpellcastingState.spellbook`.
import type { Rules } from '../data/rules'
import type { Source } from '../data/types'
import type { Character } from '../model/character'
import { esOf } from './stacking'

export const SRC_SPELLBOOK: Source = { page: 78, frPage: 59, section: 'Wizard > Spellcasting > Spellbook' }
export const WIZARD = 'wizard'

export interface SpellbookLevel {
  /** Index in `character.levels` (character level − 1). */
  index: number
  /** Wizard level reached at that character level. */
  wizardLevel: number
  /** Spells the rules add at that Wizard level: 6 at level 1, 2 after. */
  expected: number
  /** Highest spell level with a slot in the Wizard Features table at that Wizard level. */
  maxSpellLevel: number
  learned: string[]
}

export interface SpellbookProblem {
  index: number
  id?: string
  en: string
  fr: string
  es: string
}

/** Highest spell level with a slot in a class's table row (the class alone). */
function highestSlot(rules: Rules, classId: string, classLevel: number): number {
  const row = rules.classes.get(classId)?.table[classLevel - 1]
  return (row?.slots ?? []).filter((n) => n > 0).length
}

/** The Wizard levels of the record, each with the spells it added to the book. */
export function spellbookLevels(char: Character, rules: Rules): SpellbookLevel[] {
  const out: SpellbookLevel[] = []
  let n = 0
  char.levels.forEach((l, index) => {
    if (l.classId !== WIZARD) return
    n++
    out.push({
      index,
      wizardLevel: n,
      expected: n === 1 ? 6 : 2,
      maxSpellLevel: highestSlot(rules, WIZARD, n),
      learned: l.spellsLearned ?? [],
    })
  })
  return out
}

/** Everything written in the book: the spells added at each Wizard level, then the copied ones. */
export function spellbookContents(char: Character, rules: Rules): string[] {
  const ids = spellbookLevels(char, rules).flatMap((l) => l.learned)
  return [...new Set([...ids, ...(char.spellcasting?.[WIZARD]?.spellbook ?? [])])]
}

/** Wizard spell ids with their level (the Wizard spell list). */
export function wizardList(rules: Rules): Map<string, number> {
  const m = new Map<string, number>()
  for (const lv of rules.classes.get(WIZARD)?.spellList ?? []) for (const id of lv.spells) m.set(id, lv.level)
  return m
}

/** What is wrong with the spells added at each level: too many, not a Wizard spell, a cantrip, a level without a slot,
 * already in the book. Fewer spells than the rules give is not a problem (the player may fill the book later). */
export function spellbookProblems(char: Character, rules: Rules): SpellbookProblem[] {
  const list = wizardList(rules)
  const out: SpellbookProblem[] = []
  const seen = new Set<string>()
  for (const l of spellbookLevels(char, rules)) {
    if (l.learned.length > l.expected)
      out.push({
        index: l.index,
        en: `Wizard level ${l.wizardLevel}: ${l.learned.length} spells added to the spellbook, ${l.expected} allowed.`,
        fr: `Magicien niveau ${l.wizardLevel} : ${l.learned.length} sorts ajoutés au grimoire, ${l.expected} autorisés.`,
        es: `Mago de nivel ${l.wizardLevel}: ${l.learned.length} conjuros añadidos al libro de conjuros, se permiten ${l.expected}.`,
      })
    for (const id of l.learned) {
      const sp = rules.spells.get(id)
      const name = sp?.name ?? { en: id, fr: id, es: id }
      if (seen.has(id))
        out.push({
          index: l.index,
          id,
          en: `${name.en} is already in the spellbook.`,
          fr: `${name.fr} figure déjà dans le grimoire.`,
          es: `${esOf(name)} ya está en el libro de conjuros.`,
        })
      seen.add(id)
      if (!sp) continue
      if (!list.has(id))
        out.push({
          index: l.index,
          id,
          en: `${name.en} is not a Wizard spell.`,
          fr: `${name.fr} n’est pas un sort de Magicien.`,
          es: `${esOf(name)} no es un conjuro de mago.`,
        })
      else if (sp.level === 0)
        out.push({
          index: l.index,
          id,
          en: `${name.en} is a cantrip: cantrips aren't written in the spellbook.`,
          fr: `${name.fr} est un sort mineur : les sorts mineurs ne figurent pas dans le grimoire.`,
          es: `${esOf(name)} es un truco: los trucos no se escriben en el libro de conjuros.`,
        })
      else if (l.wizardLevel === 1 && sp.level !== 1)
        out.push({
          index: l.index,
          id,
          en: `${name.en}: the spellbook starts with level 1 spells.`,
          fr: `${name.fr} : le grimoire commence avec des sorts du 1er niveau.`,
          es: `${esOf(name)}: el libro de conjuros empieza con conjuros de nivel 1.`,
        })
      else if (sp.level > l.maxSpellLevel)
        out.push({
          index: l.index,
          id,
          en: `${name.en} (level ${sp.level}): a Wizard ${l.wizardLevel} has slots up to level ${l.maxSpellLevel}.`,
          fr: `${name.fr} (niveau ${sp.level}) : un Magicien ${l.wizardLevel} a des emplacements jusqu’au niveau ${l.maxSpellLevel}.`,
          es: `${esOf(name)} (nivel ${sp.level}): un mago de nivel ${l.wizardLevel} tiene espacios de conjuro hasta el nivel ${l.maxSpellLevel}.`,
        })
    }
  }
  return out
}
