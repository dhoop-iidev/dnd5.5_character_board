// Data contract of the generated SRD 5.2.1 JSON (src/data/srd/*.json) and the hand-written custom data
// (src/data/custom/*.json). tools/*.py produce these shapes; tools/validate_data.py checks them.
// Rules: D&D 2024 (SRD 5.2.1) only. Every entry cites its SRD page in both PDFs (Source).

export type Lang = 'en' | 'fr' | 'es'
/** Bilingual text. Rules text (`text` fields) is the verbatim SRD paragraph(s) as HTML (<p>, <ul>, <strong>, <em>,
 * <table>), English from SRD_CC_v5.2.1.pdf, French from FR_SRD_CC_v5.2.1.pdf and Spanish from SP_SRD_CC_v5.2.1.pdf
 * (CC-BY-4.0, see public/CC-BY.txt). `es` is optional: hand-written data may lack it, and tr() then falls back to English. */
export interface I18n {
  en: string
  fr: string
  es?: string
}

/** Where a rule comes from: the page of the English SRD 5.2.1 PDF and of the official French PDF, plus the section
 * heading. `houseRule` points to a row of docs/house-rules.md. The SRD is published at https://www.dndbeyond.com/srd. */
export interface Source {
  page?: number
  frPage?: number
  /** Page of the official Spanish PDF (SP_SRD_CC_v5.2.1.pdf). */
  esPage?: number
  section?: string
  houseRule?: number
  /** A book outside the SRD and its page, as the player typed it (custom feats, house rule #4). */
  book?: string
}

/** Both units as printed in the two PDFs (English: lb / ft; French: kg / m). */
export interface Weight {
  lb: number
  kg: number
}
export interface Distance {
  ft: number
  m: number
}

export type AbilityId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export const ABILITIES: AbilityId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export type SkillId =
  | 'acrobatics'
  | 'animal-handling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleight-of-hand'
  | 'stealth'
  | 'survival'

export interface SkillDef {
  id: SkillId
  name: I18n
  ability: AbilityId
  /** "Skill Descriptions" sentence (SRD p. 9). */
  text: I18n
  source: Source
}

export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder'

export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact'
export type RestKind = 'short' | 'long'
export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield'
export type WeaponCategory = 'simple' | 'martial'
export type School =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation'

// ---------- effects: what a feature, feat, species trait, item or condition changes ----------

/**
 * A numeric change to a computed value. Targets: 'ac', 'ac.base' (an alternative base formula, value is a formula id),
 * 'initiative', 'speed', 'hp.max', 'hp.perLevel', 'ability.<id>', 'ability.<id>.max', 'save.<id>', 'skill.<id>',
 * 'attack.melee', 'attack.ranged', 'attack.spell', 'damage.melee', 'damage.ranged', 'spell.dc', 'passive.<skill>',
 * 'carry', 'attunement.max', 'pb' (a proficiency-bonus multiple is written as the string 'pb'). 2024 has no typed
 * bonuses: `effectName` implements "same name, no stacking" (Rules Glossary, SRD p. 180); it defaults to the owner's name.
 */
export interface ModifierSpec {
  target: string
  /** A number; 'pb' / 'half-pb'; 'level'; '<class>Level', '<class>Level*5', '<class>Level/2' (rounded down); an ability
   * id ('cha' = the modifier, 'cha:min1' = at least 1); a class-table column id ('rageDamage', 'unarmoredMovement',
   * 'sneakAttack' — a dice column feeds `extraDamage.*` targets); 'speed' (the walking Speed, for 'speed.climb'…). */
  value: number | string
  effectName?: string
  /** Applies only when the engine condition holds: 'no-armor', 'no-heavy-armor', 'no-armor-no-shield', 'armor',
   * 'ranged-weapon', 'melee-weapon', or 'toggle:<key>' (a switch in the Combat pane, e.g. 'toggle:rage'). */
  when?: string
  condition?: I18n
  /** Magic items with a variant table (Weapon, +1, +2, or +3; Belt of Giant Strength): the value for each variant, by its
   * index in `MagicItemDef.variants` (`ItemInstance.variant`), instead of `value`. */
  byVariant?: (number | string)[]
  /** For dice targets ('extraDamage.*'): the dice by class level ({ "7": "1d8", "14": "2d8" }), instead of `value`. */
  diceByLevel?: Record<string, string>
}

