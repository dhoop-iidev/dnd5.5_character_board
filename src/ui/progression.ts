// Where each build choice and build warning goes in the progression (user request 2026-10-28: a warning sits where it can
// be fixed). A place is a level row index, 'origin' for the Origin block of the level-1 row (species and background,
// ability scores, species traits, the background's feat and what they grant), or undefined (listed under the levels).
import type { Rules } from '../data/rules'
import type { ChoiceDef } from '../data/types'
import type { RuleWarning } from '../engine/checks/common'
import type { Owner, Sheet } from '../engine/sheet/types'
import type { Character } from '../model/character'

export type Place = number | 'origin' | undefined

const isFeature = (o: Owner) => o.kind === 'feature' || o.kind === 'subclass-feature'
/** Warnings set in the level-1 row's skill section. */
const SKILL_ROW = /^(skills-count|skill-list-|skill-dup-)/
/** Areas whose warnings the progression fixes. */
export const BUILD_AREAS = ['abilities', 'skills', 'feats', 'levels']

/** The class level of the last step a choice's count reached (`byLevel`: Rogue Expertise 2 at 1, 4 at 6). */
const lastStep = (ch: ChoiceDef | undefined, cl: number) =>
  Math.max(
    0,
    ...Object.keys(ch?.byLevel ?? {})
      .map((lv) => parseInt(lv, 10))
      .filter((lv) => lv <= cl),
  )

export function progressionPlaces(c: Character, sheet: Sheet, _rules: Rules) {
  const classLevelAt = (i: number) => c.levels.slice(0, i + 1).filter((l) => l.classId === c.levels[i].classId).length
  const rowOfClassLevel = (classId: string | undefined, cl: number | undefined) =>
    c.levels.findIndex((l, k) => l.classId === classId && classLevelAt(k) === cl)

  function placeOfId(id: string): Place {
    const o = sheet.owners.find((x) => x.id === id)
    return o ? placeOf(o) : undefined
  }
  function placeOf(o: Owner): Place {
    if (o.kind === 'trait') return 'origin'
    if (isFeature(o)) {
      const i = rowOfClassLevel(o.classId, o.level)
      return i >= 0 ? i : undefined
    }
    if (o.optionOf) return placeOfId(o.optionOf)
    if (o.feat) {
      // Where the build stage took the feat from (engine/sheet/build.ts `addFeat`).
      if (o.feat.from === 'background') return 'origin'
      if (o.feat.grantedBy) return placeOfId(o.feat.grantedBy)
      if (o.feat.level) return o.feat.level - 1
    }
    return undefined
  }

  function placeOfWarning(w: RuleWarning): Place {
    if (!BUILD_AREAS.includes(w.area)) return undefined
    if (/^(background|ability-)/.test(w.id)) return 'origin'
    if (SKILL_ROW.test(w.id)) return 0
    // A warning about a feature, trait, feat or option goes where that owner is (RuleWarning.ownerId).
    if (w.ownerId) {
      // A choice whose count grows with the class level (Expertise at Rogue 6) is completed in the row of that step.
      const o = sheet.owners.find((x) => x.id === w.ownerId)
      const ch = o?.eff.choices?.find((x) => (x.id ?? 'choice') === w.choiceId)
      const step = o && isFeature(o) ? lastStep(ch, sheet.classLevels[o.classId ?? ''] ?? 0) : 0
      const row = step ? rowOfClassLevel(o!.classId, step) : -1
      if (row >= 0) return row
      const p = placeOfId(w.ownerId)
      if (p !== undefined) return p
    }
    return w.level ? w.level - 1 : undefined
  }

  return {
    classLevelAt,
    placeOf,
    placeOfWarning,
  }
}
