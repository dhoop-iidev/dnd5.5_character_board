// Stage 4: Armor Class (every available base formula, one applies), initiative, speed, carrying capacity and load.
import type { I18n } from '../../data/types'
import { type Part, esOf, resolve, i18n } from '../stacking'
import { ABILITY_SHORT, SRC, lbToWeight, tableNumber } from './common'
import { resolveValue } from './modifiers'
import { ammoBundle } from '../items'
import type { AcOption, BuildResult, ComputeOptions, CoreResult, DefenseResult, ModifiersResult } from './types'

type In = BuildResult & ModifiersResult & CoreResult

export function defenseStage(b: In, _opts: ComputeOptions): DefenseResult {
  const { char, abilities, pool } = b
  const dex = abilities.dex.mod
  const exhaustionLevel = char.exhaustion ?? 0
  // --- Armor Class: base formulas (SRD p. 177 "Armor Class": you choose one; p. 92 "Armor" table) ---
  const options: AcOption[] = []
  const baseLabel = i18n('Base AC: 10 + Dex', 'CA de base : 10 + Dex', 'CA base: 10 + Des')
  if (!b.armor) {
    options.push({
      id: 'base',
      label: baseLabel,
      available: true,
      stat: resolve([
        { sourceId: 'base', label: i18n('Base', 'Base', 'Base'), value: 10, source: SRC.armorClass },
        {
          sourceId: 'dex',
          label: i18n('Dexterity modifier', 'Modificateur de Dextérité', 'Modificador de Destreza'),
          value: dex,
          source: SRC.armorClass,
        },
      ]),
    })
  } else {
    const a = b.armor.def
    const parts: Part[] = [{ sourceId: b.armor.item.uid, label: a.name, value: a.baseAc ?? 10, source: a.source }]
    if (a.dex === 'full')
      parts.push({
        sourceId: 'dex',
        label: i18n('Dexterity modifier', 'Modificateur de Dextérité', 'Modificador de Destreza'),
        value: dex,
        source: SRC.armorTable,
      })
    else if (a.dex === 'max2')
      parts.push({
        sourceId: 'dex',
        label: i18n(
          'Dexterity modifier (max 2)',
          'Modificateur de Dextérité (max 2)',
          'Modificador de Destreza (máx. 2)',
        ),
        value: Math.min(2, dex),
        source: SRC.armorTable,
      })
    // Custom armor: the base armor + its bonus (as "Armor, +1, +2, or +3", SRD p. 210 / FR p. 224).
    const bonus = b.armor.item.custom?.magicBonus
    if (bonus)
      parts.push({
        sourceId: `${b.armor.item.uid}:bonus`,
        label: i18n(`Magic bonus +${bonus}`, `Bonus magique +${bonus}`, `Bonificador mágico +${bonus}`),
        value: bonus,
        source: b.rules.magicItems.get('armor-1-2-or-3')?.source ?? SRC.armorTable,
      })
    options.push({
      id: 'armor',
      label: { en: `${a.name.en}`, fr: `${a.name.fr}`, es: `${esOf(a.name)}` },
      available: true,
      stat: resolve(parts),
    })
  }
  for (const f of pool.acFormulas) {
    const ok = (!f.noArmor || !b.armor) && (!f.noShield || !b.shield)
    const parts: Part[] = [
      { sourceId: 'base', label: i18n('Base', 'Base', 'Base'), value: f.base, source: f.owner.source },
    ]
    for (const ab of f.abilities)
      parts.push({
        sourceId: ab,
        label: {
          en: `${ABILITY_SHORT[ab].en} modifier`,
          fr: `Modificateur de ${ABILITY_SHORT[ab].fr}`,
          es: `Modificador de ${esOf(ABILITY_SHORT[ab])}`,
        },
        value: abilities[ab].mod,
        source: f.owner.source,
      })
    const reason: I18n | undefined = ok
      ? undefined
      : f.noShield && b.shield
        ? i18n('not while wielding a Shield', 'pas avec un bouclier', 'no si empuñas un escudo')
        : i18n('not while wearing armor', 'pas en armure', 'no si llevas armadura')
    options.push({ id: f.owner.id, label: f.owner.name, available: ok, stat: resolve(parts), reason })
  }
  const available = options.filter((o) => o.available)
  const chosen =
    available.find((o) => o.id === char.acChoice) ??
    available.reduce((best, o) => (o.stat.total > best.stat.total ? o : best), available[0])
  const acParts: Part[] = [
    {
      sourceId: `ac:${chosen.id}`,
      label: chosen.label,
      value: chosen.stat.total,
      source: chosen.stat.parts[0]?.source,
    },
  ]
  if (b.shield && !armorTrained(b, 'shield'))
    acParts.push({
      sourceId: b.shield.item.uid,
      label: {
        en: `${b.shield.def.name.en} (no Shield training: no AC benefit)`,
        fr: `${b.shield.def.name.fr} (pas de formation aux boucliers : aucun bonus de CA)`,
        es: `${esOf(b.shield.def.name)} (sin entrenamiento con escudos: ningún beneficio a la CA)`,
      },
      value: 0,
      source: SRC.armorTable,
    })
  else if (b.shield)
    acParts.push({
      sourceId: b.shield.item.uid,
      label: b.shield.item.custom?.name ?? b.shield.def.name,
      value: (b.shield.def.bonus ?? 2) + (b.shield.item.custom?.magicBonus ?? 0),
      source: b.shield.def.source,
    })
  acParts.push(...pool.parts('ac'))
  const ac = resolve(acParts)
  // --- Initiative: Dexterity modifier (SRD p. 13); Alert adds the Proficiency Bonus; Exhaustion reduces D20 Tests ---
  const initParts: Part[] = [
    {
      sourceId: 'dex',
      label: i18n('Dexterity modifier', 'Modificateur de Dextérité', 'Modificador de Destreza'),
      value: dex,
      source: SRC.initiative,
    },
    ...pool.parts('initiative'),
    ...pool.parts('d20'),
  ]
  if (exhaustionLevel)
    initParts.push({
      sourceId: 'exhaustion',
      label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
      value: -2 * exhaustionLevel,
      source: SRC.exhaustion,
    })
  const initiative = resolve(initParts, {
    advantage: pool.advantage('initiative'),
    disadvantage: pool.disadvantage('initiative'),
  })
  // --- Speed: species Speed, class features, heavy armor Strength requirement, Exhaustion; 0 while Grappled/Restrained ---
  const speedParts: Part[] = [
    {
      sourceId: 'species',
      label: b.species?.name ?? i18n('Species', 'Espèce', 'Especie'),
      value: b.species?.speed.ft ?? 30,
      source: b.species?.source ?? SRC.speed,
    },
  ]
  speedParts.push(...pool.parts('speed'))
  // Mithral Armor has no Strength requirement (SRD p. 231); Boots of Striding and Springing: Speed not reduced by Heavy
  // Armor (p. 214): flag 'no-armor-speed-penalty'.
  if (
    b.armor?.def.strength &&
    abilities.str.score.total < b.armor.def.strength &&
    !pool.flags.has('no-armor-speed-penalty')
  )
    speedParts.push({
      sourceId: 'armor-str',
      label: {
        en: `${b.armor.def.name.en}: Strength ${b.armor.def.strength} required`,
        fr: `${b.armor.def.name.fr} : Force ${b.armor.def.strength} requise`,
        es: `${esOf(b.armor.def.name)}: requiere Fuerza ${b.armor.def.strength}`,
      },
      value: -10,
      source: SRC.heavyArmorStrength,
    })
  if (exhaustionLevel)
    speedParts.push({
      sourceId: 'exhaustion',
      label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
      value: -5 * exhaustionLevel,
      source: SRC.exhaustion,
    })
  const speed = resolve(speedParts)
  speed.total = Math.max(0, speed.total)
  // "Your Speed becomes 30 feet unless your Speed is higher" (Boots of Striding and Springing, SRD p. 214): 'speed.min'.
  const minParts = pool.parts('speed.min').filter((p) => !p.condition || p.situationalOn)
  const minSpeed = Math.max(0, ...minParts.map((p) => p.value))
  if (minSpeed > speed.total) {
    const p = minParts.find((x) => x.value === minSpeed)!
    speed.parts.push({
      ...p,
      label: {
        en: `${p.label.en}: ${minSpeed} ft`,
        fr: `${p.label.fr} : ${minSpeed} ft`,
        es: `${esOf(p.label)}: ${minSpeed} ft`,
      },
      value: minSpeed - speed.total,
      effectName: undefined,
      active: true,
    })
    speed.total = minSpeed
  }
  // "The boots double your Speed" (Boots of Speed, p. 214): 'speed.double', a switch of the Combat pane.
  const double = pool.parts('speed.double').find((p) => !p.condition || p.situationalOn)
  if (double) {
    speed.parts.push({
      ...double,
      label: { en: `${double.label.en} (× 2)`, fr: `${double.label.fr} (× 2)`, es: `${esOf(double.label)} (× 2)` },
      value: speed.total,
      effectName: undefined,
      condition: undefined,
      active: true,
    })
    speed.total *= 2
  }
  if (pool.flags.has('speed-0')) {
    // Grappled / Restrained: "Your Speed is 0 and can't increase" (Rules Glossary p. 182, p. 187).
    const who =
      pool.grants.find((g) => g.grant.kind === 'flag' && g.grant.on === 'speed-0')?.owner ??
      b.owners.find((o) => o.eff.flags?.includes('speed-0'))
    speed.parts.push({
      sourceId: who?.id ?? 'speed-0',
      label: who?.name ?? i18n('Speed 0', 'Vitesse 0', 'Velocidad 0'),
      value: -speed.total,
      active: true,
      source: who?.source,
    })
    speed.total = 0
  }
  // Other speeds: 'speed.climb' / 'speed.swim' / 'speed.fly' parts; the value 'speed' means "equal to your Speed".
  const otherSpeeds: DefenseResult['otherSpeeds'] = []
  for (const kind of ['climb', 'swim', 'fly'] as const) {
    // A switched part counts only when its switch is on (Cloak of the Bat in Dim Light, Wings of Flying spread).
    const entries = b.owners.flatMap((o) =>
      o.modifiers
        .filter((m) => m.target === `speed.${kind}`)
        .filter((m) => !m.when?.startsWith('toggle:') || !!char.toggles?.[m.when.slice('toggle:'.length)])
        .map((m) => ({ o, m })),
    )
    if (!entries.length) continue
    let total = 0
    const labels: I18n[] = []
    for (const { o, m } of entries) {
      const v = m.value === 'speed' ? speed.total : resolveValue(m.value, b, o)
      if (v === undefined) continue
      total = Math.max(total, v)
      labels.push(o.name)
    }
    if (total) otherSpeeds.push({ kind, ft: total, from: labels })
  }
  // --- Carrying capacity: Str × 15 lb for Small/Medium (Powerful Build: one size larger), drag/lift/push × 2 (SRD p. 178) ---
  const str = abilities.str.score.total
  const sizeFactor = pool.flags.has('powerful-build')
    ? 30
    : b.species?.size.length === 1 && b.species.size[0] === 'tiny'
      ? 7.5
      : 15
  const capacity = lbToWeight(str * sizeFactor)
  const dragLiftPush = lbToWeight(str * sizeFactor * 2)
  let loadLb = 0
  for (const item of char.inventory ?? []) {
    if (item.location === 'stored') continue
    const w = itemWeightLb(b, item)
    loadLb += w * (item.quantity || 1)
  }
  const carry = {
    capacity,
    dragLiftPush,
    load: lbToWeight(Math.round(loadLb * 100) / 100),
    encumbered: loadLb > capacity.lb,
  }
  return { ac, acOptions: options, initiative, speed, otherSpeeds, carry, armorKnown: !!b.armor }
}

