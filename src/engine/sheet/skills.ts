// Stage 5: skills (proficiency, Expertise, Jack of All Trades) and passive checks.
// SRD p. 9 "Skill Proficiencies", p. 181 "Expertise" (double the Proficiency Bonus), p. 32 "Jack of All Trades" (half the
// Proficiency Bonus, round down, on checks without proficiency), p. 186 "Passive Perception" (10 + bonus, ±5 with
// Advantage / Disadvantage).
import type { SkillId } from '../../data/types'
import type { Character } from '../../model/character'
import { type Part, esOf, resolve, rollState, i18n } from '../stacking'
import { ABILITY_SHORT, SRC } from './common'
import { resolveCount } from './modifiers'
import type {
  BuildResult,
  ComputeOptions,
  CoreResult,
  ModifiersResult,
  Proficiency,
  SkillLine,
  SkillsResult,
} from './types'

type In = BuildResult & ModifiersResult & CoreResult

/** Skills the character is proficient in: chosen at level 1, from the background, from the 'skill' choices of features,
 * traits and feats (Skilled, Human Skillful, Primal Knowledge…), from feats' free-form choices, from grants. */
export function grantedSkills(
  b: Pick<BuildResult, 'background' | 'levels' | 'rules'> & Partial<Pick<BuildResult, 'owners' | 'choices'>>,
  char: Character,
): Set<SkillId> {
  const set = new Set<SkillId>(char.skillProficiencies ?? [])
  for (const s of b.background?.skills ?? []) set.add(s)
  const addChoice = (v: string | string[] | undefined) => {
    for (const x of Array.isArray(v) ? v : v ? [v] : []) if (b.rules.skills.has(x)) set.add(x as SkillId)
  }
  // Skill choices of the character's current features, traits and feats (a stored pick of one it lost doesn't count).
  for (const o of b.owners ?? [])
    for (const c of o.eff.choices ?? []) if (c.kind === 'skill') addChoice(o.choiceValues[c.id ?? 'choice'])
  return set
}

export function skillsStage(b: In, _opts: ComputeOptions): SkillsResult {
  const { pool, abilities, pb, char } = b
  const proficient = grantedSkills(b, b.char)
  for (const g of pool.grants)
    if (g.grant.kind === 'proficiency' && g.grant.on?.startsWith('skill.'))
      proficient.add(g.grant.on.slice(6) as SkillId)
  const expertise = new Set<string>()
  for (const g of pool.grants)
    if (g.grant.kind === 'expertise' && g.grant.on?.startsWith('skill.')) expertise.add(g.grant.on.slice(6))
  // Expertise picks: each feature's 'expertise' choice (Rogue, Bard, Ranger, Scholar, Deft Explorer), schema 5. Open
  // ones (no list) are counted in `expertiseMax`.
  let expertiseMax = 0
  for (const o of b.owners)
    for (const c of o.eff.choices ?? []) {
      if (c.kind !== 'expertise') continue
      for (const v of o.choiceValues[c.id ?? 'choice'] ?? []) expertise.add(v)
      if (!c.from) expertiseMax += resolveCount(c.count, c.byLevel, b, o) ?? 1
    }
  const jack = pool.flags.has('jack-of-all-trades')
  const exhaustion = -2 * (char.exhaustion ?? 0)
  const skills: SkillLine[] = []
  for (const def of b.rules.skills.values()) {
    const prof: Proficiency =
      expertise.has(def.id) && proficient.has(def.id)
        ? 'expertise'
        : proficient.has(def.id)
          ? 'proficient'
          : jack
            ? 'half'
            : 'none'
    const mod = abilities[def.ability].mod
    const parts: Part[] = [
      {
        sourceId: 'ability',
        label: {
          en: `${ABILITY_SHORT[def.ability].en} modifier`,
          fr: `Modificateur de ${ABILITY_SHORT[def.ability].fr}`,
          es: `Modificador de ${esOf(ABILITY_SHORT[def.ability])}`,
        },
        value: mod,
        source: SRC.skills,
      },
    ]
    if (prof === 'expertise')
      parts.push({
        sourceId: 'pb',
        label: i18n(
          'Expertise (Proficiency Bonus × 2)',
          'Expertise (bonus de maîtrise × 2)',
          'Pericia (bonificador por competencia × 2)',
        ),
        value: pb * 2,
        effectName: 'Proficiency Bonus',
        source: SRC.expertise,
      })
    else if (prof === 'proficient')
      parts.push({
        sourceId: 'pb',
        label: i18n('Proficiency Bonus', 'Bonus de maîtrise', 'Bonificador por competencia'),
        value: pb,
        effectName: 'Proficiency Bonus',
        source: SRC.skills,
      })
    else if (prof === 'half')
      parts.push({
        sourceId: 'pb',
        label: i18n(
          'Jack of All Trades (half Proficiency Bonus)',
          'Touche-à-tout (moitié du bonus de maîtrise)',
          'Aprendiz de mucho (la mitad del bonificador por competencia)',
        ),
        value: Math.floor(pb / 2),
        effectName: 'Proficiency Bonus',
        source: { page: 32, frPage: 34, section: 'Classes > Bard > Level 2: Jack of All Trades' },
      })
    parts.push(
      ...pool.parts(`skill.${def.id}`),
      ...pool.parts(`check.${def.ability}`),
      ...pool.parts('check.all'),
      ...pool.parts('d20'),
    )
    if (exhaustion)
      parts.push({
        sourceId: 'exhaustion',
        label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
        value: exhaustion,
        source: SRC.exhaustion,
      })
    const total = resolve(parts, {
      advantage: [
        ...pool.advantage(`skill.${def.id}`),
        ...pool.advantage(`check.${def.ability}`),
        ...pool.advantage('check.all'),
      ],
      disadvantage: [
        ...pool.disadvantage(`skill.${def.id}`),
        ...pool.disadvantage(`check.${def.ability}`),
        ...pool.disadvantage('check.all'),
      ],
    })
    const state = rollState(total)
    const passive = 10 + total.total + (state === 'advantage' ? 5 : state === 'disadvantage' ? -5 : 0)
    skills.push({ id: def.id, name: def.name, ability: def.ability, proficiency: prof, total, passive })
  }
  skills.sort((a, c) => a.name.en.localeCompare(c.name.en))
  const perception = skills.find((s) => s.id === 'perception')
  return { skills, passivePerception: perception?.passive ?? 10, expertiseMax }
}
