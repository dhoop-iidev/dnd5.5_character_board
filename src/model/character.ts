// The saved character: choices and history only; every derived value is computed by engine/compute.ts.
// D&D 2024 rules (SRD 5.2.1). Schema versioned for model/migrate.ts.
import type {
  AbilityId,
  DamageType,
  FeatCategory,
  I18n,
  Lang,
  MasteryProperty,
  ModifierSpec,
  RestKind,
  Size,
  SkillId,
  WeaponProperty,
} from '../data/types'

export const SCHEMA_VERSION = 5
export const EDITION = 'srd-5.2.1'

export interface Identity {
  name: string
  player: string
  alignment: string
  /** Free text: appearance, personality, backstory. */
  background: string
  title: string
  motto: string
  deity: string
  languages: string[]
  height: { m: number }
  weight: { kg: number }
  age: string
  /** Personality notes of the General pane (free text; not a 2024 rules item, the 2024 sheet dropped them). */
  personalityTraits?: string
  ideals?: string
  bonds?: string
  flaws?: string
  appearance?: string
  allies?: string
}

/** One class level taken (SRD "Level Advancement", p. 23). */
export interface LevelEntry {
  classId: string
  /** Chosen at class level 3. */
  subclassId?: string
  /** Hit points gained at this level: rolled value, or the fixed value when `hpFixed` is true (SRD p. 23: roll or take the
   * fixed number; level 1 is always the maximum of the Hit Point Die). Con modifier is added by the engine. */
  hpRoll: number
  hpFixed: boolean
  /** At an Ability Score Improvement level: a General feat (default Ability Score Improvement) or an Epic Boon. */
  feat?: FeatPick
  /** Spells learned or swapped at this level (prepared-spell casters choose on rest; this is for level-locked choices such
   * as a wizard's free spellbook spells and a warlock's Mystic Arcanum). */
  spellsLearned?: string[]
}

export interface FeatPick {
  featId: string
  /** Ability Score Increase choice of the feat (+2 one / +1 two for Ability Score Improvement; +1 for other feats). */
  abilities?: Partial<Record<AbilityId, number>>
  /** Feat-specific choices, keyed by the choice id of the feat's effect ('skills' for Skilled, 'list', 'cantrips' and
   * 'spell' for Magic Initiate). */
  choices?: Record<string, string | string[]>
}

export interface Background {
  backgroundId: string
  /** +2 / +1, or +1 / +1 / +1, among the background's three abilities (SRD p. 20). */
  abilities: Partial<Record<AbilityId, number>>
  /** The Origin feat granted by the background (fixed by the background; choices inside it, e.g. Magic Initiate's list).
   * For the custom background, any Origin feat. */
  feat: FeatPick
  /** `backgroundId: 'custom'` (house rule #3): the player's picks, with the parts of an SRD background (p. 83). */
  custom?: CustomBackground
}

/** A feat from another book entered by the player (house rule #4, `model/customFeats.ts`), in their own words. */
export interface CustomFeat {
  /** 'custom-feat-<n>'. */
  id: string
  name: string
  category: FeatCategory
  /** Book and page ("Player's Handbook 2024 p. 201"). */
  book: string
  /** The player's summary of the feat (blank lines separate paragraphs). */
  text: string
  prereq?: { level?: number; abilities?: AbilityId[]; min?: number; text?: string }
  /** +1 to one of these abilities (the Ability Score Increase of General feats). */
  abilityIncrease?: AbilityId[]
  repeatable?: boolean
  /** Numbers the engine applies, in the effects vocabulary (docs/effects.md), as for custom items. */
  modifiers?: ModifierSpec[]
}