/** A choice the player makes for an owner (class feature, subclass feature, species trait, feat, class option). The value is
 * stored in `LevelEntry.choices` / `Character.featureChoices` under the owner id (or `<owner id>#<choice id>` when the
 * owner has several choices), or in `FeatPick.choices[<choice id>]` for a feat; a 'feat' choice is a `FeatPick` in
 * `Character.extraFeats[<owner id>]`. */
export interface ChoiceDef {
  /** Needed when the owner has several choices; defaults to 'choice'. */
  id?: string
  kind:
    | 'option' // one of `options` (inline effects), or `from` a class option list ('eldritch-invocation', 'metamagic')
    | 'skill' // skill proficiency; `from` = skill ids or omitted for any
    | 'expertise' // Expertise in proficient skills (counted against `count`); `from` restricts the skills
    | 'spell' // spell ids; `list` = class list ids, `level` = exact spell level, `maxLevel`
    | 'damage-type'
    | 'feat' // an extra feat (`category` restricts it)
    | 'language'
    | 'tool'
    | 'text'
  name?: I18n
  /** How many picks: a number, a class-table column id ('invocations'), with `byLevel` steps by class level. */
  count?: number | string
  byLevel?: Record<string, number>
  from?: string | string[]
  options?: Record<string, OptionEffect>
  list?: string[]
  level?: number
  maxLevel?: number
  category?: 'origin' | 'general' | 'fighting-style' | 'epic-boon'
  /** A 'skill' choice that also accepts tools (Skilled: "three skills or tools", SRD p. 87): gear ids of kind 'tool'. */
  tools?: boolean
}

/** The effects of one option of an 'option' choice, merged into the owner when chosen. */
export interface OptionEffect extends Omit<EffectDef, 'id' | 'choices' | 'textOnly'> {
  name: I18n
  text?: I18n
}

/** A value the feature computes for the table ("Stunning Strike DC 15", "Deflect Attacks 1d10 + 7"): dice (a string or a
 * table column id) and/or numeric parts written like ModifierSpec values. */
export interface ComputedValue {
  id: string
  label: I18n
  /** A dice string, a dice column id, or '<column>*d6'; `diceByLevel` steps it with the class level. */
  dice?: string
  diceByLevel?: Record<string, string>
  parts?: (number | string)[]
  source?: Source
}

/** Hand-written effects of a feature, feat, species trait, condition or class option that the engine computes
 * (src/data/custom/effects/*.json, keyed by the owner's id: 'barbarian:rage', 'feat:alert', 'dwarf:dwarven-toughness',
 * 'condition:prone', 'warlock:eldritch-invocation:agonizing-blast'). The text of the owner stays the SRD's; this only
 * encodes it. Every class feature up to level 12 has an entry (src/__tests__/features-coverage.test.ts): a feature the
 * engine can't compute carries `textOnly` saying why. */
