// After a change to the build's structure (a level's class or subclass, a level removed, species, background, a feat
// swapped), remove what no longer belongs to the character, so nothing applies without a control to change it: the
// choices of features, traits and options it lost, feats granted by a feature it lost, a feat on a row that is no longer
// an Ability Score Improvement level, a subclass on a row that is not its class's level 3. Run by state.svelte.ts.
import type { Rules } from '../data/rules'
import { compute } from '../engine/compute'
import { choiceKey } from '../engine/sheet/build'
import type { Character } from './character'
import { withCustom } from './custom'
import { toolChoicesOf } from './toolChoices'

/** Class level at which a subclass is chosen (SRD 5.2.1: level 3 for every class). */
const SUBCLASS_LEVEL = 3

/** Clean the character in place; returns what was removed (for tests). `baseRules`: the SRD rules (the character's
 * custom feats, subclasses and species are merged here, as compute() does). */
export function reconcile(c: Character, baseRules: Rules): string[] {
  const rules = withCustom(baseRules, c)
  const removed: string[] = []
  // Rows: a feat only at the class's Ability Score Improvement levels or 19; a subclass only at class level 3 of its class.
  const levels: Record<string, number> = {}
  c.levels.forEach((l, i) => {
    const cl = (levels[l.classId] = (levels[l.classId] ?? 0) + 1)
    const def = rules.classes.get(l.classId)
    if (l.feat && def && !(def.asiLevels.includes(cl) || cl === 19)) {
      removed.push(`levels[${i}].feat`)
      delete l.feat
    }
    if (l.subclassId && (cl !== SUBCLASS_LEVEL || !def?.subclasses.some((s) => s.id === l.subclassId))) {
      removed.push(`levels[${i}].subclassId`)
      delete l.subclassId
    }
  })
  const sheet = compute(c, baseRules)
  // Feature, trait and option choices of owners the character has; Fighting Style features hold their feat id; a
  // Spellcasting class's own choice (Circle of the Land's land); tool picks (model/toolChoices.ts).
  const keep = new Set<string>()
  for (const o of sheet.owners) {
    for (const ch of o.eff.choices ?? []) if (ch.kind !== 'feat') keep.add(choiceKey(o.id, ch))
    if (o.id.endsWith(':fighting-style')) keep.add(o.id)
  }
  for (const s of sheet.spellcasting) if (s.spellChoice?.key) keep.add(s.spellChoice.key)
  for (const t of toolChoicesOf(c, rules)) keep.add(t.key)
  for (const k of Object.keys(c.featureChoices))
    if (!keep.has(k)) {
      removed.push(`featureChoices.${k}`)
      delete c.featureChoices[k]
    }
  // Feats granted by a feature or trait ('feat' choices): only while the granting owner is there.
  const grantors = new Set(sheet.owners.filter((o) => o.eff.choices?.some((ch) => ch.kind === 'feat')).map((o) => o.id))
  for (const k of Object.keys(c.extraFeats))
    if (!grantors.has(k)) {
      removed.push(`extraFeats.${k}`)
      delete c.extraFeats[k]
    }
  return removed
}

/** What a structural change is made of: when it changes, `reconcile` runs. */
export const structureOf = (c: Character) =>
  JSON.stringify([
    c.speciesId,
    c.background?.backgroundId,
    c.background?.feat?.featId,
    c.levels?.map((l) => [l.classId, l.subclassId ?? '', l.feat?.featId ?? '']),
    Object.entries(c.extraFeats ?? {}).map(([k, p]) => [k, p.featId]),
  ])
