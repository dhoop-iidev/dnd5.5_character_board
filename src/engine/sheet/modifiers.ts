// Stage 2: the pool of numeric parts, dice, Advantage/Disadvantage sources, flags, toggles and AC formulas gathered from
// every owner (features, feats, traits, conditions, items, options chosen).
import type { AbilityId, GrantSpec, I18n, ModifierSpec } from '../../data/types'
import { ABILITIES } from '../../data/types'
import { type Part, esOf } from '../stacking'
import { pbForLevel, tableNumber } from './common'
import type { BuildResult, ComputeOptions, ModifiersResult, Owner, Pool } from './types'

interface Entry {
  target: string
  part: Part
  /** Weapon condition left to the attacks stage. */
  when?: string
  /** Ability-valued part ('cha', 'wis:min1'): resolved once the core stage has the scores. */
  pending?: string
}

/** Does an engine condition hold for this character (armor-dependent ones)? Weapon conditions are left to the attacks
 * stage; 'toggle:<key>' becomes a situational part the player switches in the Combat pane. */
export function holds(when: string | undefined, b: BuildResult): boolean | 'weapon' | 'toggle' {
  if (!when) return true
  const heavy = b.armor?.def.category === 'heavy'
  switch (when) {
    case 'no-armor':
      return !b.armor
    case 'no-heavy-armor':
      return !heavy
    case 'no-armor-no-shield':
      return !b.armor && !b.shield
    case 'armor':
      return !!b.armor
    case 'shield':
      return !!b.shield
    case 'ranged-weapon':
    case 'melee-weapon':
      return 'weapon'
  }
  if (when.startsWith('toggle:')) return 'toggle'
  return false
}

const ABILITY_RE = /^(str|dex|con|int|wis|cha)(?::min(\d+))?$/

/** The ability an ability-valued string names ('cha', 'cha:min1'), or undefined. */
export function abilityValue(value: number | string): { ability: AbilityId; min?: number } | undefined {
  if (typeof value !== 'string') return undefined
  const m = value.match(ABILITY_RE)
  if (!m) return undefined
  return { ability: m[1] as AbilityId, min: m[2] ? parseInt(m[2], 10) : undefined }
}

/** Numeric value of a ModifierSpec: a number, 'pb', 'half-pb', 'level', '<class>Level' (with '*n' or '/n'), an ability
 * id when `mods` is known (the core stage onwards), or a class-table column id of the owner's class. */
export function resolveValue(
  value: number | string,
  b: BuildResult,
  owner?: Owner,
  mods?: Record<AbilityId, number>,
): number | undefined {
  if (typeof value === 'number') return value
  const pb = pbForLevel(b.rules, b.level)
  if (value === 'pb') return pb
  if (value === 'half-pb') return Math.floor(pb / 2)
  if (value === 'level') return b.level
  const av = abilityValue(value)
  if (av) {
    const m = mods ?? (b as unknown as { abilities?: Record<AbilityId, { mod: number }> }).abilities
    if (!m) return undefined
    const raw = m[av.ability] as number | { mod: number } | undefined
    const mod = typeof raw === 'number' ? raw : raw?.mod
    if (mod === undefined) return undefined
    return av.min !== undefined ? Math.max(av.min, mod) : mod
  }
  const m = value.match(/^([a-z]+)Level(?:\*(\d+)|\/(\d+))?$/)
  if (m) {
    const lv = b.classLevels[m[1]] ?? 0
    if (m[2]) return lv * parseInt(m[2], 10)
    if (m[3]) return Math.floor(lv / parseInt(m[3], 10))
    return lv
  }
  const cid = owner?.classId ?? owner?.id.split(':')[0] ?? ''
  const tv = b.tableValues[cid]?.[value]
  return tableNumber(tv)
}

/** A dice string from a value: '1d6' itself, a class-table column holding dice ('sneakAttack' → '3d6', 'bardicDie' → 'd8'),
 * or '<column>*d6' (a numeric column as the number of dice: Frenzy's 'rageDamage*d6' → '3d6'). `byLevel` picks the dice
 * for the owner's class level ({ "1": "1d8", "7": "2d8" }). */
export function resolveDice(
  value: number | string | undefined,
  b: BuildResult,
  owner?: Owner,
  byLevel?: Record<string, string>,
): string | undefined {
  if (byLevel) {
    const classLevel = owner?.classId ? (b.classLevels[owner.classId] ?? 0) : b.level
    let pick: string | undefined
    for (const [lv, d] of Object.entries(byLevel).sort((x, y) => parseInt(x[0], 10) - parseInt(y[0], 10)))
      if (classLevel >= parseInt(lv, 10)) pick = d
    if (pick) value = pick
  }
  if (typeof value !== 'string') return undefined
  if (/^\d*d\d+/i.test(value)) return value.toLowerCase()
  const cid = owner?.classId ?? owner?.id.split(':')[0] ?? ''
  const m = value.match(/^([A-Za-z]+)\*d(\d+)$/)
  if (m) {
    const n = tableNumber(b.tableValues[cid]?.[m[1]])
    return n ? `${n}d${m[2]}` : undefined
  }
  const tv = b.tableValues[cid]?.[value]
  return typeof tv === 'string' && /\d*d\d+/i.test(tv) ? tv.toLowerCase() : undefined
}

