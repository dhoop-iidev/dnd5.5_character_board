// Shared helpers and small rule tables of the sheet stages. Rules: SRD 5.2.1 (page numbers in comments).
import type { AbilityId, I18n, Source, Weight } from '../../data/types'
import type { Rules } from '../../data/rules'
import { ABILITIES } from '../../data/types'
import { i18n } from '../stacking'

/** Ability modifier: (score − 10) / 2 rounded down (SRD p. 6 "Ability Modifiers"). */
export const abilityMod = (score: number) => Math.floor((score - 10) / 2)

export const ABILITY_NAMES: Record<AbilityId, I18n> = {
  str: i18n('Strength', 'Force', 'Fuerza'),
  dex: i18n('Dexterity', 'Dextérité', 'Destreza'),
  con: i18n('Constitution', 'Constitution', 'Constitución'),
  int: i18n('Intelligence', 'Intelligence', 'Inteligencia'),
  wis: i18n('Wisdom', 'Sagesse', 'Sabiduría'),
  cha: i18n('Charisma', 'Charisme', 'Carisma'),
}
export const ABILITY_SHORT: Record<AbilityId, I18n> = {
  str: i18n('Str', 'For', 'Fue'),
  dex: i18n('Dex', 'Dex', 'Des'),
  con: i18n('Con', 'Con', 'Con'),
  int: i18n('Int', 'Int', 'Int'),
  wis: i18n('Wis', 'Sag', 'Sab'),
  cha: i18n('Cha', 'Cha', 'Car'),
}
export { ABILITIES }

/** Proficiency Bonus by total character level (SRD p. 23 "Character Advancement"). */
export const pbForLevel = (rules: Rules, level: number) =>
  rules.tables.proficiencyBonus[Math.min(20, Math.max(1, level)) - 1]

/** Weights computed by the engine: the French SRD prints 1 kg for 2 lb (e.g. Carrying Capacity table). */
export const lbToWeight = (lb: number): Weight => ({ lb, kg: lb / 2 })

export const src = (page: number, frPage?: number, section?: string): Source => {
  const s: Source = { page }
  if (frPage) s.frPage = frPage
  if (section) s.section = section
  return s
}

/** Pages of the core rules the engine cites (SRD 5.2.1 English / French PDF). */
export const SRC = {
  abilityModifiers: src(6, 6, 'Playing the Game > Ability Modifiers'),
  proficiencyBonus: src(23, 24, 'Character Creation > Level Advancement'),
  hitPoints: src(23, 24, 'Character Creation > Gaining a Level'),
  level1Hp: src(22, 23, 'Character Creation > Hit Points'),
  armorClass: src(177, 188, 'Rules Glossary > Armor Class'),
  armorTable: src(92, 98, 'Equipment > Armor'),
  initiative: src(13, 13, 'Playing the Game > Initiative'),
  speed: src(14, 14, 'Playing the Game > Speed'),
  carrying: src(178, 189, 'Rules Glossary > Carrying Capacity'),
  skills: src(9, 9, 'Playing the Game > Skill Proficiencies'),
  passive: src(9, 9, 'Playing the Game > Passive Checks'),
  saves: src(7, 7, 'Playing the Game > Saving Throws'),
  attackRoll: src(7, 7, 'Playing the Game > Attack Rolls'),
  weaponProficiency: src(89, 95, 'Equipment > Weapon Proficiency'),
  unarmedStrike: src(190, 201, 'Rules Glossary > Unarmed Strike'),
  spellcasting: src(23, 24, 'Character Creation > Spellcasting'),
  multiclassSlots: src(25, 27, 'Character Creation > Multiclassing > Spellcasting'),
  multiclassProficiencies: src(25, 26, 'Character Creation > Multiclassing > Proficiencies'),
  exhaustion: src(181, 192, 'Rules Glossary > Exhaustion'),
  heavyArmorStrength: src(92, 98, 'Equipment > Armor > Strength'),
  expertise: src(181, 192, 'Rules Glossary > Expertise'),
  spellSaveDc: src(23, 24, 'Character Creation > Spellcasting'),
}

/** "+10 ft." / "1d6" / 3 -> number when it holds one. */
export function tableNumber(v: number | string | undefined): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return undefined
  const m = v.replace('−', '-').match(/[-+]?\d+/)
  return m ? parseInt(m[0], 10) : undefined
}

/** Fixed hit points of a Hit Point Die when the player doesn't roll (SRD p. 23 "Fixed Hit Points by Class": half + 1). */
export const fixedHp = (die: number) => die / 2 + 1
