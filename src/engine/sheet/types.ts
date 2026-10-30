// Types of the computed character sheet (engine/compute.ts) and of what the stages hand to each other.
import type { Rules } from '../../data/rules'
import type {
  AbilityId,
  ArmorDef,
  BackgroundDef,
  ClassDef,
  ClassFeatureDef,
  EffectDef,
  FeatDef,
  GrantSpec,
  I18n,
  ModifierSpec,
  SkillId,
  Source,
  SpeciesDef,
  SpeciesTraitDef,
  SubclassDef,
  WeaponDef,
  Weight,
} from '../../data/types'
import type { Character, FeatPick, ItemInstance, LevelEntry } from '../../model/character'
import type { Part, Stat } from '../stacking'

export interface ComputeOptions {
  /** Compute the build as it was at this character level (for legality checks). */
  level?: number
}

/** Something that carries rules effects: a class feature, feat, species trait, condition, item or active effect. */
export interface Owner {
  id: string
  kind: 'feature' | 'subclass-feature' | 'feat' | 'trait' | 'condition' | 'item' | 'effect' | 'option'
  name: I18n
  text?: I18n
  source?: Source
  classId?: string
  level?: number
  /** The hand-written effect entry, as written. */
  effect?: EffectDef
  /** The effect with the chosen options merged in (what the stages read). */
  eff: EffectDef
  modifiers: ModifierSpec[]
  grants: GrantSpec[]
  /** The feat pick for a feat owner (ability increases and feat choices). */
  pick?: FeatPick
  /** A feat owner's feat id and where the feat comes from. A repeatable feat taken again (Magic Initiate from the
   * background and from Versatile) is a second owner `feat:<id>@<where>` reading the same effect (`effectId`). */
  feat?: { id: string; from: BuildResult['feats'][number]['from']; level?: number; grantedBy?: string }
  /** Owner id of the feature this option was chosen for (an Eldritch Invocation's owner is 'warlock:eldritch-invocations'). */
  optionOf?: string
  /** Resolved values of the owner's choices, by choice id ('choice' when the choice has no id). */
  choiceValues: Record<string, string[]>
  /** Id of the effect entry when it differs from the owner id: an inventory item `item:<uid>` reads `item:<magic item id>`. */
  effectId?: string
  /** An item owner's inventory uid: its 'item.*' parts (attack, damage, extra dice) apply to that weapon only. */
  itemUid?: string
}

export interface BuildResult {
  char: Character
  rules: Rules
  levels: LevelEntry[]
  level: number
  classLevels: Record<string, number>
  /** Class ids in the order they were first taken (the first one gives the saving-throw proficiencies, SRD p. 25). */
  classOrder: string[]
  classes: Map<string, ClassDef>
  subclasses: Map<string, SubclassDef>
  species: SpeciesDef | undefined
  background: BackgroundDef | undefined
  features: { def: ClassFeatureDef; classId: string; classLevel: number }[]
  traits: SpeciesTraitDef[]
  /** Feats with where they come from; `grantedBy` names the feature or trait that granted an extra one. */
  feats: { def: FeatDef; from: 'background' | 'level' | 'class' | 'species'; level?: number; grantedBy?: string }[]
  owners: Owner[]
  /** Every stored choice: `Character.featureChoices` then `LevelEntry.choices` (a level entry wins). */
  choices: Record<string, string | string[]>
  /** Items on the body, in hand, carried… */
  worn: ItemInstance[]
  armor: { item: ItemInstance; def: ArmorDef } | undefined
  shield: { item: ItemInstance; def: ArmorDef } | undefined
  weapons: { item: ItemInstance; def: WeaponDef }[]
  /** Class-table values at the current class levels (the "resources" columns), by class id. */
  tableValues: Record<string, Record<string, number | string>>
}

export interface Pool {
  /** Parts by target ('ac', 'speed', 'ability.str', 'save.dex', 'skill.stealth', 'attack.melee'…); weapon-conditioned
   * parts ('ranged-weapon', 'melee-weapon') are returned only for a matching weapon context. */
  parts(target: string, ctx?: { weaponKind?: 'melee' | 'ranged' }): Part[]
  /** Advantage / disadvantage sources on a roll ('initiative', 'save.dex', 'skill.stealth', 'check.str'). */
  advantage(on: string): I18n[]
  disadvantage(on: string): I18n[]
  flags: Set<string>
  grants: { owner: Owner; grant: GrantSpec }[]
  acFormulas: { owner: Owner; base: number; abilities: AbilityId[]; noArmor: boolean; noShield: boolean }[]
  /** Situational switches the Combat pane offers ('rage', 'reckless-attack', 'innate-sorcery'…). */
  toggles: { key: string; label: I18n; owner: Owner }[]
  /** Dice contributions ('extraDamage.melee' 1d6 Sneak Attack…), with their situational text. */
  dice: { target: string; dice: string; label: I18n; condition?: I18n; owner: Owner; when?: string }[]
  /** Set by the core stage once the ability scores are known, so ability-valued parts ('cha', 'wis:min1') resolve. */
  setAbilityMods(mods: Record<AbilityId, number>): void
}

export interface ModifiersResult {
  pool: Pool
}

