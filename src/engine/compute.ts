// Character sheet computation (D&D 2024, SRD 5.2.1). Every value is a Stat {total, parts} so the UI can show its breakdown.
// compute() runs the stages of engine/sheet/ in order; each stage gets what the earlier ones computed and returns its own
// values (types: engine/sheet/types.ts; shared helpers and page references: engine/sheet/common.ts).
import type { Rules } from '../data/rules'
import type { Character } from '../model/character'
import type { ComputeOptions, Sheet } from './sheet/types'
import { buildStage } from './sheet/build'
import { modifiersStage } from './sheet/modifiers'
import { coreStage } from './sheet/core'
import { defenseStage } from './sheet/defense'
import { skillsStage } from './sheet/skills'
import { attacksStage } from './sheet/attacks'
import { spellsStage } from './sheet/spells'
import { classesStage } from './sheet/classes'
import { assembleStage } from './sheet/assemble'

export type {
  AbilityBlock,
  AttackLine,
  ComputeOptions,
  Resource,
  Sheet,
  SkillLine,
  SpellcastingBlock,
} from './sheet/types'
export { abilityMod, pbForLevel, lbToWeight } from './sheet/common'
export { fmt } from './stacking'

export function compute(char: Character, rules: Rules, opts: ComputeOptions = {}): Sheet {
  const c1 = buildStage(char, rules, opts)
  const c2 = { ...c1, ...modifiersStage(c1, opts) }
  const c3 = { ...c2, ...coreStage(c2, opts) }
  const c4 = { ...c3, ...defenseStage(c3, opts) }
  const c5 = { ...c4, ...skillsStage(c4, opts) }
  const c6 = { ...c5, ...attacksStage(c5, opts) }
  const c7 = { ...c6, ...spellsStage(c6, opts) }
  const c8 = { ...c7, ...classesStage(c7, opts) }
  return assembleStage(c8, opts)
}
