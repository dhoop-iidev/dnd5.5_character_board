// A level-1 character from the welcome screen's short creation (SRD 5.2.1 "Character Creation", p. 19–23, FR p. 20–24):
// class, origin (background, species, size, lineage), ability scores with the background's increases, starting
// equipment. Everything else (skills, Weapon Mastery, cantrips and spells, feat and trait choices, languages) is filled in
// the sheet, where the rule checks list what is still to choose. Level 1 Hit Points = Hit Point Die maximum + Con (p. 22);
// the character starts with all of them.
import type { AbilityId, Lang } from '../data/types'
import type { Rules } from '../data/rules'
import { EDITION, SCHEMA_VERSION, type Character } from './character'
import { kitInventory } from './startingEquipment'
import { compute } from '../engine/compute'

export interface NewCharacterInput {
  name: string
  player?: string
  speciesId: string
  backgroundId: string
  classId: string
  /** Scores before the background's increases (Standard Array, Point Cost or rolled; SRD p. 21). */
  abilities: Record<AbilityId, number>
  /** The background's increases: +2/+1 or +1/+1/+1 among its three abilities (SRD p. 21 "Adjust Ability Scores"). */
  backgroundAbilities?: Partial<Record<AbilityId, number>>
  /** Species choices made at creation: `size` for a species that is Small or Medium. */
  speciesChoices?: Record<string, string>
  /** Trait choices made at creation (a lineage or ancestry), keyed like `Character.featureChoices`. */
  featureChoices?: Record<string, string | string[]>
  /** Starting equipment options ('A', 'B', 'C'); absent = none (an empty inventory). */
  classKit?: string
  backgroundKit?: string
  kitPicks?: Record<string, string>
  lang: Lang
}

/** The spell list a background fixes for its Magic Initiate feat ("Magic Initiate (Cleric)", Acolyte p. 83). */
export function featListOf(featText: string | undefined, rules: Rules): string | undefined {
  const m = featText?.match(/\(([^)]+)\)/)
  const id = m?.[1].toLowerCase()
  return id && rules.classes.has(id) ? id : undefined
}

export function newCharacter(input: NewCharacterInput, rules: Rules): Character {
  const cls = rules.classes.get(input.classId)
  const bg = rules.backgrounds.get(input.backgroundId)
  const kit = kitInventory({
    classId: input.classId,
    classOption: input.classKit ?? '',
    backgroundId: input.backgroundId,
    backgroundOption: input.backgroundKit ?? '',
    picks: input.kitPicks,
  })
  const list = featListOf(bg?.featText?.en, rules)
  const c: Character = {
    schemaVersion: SCHEMA_VERSION,
    edition: EDITION,
    identity: {
      name: input.name,
      player: input.player ?? '',
      alignment: '',
      background: '',
      title: '',
      motto: '',
      deity: '',
      languages: ['Common'],
      height: { m: 0 },
      weight: { kg: 0 },
      age: '',
    },
    speciesId: input.speciesId,
    speciesChoices: { ...(input.speciesChoices ?? {}) },
    background: {
      backgroundId: input.backgroundId,
      abilities: { ...(input.backgroundAbilities ?? {}) },
      feat: { featId: bg?.feat ?? '', ...(list ? { choices: { list } } : {}) },
    },
    baseAbilities: { ...input.abilities },
    levels: [{ classId: input.classId, hpRoll: cls?.hitDie ?? 8, hpFixed: false, choices: {} }],
    xp: 0,
    skillProficiencies: [],
    toolProficiencies: [],
    expertise: [],
    inventory: kit.items,
    money: { cp: 0, sp: 0, ep: 0, gp: kit.gp, pp: 0 },
    spellcasting: {},
    slotsUsed: [],
    pactUsed: 0,
    weaponMastery: [],
    toggles: {},
    resources: {},
    hitDiceSpent: {},
    hp: { current: 0, temp: 0, deathSaves: { successes: 0, failures: 0 } },
    exhaustion: 0,
    conditions: [],
    activeEffects: [],
    heroicInspiration: false,
    companions: [],
    wildShape: { known: [] },
    featureChoices: { ...(input.featureChoices ?? {}) },
    extraFeats: {},
    round: 0,
    notes: [],
    annotations: {},
    images: {},
    settings: { lang: input.lang },
  }
  c.hp.current = Math.max(1, compute(c, rules).hpMax.total)
  return c
}