export interface EffectDef {
  id: string
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  /** Uses per rest. `count` is a number, a class-table column id ('rages'), an ability id ('cha' = modifier, min 1),
   * 'pb', or a formula with class levels ('paladinLevel*5'); `byLevel` gives the count from a class level on;
   * `shortRestRegain` uses come back on a Short Rest when the rest kind is 'long'. */
  uses?: { count: number | string; per: RestKind; byLevel?: Record<string, number>; shortRestRegain?: number }
  /** Alternative base AC: `base` (10 by default) + these ability modifiers, usable without armor (and without a Shield
   * when noShield). */
  acFormula?: { base?: number; abilities: AbilityId[]; noArmor: boolean; noShield: boolean }
  /** Engine flags: 'extra-attack', 'two-extra-attacks', 'three-extra-attacks', 'jack-of-all-trades', 'martial-arts',
   * 'powerful-build', 'rage', 'speed-0', 'resourceful', 'tireless', 'pact-weapon', 'reliable-talent'… */
  flags?: string[]
  /** Player choices attached to this owner. */
  choices?: ChoiceDef[]
  /** Values computed for the table. */
  computed?: ComputedValue[]
  /** Spells: `always` are always prepared for the owner's class and don't count against the prepared number; `lists`
   * widens the class list membership check (Magical Secrets); `fromChoices` names spell choices whose picks are always
   * prepared; `ability` the spellcasting ability for spells of a feat/trait. */
  spells?: {
    always?: string[]
    byLevel?: Record<string, string[]>
    lists?: string[]
    fromChoices?: string[]
    ability?: AbilityId
  }
  /** Weapon Mastery: number of weapons (a number or a class-table column id). */
  mastery?: number | string
  /** Changes to another owner's resource (Font of Inspiration makes Bardic Inspiration a short-rest resource). no35-ok */
  overrides?: { resource: string; per?: RestKind; shortRestRegain?: number }[]
  /** A species sub-trait that applies only when this option of another trait's choice is chosen (a Goliath's Giant
   * Ancestry benefit, a Gnomish Lineage): otherwise it is neither listed nor usable. */
  withOption?: { owner: string; option: string }
  /** Nothing is computed, and why ("an action with no sheet number", "needs the GM"). */
  textOnly?: I18n
  /** How the owner is used during a turn: one entry per use (the Combat pane's "Your turn" box, engine/turn.ts). An
   * empty list says the text names an action type but gives nothing to take (checked by activation-coverage.test.ts). */
  activation?: ActivationDef[]
  /** Magic items only (custom/effects/magic-items.json): when the effects apply. Default: worn (a weapon or Shield: in
   * hand) and attuned if it requires Attunement. 'attuned': while attuned, wherever it is on you (Thunderous Greatclub,
   * Weapon of Warning); 'on-person': while it is on your person, worn or carried (Stone of Good Luck, Luck Blade). */
  activeWhen?: 'attuned' | 'on-person'
  /** Magic items only: the spells it casts and its charges (wands, staffs, rods, scrolls, potions…). */
  spellItem?: SpellItemDef
  /** A weapon the feature creates (custom subclass features, house rule #5: Psychic Blades…): listed with the weapons in
   * hand, not carried. */
  weapon?: FeatureWeaponDef
  /** Changes to Wild Shape (custom subclass features, house rule #5: Circle Forms…), as formulas (model/formula.ts):
   * the highest of the table's value and these applies; `acMin` is the lowest Armor Class of a form. */
  wildShape?: { maxCr?: string; tempHp?: string; acMin?: string }
  source?: Source
}

/** One way to use a feature, trait, feat or item during a turn (SRD 5.2.1 p. 9–10 "Actions", "Bonus Actions",
 * "Reactions"; p. 13 "Your Turn"). */
/** A weapon created by a feature: a catalog weapon for its kind, category and properties, with these overrides. */
export interface FeatureWeaponDef {
  name: I18n
  /** Catalog weapon id it is built on ('dagger'). */
  base: string
  damage?: string
  damageType?: DamageType
  range?: { normal: Distance; long: Distance }
  /** The feature makes you proficient with it. */
  proficient?: boolean
  /** Its mastery property can be used without picking it with Weapon Mastery. */
  mastery?: boolean
}

