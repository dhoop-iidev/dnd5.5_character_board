// Custom background (house rule #3, user decision 2026-10-29): the player builds a background with the same parts as
// the SRD's (SRD 5.2.1 p. 83 "Background Descriptions"): three abilities for the +2/+1 or +1/+1/+1, one Origin feat,
// two skill proficiencies, one tool proficiency; equipment = 50 GP (option B of every SRD background). No text from
// other books: the picks are the player's. `backgroundDef` turns it into an ordinary `BackgroundDef`, so the engine,
// the checks, the popups and the PDF treat it like an SRD background.
import type { Rules } from '../data/rules'
import type { BackgroundDef, GearDef, FeatDef } from '../data/types'
import type { Background } from './character'

export const CUSTOM_BACKGROUND = 'custom'
export const CUSTOM_BACKGROUND_HOUSE_RULE = 3
export const CUSTOM_BACKGROUND_GP = 50

const NAME = { en: 'Custom background', fr: 'Historique personnalisé', es: 'Trasfondo personalizado' }

/** Origin feats the custom background can grant (SRD p. 87 "Origin Feats"). */
export const originFeats = (rules: Rules): FeatDef[] => [...rules.feats.values()].filter((f) => f.category === 'origin')

/** Tools the custom background can grant (SRD p. 93 "Tools"). */
export const toolList = (rules: Rules): GearDef[] => [...rules.gear.values()].filter((g) => g.kind === 'tool')

/** The background's definition: the SRD one, or the custom one built from the player's picks. */
export function backgroundDef(bg: Background | undefined, rules: Rules): BackgroundDef | undefined {
  if (bg?.backgroundId !== CUSTOM_BACKGROUND) return rules.backgrounds.get(bg?.backgroundId ?? '')
  const custom = bg.custom ?? { abilities: [], skills: [], tool: '' }
  const name = custom.name?.trim() ? { en: custom.name, fr: custom.name, es: custom.name } : NAME
  const feat = rules.feats.get(bg.feat?.featId ?? '')
  const tool = rules.gear.get(custom.tool)
  const gp = { en: `${CUSTOM_BACKGROUND_GP} GP`, fr: `${CUSTOM_BACKGROUND_GP} po`, es: `${CUSTOM_BACKGROUND_GP} po` }
  return {
    id: CUSTOM_BACKGROUND,
    name,
    abilities: [...custom.abilities],
    feat: bg.feat?.featId ?? '',
    featText: feat?.name ?? { en: '', fr: '', es: '' },
    skills: [...custom.skills],
    tool: tool?.name ?? { en: '', fr: '', es: '' },
    equipment: gp,
    text: {
      en: `<p>A background built by the player (house rule #${CUSTOM_BACKGROUND_HOUSE_RULE}), with the parts of an SRD background: three abilities for the +2/+1 or +1/+1/+1, one Origin feat, two skill proficiencies, one tool proficiency and ${gp.en} of equipment.</p>`,
      fr: `<p>Un historique composé par le joueur (règle maison n° ${CUSTOM_BACKGROUND_HOUSE_RULE}), avec les éléments d’un historique du SRD : trois caractéristiques pour le +2/+1 ou +1/+1/+1, un don d’origine, deux maîtrises de compétence, une maîtrise d’outils et ${gp.fr} d’équipement.</p>`,
      es: `<p>Un trasfondo creado por el jugador (regla de la casa n.º ${CUSTOM_BACKGROUND_HOUSE_RULE}), con las partes de un trasfondo del SRD: tres características para el +2/+1 o +1/+1/+1, una dote de origen, dos competencias en habilidades, una competencia con herramientas y ${gp.es} de equipo.</p>`,
    },
    source: {
      page: 83,
      frPage: 87,
      esPage: 89,
      section: 'Character Origins > Background Descriptions',
      houseRule: CUSTOM_BACKGROUND_HOUSE_RULE,
    },
  }
}
