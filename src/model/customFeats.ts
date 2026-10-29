// Custom feats (house rule #4, user decision 2026-10-29): feats from other books (2024 Player's Handbook…) that the
// player enters in the character, in their own words with the book and page, so a level's feat (instead of the Ability
// Score Improvement), an Origin feat or a Fighting Style can be one of them. Nothing of those books ships with the app:
// the entries live only in the character file. `withCustomFeats` adds them to the feats (and their modifiers to the
// effects) for that character, so the engine, the checks, the popups and the PDF treat them like SRD feats.
import type { Rules } from '../data/rules'
import type { EffectDef, FeatCategory, FeatDef, I18n, Lang } from '../data/types'
import { ABILITY_SHORT } from '../engine/sheet/common'
import type { Character, CustomFeat } from './character'

export const CUSTOM_FEAT_HOUSE_RULE = 4

const same = (s: string): I18n => ({ en: s, fr: s, es: s })

export const FEAT_CATEGORY_NAMES: Record<FeatCategory, I18n> = {
  origin: { en: 'Origin Feat', fr: 'Don d’origine', es: 'Dote de origen' },
  general: { en: 'General Feat', fr: 'Don général', es: 'Dote general' },
  'fighting-style': { en: 'Fighting Style Feat', fr: 'Don de style de combat', es: 'Dote de estilo de combate' },
  'epic-boon': { en: 'Epic Boon Feat', fr: 'Don de faveur épique', es: 'Dote de don épico' },
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A new, empty custom feat with a unique id. */
export function newCustomFeat(existing: CustomFeat[] = []): CustomFeat {
  let n = existing.length + 1
  while (existing.some((f) => f.id === `custom-feat-${n}`)) n++
  return { id: `custom-feat-${n}`, name: '', category: 'general', book: '', text: '', modifiers: [] }
}

export function customFeatDef(f: CustomFeat): FeatDef {
  const prereqText = (l: Lang) =>
    [
      f.prereq?.level ? `${{ en: 'Level', fr: 'Niveau', es: 'Nivel' }[l]} ${f.prereq.level}+` : '',
      f.prereq?.abilities?.length
        ? `${f.prereq.abilities.map((a) => ABILITY_SHORT[a][l]).join('/')} ${f.prereq.min ?? 13}+`
        : '',
      f.prereq?.text ?? '',
    ]
      .filter(Boolean)
      .join(', ')
  const cat = FEAT_CATEGORY_NAMES[f.category]
  const prereqLabel = { en: 'Prerequisite', fr: 'Prérequis', es: 'Requisito' }
  const catText = (l: Lang) => {
    const p = prereqText(l)
    return p ? `${cat[l]} (${prereqLabel[l]}${l === 'fr' ? ' :' : ':'} ${p})` : (cat[l] ?? cat.en)
  }
  return {
    id: f.id,
    name: same(f.name.trim() || f.id),
    category: f.category,
    categoryText: { en: catText('en'), fr: catText('fr'), es: catText('es') },
    ...(f.prereq?.level || f.prereq?.abilities?.length || f.prereq?.text
      ? {
          prereq: {
            ...(f.prereq.level ? { level: f.prereq.level } : {}),
            ...(f.prereq.abilities?.length ? { abilities: { any: f.prereq.abilities, min: f.prereq.min ?? 13 } } : {}),
            ...(f.prereq.text ? { text: same(f.prereq.text) } : {}),
          },
        }
      : {}),
    ...(f.repeatable ? { repeatable: true } : {}),
    ...(f.abilityIncrease?.length ? { abilityIncrease: f.abilityIncrease } : {}),
    text: same(
      f.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
        .join(''),
    ),
    source: { book: f.book.trim(), houseRule: CUSTOM_FEAT_HOUSE_RULE },
  }
}

/** Effect entry of a custom feat: its modifiers (named after the feat, so two copies don't stack), else a note saying the
 * engine only shows its text. */
export function customFeatEffect(f: CustomFeat): EffectDef {
  const name = f.name.trim() || f.id
  const mods = (f.modifiers ?? []).filter((m) => m.target && m.value !== '' && m.value !== 0)
  return mods.length
    ? {
        id: `feat:${f.id}`,
        source: { book: f.book.trim(), houseRule: CUSTOM_FEAT_HOUSE_RULE },
        modifiers: mods.map((m) => ({ ...m, effectName: m.effectName ?? name })),
      }
    : {
        id: `feat:${f.id}`,
        source: { book: f.book.trim(), houseRule: CUSTOM_FEAT_HOUSE_RULE },
        textOnly: {
          en: 'Custom feat: its text is shown; apply its effects by hand or add modifiers to it.',
          fr: 'Don personnalisé : son texte est affiché ; appliquez ses effets à la main ou ajoutez-lui des modificateurs.',
          es: 'Dote personalizada: se muestra su texto; aplica sus efectos a mano o añádele modificadores.',
        },
      }
}

/** The rules with the character's custom feats added (the same object when there are none). */
export function withCustomFeats(rules: Rules, char: Pick<Character, 'customFeats'> | undefined): Rules {
  const list = char?.customFeats ?? []
  if (!list.length) return rules
  const feats = new Map(rules.feats)
  const effects = new Map(rules.effects)
  for (const f of list) {
    if (rules.feats.has(f.id)) continue
    feats.set(f.id, customFeatDef(f))
    effects.set(`feat:${f.id}`, customFeatEffect(f))
  }
  return { ...rules, feats, effects }
}

export const isCustomFeat = (id: string | undefined) => !!id?.startsWith('custom-feat-')