/** A subclass from another book entered by the player (house rule #5, `model/customSubclasses.ts`). */
export interface CustomSubclass {
  /** 'custom-subclass-<n>'. */
  id: string
  classId: string
  name: string
  /** Book and page ("Player's Handbook 2024 p. 52"). */
  book: string
  /** The player's description of the subclass. */
  text: string
  features: CustomSubclassFeature[]
  /** Always-prepared spells by class level (Domain Spells, Oath Spells…), from the SRD spells. */
  spells?: { level: number; spells: string[] }[]
  /** Spellcasting the subclass gives its class (Eldritch Knight, Arcane Trickster…), every number from the player's book. */
  spellcasting?: {
    ability: AbilityId
    /** Class spell list id ('wizard'). */
    list: string
    change: 'long-rest' | 'level'
    /** Class level → cantrips / prepared spells, from that level on. */
    cantrips: Record<string, number>
    prepared: Record<string, number>
    /** Class level → spell slots per spell level (index 0 = level 1), from that level on. */
    slots: Record<string, number[]>
    /** Share of the Multiclass Spellcaster table: class level ÷ divisor, rounded. */
    multiclass?: { divisor: number; round: 'up' | 'down' }
  }
}

export interface CustomSubclassFeature {
  /** 'f<n>', unique in the subclass; the owner id is `<class>:<subclass>:<feature>`. */
  id: string
  /** Class level at which it is gained. */
  level: number
  name: string
  /** The player's summary. */
  text: string
  /** Numbers the engine applies (docs/effects.md vocabulary), as for custom items. */
  modifiers?: ModifierSpec[]
  /** Uses: a number, 'pb', an ability id (its modifier, min 1) or '<class>Level'; `byLevel` steps by class level. */
  uses?: { count: number | string; per: RestKind; byLevel?: Record<string, number> }
  /** The part of the turn it takes: a card in the Combat pane's turn box. */
  activation?: { kind: 'action' | 'bonus-action' | 'reaction' | 'free'; trigger?: string }
  /** Named options to choose from (maneuvers…): how many, with `byLevel` steps. */
  choice?: { name: string; count: number; byLevel?: Record<string, number>; options: string[] }
  /** Changes to Wild Shape (Druid subclasses), as formulas (model/formula.ts): highest CR, Temporary Hit Points
   * gained, lowest Armor Class of a form. */
  wildShape?: { maxCr?: string; tempHp?: string; acMin?: string }
  /** A weapon the feature creates (Psychic Blades…): a catalog weapon with these overrides; range in feet. */
  weapon?: {
    name: string
    base: string
    damage?: string
    damageType?: DamageType
    rangeFt?: { normal: number; long: number }
    proficient?: boolean
    mastery?: boolean
  }
}

/** A species from another book entered by the player (house rule #6, `model/customSpecies.ts`), in their own words.
 * Under the 2024 rules an older species gets no ability score increases: those come from the background. */
export interface CustomSpecies {
  /** 'custom-species-<n>'. */
  id: string
  name: string
  /** Book and page ("Volo's Guide to Monsters p. 115"). */
  book: string
  /** The player's description. */
  text: string
  /** Creature type as printed ("Humanoid"). */
  creatureType: string
  /** One size, or two to choose from (Small or Medium). */
  size: Size[]
  /** Walking Speed in feet. */
  speedFt: number
  traits: CustomSpeciesTrait[]
}

export interface CustomSpeciesTrait {
  /** 't<n>', unique in the species; the owner id is `<species>:<trait>`. */
  id: string
  /** Character level from which it applies (1 for most traits). */
  level: number
  name: string
  /** The player's summary. */
  text: string
  /** Darkvision range in feet. */
  darkvisionFt?: number
  /** Other speeds in feet, or 'speed' (equal to your Speed). */
  speeds?: { climb?: number | 'speed'; swim?: number | 'speed'; fly?: number | 'speed' }
  /** Skill proficiencies it gives. */
  skills?: SkillId[]
  /** Damage resistances it gives. */
  resistances?: DamageType[]
  /** Numbers the engine applies (docs/effects.md vocabulary), as for custom items. */
  modifiers?: ModifierSpec[]
  /** Uses: a number, 'pb' or an ability id (its modifier, min 1). */
  uses?: { count: number | string; per: RestKind }
  /** The part of the turn it takes: a card in the Combat pane's turn box. */
  activation?: { kind: 'action' | 'bonus-action' | 'reaction' | 'free'; trigger?: string }
}

export interface CustomBackground {
  /** The player's own name for it; empty = "Custom background". */
  name?: string
  /** The three abilities for the +2/+1 or +1/+1/+1. */
  abilities: AbilityId[]
  skills: SkillId[]
  /** Gear id of the tool (kind 'tool'). */
  tool: string
}

