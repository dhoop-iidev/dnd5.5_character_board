// Stage 1: what the character is made of. Levels, classes, subclass, species, background, feats, features, the player's
// choices, and the rules owners (features, traits, feats, options, conditions, items, effects) whose effects later stages
// read. Each owner carries `eff`: its hand-written effect entry with the chosen options merged in.
import type { Rules } from '../../data/rules'
import type {
  ArmorDef,
  ChoiceDef,
  ClassDef,
  ClassFeatureDef,
  EffectDef,
  FeatDef,
  I18n,
  OptionEffect,
  SpeciesTraitDef,
  SubclassDef,
  WeaponDef,
} from '../../data/types'
import type { Character, FeatPick, ItemInstance } from '../../model/character'
import type { BuildResult, ComputeOptions, Owner } from './types'
import { backgroundDef } from '../../model/customBackground'
import { esOf } from '../stacking'
import { customWeapon, itemActive, magicItemOf, variantOf, variantValue } from '../items'

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : [])

/** Storage key of a choice: the owner id, or '<owner id>#<choice id>' when the owner has several choices. */
export const choiceKey = (ownerId: string, c: ChoiceDef) => (c.id ? `${ownerId}#${c.id}` : ownerId)

function merge(base: EffectDef, opt: OptionEffect): EffectDef {
  return {
    ...base,
    modifiers: [...(base.modifiers ?? []), ...(opt.modifiers ?? [])],
    grants: [...(base.grants ?? []), ...(opt.grants ?? [])],
    flags: [...(base.flags ?? []), ...(opt.flags ?? [])],
    computed: [...(base.computed ?? []), ...(opt.computed ?? [])],
    uses: opt.uses ?? base.uses,
    acFormula: opt.acFormula ?? base.acFormula,
    mastery: opt.mastery ?? base.mastery,
    overrides: [...(base.overrides ?? []), ...(opt.overrides ?? [])],
    spells:
      opt.spells || base.spells
        ? {
            ...(base.spells ?? {}),
            ...(opt.spells ?? {}),
            always: [...(base.spells?.always ?? []), ...(opt.spells?.always ?? [])],
          }
        : undefined,
  }
}

