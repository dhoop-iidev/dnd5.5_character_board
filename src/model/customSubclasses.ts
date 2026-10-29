// Custom subclasses (house rule #5, user decision 2026-10-29): subclasses from other books (the 2024 Player's Handbook
// has four per class, the SRD one) that the player enters in the character, in their own words with the book and page.
// Each feature has a level, a summary and, optionally, what the engine can use: modifiers, uses per rest, the part of
// the turn it takes (a card in the Combat pane's turn box) and a list of named options to choose from (maneuvers…). The
// subclass may also give always-prepared spells by class level (for a class that casts spells). Nothing from those books
// ships with the app. `withCustomSubclasses` adds them to their class (and the features' effects) for that character.
import type { Rules } from '../data/rules'
import type { ActivationDef, ClassDef, EffectDef, I18n, OptionEffect, SubclassDef } from '../data/types'
import type { Character, CustomSubclass, CustomSubclassFeature } from './character'

export const CUSTOM_SUBCLASS_HOUSE_RULE = 5

const same = (s: string): I18n => ({ en: s, fr: s, es: s })
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** The player's text as HTML paragraphs (blank lines separate them). */
export const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function newCustomSubclass(classId: string, existing: CustomSubclass[] = []): CustomSubclass {
  let n = existing.length + 1
  while (existing.some((s) => s.id === `custom-subclass-${n}`)) n++
  return { id: `custom-subclass-${n}`, classId, name: '', book: '', text: '', features: [] }
}

export function newCustomFeature(sub: CustomSubclass): CustomSubclassFeature {
  let n = sub.features.length + 1
  while (sub.features.some((f) => f.id === `f${n}`)) n++
  return { id: `f${n}`, level: 3, name: '', text: '' }
}

/** Owner id of a feature: `<class>:<subclass>:<feature>`, like the SRD subclass features. */
export const featureId = (sub: CustomSubclass, f: CustomSubclassFeature) => `${sub.classId}:${sub.id}:${f.id}`

const source = (sub: CustomSubclass) => ({ book: sub.book.trim(), houseRule: CUSTOM_SUBCLASS_HOUSE_RULE })

export function customSubclassDef(sub: CustomSubclass): SubclassDef {
  return {
    id: sub.id,
    name: same(sub.name.trim() || sub.id),
    text: same(paragraphs(sub.text)),
    features: [...sub.features]
      .sort((a, b) => a.level - b.level)
      .map((f) => ({
        id: featureId(sub, f),
        level: f.level,
        name: same(f.name.trim() || f.id),
        text: same(paragraphs(f.text)),
        source: source(sub),
        subclass: sub.id,
      })),
    ...(sub.spells?.length ? { spells: sub.spells.map((l) => ({ level: l.level, spells: [...l.spells] })) } : {}),
    source: source(sub),
  }
}

/** Effect of a feature: what the player entered for the engine, else a note that only its text is shown. */
export function customFeatureEffect(sub: CustomSubclass, f: CustomSubclassFeature): EffectDef {
  const name = f.name.trim() || f.id
  const eff: EffectDef = { id: featureId(sub, f), source: source(sub) }
  const mods = (f.modifiers ?? []).filter((m) => m.target && m.value !== '' && m.value !== 0)
  if (mods.length) eff.modifiers = mods.map((m) => ({ ...m, effectName: m.effectName ?? name }))
  if (f.uses && f.uses.count !== '' && f.uses.count !== 0)
    eff.uses = {
      count: f.uses.count,
      per: f.uses.per,
      ...(f.uses.byLevel && Object.keys(f.uses.byLevel).length ? { byLevel: { ...f.uses.byLevel } } : {}),
    }
  if (f.activation) {
    const a: ActivationDef = { kind: f.activation.kind }
    if (f.activation.trigger?.trim()) a.trigger = same(f.activation.trigger.trim())
    if (!eff.uses) a.cost = { amount: 0 }
    eff.activation = [a]
  }
  const opts = (f.choice?.options ?? []).map((o) => o.trim()).filter(Boolean)
  if (f.choice && opts.length) {
    const options: Record<string, OptionEffect> = {}
    for (const o of opts) options[slug(o) || o] = { name: same(o) }
    eff.choices = [
      {
        kind: 'option',
        name: same(f.choice.name.trim() || name),
        count: f.choice.count || 1,
        ...(f.choice.byLevel && Object.keys(f.choice.byLevel).length ? { byLevel: { ...f.choice.byLevel } } : {}),
        options,
      },
    ]
  }
  if (!eff.modifiers && !eff.uses && !eff.activation && !eff.choices)
    eff.textOnly = {
      en: 'Custom subclass feature: its text is shown; apply its effects by hand or add numbers to it.',
      fr: 'Aptitude de sous-classe personnalisée : son texte est affiché ; appliquez ses effets à la main ou ajoutez-lui des valeurs.',
      es: 'Rasgo de subclase personalizada: se muestra su texto; aplica sus efectos a mano o añádele valores.',
    }
  return eff
}

/** The rules with the character's custom subclasses added to their classes (the same object when there are none). */
export function withCustomSubclasses(rules: Rules, char: Pick<Character, 'customSubclasses'> | undefined): Rules {
  const list = char?.customSubclasses ?? []
  if (!list.length) return rules
  const classes = new Map(rules.classes)
  const effects = new Map(rules.effects)
  for (const sub of list) {
    const cls = classes.get(sub.classId)
    if (!cls || cls.subclasses.some((s) => s.id === sub.id)) continue
    classes.set(sub.classId, { ...cls, subclasses: [...cls.subclasses, customSubclassDef(sub)] } as ClassDef)
    for (const f of sub.features) effects.set(featureId(sub, f), customFeatureEffect(sub, f))
  }
  return { ...rules, classes, effects }
}

/** Parse "7:5, 15:6" (class level: count) into a byLevel table; the reverse for display. */
export function parseSteps(s: string): Record<string, number> | undefined {
  const out: Record<string, number> = {}
  for (const m of s.matchAll(/(\d+)\s*:\s*(\d+)/g)) out[m[1]] = +m[2]
  return Object.keys(out).length ? out : undefined
}
export const stepsText = (t: Record<string, number> | undefined) =>
  Object.entries(t ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join(', ')

/** A subclass file to share between characters ("Export"/"Import" in the editor). */
export const SUBCLASS_FILE_KIND = 'custom-subclass'
export function subclassFile(sub: CustomSubclass) {
  return { kind: SUBCLASS_FILE_KIND, edition: 'srd-5.2.1', subclass: sub }
}
/** Read a subclass file; the subclass gets a fresh id when the character already has that one. */
export function readSubclassFile(raw: unknown, existing: CustomSubclass[]): CustomSubclass {
  const data = raw as { kind?: string; subclass?: CustomSubclass }
  const sub = data?.subclass
  if (data?.kind !== SUBCLASS_FILE_KIND || !sub || typeof sub.classId !== 'string' || !Array.isArray(sub.features))
    throw new Error('not a custom subclass file')
  const copy: CustomSubclass = structuredClone(sub)
  if (existing.some((s) => s.id === copy.id)) copy.id = newCustomSubclass(copy.classId, existing).id
  return copy
}
