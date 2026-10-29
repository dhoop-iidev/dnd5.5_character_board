// Formulas the player types for custom content (house rule #5): a sum of terms, each a whole number, 'pb' (Proficiency
// Bonus), 'level' (character level), an ability id (its modifier: 'wis'), or '<class>Level' ('rangerLevel'), optionally
// followed by '*N' or '/N' (divided, rounded down: SRD p. 5 "Round Down"). Examples: "13 + wis", "5 + rangerLevel*5",
// "druidLevel/3", "pb + 2".
import type { AbilityId } from '../data/types'
import type { Sheet } from '../engine/sheet/types'
import { ABILITIES } from '../data/types'

export interface FormulaContext {
  pb: number
  level: number
  classLevels: Record<string, number>
  mods: Record<AbilityId, number>
}

const TERM = /^([a-z]+|\d+)(?:\s*([*/])\s*(\d+))?$/i

function term(t: string, ctx: FormulaContext): number | undefined {
  const m = t.trim().match(TERM)
  if (!m) return undefined
  const [, head, op, n] = m
  let v: number | undefined
  if (/^\d+$/.test(head)) v = parseInt(head, 10)
  else if (head === 'pb') v = ctx.pb
  else if (head === 'level') v = ctx.level
  else if ((ABILITIES as readonly string[]).includes(head)) v = ctx.mods[head as AbilityId]
  else {
    const cl = head.match(/^([a-z]+)Level$/)
    if (cl) v = ctx.classLevels[cl[1]] ?? 0
  }
  if (v === undefined) return undefined
  if (op === '*') return v * parseInt(n, 10)
  if (op === '/') return Math.floor(v / Math.max(1, parseInt(n, 10)))
  return v
}

/** The value of a formula, or undefined when it can't be read (empty, unknown word). */
export function evalFormula(expr: string | number | undefined, ctx: FormulaContext): number | undefined {
  if (typeof expr === 'number') return expr
  const s = expr?.trim()
  if (!s) return undefined
  let total = 0
  // Split into signed terms: "13 + wis - 1" → ["13", "+wis", "-1"]; anything left over ("13 ++ wis") is unreadable.
  const compact = s.replace(/\s+/g, '')
  const parts = compact.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== compact) return undefined
  for (const p of parts) {
    const sign = p.startsWith('-') ? -1 : 1
    const v = term(p.replace(/^[+-]/, ''), ctx)
    if (v === undefined) return undefined
    total += sign * v
  }
  return total
}

/** Whether a formula can be read (for the editors: a red field when not). */
export const formulaOk = (expr: string | undefined) =>
  !expr?.trim() ||
  evalFormula(expr, { pb: 2, level: 1, classLevels: {}, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } }) !==
    undefined

/** The context of a computed sheet. */
export function formulaContext(sheet: Pick<Sheet, 'pb' | 'level' | 'classLevels' | 'abilities'>): FormulaContext {
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].mod])) as Record<AbilityId, number>
  return { pb: sheet.pb, level: sheet.level, classLevels: sheet.classLevels, mods }
}
