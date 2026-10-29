// Shared pieces of the rule checks (engine/validate.ts and engine/checks/*): warning type, helper, context.
import type { Rules } from '../../data/rules'
import type { I18n, Source } from '../../data/types'
import type { Character } from '../../model/character'
import type { Sheet } from '../sheet/types'

export { esOf } from '../stacking'

export type Severity = 'error' | 'warning' | 'info'
export type WarningArea = 'abilities' | 'skills' | 'feats' | 'levels' | 'inventory' | 'combat' | 'spells' | 'companions'

export interface RuleWarning {
  id: string
  severity: Severity
  area: WarningArea
  level?: number
  message: I18n
  source?: Source
  /** Needs a choice from the player (missing/extra feat, skill, illegal pick). */
  actionable?: boolean
}

export const w = (
  id: string,
  severity: Severity,
  area: WarningArea,
  en: string,
  fr: string,
  es: string,
  extra: Partial<RuleWarning> = {},
): RuleWarning => ({
  id,
  severity,
  area,
  message: { en, fr, es },
  ...extra,
})

export interface CheckContext {
  char: Character
  rules: Rules
  now: Sheet
  sheetAt: (level: number) => Sheet
  out: RuleWarning[]
}
