// Stage 6: attacks with the weapons in hand and the Unarmed Strike.
// SRD p. 7 "Attack Rolls" (ability modifier + Proficiency Bonus when proficient), p. 89 "Weapon Proficiency", "Properties"
// (Finesse: Str or Dex; Thrown; Versatile; Heavy: Disadvantage without Str/Dex 13), p. 90 "Mastery Properties", p. 190
// "Unarmed Strike" (Str + PB; 1 + Str Bludgeoning), p. 17 "Damage Rolls" (add the same ability modifier), p. 50 Monk
// "Martial Arts" (Dexterous Attacks, Martial Arts die on Unarmed Strikes and Monk weapons), p. 48 Fighter "Two Extra
// Attacks" / "Three Extra Attacks", p. 25 "Extra Attack" (features from several classes don't stack).
import type { AbilityId, WeaponDef } from '../../data/types'
import type { ItemInstance } from '../../model/character'
import { type Part, esOf, resolve, i18n } from '../stacking'
import { ABILITY_SHORT, SRC } from './common'
import { resolveValue } from './modifiers'
import type {
  AttackLine,
  AttacksResult,
  BuildResult,
  ComputeOptions,
  CoreResult,
  DefenseResult,
  ModifiersResult,
} from './types'

type In = BuildResult & ModifiersResult & CoreResult & DefenseResult

const PROP_NAMES: Record<string, { en: string; fr: string; es: string }> = {
  ammunition: { en: 'Ammunition', fr: 'Munitions', es: 'Munición' },
  finesse: { en: 'Finesse', fr: 'Finesse', es: 'Sutil' },
  heavy: { en: 'Heavy', fr: 'Lourde', es: 'Pesada' },
  light: { en: 'Light', fr: 'Légère', es: 'Ligera' },
  loading: { en: 'Loading', fr: 'Chargement', es: 'Recarga' },
  range: { en: 'Range', fr: 'Portée', es: 'Alcance' },
  reach: { en: 'Reach', fr: 'Allonge', es: 'Gran alcance' },
  thrown: { en: 'Thrown', fr: 'Lancer', es: 'Arrojadiza' },
  'two-handed': { en: 'Two-Handed', fr: 'À deux mains', es: 'A dos manos' },
  versatile: { en: 'Versatile', fr: 'Polyvalente', es: 'Versátil' },
}

const SRC_MARTIAL_ARTS = { page: 50, frPage: 65, section: 'Classes > Monk > Level 1: Martial Arts' }

/** Weapon proficiency: the first class's list, a later class's multiclass list, feats/grants (SRD p. 25, p. 89). Lists may
 * hold a category, a weapon id, 'martial:light' (Monk, p. 49) or 'martial:finesse-or-light' (Rogue, p. 61). */
export function weaponProficient(b: BuildResult, w: WeaponDef): boolean {
  const lists: string[] = []
  b.classOrder.forEach((cid, i) => {
    const def = b.classes.get(cid)
    if (!def) return
    lists.push(...(i === 0 ? def.weaponProficiencies : def.multiclass.weapons))
  })
  for (const g of b.owners.flatMap((o) => o.grants))
    if (g.kind === 'proficiency' && g.on?.startsWith('weapon.')) lists.push(g.on.slice(7))
  for (const p of lists) {
    if (p === w.category || p === w.id) return true
    if (
      p === 'martial:finesse-or-light' &&
      w.category === 'martial' &&
      (w.properties.includes('finesse') || w.properties.includes('light'))
    )
      return true
    if (p === 'martial:light' && w.category === 'martial' && w.properties.includes('light')) return true
  }
  return false
}

/** Monk weapons: Simple Melee weapons and Martial Melee weapons with the Light property (SRD p. 50). */
export const isMonkWeapon = (w: WeaponDef) =>
  w.kind === 'melee' && (w.category === 'simple' || w.properties.includes('light'))

const dieSize = (dice: string | null | undefined) => {
  const m = dice?.match(/(\d*)d(\d+)/)
  return m ? parseInt(m[2], 10) : 0
}