export interface ActivationDef {
  /** The part of the turn it takes: 'action', 'bonus-action', 'reaction'; 'free' takes none (Action Surge, Reckless
   * Attack); 'attack' replaces one attack of the Attack action (Dragonborn Breath Weapon). */
  kind: 'action' | 'bonus-action' | 'reaction' | 'free' | 'attack'
  /** Card name when it differs from the owner's name ("Bonus Unarmed Strike" for Martial Arts). */
  name?: I18n
  /** For an action: the standard action it is ('magic' for "As a Magic action", 'attack', 'utilize'…). Action Surge
   * can't be used for 'magic'; Haste's extra action only for attack, dash, disengage, hide and utilize. */
  action?: string
  /** Standard actions it lets you take with that kind (Cunning Action: dash, disengage, hide). */
  actions?: string[]
  /** A Reaction's trigger, or a short reminder of the condition, in our own words. */
  trigger?: I18n
  /** Uses spent: the resource (owner id; default: this owner when it has uses) and how many (default 1; 0 = none). */
  cost?: { resource?: string; amount?: number }
  /** Shown only while this holds: 'toggle:<key>' (a Combat-pane switch), '!toggle:<key>' (while it is off). */
  when?: string
  /** Character level from which it can be used (a species trait that starts at level 5). */
  minLevel?: number
  /** Turns this Combat-pane switch on when used (Rage → 'rage'). */
  setsToggle?: string
  /** Gives one more action this turn (Action Surge), except these standard actions. */
  extraAction?: { except?: string[] }
}

/** A spell an item casts (SRD "Magic Items": "cast X from it"). */
export interface ItemSpellDef {
  spellId: string
  /** Charges spent: a number (0 = free), or 'level' (1 charge per spell level, Staff of Healing's Cure Wounds). Absent with
   * `perDay` or `atWill`. */
  cost?: number | 'level'
  /** Level it is cast at (the spell's own level when absent). With `maxLevel`, each extra charge raises it by one (Wand of
   * Fireballs: level 3 for 1 charge, up to level 5). */
  level?: number
  maxLevel?: number
  /** Save DC / attack bonus printed in the item text; absent = the wielder's own (`SpellItemDef.wielderDc`). */
  dc?: number
  attack?: number
  /** Usable once per dawn without charges (Cape of the Mountebank); `atWill` without limit (Hat of Disguise). */
  perDay?: number
  atWill?: boolean
  note?: I18n
}

export interface SpellItemDef {
  spells: ItemSpellDef[]
  /** Maximum charges: a number, or dice rolled when found ('1d3', '1d6 + 3' beads). */
  charges?: number | string
  /** Charges regained daily at dawn: dice ('1d6 + 1'), a number, or 'all'. Absent = no regain (Ring of Three Wishes). */
  recharge?: string
  /** Regained at dusk instead of dawn (Robe of Stars). */
  rechargeAt?: 'dawn' | 'dusk'
  /** Spells use the wielder's spell save DC and attack bonus ("using your spell save DC"). */
  wielderDc?: boolean
  /** Used up when used (potions, oils, Spell Scroll): the quantity drops by one. */
  consumable?: boolean
  /** Spell Scroll: the spell is the instance's (`ItemInstance.spells`), its DC and attack come from the scroll table by
   * spell level (SRD p. 244). */
  scroll?: boolean
  /** Holds spells cast into it (Ring of Spell Storing, Ioun Stone of Reserve): the instance's spells, cast with the
   * original caster's DC. */
  stores?: boolean
  /** A short line per variant (Potion of Healing: "Regain 2d4 + 2 HP"), by `ItemInstance.variant`. */
  variantNotes?: I18n[]
  note?: I18n
}

/** Non-numeric grants. `on` names what it applies to (a skill id, a save ability, 'initiative', a damage type…). */
export interface GrantSpec {
  kind:
    | 'advantage'
    | 'disadvantage'
    | 'proficiency' // on: 'skill.<id>' | 'save.<id>' | 'armor.<category>' | 'weapon.<category|id>' | 'tool.<id>'
    | 'expertise' // on: 'skill.<id>'
    | 'resistance' // on: DamageType
    | 'immunity' // on: DamageType or condition id
    | 'darkvision' // value: range in feet
    | 'language'
    | 'flag' // on: a free flag the engine reads (e.g. 'unarmored-defense-con', 'extra-attack-1')
  on?: string
  value?: number | string
  condition?: I18n
  /** Same vocabulary as ModifierSpec.when ('toggle:rage', 'no-armor'…). */
  when?: string
}

/** A choice the player makes when gaining the owner (skill, tool, spell list, weapon type, subclass option…). */
export interface ChoiceSpec {
  id: string
  name: I18n
  count: number
  /** What is offered: ids of a kind, or free text. */
  from: {
    kind: 'skill' | 'tool' | 'language' | 'ability' | 'spell' | 'weapon' | 'option' | 'text'
    ids?: string[]
    options?: I18n[]
  }
}