export type ItemLocation = 'worn' | 'carried' | 'stored'

export interface ItemInstance {
  uid: string
  /** 'weapon' | 'armor' | 'gear' | 'magic' | 'custom'. */
  kind: 'weapon' | 'armor' | 'gear' | 'magic' | 'custom'
  refId?: string
  quantity: number
  location: ItemLocation
  /** Magic items that require Attunement, when attuned (max 3, SRD "Attunement"). */
  attuned?: boolean
  /** In hand this turn (weapons; the shield when held). */
  equipped?: boolean
  /** A Versatile weapon held in two hands (its bracketed damage, SRD p. 90 "Versatile"; schema 4). */
  twoHanded?: boolean
  /** Two of a stack of Light weapons in hand, one in each (two Daggers), for the Light extra attack (SRD p. 89). */
  pair?: boolean
  /** Charges left (wands, staffs…). */
  charges?: number
  /** Computed, never saved: a weapon created by a feature (`EffectDef.weapon`), not an inventory item. */
  feature?: { ownerId: string; mastery?: boolean }
  /** An SRD magic weapon or armor on its base item: `kind` 'weapon' / 'armor', `refId` the base (longsword, chain mail,
   * quarterstaff for the staffs wielded as one), and this field the magic item id ('flame-tongue', 'armor-1-2-or-3'). Its
   * effects are `item:<id>` in custom/effects/magic-items.json. Optional, no schema change. */
  magicItemId?: string
  /** Variant of a magic item with a variant table, as an index in `MagicItemDef.variants` (+1/+2/+3, giant type, Spell
   * Scroll level, potion strength). */
  variant?: number
  /** Spells the item holds besides its SRD list: a Spell Scroll's spell, those stored in a Ring of Spell Storing, a custom
   * wand's. `chargeCost` charges per casting (absent = 1 for an item with charges), `level` the level it is cast at. */
  spells?: {
    spellId: string
    chargeCost?: number
    level?: number
    /** Uses per dawn without charges ("once per dawn"); `atWill` = no limit (a sword that casts Light). Without either,
     * the spell costs `chargeCost` charges when the item has charges, else it is at will. */
    perDay?: number
    atWill?: boolean
    /** Save DC / attack bonus fixed by the item; absent = the wielder's own (SRD p. 206 "Spells"). */
    dc?: number
    attack?: number
  }[]
  /** Maximum charges and charges regained at dawn ('1d6 + 1', 'all') of a custom item with charges. */
  maxCharges?: number
  recharge?: string
  /** Once-per-dawn spells of the item already used (spell ids), cleared at dawn. */
  usedToday?: string[]
  /** Custom item (kind 'custom'), or overrides of an SRD base item (a custom weapon = a base weapon + overrides; custom
   * armor = a base armor + a bonus). Schema 4 adds everything after `costGp`. */
  custom?: CustomItem
  note?: string
}

/** The kinds of worn items of which only one can be worn at a time (SRD 5.2.1 p. 103 "Multiple Items of the Same Kind",
 * FR p. 109 "Plusieurs objets du même type": one pair of footwear, one pair of gloves or gauntlets, one pair of bracers,
 * one suit of armor, one item of headwear, one cloak). Anything else worn (rings, amulets, belts…) has no limit. */
export type WornKind = 'headwear' | 'cloak' | 'armor' | 'bracers' | 'gloves' | 'footwear'

export interface CustomItem {
  /** Name (both languages; the form fills both with the same text). Absent = the base item's name. */
  name?: I18n
  text?: I18n
  /** Weight of one unit in lb (kg = lb / 2 is derived); absent = the base item's weight. */
  weightLb?: number
  /** Price of one unit in GP; absent = the base item's price. */
  costGp?: number
  /** A magic item (wondrous item, magic gear): marked ✦ in the lists. */
  magic?: boolean
  /** Requires Attunement: its modifiers apply only while attuned (Rules Glossary "Attunement", SRD p. 177). */
  attunement?: boolean
  /** Worn kind (p. 103), overriding the one inferred from the name; 'none' = an "other worn item". */
  wornKind?: WornKind | 'none'
  /** +1, +2, +3: a weapon adds it to attack and damage rolls, armor or a Shield to the Armor Class (as the SRD's
   * "Weapon, +1, +2, or +3" and "Armor, +1, +2, or +3"). */
  magicBonus?: number
  /** Weapon only: further bonuses to the attack roll and to the damage. */
  attackBonus?: number
  damageBonus?: number
  /** Weapon only: overrides of the base weapon. */
  damage?: string
  damageType?: DamageType
  properties?: WeaponProperty[]
  mastery?: MasteryProperty
  /** Weapon only: extra damage dice on a hit ("1d6" Fire). */
  extraDamage?: { dice: string; type?: DamageType }[]
  /** Numeric effects (the vocabulary of docs/effects.md) applied while the item is worn (a weapon or Shield: in hand),
   * and attuned when it requires Attunement. */
  modifiers?: ModifierSpec[]
}