export function attacksStage(b: In, _opts: ComputeOptions): AttacksResult {
  const { pool, abilities, pb, char, rules } = b
  const exhaustion = -2 * (char.exhaustion ?? 0)
  const mastery = new Set(char.weaponMastery ?? [])
  // Weapon Mastery count: the `mastery` of each Weapon Mastery feature (a table column for Barbarian/Fighter, 2 for
  // Rogue/Paladin/Ranger), summed across classes (the SRD is silent on multiclass stacking: house-rules.md pending).
  let masteryMax = 0
  for (const o of b.owners) if (o.eff.mastery !== undefined) masteryMax += resolveValue(o.eff.mastery, b, o) ?? 0
  const martialArts =
    pool.flags.has('martial-arts') && !b.armor && !b.shield && b.weapons.every((x) => isMonkWeapon(x.def))
  const martialDie = typeof b.tableValues.monk?.martialArts === 'string' ? b.tableValues.monk.martialArts : undefined
  const pactWeapon = pool.flags.has('pact-weapon')
  const critParts = pool.parts('critRange')
  const critRange = critParts.length ? Math.min(20, ...critParts.map((p) => p.value)) : 20
  const extraFor = (kind: 'melee' | 'ranged' | 'unarmed'): AttackLine['extraDamage'] =>
    pool.dice
      .filter(
        (d) =>
          d.target === 'extraDamage.all' ||
          d.target === `extraDamage.${kind}` ||
          (kind === 'unarmed' && d.target === 'extraDamage.melee'),
      )
      .filter((d) => !d.when || d.when === `${kind === 'unarmed' ? 'melee' : kind}-weapon`)
      .map((d) => ({ label: d.label, dice: d.dice, condition: d.condition, source: d.owner.source }))
  const abilityLabel = (a: AbilityId) => ({
    en: `${ABILITY_SHORT[a].en} modifier`,
    fr: `Modificateur de ${ABILITY_SHORT[a].fr}`,
    es: `Modificador de ${esOf(ABILITY_SHORT[a])}`,
  })
  const line = (uid: string, w: WeaponDef, item?: ItemInstance, name = w.name): AttackLine => {
    const melee = w.kind === 'melee'
    let ability: AbilityId = melee ? 'str' : 'dex'
    const notes: AttackLine['notes'] = []
    if (w.properties.includes('finesse')) ability = abilities.dex.mod > abilities.str.mod ? 'dex' : 'str'
    const monk = martialArts && isMonkWeapon(w)
    if (monk && abilities.dex.mod > abilities[ability].mod) {
      ability = 'dex'
      notes.push(i18n('Martial Arts: Dexterity', 'Arts martiaux : Dextérité', 'Artes marciales: Destreza'))
    }
    if (pactWeapon && abilities.cha.mod > abilities[ability].mod) {
      ability = 'cha'
      notes.push(i18n('Pact weapon: Charisma', 'Arme de pacte : Charisme', 'Arma de pacto: Carisma'))
    }
    const proficient = weaponProficient(b, w)
    const kind = melee ? 'melee' : 'ranged'
    const atk: Part[] = [
      { sourceId: 'ability', label: abilityLabel(ability), value: abilities[ability].mod, source: SRC.attackRoll },
    ]
    if (proficient)
      atk.push({
        sourceId: 'pb',
        label: i18n('Proficiency Bonus', 'Bonus de maîtrise', 'Bonificador por competencia'),
        value: pb,
        effectName: 'Proficiency Bonus',
        source: SRC.weaponProficiency,
      })
    // A custom weapon's bonuses: the magic bonus (as "Weapon, +1, +2, or +3", SRD p. 253) on attack and damage rolls,
    // plus its own attack and damage bonuses (engine/items.ts, model CustomItem).
    const cw = item?.custom
    const magicSrc = rules.magicItems.get('weapon-1-2-or-3')?.source
    const wName = cw?.name ?? w.name
    const customParts = (extra: number | undefined): Part[] => {
      const out: Part[] = []
      if (cw?.magicBonus)
        out.push({
          sourceId: `${uid}:magic`,
          label: i18n(
            `Magic bonus +${cw.magicBonus}`,
            `Bonus magique +${cw.magicBonus}`,
            `Bonificador mágico +${cw.magicBonus}`,
          ),
          value: cw.magicBonus,
          source: magicSrc,
        })
      if (extra) out.push({ sourceId: `${uid}:custom`, label: wName, value: extra })
      return out
    }
    atk.push(...customParts(cw?.attackBonus))
    // An SRD magic weapon's own bonuses ('item.attack' / 'item.damage' parts of its owner `item:<uid>`, e.g. "You gain
    // a +1 bonus to attack rolls and damage rolls made with this magic weapon"), and bonuses tied to a weapon type
    // ('attack.weapon.<id>', 'damage.weapon.<id>': Bracers of Archery with Longbows and Shortbows, SRD p. 214).
    const itemOwner = item ? `item:${item.uid}` : undefined
    const own = (target: string) => (itemOwner ? pool.parts(target).filter((p) => p.sourceId === itemOwner) : [])
    atk.push(...own('item.attack'), ...pool.parts(`attack.weapon.${w.id}`))
    atk.push(...pool.parts(`attack.${kind}`, { weaponKind: kind }), ...pool.parts('attack.all'), ...pool.parts('d20'))
    if (exhaustion)
      atk.push({
        sourceId: 'exhaustion',
        label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
        value: exhaustion,
        source: SRC.exhaustion,
      })
    const dis = [...pool.disadvantage('attack'), ...pool.disadvantage(`attack.${kind}`)]
    const adv = [...pool.advantage('attack'), ...pool.advantage(`attack.${kind}`)]
    if (w.properties.includes('heavy')) {
      const need = melee ? abilities.str.score.total : abilities.dex.score.total
      if (need < 13)
        dis.push({
          en: `Heavy weapon: ${melee ? 'Strength' : 'Dexterity'} below 13`,
          fr: `Arme lourde : ${melee ? 'Force' : 'Dextérité'} inférieure à 13`,
          es: `Arma pesada: ${melee ? 'Fuerza' : 'Destreza'} inferior a 13`,
        })
    }
    if (!proficient)
      notes.push(
        i18n(
          'Not proficient: no Proficiency Bonus',
          'Non maîtrisée : pas de bonus de maîtrise',
          'Sin competencia: no se suma el bonificador por competencia',
        ),
      )
    const attack = resolve(atk, { advantage: adv, disadvantage: dis })
    const dmg: Part[] = [
      {
        sourceId: 'ability',
        label: abilityLabel(ability),
        value: abilities[ability].mod,
        source: { page: 17, frPage: 17, section: 'Playing the Game > Damage Rolls' },
      },
    ]
    dmg.push(...customParts(cw?.damageBonus))
    dmg.push(...own('item.damage'), ...pool.parts(`damage.weapon.${w.id}`))
    dmg.push(...pool.parts(`damage.${kind}`, { weaponKind: kind }), ...pool.parts('damage.all'))
    if (melee && ability === 'str') dmg.push(...pool.parts('damage.melee.str'))
    // Martial Arts die in place of the weapon's damage when larger (p. 50 "Martial Arts Die").
    // Versatile weapon held in two hands: the bracketed damage (p. 90 "Versatile").
    let dice = (item?.twoHanded && w.versatile ? w.versatile : w.damage) ?? '—'
    if (monk && martialDie && dieSize(martialDie) > dieSize(w.damage)) {
      dice = martialDie
      notes.push(
        i18n(
          `Martial Arts die ${martialDie}`,
          `Dé d’arts martiaux ${martialDie}`,
          `Dado de Artes marciales ${martialDie}`,
        ),
      )
    }
    const props = w.properties.map((p) => PROP_NAMES[p] ?? { en: p, fr: p, es: p })
    const mdef = rules.weaponProperties.get(w.mastery)
    return {
      uid,
      name,
      weapon: w,
      ability,
      proficient,
      attack,
      damage: {
        dice,
        type: w.damageType
          ? (rules.damageTypeNames?.[w.damageType] ?? { en: w.damageType, fr: w.damageType, es: w.damageType })
          : { en: '', fr: '', es: '' },
        bonus: resolve(dmg),
        versatile: w.versatile,
      },
      properties: props,
      mastery: {
        id: w.mastery,
        name: mdef?.name ?? { en: w.mastery, fr: w.mastery, es: w.mastery },
        usable: masteryMax > 0 && mastery.has(w.id) && proficient,
      },
      range: w.range
        ? {
            normal: { en: `${w.range.normal.ft} ft`, fr: `${w.range.normal.m} m`, es: `${w.range.normal.m} m` },
            long: { en: `${w.range.long.ft} ft`, fr: `${w.range.long.m} m`, es: `${w.range.long.m} m` },
          }
        : undefined,
      notes,
      critRange,
      extraDamage: [
        ...(cw?.extraDamage ?? [])
          .filter((x) => x.dice?.trim())
          .map((x) => {
            const t = x.type ? (rules.damageTypeNames?.[x.type] ?? { en: x.type, fr: x.type, es: x.type }) : undefined
            return {
              label: t
                ? { en: `${wName.en} (${t.en})`, fr: `${wName.fr} (${t.fr})`, es: `${esOf(wName)} (${esOf(t)})` }
                : wName,
              dice: x.dice.trim(),
            }
          }),
        // An SRD magic weapon's extra dice ('extraDamage.item': Flame Tongue 2d6 Fire while ablaze, Vicious Weapon 2d6).
        ...pool.dice
          .filter((d) => d.target === 'extraDamage.item' && d.owner.id === itemOwner)
          .map((d) => ({ label: d.label, dice: d.dice, condition: d.condition, source: d.owner.source })),
        ...extraFor(kind),
      ],
    }
  }
  const attacks = b.weapons.map((x) => line(x.item.uid, x.def, x.item))
  // Unarmed Strike (SRD p. 190): Str + PB to hit, 1 + Str Bludgeoning; Monk Martial Arts: Dex if higher, the Martial Arts
  // die as damage (p. 50).
  const uAbility: AbilityId = martialArts && abilities.dex.mod > abilities.str.mod ? 'dex' : 'str'
  const uSrc = martialArts ? SRC_MARTIAL_ARTS : SRC.unarmedStrike
  const uAtk: Part[] = [
    { sourceId: 'ability', label: abilityLabel(uAbility), value: abilities[uAbility].mod, source: uSrc },
    {
      sourceId: 'pb',
      label: i18n('Proficiency Bonus', 'Bonus de maîtrise', 'Bonificador por competencia'),
      value: pb,
      effectName: 'Proficiency Bonus',
      source: SRC.unarmedStrike,
    },
    ...pool.parts('attack.melee', { weaponKind: 'melee' }),
    ...pool.parts('attack.all'),
    ...pool.parts('d20'),
    // Unarmed Strikes only (Demon Armor's clawed gauntlets, SRD p. 218).
    ...pool.parts('attack.unarmed'),
  ]
  if (exhaustion)
    uAtk.push({
      sourceId: 'exhaustion',
      label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
      value: exhaustion,
      source: SRC.exhaustion,
    })
  const uDmg: Part[] = [
    { sourceId: 'ability', label: abilityLabel(uAbility), value: abilities[uAbility].mod, source: uSrc },
  ]
  if (!(martialArts && martialDie))
    uDmg.unshift({
      sourceId: 'base',
      label: i18n('Unarmed Strike', 'Attaque à mains nues', 'Ataque sin armas'),
      value: 1,
      source: SRC.unarmedStrike,
    })
  uDmg.push(
    ...pool.parts('damage.melee', { weaponKind: 'melee' }),
    ...pool.parts('damage.all'),
    ...pool.parts('damage.unarmed'),
  )
  if (uAbility === 'str') uDmg.push(...pool.parts('damage.melee.str'))
  const uNotes: AttackLine['notes'] = []
  if (martialArts && martialDie)
    uNotes.push(
      i18n(
        `Martial Arts die ${martialDie}`,
        `Dé d’arts martiaux ${martialDie}`,
        `Dado de Artes marciales ${martialDie}`,
      ),
    )
  const unarmed: AttackLine = {
    uid: 'unarmed',
    name: i18n('Unarmed Strike', 'Attaque à mains nues', 'Ataque sin armas'),
    weapon: {
      id: 'unarmed',
      name: i18n('Unarmed Strike', 'Attaque à mains nues', 'Ataque sin armas'),
      category: 'simple',
      kind: 'melee',
      damage: null,
      damageType: 'bludgeoning',
      properties: [],
      mastery: 'sap',
      weight: { lb: 0, kg: 0 },
      cost: { gp: 0, text: { en: '—', fr: '—', es: '—' } },
      source: SRC.unarmedStrike,
    },
    ability: uAbility,
    proficient: true,
    attack: resolve(uAtk, {
      advantage: [...pool.advantage('attack'), ...pool.advantage('attack.melee')],
      disadvantage: [...pool.disadvantage('attack'), ...pool.disadvantage('attack.melee')],
    }),
    damage: {
      dice: martialArts && martialDie ? martialDie : '',
      type: i18n('Bludgeoning', 'contondants', 'contundente'),
      bonus: resolve(uDmg),
    },
    properties: [],
    mastery: { id: '', name: { en: '', fr: '', es: '' }, usable: false },
    notes: uNotes,
    critRange,
    extraDamage: extraFor('unarmed'),
  }
  // Extra Attack: two attacks with the Attack action; features from several classes don't stack (SRD p. 25); the
  // Fighter's Two / Three Extra Attacks (p. 48) give three and four.
  let attacksPerAction = pool.flags.has('extra-attack') ? 2 : 1
  if (pool.flags.has('two-extra-attacks')) attacksPerAction = 3
  if (pool.flags.has('three-extra-attacks')) attacksPerAction = 4
  return { attacks, unarmed, attacksPerAction, masteryMax }
}
