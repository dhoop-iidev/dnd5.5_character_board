// Stage 8: per-rest resources of class features, species traits and feats (`uses` in custom/effects/*.json), overrides of
// other features' resources (Font of Inspiration), and the values features compute for the table (`computed`). no35-ok
import { type Part, esOf, resolve, i18n } from '../stacking'
import { resolveCount, resolveDice, resolveValue } from './modifiers'
import type {
  BuildResult,
  ClassesResult,
  ComputeOptions,
  CoreResult,
  FeatureValue,
  ModifiersResult,
  Resource,
} from './types'

type In = BuildResult & ModifiersResult & CoreResult

export function classesStage(b: In, _opts: ComputeOptions): ClassesResult {
  const resources: Resource[] = []
  const mods = Object.fromEntries(Object.entries(b.abilities).map(([k, v]) => [k, v.mod])) as Record<
    keyof typeof b.abilities,
    number
  >
  for (const o of b.owners) {
    const u = o.eff.uses
    if (!u) continue
    const max = resolveCount(u.count, u.byLevel, b, o, mods)
    if (max === undefined) continue
    resources.push({
      id: o.id,
      name: o.name,
      max,
      spent: Math.min(max, b.char.resources?.[o.id] ?? 0),
      per: u.per,
      shortRestRegain: u.shortRestRegain,
      source: o.source,
    })
  }
  for (const o of b.owners)
    for (const ov of o.eff.overrides ?? []) {
      const r = resources.find((x) => x.id === ov.resource)
      if (!r) continue
      if (ov.per) r.per = ov.per
      if (ov.shortRestRegain !== undefined) r.shortRestRegain = ov.shortRestRegain
    }
  const featureValues: FeatureValue[] = []
  for (const o of b.owners)
    for (const cv of o.eff.computed ?? []) {
      const parts: Part[] = []
      for (const p of cv.parts ?? []) {
        const v = resolveValue(p, b, o, mods)
        if (v === undefined) continue
        parts.push({
          sourceId: `${o.id}:${cv.id}:${String(p)}`,
          label: typeof p === 'number' ? i18n('Base', 'Base', 'Base') : i18n(String(p), String(p), String(p)),
          value: v,
          source: cv.source ?? o.source,
        })
      }
      featureValues.push({
        ownerId: o.id,
        owner: o.name,
        id: cv.id,
        label: cv.label,
        dice: resolveDice(cv.dice, b, o, cv.diceByLevel),
        stat: resolve(parts),
        source: cv.source ?? o.source,
      })
    }
  return { resources, featureValues, tableValues: b.tableValues }
}
