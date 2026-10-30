import type { ChoiceDef } from '../data/types'
import { rules as baseRules } from '../data/rules'
import { compute } from '../engine/compute'
import { choiceKey } from '../engine/sheet/build'
import { SCHEMA_VERSION, type Character } from './character'

/** Picks of a choice at a class level (its `count`, raised by `byLevel` steps). */
const countAt = (ch: ChoiceDef, cl: number) => {
  let n = typeof ch.count === 'number' ? ch.count : ch.byLevel ? 0 : 1
  for (const [lv, k] of Object.entries(ch.byLevel ?? {})) if (cl >= parseInt(lv, 10)) n = Math.max(n, k)
  return n
}

/** Schema 5: the flat Expertise list goes to each feature's own choice, in the order the rows gained the picks (Rogue 1:
 * 2 picks, Rogue 6: 2 more…), as the progression split it before. Extra picks go to the first feature (and are flagged). */
function distributeExpertise(c: Character, flat: string[]) {
  const sheet = compute(c, baseRules)
  const open = sheet.owners.flatMap((o) =>
    (o.eff.choices ?? []).filter((ch) => ch.kind === 'expertise' && !ch.from).map((ch) => ({ o, ch })),
  )
  if (!open.length) return
  const add = (key: string, vs: string[]) => {
    const prev = c.featureChoices[key]
    c.featureChoices[key] = [...new Set([...(Array.isArray(prev) ? prev : prev ? [prev] : []), ...vs])]
  }
  const levels: Record<string, number> = {}
  let k = 0
  for (const l of c.levels) {
    const cl = (levels[l.classId] = (levels[l.classId] ?? 0) + 1)
    for (const { o, ch } of open) {
      if (o.classId !== l.classId || o.level === undefined || cl < o.level) continue
      const gain = countAt(ch, cl) - (cl - 1 >= o.level ? countAt(ch, cl - 1) : 0)
      if (gain > 0) add(choiceKey(o.id, ch), flat.slice(k, k + gain))
      k += gain
    }
  }
  if (k < flat.length) add(choiceKey(open[0].o.id, open[0].ch), flat.slice(k))
}

/** Upgrade a saved character (from localStorage or an imported JSON file) to the current schema. */
export function migrate(raw: unknown): Character {
  if (!raw || typeof raw !== 'object') throw new Error('Not a character file')
  const data = raw as { schemaVersion?: number; edition?: string }
  const version = data.schemaVersion ?? 0
  if (version > SCHEMA_VERSION)
    throw new Error(`This file was made by a newer version of the app (schema ${version} > ${SCHEMA_VERSION})`)
  // A 3.5 playboard file has no `edition` field: refuse it rather than misread it.
  if (data.edition !== 'srd-5.2.1') throw new Error('Not a D&D 2024 (SRD 5.2.1) character file')
  const c = data as Character
  if (c.schemaVersion < 2) {
    // Schema 2 (2026-10-25): companions and Wild Shape state.
    c.companions ??= []
    c.wildShape ??= { known: [] }
    c.schemaVersion = 2
  }
  if (c.schemaVersion < 3) {
    // Schema 3 (2026-10-25): feature choices and extra feats (Human Versatile, Champion's second Fighting Style…).
    c.featureChoices ??= {}
    c.extraFeats ??= {}
    c.schemaVersion = 3
  }
  if (c.schemaVersion < 4) {
    // Schema 4 (2026-10-26): paper-doll picture (`images.doll`, absent = the built-in one) and real custom items
    // (`ItemInstance.custom` gains attunement, worn kind, bonuses, weapon overrides and modifiers). A custom item that
    // was attuned before required Attunement, so it keeps it.
    c.images ??= {}
    for (const i of c.inventory ?? []) if (i.kind === 'custom' && i.attuned && i.custom) i.custom.attunement = true
    c.schemaVersion = 4
  }
  if (c.schemaVersion < 5) {
    // Schema 5 (2026-10-30): one store for feature, trait and option choices. Level choices (`LevelEntry.choices`, the
    // later level winning as the engine read them) and the flat Expertise list move into `featureChoices`.
    const old = c as Character & { expertise?: string[]; levels: { choices?: Record<string, string | string[]> }[] }
    c.featureChoices ??= {}
    c.extraFeats ??= {}
    c.toggles ??= {}
    c.resources ??= {}
    c.annotations ??= {}
    for (const l of old.levels) {
      for (const [k, v] of Object.entries(l.choices ?? {})) if (v !== undefined && v !== '') c.featureChoices[k] = v
      delete l.choices
    }
    const flat = (old.expertise ?? []).filter(Boolean)
    delete old.expertise
    if (flat.length) distributeExpertise(c, flat)
    c.schemaVersion = 5
  }
  return c
}