// ---------- classes ----------

export interface ClassLevelRow {
  level: number
  /** Proficiency Bonus. */
  pb: number
  /** "Class Features" column, as printed (names). */
  features: I18n[]
  /** Other columns: a resource per column id (e.g. rages: 2, rageDamage: 2, weaponMastery: 2, cantrips: 4, prepared: 4,
   * sorceryPoints, martialArts: '1d6', focusPoints, invocations, sneakAttack: '1d6'…). */
  resources: Record<string, number | string>
  /** Spell slots per spell level, index 0 = level 1 slots (full and half casters). */
  slots?: number[]
  /** Warlock Pact Magic: number of slots and their level. */
  pact?: { slots: number; level: number }
}

export interface ClassFeatureDef {
  /** `<class>:<kebab feature>` or `<class>:<subclass>:<kebab feature>`. */
  id: string
  level: number
  name: I18n
  /** Verbatim SRD text (HTML). */
  text: I18n
  source: Source
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  choices?: ChoiceSpec[]
  /** Uses per rest, when the feature has them. `count` may be a resource column id of the class table. */
  uses?: { count: number | string; per: RestKind }
  /** The engine computes this feature (otherwise it is shown as text only). */
  computed?: boolean
  /** Subclass id when the feature belongs to a subclass. */
  subclass?: string
}

export interface SubclassDef {
  id: string
  name: I18n
  text: I18n
  features: ClassFeatureDef[]
  /** Subclass spell lists (Life Domain Spells, Fiend Spells…): level → spell ids. */
  spells?: { level: number; spells: string[] }[]
  /** Subclass spell lists that depend on a choice (Circle of the Land: one land type chosen on each Long Rest). The
   * choice value is stored in `Character.featureChoices[<subclass id>:spells]`. */
  spellChoices?: { name: I18n; options: Record<string, { name: I18n; spells: { level: number; spells: string[] }[] }> }
  /** A subclass that gives its class spellcasting (none in the SRD; custom subclasses, house rule #5): every number is
   * the player's, from their book. */
  spellcasting?: SubclassSpellcastingDef
  source: Source
}

/** Spellcasting given by a subclass (house rule #5). Steps tables: class level → count, the highest level ≤ the class
 * level applies. */
export interface SubclassSpellcastingDef {
  ability: AbilityId
  /** Class spell list id ('wizard'). */
  list: string
  change: 'long-rest' | 'level'
  cantrips: Record<string, number>
  prepared: Record<string, number>
  /** Spell slots (index 0 = level 1) from a class level on. */
  slots: Record<string, number[]>
  /** How the class levels count toward the Multiclass Spellcaster table (SRD p. 25 lists only full and half casters):
   * class level ÷ `divisor`, rounded. Absent = not entered yet (counts 0, a rule check asks for it). */
  multiclass?: { divisor: number; round: 'up' | 'down' }
  source: Source
}

export interface SpellcastingDef {
  ability: AbilityId
  /** full = bard/cleric/druid/sorcerer/wizard, half = paladin/ranger, pact = warlock. */
  kind: 'full' | 'half' | 'pact'
  /** Class spell list id (usually the class id). */
  list: string
  /** Wizards keep a spellbook; prepared spells are chosen from it. */
  spellbook?: boolean
  /** Can cast rituals. */
  ritual?: boolean
  /** When prepared spells can change: 'long-rest' (any number) or 'level' (one). SRD "Spell Preparation by Class". */
  change: 'long-rest' | 'level'
  /** Features gained at level 1 that spell slots depend on, for the multiclass rules text. */
  source: Source
}