/** Armor training with a category: the first class's list, a later class's multiclass list, feats and features' grants
 * (SRD p. 25 "Multiclassing > Proficiencies", p. 92 "Armor Training"). */
export function armorTrained(b: BuildResult, category: string): boolean {
  const lists: string[] = []
  b.classOrder.forEach((cid, i) => {
    const def = b.classes.get(cid)
    if (def) lists.push(...(i === 0 ? def.armorTraining : def.multiclass.armor))
  })
  for (const g of b.owners.flatMap((o) => o.grants))
    if (g.kind === 'proficiency' && g.on?.startsWith('armor.')) lists.push(g.on.slice(6))
  return lists.includes(category)
}

export function itemWeightLb(
  b: BuildResult,
  item: { kind: string; refId?: string; custom?: { weightLb?: number } },
): number {
  const r = b.rules
  // A custom weight (custom item, or an override of the base item's) wins.
  if (item.custom?.weightLb !== undefined) return item.custom.weightLb
  if (item.kind === 'weapon') return r.weapons.get(item.refId ?? '')?.weight.lb ?? 0
  if (item.kind === 'armor') return r.armor.get(item.refId ?? '')?.weight.lb ?? 0
  if (item.kind === 'gear') {
    const g = r.gear.get(item.refId ?? '')
    return (g?.weight?.lb ?? 0) / ammoBundle(g)
  }
  if (item.kind === 'magic') return r.magicItems.get(item.refId ?? '')?.weight?.lb ?? 0
  return item.custom?.weightLb ?? 0
}

export { tableNumber }
