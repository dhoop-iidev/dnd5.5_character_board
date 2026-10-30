// Rule checks. They only produce warnings; nothing is ever blocked (CLAUDE.md).
// Each area lives in engine/checks/*.ts; this file builds the shared context and runs them in order.
import type { Rules } from '../data/rules'
import type { Character } from '../model/character'
import { compute } from './compute'
import type { CheckContext, RuleWarning } from './checks/common'
import { checkBuild } from './checks/build'
import { checkEquipment, checkWornKinds } from './checks/equipment'
import { checkSpells } from './checks/spells'
import { checkCompanions } from './checks/companions'
import { withCustom } from '../model/custom'

export type { RuleWarning, Severity, WarningArea } from './checks/common'

/** The character without temporary state (effects, conditions, Exhaustion), to check the build itself. */
function permanent(char: Character): Character {
  return { ...char, activeEffects: [], conditions: [], exhaustion: 0, toggles: {} }
}

export function validate(char: Character, baseRules: Rules): RuleWarning[] {
  const rules = withCustom(baseRules, char)
  const out: RuleWarning[] = []
  const perm = permanent(char)
  const sheets = new Map<number, ReturnType<typeof compute>>()
  const sheetAt = (L: number) => sheets.get(L) ?? sheets.set(L, compute(perm, rules, { level: L })).get(L)!
  const now = compute(char, rules)
  const ctx: CheckContext = { char, rules, now, sheetAt, out }
  checkBuild(ctx)
  checkEquipment(ctx)
  checkWornKinds(ctx)
  checkSpells(ctx)
  checkCompanions(ctx)
  // Ids are list keys in the panes (a duplicate key stops a pane from rendering): make every one unique.
  const seen = new Map<string, number>()
  for (const x of out) {
    x.actionable = x.actionable ?? false
    const n = (seen.get(x.id) ?? 0) + 1
    seen.set(x.id, n)
    if (n > 1) x.id = `${x.id}~${n}`
  }
  return out
}