export interface ClassDef {
  id: string
  name: I18n
  hitDie: 6 | 8 | 10 | 12
  primaryAbility: AbilityId[]
  /** "Strength or Dexterity" (Fighter): any one of them satisfies the multiclass prerequisite (SRD p. 24). */
  primaryAbilityAny?: boolean
  saveProficiencies: AbilityId[]
  skillChoices: { count: number; from: SkillId[] | 'any' }
  /** 'simple', 'martial', or specific weapon ids. */
  weaponProficiencies: string[]
  armorTraining: ArmorCategory[]
  toolProficiencies?: I18n
  startingEquipment: I18n
  /** Multiclassing: what the class grants when it isn't the first class (SRD "Multiclassing Proficiencies"). */
  multiclass: { armor: ArmorCategory[]; weapons: string[]; skills?: number; tools?: I18n[]; text: I18n }
  table: ClassLevelRow[]
  /** Column ids and printed names of the class table beyond Level / PB / Class Features. */
  columns: { id: string; name: I18n }[]
  features: ClassFeatureDef[]
  subclasses: SubclassDef[]
  spellcasting?: SpellcastingDef
  /** Levels at which the class grants the Ability Score Improvement feature (feat or ASI). */
  asiLevels: number[]
  /** Class spell list: level (0 = cantrip) → spell ids, from the "<Class> Spell List" tables. */
  spellList?: { level: number; spells: string[] }[]
  /** Class options chosen from a list (sorcerer Metamagic, warlock Eldritch Invocations), by option kind. */
  options?: Record<string, ClassOptionDef[]>
  /** Intro text of the class (verbatim), for the popup. */
  text: I18n
  source: Source
}

export interface ClassOptionDef {
  id: string
  name: I18n
  text: I18n
  /** Prerequisite as printed, when any. */
  prereq?: I18n
  source: Source
}

// ---------- species, backgrounds, feats ----------

export interface SpeciesTraitDef {
  id: string
  name: I18n
  text: I18n
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  choices?: ChoiceSpec[]
  uses?: { count: number | string; per: RestKind }
  /** Character level from which it applies (custom species, house rule #6); absent = from level 1. */
  level?: number
  source: Source
}

export interface SpeciesDef {
  id: string
  name: I18n
  creatureType: I18n
  /** Some species choose Small or Medium. */
  size: Size[]
  /** The Size line as printed ("Medium (about 5–7 feet tall)"). */
  sizeText: I18n
  speed: Distance
  traits: SpeciesTraitDef[]
  text: I18n
  source: Source
}

export interface BackgroundDef {
  id: string
  name: I18n
  /** The three abilities among which +2/+1 or +1/+1/+1 are distributed. */
  abilities: AbilityId[]
  feat: string
  /** The Feat line as printed ("Magic Initiate (Cleric)"). */
  featText: I18n
  skills: SkillId[]
  tool: I18n
  equipment: I18n
  text: I18n
  source: Source
}

export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon'

export interface FeatPrereq {
  level?: number
  /** Any one of these abilities at the score (e.g. Strength or Dexterity 13+). */
  abilities?: { any: AbilityId[]; min: number }
  /** A feature or feat id ('fighting-style', 'spellcasting'…). */
  feature?: string
  text?: I18n
}

export interface FeatDef {
  id: string
  name: I18n
  category: FeatCategory
  /** The italic category line as printed ("General Feat (Prerequisite: Level 4+)"). */
  categoryText: I18n
  prereq?: FeatPrereq
  repeatable?: boolean
  /** Ability Score Increase part of General feats: choose among these abilities (+1). */
  abilityIncrease?: AbilityId[] | 'any'
  text: I18n
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  choices?: ChoiceSpec[]
  source: Source
}

// ---------- equipment ----------

export type WeaponProperty =
  'ammunition' | 'finesse' | 'heavy' | 'light' | 'loading' | 'range' | 'reach' | 'thrown' | 'two-handed' | 'versatile'
export type MasteryProperty = 'cleave' | 'graze' | 'nick' | 'push' | 'sap' | 'slow' | 'topple' | 'vex'

export interface WeaponDef {
  id: string
  name: I18n
  category: WeaponCategory
  kind: 'melee' | 'ranged'
  /** Dice as printed ("1d8"); null for the Net. */
  damage: string | null
  damageType: DamageType | null
  properties: WeaponProperty[]
  /** Versatile two-handed damage ("1d10"). */
  versatile?: string
  /** Range (normal/long) in feet, for Thrown and Ammunition weapons. */
  range?: { normal: Distance; long: Distance }
  ammunition?: string
  mastery: MasteryProperty
  weight: Weight
  cost: Cost
  source: Source
}

