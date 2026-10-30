// Character creation helpers shared by the Builder's steps (ui/Builder.svelte), working on the live character: the
// class's suggested Standard Array, the background's default increases, the starting equipment kits (SRD 5.2.1
// "Character Creation", p. 19–23, FR p. 20–24), and which Builder step fixes a rule warning.
import type { Rules } from '../data/rules'
import type { AbilityId } from '../data/types'
import { ABILITIES } from '../data/types'
import type { RuleWarning } from '../engine/checks/common'
import type { Sheet } from '../engine/sheet/types'
import type { Character } from '../model/character'
import { backgroundDef } from '../model/customBackground'
import { kitInventory } from '../model/startingEquipment'
import { progressionPlaces } from './progression'
import { isSpellChoiceWarning } from './spellChoices'

/** The Standard Array placed as the class suggests (SRD p. 21 table). */
export const suggestedArray = (classId: string, rules: Rules): Record<AbilityId, number> => ({
  ...(rules.tables.standardArrayByClass[classId] ?? rules.tables.standardArrayByClass.fighter),
})

/** The base scores are the Standard Array (15, 14, 13, 12, 10, 8) in some order. */
export const isStandardArray = (base: Record<AbilityId, number>, rules: Rules) =>
  ABILITIES.map((a) => base[a])
    .sort((x, y) => y - x)
    .join() === rules.tables.standardArray.join()

/** The background's increases, +2 to the class's primary ability when the background has it (else the best score), +1
 * to the next best (SRD p. 21 "Adjust Ability Scores"). */
export function defaultIncreases(c: Character, rules: Rules) {
  const bg = backgroundDef(c.background, rules)
  const cls = rules.classes.get(c.levels[0]?.classId)
  const prim = new Set(cls?.primaryAbility ?? [])
  const base = c.baseAbilities
  const order = [...(bg?.abilities ?? [])].sort(
    (x, y) => Number(prim.has(y)) - Number(prim.has(x)) || base[y] - base[x],
  )
  if (order.length >= 2) c.background.abilities = { [order[0]]: 2, [order[1]]: 1 }
}

/** The starting equipment options picked in the Builder ('' = keep the inventory as it is). */
export interface Kits {
  classKit: string
  backgroundKit: string
  picks: Record<string, string>
}

/** Replace the inventory and the coins with the chosen starting equipment (creation only, SRD p. 20). */
export function applyKits(c: Character, kits: Kits) {
  const kit = kitInventory({
    classId: c.levels[0]?.classId,
    classOption: kits.classKit,
    backgroundId: c.background.backgroundId,
    backgroundOption: kits.backgroundKit,
    picks: kits.picks,
  })
  c.inventory = kit.items
  c.money = { cp: 0, sp: 0, ep: 0, gp: kit.gp, pp: 0 }
}

export type StepId = 'level' | 'origin' | 'abilities' | 'spells' | 'combat' | 'equipment' | 'summary'

/** Warnings of the base scores and the background's increases (the Abilities step). */
const ABILITY_STEP = /^(ability-(str|dex|con|int|wis|cha)|background-abilities)$/

/** The Builder step that fixes a warning, for the level being edited (`index`), or undefined when it belongs to another
 * level or to no step (then the sheet shows it). */
export function stepOfWarning(
  w: RuleWarning,
  c: Character,
  sheet: Sheet,
  rules: Rules,
  index: number,
): StepId | undefined {
  if (w.area === 'spells' || isSpellChoiceWarning(w, sheet)) return 'spells'
  if (w.id.startsWith('mastery-')) return 'combat'
  const place = progressionPlaces(c, sheet, rules).placeOfWarning(w)
  if (place === 'origin') return index === 0 ? (ABILITY_STEP.test(w.id) ? 'abilities' : 'origin') : undefined
  if (place === index) return 'level'
  return undefined
}

const STEP_ORDER: StepId[] = ['level', 'origin', 'abilities', 'spells', 'combat', 'equipment', 'summary']

/** The choices still to make in the Builder: how many, and the first level and step that needs one (the sheet's
 * banner opens it there). Spell and Weapon Mastery picks open on the last level. */
export function builderTodo(c: Character, sheet: Sheet, rules: Rules, warnings: RuleWarning[]) {
  let count = 0
  let first: { index: number; step: StepId } | undefined
  const better = (a: { index: number; step: StepId }) =>
    !first ||
    a.index < first.index ||
    (a.index === first.index && STEP_ORDER.indexOf(a.step) < STEP_ORDER.indexOf(first.step))
  for (const w of warnings) {
    if (!w.actionable) continue
    for (let i = 0; i < c.levels.length; i++) {
      const step = stepOfWarning(w, c, sheet, rules, i)
      if (!step) continue
      const index = step === 'spells' || step === 'combat' ? c.levels.length - 1 : i
      count++
      if (better({ index, step })) first = { index, step }
      break
    }
  }
  return { count, first }
}
