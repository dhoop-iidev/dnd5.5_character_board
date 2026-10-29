// Stage 9: the Sheet, plus the proficiency lists.
import type {
  AttacksResult,
  BuildResult,
  ClassesResult,
  ComputeOptions,
  CoreResult,
  DefenseResult,
  ModifiersResult,
  Sheet,
  SkillsResult,
  SpellsResult,
} from './types'

type In = BuildResult &
  ModifiersResult &
  CoreResult &
  DefenseResult &
  SkillsResult &
  AttacksResult &
  SpellsResult &
  ClassesResult

export function assembleStage(b: In, _opts: ComputeOptions): Sheet {
  const armor: string[] = []
  const weapons: string[] = []
  const tools: string[] = []
  b.classOrder.forEach((cid, i) => {
    const def = b.classes.get(cid)
    if (!def) return
    for (const a of i === 0 ? def.armorTraining : def.multiclass.armor) if (!armor.includes(a)) armor.push(a)
    for (const w of i === 0 ? def.weaponProficiencies : def.multiclass.weapons)
      if (!weapons.includes(w)) weapons.push(w)
    if (i === 0 && def.toolProficiencies) tools.push(def.toolProficiencies.en)
    if (i > 0) for (const t of def.multiclass.tools ?? []) tools.push(t.en)
  })
  for (const g of b.pool.grants) {
    if (g.grant.kind !== 'proficiency' || !g.grant.on) continue
    if (g.grant.on.startsWith('armor.')) armor.push(g.grant.on.slice(6))
    if (g.grant.on.startsWith('weapon.')) weapons.push(g.grant.on.slice(7))
    if (g.grant.on.startsWith('tool.')) tools.push(g.grant.on.slice(5))
  }
  if (b.background?.tool.en) tools.push(b.background.tool.en)
  tools.push(...(b.char.toolProficiencies ?? []))
  const { char, rules, ...rest } = b
  return {
    ...rest,
    proficiencies: {
      armor,
      weapons,
      tools,
      languages: [
        ...(char.identity?.languages ?? []),
        ...b.pool.grants
          .filter((g) => g.grant.kind === 'language' && (g.grant.on || g.grant.value))
          .map((g) => String(g.grant.on ?? g.grant.value)),
      ],
    },
    exhaustion: char.exhaustion ?? 0,
    exhaustionPenalty: -2 * (char.exhaustion ?? 0),
    conditions: (char.conditions ?? []).map((id) => ({
      id,
      name: rules.conditions.get(id)?.name ?? { en: id, fr: id, es: id },
    })),
  }
}