export interface Cost {
  /** Value in GP (1 SP = 0.1, 1 CP = 0.01). */
  gp: number
  /** As printed ("25 GP", "2 SP"). */
  text: I18n
}

export interface ArmorDef {
  id: string
  name: I18n
  category: ArmorCategory
  /** Base AC; shields add `bonus` instead. */
  baseAc?: number
  bonus?: number
  /** Dexterity modifier added: 'full', 'max2' or 'none'. */
  dex: 'full' | 'max2' | 'none'
  strength?: number
  stealthDisadvantage: boolean
  /** Time to don / doff (text). */
  don: I18n
  doff: I18n
  weight: Weight
  cost: Cost
  source: Source
}

export interface GearDef {
  id: string
  name: I18n
  /** 'gear' (Adventuring Gear), 'tool' (Tools), 'ammunition', 'mount', 'vehicle', 'tack', 'service'. */
  kind: 'gear' | 'tool' | 'ammunition' | 'mount' | 'vehicle' | 'tack' | 'service'
  weight?: Weight
  cost?: Cost
  /** Tools: ability, utilize, craft, variants. */
  tool?: { ability: AbilityId; utilize: I18n; craft?: I18n; variants?: I18n }
  text?: I18n
  source: Source
}

/** Definition of a weapon property ("Properties", SRD p. 89-90) or mastery property ("Mastery Properties", p. 90):
 * the verbatim paragraph shown when a weapon's property is clicked. `id` is the value used in WeaponDef.properties /
 * WeaponDef.mastery (src/data/srd/weapon-properties.json). */
export interface WeaponPropertyDef {
  id: WeaponProperty | MasteryProperty
  name: I18n
  kind: 'property' | 'mastery'
  text: I18n
  source: Source
}

// ---------- spells ----------

export interface SpellDef {
  id: string
  name: I18n
  /** 0 = cantrip. */
  level: number
  school: School
  /** Class list ids the spell belongs to (from the italic line and the class spell lists). */
  classes: string[]
  castingTime: I18n
  /** Casting time category for the UI: 'action', 'bonus', 'reaction', 'minute', 'hour', 'ritual-only'. */
  castingKind: 'action' | 'bonus-action' | 'reaction' | 'time'
  ritual: boolean
  range: I18n
  components: { v: boolean; s: boolean; m?: I18n }
  duration: I18n
  concentration: boolean
  text: I18n
  /** "Using a Higher-Level Spell Slot" / "Cantrip Upgrade" paragraph, when present (HTML). */
  upcast?: I18n
  source: Source
}

// ---------- conditions and glossary ----------

export interface ConditionDef {
  id: string
  name: I18n
  text: I18n
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  /** Free flags the engine reads (e.g. 'cant-move', 'incapacitated', 'speed-0'). */
  flags?: string[]
  source: Source
}

export interface GlossaryEntry {
  id: string
  name: I18n
  /** [Action], [Condition], [Area of Effect], [Hazard], [Attitude]… tag as printed. */
  tag?: I18n
  text: I18n
  source: Source
}

// ---------- magic items ----------

export interface MagicItemDef {
  id: string
  name: I18n
  /** Armor, Potion, Ring, Rod, Scroll, Staff, Wand, Weapon, Wondrous Item. */
  kind: 'armor' | 'potion' | 'ring' | 'rod' | 'scroll' | 'staff' | 'wand' | 'weapon' | 'wondrous'
  rarity: Rarity | 'varies'
  attunement: boolean
  /** Attunement restriction as printed ("by a Cleric or Paladin"). */
  attunementBy?: I18n
  /** Base item id for armor/weapon items when fixed. */
  baseItem?: string
  /** Variant table rows for items like "Armor, +1, +2, or +3". */
  variants?: { name: I18n; rarity: Rarity; value?: number }[]
  weight?: Weight
  text: I18n
  modifiers?: ModifierSpec[]
  grants?: GrantSpec[]
  charges?: { max: number | string; recharge: I18n }
  source: Source
}