export function buildStage(char: Character, rules: Rules, opts: ComputeOptions): BuildResult {
  const levels = opts.level ? char.levels.slice(0, opts.level) : char.levels
  const level = levels.length
  const classLevels: Record<string, number> = {}
  const classOrder: string[] = []
  const subclassChoice: Record<string, string> = {}
  // Every feature, trait and option choice, keyed by owner (and choice id): one store (schema 5).
  const choices: Record<string, string | string[]> = char.featureChoices ?? {}
  /** The rows whose feat applies: a class's Ability Score Improvement levels and level 19 (Epic Boon). A feat stored on
   * another row (its class changed) is ignored, and flagged by the rule checks. */
  const featRows = new Set<number>()
  levels.forEach((l, i) => {
    classLevels[l.classId] = (classLevels[l.classId] ?? 0) + 1
    if (!classOrder.includes(l.classId)) classOrder.push(l.classId)
    if (l.subclassId) subclassChoice[l.classId] = l.subclassId
    const cl = classLevels[l.classId]
    if (rules.classes.get(l.classId)?.asiLevels.includes(cl) || cl === 19) featRows.add(i)
  })
  const classes = new Map<string, ClassDef>()
  for (const id of classOrder) {
    const def = rules.classes.get(id)
    if (def) classes.set(id, def)
  }
  const subclasses = new Map<string, SubclassDef>()
  const features: BuildResult['features'] = []
  const owners: Owner[] = []
  const feats: BuildResult['feats'] = []

  const chosen = (o: Owner, c: ChoiceDef): string[] => {
    if (o.pick) return asList(o.pick.choices?.[c.id ?? 'choice'])
    return asList(choices[choiceKey(o.id, c)])
  }

  /** Create an owner, merge its chosen options in, spawn option owners and extra feats. */
  function owner(id: string, kind: Owner['kind'], name: I18n, text?: I18n, extra: Partial<Owner> = {}): Owner {
    const effect = rules.effects.get(extra.effectId ?? id)
    let eff: EffectDef = effect
      ? { ...effect, modifiers: [...(effect.modifiers ?? [])], grants: [...(effect.grants ?? [])] }
      : { id }
    const o: Owner = { id, kind, name, text, effect, eff, modifiers: [], grants: [], choiceValues: {}, ...extra }
    owners.push(o)
    for (const c of effect?.choices ?? []) {
      const values = chosen(o, c)
      o.choiceValues[c.id ?? 'choice'] = values
      if (c.kind === 'option') {
        for (const v of values) {
          const inline = c.options?.[v]
          if (inline) {
            eff = merge(eff, inline)
            continue
          }
          // An option from the class's option lists (Eldritch Invocations, Metamagic): its own owner.
          const cls = o.classId ? rules.classes.get(o.classId) : undefined
          const lists = asList(c.from).flatMap((k) => cls?.options?.[k] ?? [])
          const opt = lists.find((x) => x.id === v)
          if (opt)
            owner(opt.id, 'option', opt.name, opt.text, {
              source: opt.source,
              classId: o.classId,
              level: o.level,
              optionOf: o.id,
            })
        }
      } else if (c.kind === 'feat') {
        const pick = char.extraFeats?.[o.id]
        if (pick) addFeat(pick, o.kind === 'trait' ? 'species' : 'class', o.level, o.id)
      }
    }
    o.eff = eff
    o.modifiers = [...(eff.modifiers ?? [])]
    o.grants = [...(eff.grants ?? [])]
    return o
  }

  function addFeat(
    pick: FeatPick | undefined,
    from: BuildResult['feats'][number]['from'],
    lvl?: number,
    grantedBy?: string,
  ) {
    const def = pick ? rules.feats.get(pick.featId) : undefined
    if (!def || !pick) return
    feats.push({ def, from, level: lvl, grantedBy })
    // Each copy of a repeatable feat is its own owner: its choices, warnings, uses and free casts are its own. The
    // first copy (the background's, built first) is `feat:<id>`; another one is named after where it comes from
    // (`feat:magic-initiate@human:versatile`, `feat:skilled@level-4`), so adding or removing one copy never renames
    // the other (saved uses and free casts are keyed by owner id).
    const n = owners.filter((x) => x.feat?.id === def.id).length
    const slot = grantedBy ?? `level-${lvl ?? 0}`
    owner(n ? `feat:${def.id}@${slot}` : `feat:${def.id}`, 'feat', def.name, def.text, {
      source: def.source,
      level: lvl,
      pick,
      feat: { id: def.id, from, level: lvl, grantedBy },
      ...(n ? { effectId: `feat:${def.id}` } : {}),
    })
  }

  // The background's feat first: it keeps the plain `feat:<id>` when a feature or trait grants the same feat.
  addFeat(char.background?.feat, 'background')
  for (const [cid, def] of classes) {
    const cl = classLevels[cid]
    for (const f of def.features) {
      if (f.level <= cl) {
        features.push({ def: f, classId: cid, classLevel: cl })
        owner(f.id, 'feature', f.name, f.text, { source: f.source, classId: cid, level: f.level })
      }
    }
    const subId = subclassChoice[cid]
    const sub = subId ? def.subclasses.find((s) => s.id === subId) : undefined
    if (sub) {
      subclasses.set(cid, sub)
      for (const f of sub.features) {
        if (f.level <= cl) {
          features.push({ def: f, classId: cid, classLevel: cl })
          owner(f.id, 'subclass-feature', f.name, f.text, { source: f.source, classId: cid, level: f.level })
        }
      }
    }
  }
  const species = rules.species.get(char.speciesId)
  // A custom species trait may start at a later character level (house rule #6).
  const traits: SpeciesTraitDef[] = (species?.traits ?? []).filter((t) => !t.level || t.level <= level)
  for (const t of traits) owner(t.id, 'trait', t.name, t.text, { source: t.source })
  const background = backgroundDef(char.background, rules)
  levels.forEach((l, i) => {
    if (featRows.has(i)) addFeat(l.feat, 'level', i + 1)
  })
  // Fighting Style features grant the feat the player chose (the choice holds the feat id), while the feature is there.
  for (const o of owners.filter((x) => x.kind === 'feature' && x.id.endsWith(':fighting-style'))) {
    const v = choices[o.id]
    if (typeof v === 'string' && rules.feats.has(v)) addFeat({ featId: v }, 'class', undefined, o.id)
  }
  // Conditions (Rules Glossary) and active effects.
  for (const cid of char.conditions ?? []) {
    const def = rules.conditions.get(cid)
    if (def) owner(`condition:${cid}`, 'condition', def.name, def.text, { source: def.source })
  }
  for (const e of char.activeEffects ?? []) {
    if (!e.enabled) continue
    const name = e.name ??
      (e.refId ? rules.spells.get(e.refId)?.name : undefined) ?? {
        en: e.refId ?? '?',
        fr: e.refId ?? '?',
        es: e.refId ?? '?',
      }
    const o = owner(`effect:${e.uid}`, 'effect', name)
    for (const m of e.modifiers ?? [])
      o.modifiers.push({ target: m.target, value: m.value, effectName: m.effectName ?? name.en })
  }
  // Items on the body: armor, shield, weapons in hand, magic items with effects.
  const worn = (char.inventory ?? []).filter((i) => i.location === 'worn')
  let armor: BuildResult['armor']
  let shield: BuildResult['shield']
  const weapons: BuildResult['weapons'] = []
  for (const item of worn) {
    if (item.kind === 'armor' && item.refId) {
      const def = rules.armor.get(item.refId)
      if (!def) continue
      if (def.category === 'shield') {
        if (item.equipped) shield = { item, def }
      } else if (!armor) armor = { item, def }
    } else if (item.kind === 'weapon' && item.refId && item.equipped) {
      const def = rules.weapons.get(item.refId)
      // A custom weapon: the base weapon with its overrides (engine/items.ts); an SRD magic weapon is named after the
      // magic item and its base ("Flame Tongue (Longsword)").
      const mdef = magicItemOf(item, rules)
      if (def) {
        const w = { ...customWeapon(def, item) }
        if (mdef && !item.custom?.name)
          w.name = mdef.name.en.includes(def.name.en)
            ? mdef.name
            : {
                en: `${mdef.name.en} (${def.name.en})`,
                fr: `${mdef.name.fr} (${def.name.fr})`,
                es: `${esOf(mdef.name)} (${esOf(def.name)})`,
              }
        weapons.push({ item, def: w })
      }
    }
  }
  // Weapons created by a feature (custom subclass features, house rule #5): always at hand while the feature is gained,
  // never carried. Its own id, so proficiency with it doesn't extend to the base weapon.
  for (const o of owners) {
    const fw = o.eff.weapon
    const base = fw ? rules.weapons.get(fw.base) : undefined
    if (!fw || !base) continue
    const id = `feature:${o.id}`
    const item: ItemInstance = {
      uid: id,
      kind: 'weapon',
      refId: base.id,
      quantity: 1,
      location: 'worn',
      equipped: true,
      feature: { ownerId: o.id, mastery: fw.mastery },
    }
    weapons.push({
      item,
      def: {
        ...base,
        id,
        name: fw.name,
        damage: fw.damage?.trim() || base.damage,
        damageType: fw.damageType ?? base.damageType,
        range: fw.range ?? base.range,
      },
    })
    if (fw.proficient) o.grants.push({ kind: 'proficiency', on: `weapon.${id}` })
  }
  // Item effects: SRD magic items (custom/effects/magic-items.json, `item:<magic item id>`, with the chosen options and
  // the item's variant) and the modifiers of a custom item (or of an SRD item the player gave some), while the item is
  // active (engine/items.ts `itemActive`: worn, a weapon or Shield in hand, attuned when required; some items "while
  // attuned" or "on your person"). One owner per inventory item, `item:<uid>`; its choices are stored under that id.
  for (const item of char.inventory ?? []) {
    if (!itemActive(item, rules)) continue
    const mdef = magicItemOf(item, rules)
    const effect = mdef ? rules.effects.get(`item:${mdef.id}`) : undefined
    const customMods = item.custom?.modifiers ?? []
    if (!effect && !mdef?.modifiers?.length && !mdef?.grants?.length && !customMods.length) continue
    const magicName = mdef?.name
    const name = item.custom?.name ??
      magicName ?? { en: item.refId ?? '?', fr: item.refId ?? '?', es: item.refId ?? '?' }
    const o = owner(`item:${item.uid}`, 'item', name, item.custom?.text ?? mdef?.text, {
      source: mdef?.source,
      effectId: effect?.id,
      itemUid: item.uid,
    })
    // The same magic item worn twice doesn't combine (SRD p. 106 "Combining Spell Effects", stacking.ts): parts are
    // named after the SRD item; a variant's value replaces `value`.
    const variant = variantOf(item, mdef)
    const stackName = (magicName ?? name).en
    o.modifiers = o.modifiers.map((m) => ({
      ...m,
      value: variantValue(m, variant),
      effectName: m.effectName ?? stackName,
    }))
    for (const m of mdef?.modifiers ?? []) o.modifiers.push({ ...m, effectName: m.effectName ?? stackName })
    for (const g of mdef?.grants ?? []) o.grants.push(g)
    for (const m of customMods) o.modifiers.push({ ...m, effectName: m.effectName || name.en })
  }
  // Armor with Disadvantage in the Stealth column (SRD p. 92 "Armor" table), unless the armor says otherwise (Mithral
  // Armor, p. 231).
  const flagged = (f: string) => owners.some((o) => o.eff.flags?.includes(f))
  if (armor?.def.stealthDisadvantage && !flagged('no-armor-stealth-disadvantage')) {
    const o = owner(`armor:${armor.item.uid}`, 'item', armor.def.name, undefined, { source: armor.def.source })
    o.grants.push({ kind: 'disadvantage', on: 'skill.stealth' })
  }
  // Class-table values at the current class levels (the "resources" columns).
  const tableValues: Record<string, Record<string, number | string>> = {}
  for (const [cid, def] of classes) {
    const row = def.table[classLevels[cid] - 1]
    tableValues[cid] = { ...(row?.resources ?? {}) }
  }
  return {
    char,
    rules,
    levels,
    level,
    classLevels,
    classOrder,
    classes,
    subclasses,
    species,
    background,
    features,
    traits,
    feats,
    owners,
    choices,
    worn,
    armor,
    shield,
    weapons,
    tableValues,
  }
}

export type { ArmorDef, ClassFeatureDef, FeatDef, ItemInstance, WeaponDef }