export interface AbilityBlock {
  id: AbilityId
  score: Stat
  mod: number
  save: Stat
  saveProficient: boolean
}

export interface CoreResult {
  pb: number
  abilities: Record<AbilityId, AbilityBlock>
  hpMax: Stat
  hitDice: { classId: string; die: number; total: number; spent: number }[]
}

export interface AcOption {
  id: string
  label: I18n
  stat: Stat
  available: boolean
  reason?: I18n
}

export interface DefenseResult {
  ac: Stat
  acOptions: AcOption[]
  initiative: Stat
  speed: Stat
  /** Climb, Swim and Fly Speeds granted by features ('speed.climb' parts; the value 'speed' equals the walking Speed). */
  otherSpeeds: { kind: 'climb' | 'swim' | 'fly'; ft: number; from: I18n[] }[]
  carry: { capacity: Weight; dragLiftPush: Weight; load: Weight; encumbered: boolean }
  armorKnown: boolean
}

export type Proficiency = 'none' | 'half' | 'proficient' | 'expertise'

export interface SkillLine {
  id: SkillId
  name: I18n
  ability: AbilityId
  proficiency: Proficiency
  total: Stat
  passive: number
}

export interface SkillsResult {
  skills: SkillLine[]
  passivePerception: number
  /** Open Expertise picks the features allow (Rogue, Bard, Ranger Expertise…). */
  expertiseMax: number
}

export interface AttackLine {
  uid: string
  name: I18n
  weapon: WeaponDef
  ability: AbilityId
  proficient: boolean
  attack: Stat
  damage: { dice: string; type: I18n; bonus: Stat; versatile?: string }
  properties: I18n[]
  mastery: { id: string; name: I18n; usable: boolean }
  range?: { normal: I18n; long: I18n }
  notes: I18n[]
  /** Lowest d20 roll that is a Critical Hit (20; 19 with Improved Critical). */
  critRange: number
  /** Extra damage dice that may apply (Sneak Attack, Radiant Strikes, Rage…), with their situational text. */
  extraDamage: { label: I18n; dice: string; condition?: I18n; source?: Source }[]
}

export interface AttacksResult {
  attacks: AttackLine[]
  unarmed: AttackLine | undefined
  attacksPerAction: number
  /** Weapons whose mastery property the character may use (Weapon Mastery features, summed across classes). */
  masteryMax: number
}

export interface SpellcastingBlock {
  classId: string
  className: I18n
  ability: AbilityId
  mod: number
  dc: Stat
  attack: Stat
  /** 'subclass': spellcasting given by a custom subclass (house rule #5). */
  kind: 'full' | 'half' | 'pact' | 'subclass'
  /** Class spell list the spells come from (the class id, or the list a subclass names). */
  list: string
  /** Highest slot level and the slots (shared between Spellcasting classes, SRD p. 25). */
  cantripsMax: number
  preparedMax: number
  prepared: string[]
  cantrips: string[]
  spellbook?: string[]
  /** Spells always prepared for this class (subclass spell lists, Favored Enemy's Hunter's Mark…): not counted. */
  alwaysPrepared: string[]
  /** Other class lists this class may prepare from (Magical Secrets). */
  extraLists: string[]
  /** Highest spell level this class alone can prepare (its own table row; SRD p. 25 "as if single-classed"). */
  maxSpellLevel: number
  /** A subclass spell list that depends on a choice (Circle of the Land). */
  spellChoice?: { key: string; name: I18n; options: { id: string; name: I18n }[]; value: string }
  source: Source
}

/** Spells granted outside a class's Spellcasting (Magic Initiate, species lineages…). */
export interface ExtraSpells {
  ownerId: string
  name: I18n
  spells: string[]
  ability?: AbilityId
  source?: Source
}

export interface SpellsResult {
  spellcasting: SpellcastingBlock[]
  extraSpells: ExtraSpells[]
  /** Spell slots per level (index 0 = level 1), from one class table or the Multiclass Spellcaster table. */
  slots: number[]
  slotsUsed: number[]
  pact?: { slots: number; level: number; used: number }
  casterLevel: number
}

export interface Resource {
  id: string
  name: I18n
  max: number
  spent: number
  per: 'short' | 'long'
  shortRestRegain?: number
  source?: Source
}

/** A value a feature computes for the table (Stunning Strike DC, Deflect Attacks reduction…). */
export interface FeatureValue {
  ownerId: string
  owner: I18n
  id: string
  label: I18n
  dice?: string
  stat: Stat
  source?: Source
}

export interface ClassesResult {
  resources: Resource[]
  featureValues: FeatureValue[]
  /** Class-table values at the current class levels (resources column values). */
  tableValues: Record<string, Record<string, number | string>>
}

export interface Sheet
  extends
    Omit<BuildResult, 'char' | 'rules'>,
    CoreResult,
    DefenseResult,
    SkillsResult,
    AttacksResult,
    SpellsResult,
    ClassesResult {
  pool: Pool
  proficiencies: { armor: string[]; weapons: string[]; tools: string[]; languages: string[] }
  exhaustion: number
  /** D20 Test penalty from Exhaustion (−2 × level, SRD p. 181). */
  exhaustionPenalty: number
  conditions: { id: string; name: I18n }[]
}
