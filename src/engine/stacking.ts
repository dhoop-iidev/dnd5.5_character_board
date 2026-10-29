// Combining numeric effects (D&D 2024). There are no typed bonuses: every contribution adds up, except that
// - a situational part counts only when switched on;
// - the same effect never applies twice: parts sharing an `effectName` (the same spell cast twice, the same feature
//   from two classes, the same magic item worn twice) keep only the most potent one — SRD 5.2.1 p. 106 "Combining
//   Spell Effects" ("The effects of the same spell cast multiple times don't combine… the most potent effect applies"),
//   p. 8 "The Bonus Doesn't Stack" (the Proficiency Bonus is never added twice), p. 25 "Extra Attack" (features don't stack).
import type { I18n, Source } from '../data/types'

/** One contribution to a computed value, as shown in the breakdown popup. */
export interface Part {
  /** Stable id of what produced it (feature id, item uid, effect uid…). */
  sourceId: string
  label: I18n
  value: number
  /** Parts with the same name don't combine (the most potent applies). */
  effectName?: string
  source?: Source
  /** Situational text; the part only counts when `situationalOn` is true. */
  condition?: I18n
  situationalOn?: boolean
  /** Key in character.toggles that switches this part on/off. */
  toggleKey?: string
  /** Filled by `resolve`: whether the part counts in the total. */
  active?: boolean
  inactiveReason?: 'situational' | 'sameName'
}

export interface Stat {
  total: number
  parts: Part[]
  /** Sources of Advantage / Disadvantage on the roll this value feeds (they cancel out, never stack: SRD p. 8). */
  advantage?: I18n[]
  disadvantage?: I18n[]
}

export function resolve(parts: Part[], extra: { advantage?: I18n[]; disadvantage?: I18n[] } = {}): Stat {
  const out = parts.map((p) => ({ ...p, active: true, inactiveReason: undefined as Part['inactiveReason'] }))
  for (const p of out) {
    if (p.condition && !p.situationalOn) {
      p.active = false
      p.inactiveReason = 'situational'
    }
  }
  const byName = new Map<string, typeof out>()
  for (const p of out) {
    if (!p.active || !p.effectName) continue
    byName.set(p.effectName, [...(byName.get(p.effectName) ?? []), p])
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue
    const keep = group.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a))
    for (const p of group) if (p !== keep) Object.assign(p, { active: false, inactiveReason: 'sameName' })
  }
  const total = out.filter((p) => p.active).reduce((s, p) => s + p.value, 0)
  const stat: Stat = { total, parts: out }
  if (extra.advantage?.length) stat.advantage = extra.advantage
  if (extra.disadvantage?.length) stat.disadvantage = extra.disadvantage
  return stat
}

/** Net roll state once Advantage and Disadvantage cancel each other (SRD 5.2.1 p. 8). */
export function rollState(stat: Stat): 'advantage' | 'disadvantage' | 'normal' {
  const a = stat.advantage?.length ?? 0
  const d = stat.disadvantage?.length ?? 0
  if (a && !d) return 'advantage'
  if (d && !a) return 'disadvantage'
  return 'normal'
}

/** Engine-made text in the three languages (every engine label and message carries Spanish). */
export const i18n = (en: string, fr: string, es: string): I18n => ({ en, fr, es })

/** Spanish text of an I18n (data may lack it: falls back to English). */
export const esOf = (t: I18n | undefined): string => t?.es || t?.en || ''

/** "+3" / "−1" / "0" (signed, typographic minus). */
export const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
