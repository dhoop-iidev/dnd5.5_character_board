// What the druid uses while shape-shifted (SRD 5.2.1 p. 42–43 "Rules While Shape-Shifted"): the Beast's game statistics
// replace the character's, except that the druid keeps creature type, Hit Points and Hit Point Dice, Intelligence,
// Wisdom and Charisma, class features, languages and feats, and keeps skill and saving-throw proficiencies with the
// character's Proficiency Bonus — "If a skill or saving throw modifier in the Beast's stat block is higher than yours,
// use the one in the stat block." Spells can't be cast. Each value says whose it is (`from`), so the UI can colour them.
import type { Rules } from '../data/rules'
import type { AbilityId, CreatureDef, I18n, SkillId } from '../data/types'
import { ABILITIES } from '../data/types'
import type { Character } from '../model/character'
import type { Sheet } from './sheet/types'
import { abilityMod } from './sheet/common'

export type From = 'beast' | 'you' | 'merged'

export interface WsValue {
  value: number
  from: From
  /** Short explanation for the popup ("Beast Dex +2 and your Proficiency Bonus +4"). */
  note?: I18n
}

export interface WildShapeView {
  form: CreatureDef
  hp: { current: number; temp: number; max: number }
  ac: WsValue
  speed: I18n
  initiative: WsValue
  pb: number
  abilities: Record<AbilityId, { score: WsValue; mod: WsValue; save: WsValue; saveProficient: boolean }>
  skills: { id: SkillId; name: I18n; ability: AbilityId; total: WsValue; proficient: boolean }[]
  passivePerception: number
  senses: I18n
  languages: I18n
  retained: I18n[]
}

const REPLACED: AbilityId[] = ['str', 'dex', 'con']