export interface SpellcastingState {
  /** Prepared spells per class (ids), SRD "Preparing Spells" p. 104. Cantrips known are in `cantrips`. */
  prepared: string[]
  cantrips: string[]
  /** Wizard spellbook (spell ids), SRD "Spellbook" p. 78: spells copied into the book (or entered without a level). The
   * two spells added at each Wizard level (six at level 1) are `LevelEntry.spellsLearned` of the Wizard levels; the book
   * is both lists together (engine/spellbook.ts). */
  spellbook?: string[]
}

export interface ActiveEffect {
  uid: string
  kind: 'condition' | 'spell' | 'feature' | 'item' | 'custom'
  refId?: string
  name?: { en: string; fr: string; es?: string }
  enabled: boolean
  /** Rounds left, when timed. */
  rounds?: number
  /** Temporary hit points this effect gave (SRD "Temporary Hit Points" p. 19: they don't add up). */
  tempHp?: number
  /** This effect requires Concentration (one at a time, SRD "Concentration" p. 180). */
  concentration?: boolean
  modifiers?: { target: string; value: number; effectName?: string }[]
  /** A spell cast from the Spells pane (optional, no schema change): what the casting spent, so "Cast ✓" can be undone
   * (`slot` = spell slot level, `pact` = a Pact Magic slot, Sorcery Points spent on Metamagic, the options used). */
  cast?: {
    classId?: string
    slot?: number
    pact?: boolean
    sorceryPoints?: number
    metamagic?: string[]
    /** Cast without a slot: the `Character.freeCasts` key, or the owner resource spent (engine/casting.ts `freeCast`). */
    free?: string
    freeResource?: string
  }
}

/** What the character has used on the current turn (Combat pane "Your turn" box, engine/turn.ts; SRD 5.2.1 p. 13 "Your
 * Turn": a move up to your Speed and one action; a Bonus Action only when something grants one, one Reaction per round,
 * one free object interaction). Optional, no schema change; reset by "New turn" and by the turn bar's "Next round". */
export interface TurnState {
  /** Actions taken, in order: standard action ids ('attack', 'dash'…) or 'use:<option key>' for a feature's action. */
  actions: string[]
  /** What the Bonus Action went to (option key or 'light-attack', 'potion', 'spell'); undefined = still free. */
  bonus?: string
  /** What the Reaction went to; undefined = still free. */
  reaction?: string
  /** The free object interaction is used. */
  object: boolean
  /** The player chose to move this turn (no distance is counted: a turn's move can be split, and the character may fly,
   * swim or ride; user decision 2026-10-28). Older saves hold a number of feet: truthy when they moved. */
  moved: boolean
  /** Attacks made with the Attack actions taken. */
  attacks: number
  /** An attack with a Light weapon was made with the Attack action (its uid): the Light extra attack is open. */
  lightAttack?: string
  /** The Light extra attack was made (as a Bonus Action, or inside the Attack action with Nick). */
  lightExtraDone?: boolean
  /** Action Surge used this turn (one more action, not Magic). */
  surge: boolean
  /** A spell slot was spent this turn (one per turn, SRD p. 105). */
  slotSpent: boolean
  /** Undo stack: the state before each step, and what the step spent outside the turn. */
  undo: TurnUndo[]
}

