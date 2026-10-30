// Stage 9: the Sheet, plus the proficiency lists.
import { languageOf } from '../../model/languages'
import { toolChoicesOf, toolPicks } from '../../model/toolChoices'
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
  // Tools picked in a "skills or tools" choice (Skilled).
  for (const o of b.owners)
    for (const c of o.eff.choices ?? [])
      if (c.tools)
        for (const v of o.choiceValues[c.id ?? 'choice'] ?? []) {
          const g = b.rules.gear.get(v)
          if (g?.kind === 'tool' && !tools.includes(g.name.en)) tools.push(g.name.en)
        }
  if (b.background?.tool.en) tools.push(b.background.tool.en)
  tools.push(...(b.char.toolProficiencies ?? []))
  // Tools chosen by the player (Bard instruments, Monk, Soldier's Gaming Set) in place of the sentence that offers them.
  for (const t of toolChoicesOf(b.char, b.rules)) {
    const picks = toolPicks(b.char, t)
    if (!picks.length) continue
    const k = tools.indexOf(t.replaces)
    if (k >= 0) tools.splice(k, 1)
    for (const p of picks) if (!tools.includes(p)) tools.push(p)
  }
  // Languages: the player's (Origin), those granted (Thieves' Cant, Druidic), those picked in a feature's language
  // choice (Thieves' Cant's other language, Deft Explorer); each once.
  const languages: string[] = []
  const seen = new Set<string>()
  const addLanguage = (l: string) => {
    const k = languageOf(l)?.id ?? l.trim().toLowerCase()
    if (!k || seen.has(k)) return
    seen.add(k)
    languages.push(l)
  }
  for (const l of b.char.identity?.languages ?? []) addLanguage(l)
  for (const g of b.pool.grants)
    if (g.grant.kind === 'language' && (g.grant.on || g.grant.value)) addLanguage(String(g.grant.on ?? g.grant.value))
  for (const o of b.owners)
    for (const c of o.eff.choices ?? [])
      if (c.kind === 'language') for (const v of o.choiceValues[c.id ?? 'choice'] ?? []) addLanguage(v)
  const { char, rules, ...rest } = b
  return {
    ...rest,
    proficiencies: {
      armor,
      weapons,
      tools,
      languages,
    },
    exhaustion: char.exhaustion ?? 0,
    exhaustionPenalty: -2 * (char.exhaustion ?? 0),
    conditions: (char.conditions ?? []).map((id) => ({
      id,
      name: rules.conditions.get(id)?.name ?? { en: id, fr: id, es: id },
    })),
  }
}