/** Parse "Perception +5, Stealth +4" into skill id → modifier. */
export function parseCreatureSkills(def: CreatureDef, rules: Rules): Partial<Record<SkillId, number>> {
  const out: Partial<Record<SkillId, number>> = {}
  const text = def.skills?.en ?? ''
  for (const m of text.matchAll(/([A-Za-z' ]+?)\s+([+−-]\d+)/g)) {
    const name = m[1].trim().toLowerCase()
    const skill = [...rules.skills.values()].find((s) => s.name.en.toLowerCase() === name)
    if (skill) out[skill.id] = parseInt(m[2].replace('−', '-'), 10)
  }
  return out
}

export function wildShapeView(char: Character, sheet: Sheet, def: CreatureDef, rules: Rules): WildShapeView {
  const pb = sheet.pb
  const abilities = {} as WildShapeView['abilities']
  for (const id of ABILITIES) {
    const mine = sheet.abilities[id]
    const beast = def.abilities[id]
    const replaced = REPLACED.includes(id)
    const score: WsValue = replaced ? { value: beast.score, from: 'beast' } : { value: mine.score.total, from: 'you' }
    const mod: WsValue = replaced ? { value: beast.mod, from: 'beast' } : { value: mine.mod, from: 'you' }
    // Your saving throw with the form's ability modifier (proficiency and other bonuses kept), or the stat block's if higher.
    const yours = mod.value + (mine.save.total - mine.mod)
    const save: WsValue =
      beast.save > yours
        ? {
            value: beast.save,
            from: 'beast',
            note: {
              en: `Stat block ${fmt(beast.save)} is higher than yours (${fmt(yours)})`,
              fr: `Le profil (${fmt(beast.save)}) dépasse le vôtre (${fmt(yours)})`,
              es: `El perfil (${fmt(beast.save)}) es mayor que el tuyo (${fmt(yours)})`,
            },
          }
        : {
            value: yours,
            from: replaced ? 'merged' : 'you',
            note: replaced
              ? {
                  en: `Form's ${id.toUpperCase()} ${fmt(mod.value)} + your bonuses ${fmt(mine.save.total - mine.mod)}`,
                  fr: `${id.toUpperCase()} de la forme ${fmt(mod.value)} + vos bonus ${fmt(mine.save.total - mine.mod)}`,
                  es: `${id.toUpperCase()} de la forma ${fmt(mod.value)} + tus bonificadores ${fmt(mine.save.total - mine.mod)}`,
                }
              : undefined,
          }
    abilities[id] = { score, mod, save, saveProficient: mine.saveProficient }
  }
  const beastSkills = parseCreatureSkills(def, rules)
  const skills: WildShapeView['skills'] = sheet.skills.map((s) => {
    const myMod = sheet.abilities[s.ability].mod
    const formMod = abilities[s.ability].mod.value
    const yours = s.total.total - myMod + formMod
    const b = beastSkills[s.id]
    const total: WsValue =
      b !== undefined && b > yours
        ? {
            value: b,
            from: 'beast',
            note: {
              en: `Stat block ${fmt(b)} is higher than yours (${fmt(yours)})`,
              fr: `Le profil (${fmt(b)}) dépasse le vôtre (${fmt(yours)})`,
              es: `El perfil (${fmt(b)}) es mayor que el tuyo (${fmt(yours)})`,
            },
          }
        : { value: yours, from: REPLACED.includes(s.ability) ? 'merged' : 'you' }
    return {
      id: s.id,
      name: s.name,
      ability: s.ability,
      total,
      proficient: s.proficiency !== 'none' && s.proficiency !== 'half',
    }
  })
  const perception = skills.find((s) => s.id === 'perception')
  const myDex = sheet.abilities.dex.mod
  const initiative: WsValue = {
    value: sheet.initiative.total - myDex + def.abilities.dex.mod,
    from: 'merged',
    note: {
      en: `Form's Dex ${fmt(def.abilities.dex.mod)} + your other Initiative bonuses ${fmt(sheet.initiative.total - myDex)}`,
      fr: `Dex de la forme ${fmt(def.abilities.dex.mod)} + vos autres bonus d’Initiative ${fmt(sheet.initiative.total - myDex)}`,
      es: `Des de la forma ${fmt(def.abilities.dex.mod)} + tus otros bonificadores de Iniciativa ${fmt(sheet.initiative.total - myDex)}`,
    },
  }
  return {
    form: def,
    hp: { current: char.hp.current, temp: char.hp.temp, max: sheet.hpMax.total },
    ac: { value: def.ac ?? 10, from: 'beast' },
    speed: def.speed.text,
    initiative,
    pb,
    abilities,
    skills,
    passivePerception: 10 + (perception?.total.value ?? 0),
    senses: def.senses,
    languages: sheet.proficiencies.languages.length
      ? {
          en: sheet.proficiencies.languages.join(', '),
          fr: sheet.proficiencies.languages.join(', '),
          es: sheet.proficiencies.languages.join(', '),
        }
      : { en: '—', fr: '—', es: '—' },
    retained: [
      {
        en: 'Hit Points, Hit Point Dice and Temporary HP are yours',
        fr: 'Points de vie, dés de vie et PV temporaires sont les vôtres',
        es: 'Los puntos de golpe, los dados de puntos de golpe y los puntos de golpe temporales son los tuyos',
      },
      {
        en: 'Intelligence, Wisdom, Charisma, class features, feats and languages are yours',
        fr: 'Intelligence, Sagesse, Charisme, aptitudes de classe, dons et langues sont les vôtres',
        es: 'Inteligencia, Sabiduría, Carisma, rasgos de clase, dotes e idiomas son los tuyos',
      },
      {
        en: 'Saving throws and skills: your proficiencies with your Proficiency Bonus, or the stat block when higher',
        fr: 'Jets de sauvegarde et compétences : vos maîtrises avec votre bonus de maîtrise, ou le profil s’il est plus élevé',
        es: 'Tiradas de salvación y habilidades: tus competencias con tu bonificador por competencia, o el perfil si es mayor',
      },
      {
        en: 'No spellcasting; Concentration continues',
        fr: 'Pas de sorts ; la Concentration se poursuit',
        es: 'No puedes lanzar conjuros; la Concentración continúa',
      },
    ],
  }
}

export const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
export { abilityMod }