export interface TurnUndo {
  label: I18n
  before: Omit<TurnState, 'undo'>
  resource?: { id: string; amount: number }
  toggle?: string
  /** A condition the step removed (standing up removes Prone). */
  condition?: string
  /** A spell cast (slot and effect to give back). */
  cast?: { cast: NonNullable<ActiveEffect['cast']>; effectUid?: string }
  /** A consumable item used up (inventory uid). */
  item?: string
}

export interface HitPointState {
  current: number
  temp: number
  deathSaves: { successes: number; failures: number }
  /** Stable at 0 HP (SRD "Stable", p. 18–19). */
  stable?: boolean
}

/** A creature at the character's side: familiar (Find Familiar, SRD p. 130), steed (Find Steed, p. 130), mount or any
 * other controlled creature. Its stat block is `rules.creatures.get(creatureId)`; only its state is stored here. */
export interface Companion {
  uid: string
  kind: 'familiar' | 'steed' | 'mount' | 'other'
  creatureId: string
  /** Given name. */
  name?: string
  /** Find Familiar / Find Steed: the creature type chosen when casting (Celestial, Fey or Fiend). */
  creatureType?: 'celestial' | 'fey' | 'fiend'
  /** Find Steed: level of the spell slot used (the steed's AC and Hit Points depend on it). */
  spellLevel?: number
  /** Hit points of this creature. `max` starts at the stat block's average (or the spell formula) and can be edited. */
  hp: { current: number; temp: number; max: number }
  /** Dismissed to its pocket dimension, or otherwise not present. */
  away?: boolean
  note?: string
  /** A creature from another book entered by the player (a subclass's beast companion…; house rule #5,
   * `model/customCreature.ts`): `creatureId` is then 'custom'. */
  custom?: CustomCreature
}

/** A stat block entered by the player, whose numbers may follow the character (formulas, `model/formula.ts`). */
export interface CustomCreature {
  name: string
  /** Creature type as the book prints it ("Beast"). */
  type: string
  size: Size
  /** Book and page. */
  book: string
  /** Formulas: "13 + wis", "5 + rangerLevel*5". */
  ac: string
  hp: string
  /** Its Proficiency Bonus (default: yours, 'pb'), for the saves marked proficient. */
  pb?: string
  speed: string
  abilities: Record<AbilityId, number>
  saves?: AbilityId[]
  senses?: string
  languages?: string
  /** Traits, actions, Bonus Actions and Reactions in the player's own words; an attack may carry formulas. */
  entries: CustomCreatureEntry[]
}

export interface CustomCreatureEntry {
  kind: 'trait' | 'action' | 'bonus-action' | 'reaction'
  name: string
  text: string
  /** Attack roll bonus formula ("pb + wis"). */
  attack?: string
  /** Damage dice ("1d8") and bonus formula ("2 + wis"), and its type as printed. */
  damageDice?: string
  damageBonus?: string
  damageType?: string
}

/** A creature summoned or created by a spell with a stat block (Summon Dragon, Giant Insect, Animate Dead…; the list and
 * the scaling formulas are in engine/summons.ts). Its stat block is `rules.creatures.get(creatureId)`. */
export interface Summon {
  uid: string
  spellId: string
  creatureId: string
  /** Level of the spell slot used (the stat block's "spell's level"). */
  slotLevel: number
  /** Giant Insect form ('centipede' | 'spider' | 'wasp') or Animated Object size ('medium' | 'large' | 'huge'). */
  variant?: string
  hp: { current: number; temp: number; max: number }
  /** Rounds left (1 minute = 10 rounds); counted down by the turn bar, the creature vanishes at 0. */
  rounds?: number
  /** The Concentration effect (ActiveEffect uid) the creature depends on: when it ends, the creature disappears. */
  effectUid?: string
  name?: string
}

/** Druid Wild Shape (SRD p. 42): the known Beast forms and the form currently assumed. */
export interface WildShapeState {
  /** Known forms (creature ids), up to the Beast Shapes table count. */
  known: string[]
  /** Creature id of the form assumed right now, when shape-shifted. */
  active?: string
}

