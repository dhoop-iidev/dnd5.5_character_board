// Loads the generated SRD 5.2.1 data (src/data/srd/*.json) into one indexed registry.
import type {
  I18n,
  ArmorDef,
  BackgroundDef,
  ClassDef,
  ConditionDef,
  CreatureDef,
  DamageType,
  EffectDef,
  FeatDef,
  GearDef,
  GlossaryEntry,
  MagicItemDef,
  RulesTables,
  SkillDef,
  SpeciesDef,
  SpellDef,
  WeaponDef,
  WeaponPropertyDef,
} from './types'

import rulesTables from './srd/rules.json'
import skills from './srd/skills.json'
import conditions from './srd/conditions.json'
import glossary from './srd/glossary.json'
import classes from './srd/classes.json'
import species from './srd/species.json'
import backgrounds from './srd/backgrounds.json'
import feats from './srd/feats.json'
import weapons from './srd/weapons.json'
import weaponProperties from './srd/weapon-properties.json'
import armor from './srd/armor.json'
import gear from './srd/gear.json'
import spells from './srd/spells.json'
import magicItems from './srd/magic-items.json'
import creatures from './srd/creatures.json'
import effBarbarian from './custom/effects/barbarian.json'
import effBard from './custom/effects/bard.json'
import effCleric from './custom/effects/cleric.json'
import effDruid from './custom/effects/druid.json'
import effFighter from './custom/effects/fighter.json'
import effMonk from './custom/effects/monk.json'
import effPaladin from './custom/effects/paladin.json'
import effRanger from './custom/effects/ranger.json'
import effRogue from './custom/effects/rogue.json'
import effSorcerer from './custom/effects/sorcerer.json'
import effWarlock from './custom/effects/warlock.json'
import effWizard from './custom/effects/wizard.json'
import effSpecies from './custom/effects/species.json'
import effFeats from './custom/effects/feats.json'
import effConditions from './custom/effects/conditions.json'
import effMagicItems from './custom/effects/magic-items.json'
import damageTypes from './custom/damage-types.json'
import summaries from './custom/summaries.json'
import summariesSpells from './custom/summaries-spells.json'
import summariesItems from './custom/summaries-items.json'

export interface Rules {
  tables: RulesTables
  skills: Map<string, SkillDef>
  conditions: Map<string, ConditionDef>
  glossary: Map<string, GlossaryEntry>
  classes: Map<string, ClassDef>
  species: Map<string, SpeciesDef>
  backgrounds: Map<string, BackgroundDef>
  feats: Map<string, FeatDef>
  weapons: Map<string, WeaponDef>
  weaponProperties: Map<string, WeaponPropertyDef>
  armor: Map<string, ArmorDef>
  gear: Map<string, GearDef>
  spells: Map<string, SpellDef>
  magicItems: Map<string, MagicItemDef>
  creatures: Map<string, CreatureDef>
  /** Hand-written effects of the features the engine computes (custom/effects/*.json, one file per class, plus species,
   * feats and conditions). */
  effects: Map<string, EffectDef>
  /** Damage type names (custom/damage-types.json, official French and Spanish terms from the translated SRDs). */
  damageTypeNames: Record<DamageType, I18n>
  /** One-line summaries shown in lists (custom/summaries.json), keyed `feature:<id>`, `trait:<id>`, `feat:<id>`,
   * `background:<id>`, `species:<id>`, `invocation:<id>`, `metamagic:<id>`, `resource:<id>`; `spell:<id>` in summaries-spells.json, `item:<id>` in
   * summaries-items.json. */
  summaries: Map<string, I18n>
}

/** Every effect file concatenated; a duplicated id is a data error. */
export function allEffects(): EffectDef[] {
  const files = [
    effBarbarian,
    effBard,
    effCleric,
    effDruid,
    effFighter,
    effMonk,
    effPaladin,
    effRanger,
    effRogue,
    effSorcerer,
    effWarlock,
    effWizard,
    effSpecies,
    effFeats,
    effConditions,
    effMagicItems,
  ] as unknown as EffectDef[][]
  const out: EffectDef[] = []
  const seen = new Set<string>()
  for (const list of files)
    for (const e of list) {
      if (seen.has(e.id)) throw new Error(`effects: duplicate id ${e.id}`)
      seen.add(e.id)
      out.push(e)
    }
  return out
}

function index<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]))
}

export function buildRules(): Rules {
  return {
    tables: rulesTables as unknown as RulesTables,
    skills: index(skills as unknown as SkillDef[]),
    conditions: index(conditions as unknown as ConditionDef[]),
    glossary: index(glossary as unknown as GlossaryEntry[]),
    classes: index(classes as unknown as ClassDef[]),
    species: index(species as unknown as SpeciesDef[]),
    backgrounds: index(backgrounds as unknown as BackgroundDef[]),
    feats: index(feats as unknown as FeatDef[]),
    weapons: index(weapons as unknown as WeaponDef[]),
    weaponProperties: index(weaponProperties as unknown as WeaponPropertyDef[]),
    armor: index(armor as unknown as ArmorDef[]),
    gear: index(gear as unknown as GearDef[]),
    spells: index(spells as unknown as SpellDef[]),
    magicItems: index(magicItems as unknown as MagicItemDef[]),
    creatures: index(creatures as unknown as CreatureDef[]),
    effects: index(allEffects()),
    damageTypeNames: damageTypes as Record<DamageType, I18n>,
    summaries: new Map(Object.entries({ ...summaries, ...summariesSpells, ...summariesItems } as Record<string, I18n>)),
  }
}

export const rules: Rules = buildRules()
