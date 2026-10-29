// Where each build choice and build warning goes in the progression (user request 2026-10-28: a warning sits where it can
// be fixed). A place is a level row index, 'origin' for the Origin block of the level-1 row (species and background,
// ability scores, species traits, the background's feat and what they grant), or undefined (listed under the levels).
// Expertise: the open Expertise choices (Rogue, Bard, Ranger…) count against `character.expertise`; each row gets the
// picks its features add there, taken in order from that list (Rogue: 2 at Rogue 1, 2 more at Rogue 6, SRD 5.2.1 p. 61).
import type { Rules } from '../data/rules'
import type { ChoiceDef } from '../data/types'
import type { RuleWarning } from '../engine/checks/common'
import { resolveCount } from '../engine/sheet/modifiers'
import type { Owner, Sheet } from '../engine/sheet/types'
import type { Character } from '../model/character'

export type Place = number | 'origin' | undefined

const isFeature = (o: Owner) => o.kind === 'feature' || o.kind === 'subclass-feature'
/** The warning is about one of this owner's choices (`choice-<id>`, `choice-<id>#<choice>`, `choice-<id>><choice>`). */
const choiceOf = (w: RuleWarning, o: Owner) =>
  w.id === `choice-${o.id}` || w.id.startsWith(`choice-${o.id}#`) || w.id.startsWith(`choice-${o.id}>`)
/** Warnings set in the level-1 row's skill section. */
const SKILL_ROW = /^(skills-count|skill-list-|skill-dup-)/
/** Areas whose warnings the progression fixes. */
export const BUILD_AREAS = ['abilities', 'skills', 'feats', 'levels']

const countAt = (ch: ChoiceDef, cl: number) => {
  let n = ch.byLevel ? (typeof ch.count === 'number' ? ch.count : 0) : typeof ch.count === 'number' ? ch.count : 1
  for (const [lv, k] of Object.entries(ch.byLevel ?? {})) if (cl >= parseInt(lv, 10)) n = Math.max(n, k)
  return n
}

export function progressionPlaces(c: Character, sheet: Sheet, rules: Rules) {
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
    if (o.kind === 'feat') {
      const featId = o.id.slice('feat:'.length)
      if (c.background.feat?.featId === featId) return 'origin'
      const i = c.levels.findIndex(
        (l) =>
          l.feat?.featId === featId ||
          Object.entries(l.choices ?? {}).some(([k, v]) => k.endsWith(':fighting-style') && v === featId),
      )
      if (i >= 0) return i
      const by = Object.entries(c.extraFeats).find(([, p]) => p.featId === featId)?.[0]
      if (by) return placeOfId(by)
    }
    return undefined
  }

  const openExpertise = (o: Owner) => (o.eff.choices ?? []).filter((ch) => ch.kind === 'expertise' && !ch.from)
  /** Expertise picks gained at each row. */
  const expertiseGain = c.levels.map((l, i) => {
    const cl = classLevelAt(i)
    let n = 0
    for (const o of sheet.owners)
      for (const ch of openExpertise(o)) {
        if (isFeature(o)) {
          if (o.classId === l.classId && o.level !== undefined && cl >= o.level)
            n += countAt(ch, cl) - (cl - 1 >= o.level ? countAt(ch, cl - 1) : 0)
        } else if (placeOf(o) === i || (i === 0 && placeOf(o) === 'origin'))
          n += resolveCount(ch.count, ch.byLevel, { ...sheet, char: c, rules }, o) ?? 1
      }
    return n
  })
  const expertiseRows = expertiseGain.flatMap((n, i) => (n ? [i] : []))
  const expertiseStart = (i: number) => expertiseGain.slice(0, i).reduce((s, n) => s + n, 0)

  function placeOfWarning(w: RuleWarning): Place {
    if (!BUILD_AREAS.includes(w.area)) return undefined
    if (/^(background|ability-)/.test(w.id)) return 'origin'
    if (SKILL_ROW.test(w.id)) return 0
    if (w.id.startsWith('expertise')) return expertiseRows.at(-1)
    if (w.id.startsWith('choice-') && !w.id.startsWith('choice-stale-')) {
      const o = sheet.owners.find((x) => choiceOf(w, x))
      const p = o ? placeOf(o) : undefined
      if (p !== undefined) return p
    }
    const by = /^feat-asi-(.+)$/.exec(w.id)?.[1]
    if (by && !/^\d+$/.test(by)) return placeOfId(by)
    const rep = /^feat-repeat-(.+)$/.exec(w.id)?.[1]
    if (rep) {
      const i = c.levels.findLastIndex((l) => l.feat?.featId === rep)
      return i >= 0 ? i : 'origin'
    }
    return w.level ? w.level - 1 : undefined
  }

  return {
    classLevelAt,
    placeOf,
    placeOfWarning,
    expertiseGain,
    /** The `character.expertise` picks of row i. */
    expertiseHere: (i: number) => c.expertise.slice(expertiseStart(i), expertiseStart(i) + expertiseGain[i]),
    /** Index in `character.expertise` where row i's picks end (where a new pick of that row goes). */
    expertiseEnd: (i: number) =>
      Math.min(c.expertise.length, expertiseStart(i) + c.expertise.slice(expertiseStart(i)).length),
  }
}