export interface Character {
  schemaVersion: number
  edition: typeof EDITION
  identity: Identity
  speciesId: string
  /** Species choices (Elven Lineage, Gnomish Lineage, Draconic Ancestry, Giant Ancestry, Fiendish Legacy, size…). */
  speciesChoices: Record<string, string>
  background: Background
  /** Feats from other books entered by the player (house rule #4). */
  customFeats?: CustomFeat[]
  /** Subclasses from other books entered by the player (house rule #5). */
  customSubclasses?: CustomSubclass[]
  /** Species from other books entered by the player (house rule #6). */
  customSpecies?: CustomSpecies[]
  /** Ability scores before the background's increases and feats (Standard Array, Point Cost or rolled; SRD p. 20). */
  baseAbilities: Record<AbilityId, number>
  levels: LevelEntry[]
  xp: number
  /** Proficiencies chosen at level 1 (class skills; tools, languages, instruments…). Granted ones are derived. */
  skillProficiencies: SkillId[]
  toolProficiencies: string[]
  inventory: ItemInstance[]
  money: { cp: number; sp: number; ep: number; gp: number; pp: number }
  /** Gems, jewelry, art objects and other valuables, free text beside the coins (no weight, not in the load; user
   * request 2026-10-29). Optional: older files have none. */
  valuables?: string
  /** Feat and species spells cast without a slot since the last Long Rest ('<owner id>:<spell id>'; Elven Lineage p. 84,
   * Fiendish Legacy p. 86, Magic Initiate p. 87). Optional: older files have none. */
  freeCasts?: string[]
  spellcasting: Record<string, SpellcastingState>
  /** Expended spell slots per spell level (index 0 = level 1); slots are shared between Spellcasting classes (SRD p. 25). */
  slotsUsed: number[]
  /** Warlock Pact Magic slots expended (separate pool, SRD p. 26). */
  pactUsed: number
  /** Weapons whose mastery property the character can use (Weapon Mastery feature choices). */
  weaponMastery: string[]
  /** Situational switches of the Combat pane ('rage', or '<owner id>|<target>' for a conditional part). */
  toggles: Record<string, boolean>
  /** Base AC formula chosen when several apply (SRD p. 177); the best one when unset. */
  acChoice?: string
  /** Uses of per-rest resources spent, keyed by feature id (e.g. 'barbarian:rage', 'fighter:second-wind'). */
  resources: Record<string, number>
  /** Hit Dice spent per class id (SRD "Short Rest", p. 15). */
  hitDiceSpent: Record<string, number>
  hp: HitPointState
  /** Exhaustion level 0–6 (Rules Glossary). */
  exhaustion: number
  conditions: string[]
  activeEffects: ActiveEffect[]
  /** Id of the active effect being concentrated on. */
  concentration?: string
  heroicInspiration: boolean
  /** Familiar, steed, mounts and other creatures (schema 2). */
  companions: Companion[]
  wildShape: WildShapeState
  /** Creatures summoned or created by a spell, tracked in the Combat pane (engine/summons.ts). Optional, no migration. */
  summons?: Summon[]
  /** The current turn's actions, movement and attacks (Combat pane "Your turn"). Optional, no migration. */
  turn?: TurnState
  /** Every choice of a feature, species trait or class option, keyed by the owner id (or '<owner id>#<choice id>',
   * engine/sheet/build.ts `choiceKey`): 'human:skillful' → a skill id, 'fighter:fighting-style' → a feat id,
   * 'druid:circle-of-the-land:spells' → 'polar', 'warlock:eldritch-invocations' → invocation ids, 'rogue:expertise' →
   * skill ids. One store since schema 5 (level choices and `expertise` were separate before). A feat's own choices
   * stay in its `FeatPick`, which belongs to its slot (background, level, granting feature). */
  featureChoices: Record<string, string | string[]>
  /** Feats granted outside the level record, keyed by what grants them: 'human:versatile' (Origin feat),
   * 'fighter:champion:additional-fighting-style', 'warlock:eldritch-invocation:lessons-of-the-first-ones'. */
  extraFeats: Record<string, FeatPick>
  round: number
  notes: { id: string; date: string; title: string; body: string }[]
  /** Campaign notes attached to popups, keyed like 'feat:<id>', 'item:<uid>', 'stat:<title>'. */
  annotations: Record<string, string>
  /** Uploaded pictures (data URLs). `doll` (schema 4): undefined = the built-in paper-doll illustration, null = removed. */
  images: { face?: string; coatOfArms?: string; doll?: string | null }
  settings: { lang: Lang }
}
