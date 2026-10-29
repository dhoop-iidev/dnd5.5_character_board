// Custom species (house rule #6, user decision 2026-10-29): species from other books (Tabaxi…) that the player enters in
// the character, in their own words with the book and page. The 2024 rules give older species no ability score
// increases (the background gives them, SRD 5.2.1 p. 20), so a custom species has none. Each trait has a character level
// and a summary and, optionally, what the engine can use: Darkvision, other speeds, skill proficiencies, resistances,
// modifiers, uses per rest and the part of the turn it takes. Nothing from those books ships with the app.
// `withCustomSpecies` adds them to the species (and the traits' effects) for that character.
import type { Rules } from '../data/rules'
import type { ActivationDef, EffectDef, GrantSpec, I18n, ModifierSpec, SpeciesDef } from '../data/types'
import { SIZE_NAMES } from '../i18n/ui'
import type { Character, CustomSpecies, CustomSpeciesTrait } from './character'
import { paragraphs } from './customSubclasses'

export const CUSTOM_SPECIES_HOUSE_RULE = 6

const same = (s: string): I18n => ({ en: s, fr: s, es: s })
/** French SRD: 1,5 m per 5 ft (30 ft = 9 m). */
const dist = (ft: number) => ({ ft, m: Math.round((ft / 5) * 1.5 * 10) / 10 })

export function newCustomSpecies(existing: CustomSpecies[] = []): CustomSpecies {
  let n = existing.length + 1
  while (existing.some((s) => s.id === `custom-species-${n}`)) n++
  return {
    id: `custom-species-${n}`,
    name: '',
    book: '',
    text: '',
    creatureType: 'Humanoid',
    size: ['medium'],
    speedFt: 30,
    traits: [],
  }
}

export function newCustomTrait(sp: CustomSpecies): CustomSpeciesTrait {
  let n = sp.traits.length + 1
  while (sp.traits.some((t) => t.id === `t${n}`)) n++
  return { id: `t${n}`, level: 1, name: '', text: '' }
}

/** Owner id of a trait: `<species>:<trait>`, like the SRD species traits. */
export const traitId = (sp: CustomSpecies, t: CustomSpeciesTrait) => `${sp.id}:${t.id}`

const source = (sp: CustomSpecies) => ({ book: sp.book.trim(), houseRule: CUSTOM_SPECIES_HOUSE_RULE })

export function customSpeciesDef(sp: CustomSpecies): SpeciesDef {
  const sizes = sp.size.length ? sp.size : (['medium'] as const)
  const or = { en: ' or ', fr: ' ou ', es: ' o ' }
  const sizeText = {
    en: sizes.map((z) => SIZE_NAMES[z].en).join(or.en),
    fr: sizes.map((z) => SIZE_NAMES[z].fr).join(or.fr),
    es: sizes.map((z) => SIZE_NAMES[z].es).join(or.es),
  }
  return {
    id: sp.id,
    name: same(sp.name.trim() || sp.id),
    creatureType: same(sp.creatureType.trim() || 'Humanoid'),
    size: [...sizes],
    sizeText,
    speed: dist(sp.speedFt || 30),
    traits: [...sp.traits]
      .sort((a, b) => a.level - b.level)
      .map((t) => ({
        id: traitId(sp, t),
        name: same(t.name.trim() || t.id),
        text: same(paragraphs(t.text)),
        ...(t.level > 1 ? { level: t.level } : {}),
        source: source(sp),
      })),
    text: same(paragraphs(sp.text)),
    source: source(sp),
  }
}

/** Effect of a trait: what the player entered for the engine, else a note that only its text is shown. */
export function customTraitEffect(sp: CustomSpecies, t: CustomSpeciesTrait): EffectDef {
  const name = t.name.trim() || t.id
  const eff: EffectDef = { id: traitId(sp, t), source: source(sp) }
  const grants: GrantSpec[] = []
  if (t.darkvisionFt) grants.push({ kind: 'darkvision', value: t.darkvisionFt })
  for (const s of t.skills ?? []) grants.push({ kind: 'proficiency', on: `skill.${s}` })
  for (const d of t.resistances ?? []) grants.push({ kind: 'resistance', on: d })
  if (grants.length) eff.grants = grants
  const mods: ModifierSpec[] = (t.modifiers ?? [])
    .filter((m) => m.target && m.value !== '' && m.value !== 0)
    .map((m) => ({ ...m, effectName: m.effectName ?? name }))
  for (const kind of ['climb', 'swim', 'fly'] as const) {
    const v = t.speeds?.[kind]
    if (v) mods.push({ target: `speed.${kind}`, value: v, effectName: name })
  }
  if (mods.length) eff.modifiers = mods
  if (t.uses && t.uses.count !== '' && t.uses.count !== 0) eff.uses = { count: t.uses.count, per: t.uses.per }
  if (t.activation) {
    const a: ActivationDef = { kind: t.activation.kind }
    if (t.activation.trigger?.trim()) a.trigger = same(t.activation.trigger.trim())
    if (!eff.uses) a.cost = { amount: 0 }
    eff.activation = [a]
  }
  if (!eff.grants && !eff.modifiers && !eff.uses && !eff.activation)
    eff.textOnly = {
      en: 'Custom species trait: its text is shown; apply its effects by hand or add numbers to it.',
      fr: 'Trait d’espèce personnalisée : son texte est affiché ; appliquez ses effets à la main ou ajoutez-lui des valeurs.',
      es: 'Rasgo de especie personalizada: se muestra su texto; aplica sus efectos a mano o añádele valores.',
    }
  return eff
}

/** The rules with the character's custom species added (the same object when there are none). */
export function withCustomSpecies(rules: Rules, char: Pick<Character, 'customSpecies'> | undefined): Rules {
  const list = char?.customSpecies ?? []
  if (!list.length) return rules
  const species = new Map(rules.species)
  const effects = new Map(rules.effects)
  for (const sp of list) {
    if (species.has(sp.id)) continue
    species.set(sp.id, customSpeciesDef(sp))
    for (const t of sp.traits) effects.set(traitId(sp, t), customTraitEffect(sp, t))
  }
  return { ...rules, species, effects }
}

/** A species file to share between characters ("Export"/"Import" in the editor). */
export const SPECIES_FILE_KIND = 'custom-species'
export function speciesFile(sp: CustomSpecies) {
  return { kind: SPECIES_FILE_KIND, edition: 'srd-5.2.1', species: sp }
}
/** Read a species file; the species gets a fresh id when the character already has that one. */
export function readSpeciesFile(raw: unknown, existing: CustomSpecies[]): CustomSpecies {
  const data = raw as { kind?: string; species?: CustomSpecies }
  const sp = data?.species
  if (data?.kind !== SPECIES_FILE_KIND || !sp || typeof sp.name !== 'string' || !Array.isArray(sp.traits))
    throw new Error('not a custom species file')
  const copy: CustomSpecies = structuredClone(sp)
  if (existing.some((s) => s.id === copy.id)) copy.id = newCustomSpecies(existing).id
  return copy
}