// ---------- creatures (beasts for Wild Shape and Find Familiar, monsters) ----------

export interface CreatureAbility {
  score: number
  mod: number
  save: number
}

export interface CreatureAttack {
  name: I18n
  text: I18n
}

export interface CreatureDef {
  id: string
  name: I18n
  /** The h1 of "Monsters A–Z" when it groups several stat blocks ("Angels" for Deva, Planetar, Solar; "Dragons"). */
  group?: I18n
  /** "Medium or Small" -> both; "Huge or Smaller" (Animated Object) -> tiny to huge. */
  size: Size[]
  /** Creature type as printed ("Beast", "Fiend (Devil)"). */
  type: I18n
  /** Lower-case type word(s) and parenthetical tags: "Fiend (Devil)" -> ['fiend', 'devil'], "Swarm of Tiny Beasts" ->
   * ['swarm', 'beast']. */
  tags: string[]
  alignment: I18n
  /** Descriptive paragraphs under the group heading that are not part of a stat block (none in SRD 5.2.1). */
  flavour?: I18n
  /** null for the spell-summoned creatures whose AC is a formula, printed in `acText` ("10 + 1 per spell level"). */
  ac: number | null
  acText?: I18n
  /** Absent for the four spell-summoned creatures (Animated Object, Otherworldly Steed, Giant Insect, Draconic Spirit). */
  initiative?: { mod: number; score: number }
  /** null when the Hit Points are a formula or depend on the size, printed in `hpText`. */
  hp: { average: number; dice: string } | null
  hpText?: I18n
  speed: {
    walk?: Distance
    fly?: Distance
    swim?: Distance
    climb?: Distance
    burrow?: Distance
    hover?: boolean
    text: I18n
  }
  abilities: Record<AbilityId, CreatureAbility>
  skills?: I18n
  resistances?: I18n
  immunities?: I18n
  vulnerabilities?: I18n
  gear?: I18n
  senses: I18n
  passivePerception: number
  languages: I18n
  /** Fractions as 0.125 / 0.25 / 0.5; null for "CR None" (spell-summoned creatures), see `crText`. */
  cr: number | null
  xp: number
  /** "XP 5,900, or 7,200 in lair": the second figure. */
  xpInLair?: number
  /** null when "PB equals your Proficiency Bonus" (spell-summoned creatures), see `crText`. */
  pb: number | null
  /** The CR entry as printed when cr or pb is null ("None (XP 0; PB equals your Proficiency Bonus)"). */
  crText?: I18n
  traits: CreatureAttack[]
  actions: CreatureAttack[]
  bonusActions?: CreatureAttack[]
  reactions?: CreatureAttack[]
  /** The italic preamble of the Legendary Actions section ("Legendary Action Uses: 3 (4 in Lair). Immediately after…"). */
  legendaryActionsIntro?: I18n
  legendaryActions?: CreatureAttack[]
  /** SRD misprints corrected after the 2024 Monster Manual (tools/build_creatures.py CORRECTIONS, rulings-data.md D1):
   * one note per corrected value, shown with the stat block. */
  errata?: I18n[]
  source: Source
}

// ---------- rules tables (Character Creation, Playing the Game) ----------

export interface RulesTables {
  /** Proficiency Bonus by character level (index 0 = level 1). */
  proficiencyBonus: number[]
  /** XP needed to reach each level (index 0 = level 1). */
  xpByLevel: number[]
  /** Multiclass Spellcaster slots per spell level by combined level (index 0 = level 1). */
  multiclassSlots: number[][]
  /** Standard Array (Character Creation) and its suggested distribution per class. */
  standardArray: number[]
  standardArrayByClass: Record<string, Record<AbilityId, number>>
  pointCost: Record<string, number>
  /** Ability score ranges and their modifiers. */
  abilityModifiers: { from: number; to: number; mod: number }[]
  typicalDcs: { task: I18n; dc: number }[]
  source: Source
}