/** A count: a number, a class-table column id, 'pb', an ability modifier (min 1), with `byLevel` steps by class level. */
export function resolveCount(
  count: number | string | undefined,
  byLevel: Record<string, number> | undefined,
  b: BuildResult,
  owner?: Owner,
  mods?: Record<AbilityId, number>,
): number | undefined {
  const classLevel = owner?.classId ? (b.classLevels[owner.classId] ?? 0) : b.level
  if (byLevel) {
    let max = typeof count === 'number' ? count : 0
    for (const [lv, n] of Object.entries(byLevel)) if (classLevel >= parseInt(lv, 10)) max = Math.max(max, n)
    return max
  }
  if (count === undefined) return 1
  if (typeof count === 'number') return count
  const av = abilityValue(count)
  if (av) return resolveValue(av.min === undefined ? `${av.ability}:min1` : count, b, owner, mods)
  return resolveValue(count, b, owner, mods)
}

export function modifiersStage(b: BuildResult, _opts: ComputeOptions): ModifiersResult {
  const entries: Entry[] = []
  const adv: Record<string, I18n[]> = {}
  const dis: Record<string, I18n[]> = {}
  const flags = new Set<string>()
  const grants: Pool['grants'] = []
  const acFormulas: Pool['acFormulas'] = []
  const toggles: Pool['toggles'] = []
  const dice: Pool['dice'] = []
  const chartoggles = b.char.toggles ?? {}
  const addToggle = (when: string, owner: Owner, label?: I18n) => {
    const key = when.slice('toggle:'.length)
    if (!toggles.some((t) => t.key === key)) toggles.push({ key, label: label ?? owner.name, owner })
    return key
  }
  for (const o of b.owners) {
    for (const m of o.modifiers) {
      const h = holds(m.when, b)
      if (h === false) continue
      if (h === 'toggle') addToggle(m.when!, o, m.condition)
      // Dice contributions (Sneak Attack, Radiant Strikes…): kept as dice, with the situational text.
      if (m.target.startsWith('extraDamage.') || m.target.startsWith('dice.')) {
        const d = resolveDice(m.value, b, o, m.diceByLevel)
        if (!d) continue
        if (h === 'toggle' && !chartoggles[m.when!.slice('toggle:'.length)]) continue
        dice.push({
          target: m.target,
          dice: d,
          label: o.name,
          condition: m.condition,
          owner: o,
          when: h === 'weapon' ? m.when : undefined,
        })
        continue
      }
      const av = abilityValue(m.value)
      const value = av ? 0 : resolveValue(m.value, b, o)
      if (value === undefined) continue
      const part: Part = { sourceId: o.id, label: o.name, value, effectName: m.effectName, source: o.source }
      if (h === 'toggle') {
        const key = m.when!.slice('toggle:'.length)
        part.toggleKey = key
        part.condition = m.condition ?? o.name
        part.situationalOn = !!chartoggles[key]
      } else if (m.condition) {
        part.condition = m.condition
        part.toggleKey = `${o.id}|${m.target}`
        part.situationalOn = !!chartoggles[part.toggleKey]
      }
      entries.push({
        target: m.target,
        part,
        when: h === 'weapon' ? m.when : undefined,
        pending: av ? (m.value as string) : undefined,
      })
    }
    for (const g of o.grants) {
      const h = holds(g.when, b)
      if (h === false) continue
      if (h === 'toggle') {
        const key = addToggle(g.when!, o, g.condition)
        if (!chartoggles[key]) continue
      }
      grants.push({ owner: o, grant: g })
      const label: I18n = g.condition
        ? {
            en: `${o.name.en} (${g.condition.en})`,
            fr: `${o.name.fr} (${g.condition.fr})`,
            es: `${esOf(o.name)} (${esOf(g.condition)})`,
          }
        : o.name
      if (g.kind === 'advantage' && g.on) (adv[g.on] ??= []).push(label)
      if (g.kind === 'disadvantage' && g.on) (dis[g.on] ??= []).push(label)
      if (g.kind === 'flag' && g.on) flags.add(g.on)
    }
    for (const f of o.eff.flags ?? []) flags.add(f)
    if (o.eff.acFormula)
      acFormulas.push({
        owner: o,
        base: o.eff.acFormula.base ?? 10,
        abilities: o.eff.acFormula.abilities,
        noArmor: o.eff.acFormula.noArmor,
        noShield: o.eff.acFormula.noShield,
      })
  }
  let mods: Record<AbilityId, number> | undefined
  const pool: Pool = {
    parts: (target: string, ctx?: { weaponKind?: 'melee' | 'ranged' }) =>
      entries
        .filter((e) => e.target === target)
        .filter((e) => !e.when || (ctx?.weaponKind && e.when === `${ctx.weaponKind}-weapon`))
        .map((e) => {
          const part = { ...e.part }
          if (e.pending) {
            const owner = b.owners.find((o) => o.id === e.part.sourceId)
            part.value = (mods ? resolveValue(e.pending, b, owner, mods) : undefined) ?? 0
          }
          return part
        }),
    advantage: (on: string) => adv[on] ?? [],
    disadvantage: (on: string) => dis[on] ?? [],
    flags,
    grants,
    acFormulas,
    toggles,
    dice,
    setAbilityMods: (m) => {
      mods = m
    },
  }
  return { pool }
}

export { ABILITIES }
export type { AbilityId, GrantSpec, ModifierSpec }
