// Which choices are made in the Spells pane rather than in the progression (user request 2026-10-30: spells are chosen
// where they are used). A feat or trait whose spells are the player's picks (Magic Initiate: list, ability, two cantrips
// and a level 1 spell, `spells.fromChoices`) is set up there entirely; any other spell pick (Pact of the Tome, Magical
// Discoveries) too, the rest of its owner's choices staying in the progression. Also which tab fixes a warning, for the
// tab badges.
import type { ChoiceDef } from '../data/types'
import type { RuleWarning } from '../engine/checks/common'
import type { Owner, Sheet } from '../engine/sheet/types'

/** The owner is a feat or trait whose granted spells are chosen by the player (Magic Initiate). */
export const spellOwner = (o: Owner) => !!o.effect?.spells?.fromChoices?.length && !!o.effect?.choices?.length

/** Choices of an owner shown in the Spells pane ('spells') or in the progression ('rest'). */
export function choicesFor(o: Owner, where: 'spells' | 'rest'): ChoiceDef[] {
  const all = o.effect?.choices ?? []
  if (spellOwner(o)) return where === 'spells' ? all : []
  return all.filter((ch) => (ch.kind === 'spell') === (where === 'spells'))
}

/** Owners with something to choose in the Spells pane. */
export const spellChoiceOwners = (sheet: Sheet) => sheet.owners.filter((o) => choicesFor(o, 'spells').length > 0)

/** The owner and choice a `choice-…` warning is about (ids `choice-<owner>`, `choice-<owner>#<choice>[-…]` for
 * features and traits, `choice-<owner>><choice>` for feats). */
function choiceOfWarning(w: RuleWarning, sheet: Sheet): { o: Owner; ch?: ChoiceDef } | undefined {
  if (!w.id.startsWith('choice-')) return undefined
  const rest = w.id.slice('choice-'.length)
  // Longest owner id that prefixes the rest (owner ids contain ':' and '-').
  const o = sheet.owners
    .filter(
      (x) => rest === x.id || rest.startsWith(`${x.id}#`) || rest.startsWith(`${x.id}>`) || rest.startsWith(`${x.id}-`),
    )
    .sort((a, b) => b.id.length - a.id.length)[0]
  if (!o) return undefined
  const after = rest.slice(o.id.length)
  const chId = after.startsWith('#') || after.startsWith('>') ? after.slice(1) : undefined
  const ch = (o.effect?.choices ?? []).find(
    (c) => (c.id ?? '') === (chId ?? '') || (chId !== undefined && c.id !== undefined && chId.startsWith(`${c.id}-`)),
  )
  return { o, ch }
}

/** The warning is fixed in the Spells pane (a spell pick of a feat, trait or feature). */
export function isSpellChoiceWarning(w: RuleWarning, sheet: Sheet): boolean {
  const hit = choiceOfWarning(w, sheet)
  if (!hit) return false
  if (spellOwner(hit.o)) return true
  return hit.ch?.kind === 'spell'
}

export type TabId = 'general' | 'equipment' | 'combat' | 'spells' | 'companions'

/** The tab where a warning is fixed: build choices in the progression (General), Weapon Mastery and hands in Combat,
 * items in Equipment, spells in Spells. */
export function tabOfWarning(w: RuleWarning, sheet: Sheet): TabId {
  if (w.area === 'spells' || isSpellChoiceWarning(w, sheet)) return 'spells'
  if (w.area === 'companions') return 'companions'
  if (w.area === 'combat') return 'combat'
  if (w.area === 'inventory') return 'equipment'
  return 'general'
}
