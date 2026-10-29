// What an item does on the sheet, in words: the effects of its SRD magic item (custom/effects/magic-items.json, with the
// options chosen and the variant) and its custom modifiers, as a short line ("+1 AC, +1 saving throws"), and whether they
// apply right now (engine/items.ts `inactiveReason`). Used by the item popup, the Equipment table and the Combat pane.
import { rules } from '../data/rules'
import type { EffectDef, GrantSpec, I18n, ModifierSpec } from '../data/types'
import type { ItemInstance } from '../model/character'
import { inactiveReason, magicEffectOf, magicItemOf, variantOf, variantValue } from '../engine/items'
import { ABILITY_SHORT } from '../engine/sheet/common'
import { fmtFeet } from './format'

type AbilityKey = keyof typeof ABILITY_SHORT

const both = (en: string, fr: string, es?: string): I18n => (es === undefined ? { en, fr } : { en, fr, es })
const sign = (v: number | string): string =>
  typeof v === 'number' ? (v >= 0 ? `+${v}` : `−${-v}`) : /^\d/.test(v) ? `+${v}` : v
const feet = (ft: number): I18n => both(fmtFeet(ft, 'en'), fmtFeet(ft, 'fr'), fmtFeet(ft, 'es'))

const SAVES = both('saving throws', 'jets de sauvegarde', 'tiradas de salvación')

function targetName(t: string): I18n {
  if (t === 'ac') return both('AC', 'CA', 'CA')
  if (t === 'save.all') return SAVES
  if (t === 'check.all') return both('ability checks', 'tests de caractéristique', 'pruebas de característica')
  if (t === 'initiative') return both('Initiative', 'Initiative', 'Iniciativa')
  if (t === 'hp.max') return both('Hit Point maximum', 'points de vie maximum', 'puntos de golpe máximos')
  if (t === 'attack.spell') return both('spell attack rolls', 'jets d’attaque de sort', 'tiradas de ataque de conjuro')
  if (t === 'spell.dc') return both('spell save DC', 'DD de sauvegarde des sorts', 'CD de salvación de conjuros')
  if (t === 'attack.ranged')
    return both('ranged attack rolls', 'jets d’attaque à distance', 'tiradas de ataque a distancia')
  if (t === 'damage.ranged') return both('ranged damage', 'dégâts à distance', 'daño a distancia')
  if (t === 'attack.melee')
    return both('melee attack rolls', 'jets d’attaque au corps à corps', 'tiradas de ataque cuerpo a cuerpo')
  if (t === 'damage.melee') return both('melee damage', 'dégâts au corps à corps', 'daño cuerpo a cuerpo')
  if (t === 'attack.all') return both('attack rolls', 'jets d’attaque', 'tiradas de ataque')
  if (t === 'damage.all') return both('damage', 'dégâts', 'daño')
  if (t === 'item.attack') return both('attack rolls with it', 'jets d’attaque avec', 'tiradas de ataque con él')
  if (t === 'item.damage') return both('damage with it', 'dégâts avec', 'daño con él')
  if (t === 'attack.unarmed')
    return both('Unarmed Strike attack rolls', 'attaques à mains nues', 'tiradas de ataque sin armas')
  if (t === 'damage.unarmed') return both('Unarmed Strike damage', 'dégâts à mains nues', 'daño de ataque sin armas')
  if (t === 'attunement.max')
    return both('items attuned (maximum)', 'objets harmonisés (maximum)', 'objetos sintonizados (máximo)')
  let m = t.match(/^save\.(str|dex|con|int|wis|cha)$/)
  if (m) {
    const a = ABILITY_SHORT[m[1] as AbilityKey]
    return both(`${a.en} saving throws`, `jets de sauvegarde de ${a.fr}`, `tiradas de salvación de ${a.es ?? a.en}`)
  }
  m = t.match(/^ability\.(str|dex|con|int|wis|cha)$/)
  if (m) return ABILITY_SHORT[m[1] as AbilityKey]
  m = t.match(/^skill\.(.+)$/)
  if (m) return rules.skills.get(m[1])?.name ?? both(m[1], m[1])
  m = t.match(/^(attack|damage)\.weapon\.(.+)$/)
  if (m) {
    const w = rules.weapons.get(m[2])?.name ?? both(m[2], m[2])
    return m[1] === 'attack'
      ? both(`attack rolls with a ${w.en}`, `jets d’attaque avec ${w.fr}`, `tiradas de ataque con ${w.es ?? w.en}`)
      : both(`damage with a ${w.en}`, `dégâts avec ${w.fr}`, `daño con ${w.es ?? w.en}`)
  }
  return both(t, t)
}

const SPEED_KIND: Record<string, I18n> = {
  climb: both('Climb Speed', 'Vitesse d’escalade', 'Velocidad trepando'),
  swim: both('Swim Speed', 'Vitesse de nage', 'Velocidad nadando'),
  fly: both('Fly Speed', 'Vitesse de vol', 'Velocidad volando'),
}

const WHEN: Record<string, I18n> = {
  'no-armor': both('no armor', 'sans armure', 'sin armadura'),
  'no-armor-no-shield': both('no armor, no Shield', 'sans armure ni bouclier', 'sin armadura ni escudo'),
  'no-heavy-armor': both('no Heavy armor', 'sans armure lourde', 'sin armadura pesada'),
  armor: both('in armor', 'en armure', 'con armadura'),
  shield: both('with a Shield', 'avec un bouclier', 'con escudo'),
}

function withCondition(t: I18n, m: { when?: string; condition?: I18n }): I18n {
  const c = m.condition ?? (m.when ? WHEN[m.when] : undefined)
  return c ? both(`${t.en} (${c.en})`, `${t.fr} (${c.fr})`, `${t.es ?? t.en} (${c.es ?? c.en})`) : t
}

/** One modifier in words ("+1 AC", "Str 21", "Swim Speed 60 ft", "+2d6 damage"). */
export function modifierText(m: ModifierSpec, variant = 0): I18n {
  const v = variantValue(m, variant)
  const t = m.target
  let out: I18n
  const set = t.match(/^ability\.(str|dex|con|int|wis|cha)\.set$/)
  const speed = t.match(/^speed\.(climb|swim|fly)$/)
  if (set) {
    const a = ABILITY_SHORT[set[1] as AbilityKey]
    out = both(`${a.en} ${v}`, `${a.fr} ${v}`, `${a.es ?? a.en} ${v}`)
  } else if (speed) {
    const k = SPEED_KIND[speed[1]]
    out =
      v === 'speed'
        ? both(`${k.en} = Speed`, `${k.fr} = Vitesse`, `${k.es ?? k.en} = Velocidad`)
        : typeof v === 'number'
          ? both(`${k.en} ${feet(v).en}`, `${k.fr} ${feet(v).fr}`, `${k.es ?? k.en} ${feet(v).es ?? feet(v).en}`)
          : both(`${k.en} ${v}`, `${k.fr} ${v}`, `${k.es ?? k.en} ${v}`)
  } else if (t === 'speed')
    out =
      typeof v === 'number'
        ? both(`${sign(v)} ft Speed`, `Vitesse ${feet(v).fr}`, `Velocidad ${feet(v).es ?? feet(v).en}`)
        : both(t, t)
  else if (t === 'speed.min' && typeof v === 'number')
    out = both(
      `Speed at least ${feet(v).en}`,
      `Vitesse d’au moins ${feet(v).fr}`,
      `Velocidad de al menos ${feet(v).es ?? feet(v).en}`,
    )
  else if (t === 'speed.double') out = both('Speed × 2', 'Vitesse × 2', 'Velocidad × 2')
  else if (t === 'extraDamage.item' || t.startsWith('extraDamage.'))
    out = both(`${sign(v)} damage`, `${sign(v)} dégâts`, `${sign(v)} daño`)
  else if (t === 'hp.max' && v === 'level')
    out = both('+1 Hit Point per level', '+1 point de vie par niveau', '+1 punto de golpe por nivel')
  else {
    const n = targetName(t)
    out = both(`${sign(v)} ${n.en}`, `${sign(v)} ${n.fr}`, `${sign(v)} ${n.es ?? n.en}`)
  }
  return withCondition(out, m)
}

function onName(on: string): I18n {
  if (on === 'initiative') return both('Initiative', 'l’Initiative', 'la Iniciativa')
  if (on === 'attacks-against')
    return both('attack rolls against you', 'jets d’attaque contre vous', 'tiradas de ataque contra ti')
  if (on === 'save.all' || on === 'save.spells' || on === 'save.magic') return SAVES
  const cond = on.match(/^save\.(.+)$/)
  if (cond) {
    const c = rules.conditions.get(cond[1])?.name
    if (c)
      return both(`saves against ${c.en}`, `JS contre l’état ${c.fr}`, `salvaciones contra el estado ${c.es ?? c.en}`)
  }
  return targetName(on)
}

/** One grant in words ("Advantage on Stealth", "Resistance to Fire", "Darkvision 60 ft"). */
export function grantText(g: GrantSpec): I18n {
  const on = g.on ?? ''
  let out: I18n
  switch (g.kind) {
    case 'advantage':
    case 'disadvantage': {
      const n = onName(on)
      out =
        g.kind === 'advantage'
          ? both(`Advantage on ${n.en}`, `Avantage : ${n.fr}`, `Ventaja en ${n.es ?? n.en}`)
          : both(`Disadvantage on ${n.en}`, `Désavantage : ${n.fr}`, `Desventaja en ${n.es ?? n.en}`)
      break
    }
    case 'resistance':
    case 'immunity': {
      const n =
        rules.damageTypeNames[on as keyof typeof rules.damageTypeNames] ??
        rules.conditions.get(on)?.name ??
        both(on, on)
      out =
        g.kind === 'resistance'
          ? both(`Resistance to ${n.en}`, `Résistance : ${n.fr}`, `Resistencia a ${n.es ?? n.en}`)
          : both(`Immunity to ${n.en}`, `Immunité : ${n.fr}`, `Inmunidad a ${n.es ?? n.en}`)
      break
    }
    case 'darkvision': {
      const f = feet(Number(g.value) || 0)
      out = both(`Darkvision ${f.en}`, `Vision dans le noir ${f.fr}`, `Visión en la oscuridad ${f.es ?? f.en}`)
      break
    }
    case 'proficiency': {
      const [kind, id] = on.split('.')
      if (kind === 'armor') {
        const cat: Record<string, I18n> = {
          light: both('Light', 'légères', 'ligeras'),
          medium: both('Medium', 'intermédiaires', 'medias'),
          heavy: both('Heavy', 'lourdes', 'pesadas'),
          shield: both('Shield', 'boucliers', 'escudos'),
        }
        const c = cat[id] ?? both(id, id)
        out = both(
          `${c.en} armor training`,
          `Formation aux armures ${c.fr}`,
          id === 'shield' ? 'Entrenamiento con escudos' : `Entrenamiento con armaduras ${c.es ?? c.en}`,
        )
      } else {
        const w = rules.weapons.get(id)?.name ?? both(id, id)
        out = both(`Proficiency: ${w.en}`, `Maîtrise : ${w.fr}`, `Competencia: ${w.es ?? w.en}`)
      }
      break
    }
    case 'language':
      out = both(`Language: ${g.value ?? on}`, `Langue : ${g.value ?? on}`, `Idioma: ${g.value ?? on}`)
      break
    default:
      out = both(on, on)
  }
  return g.condition
    ? both(
        `${out.en} (${g.condition.en})`,
        `${out.fr} (${g.condition.fr})`,
        `${out.es ?? out.en} (${g.condition.es ?? g.condition.en})`,
      )
    : out
}

const join = (parts: I18n[], sep = ', '): I18n => ({
  en: parts.map((p) => p.en).join(sep),
  fr: parts.map((p) => p.fr).join(sep),
  es: parts.map((p) => p.es ?? p.en).join(sep),
})

/** The item's effect entry with the options chosen for this instance (`character.featureChoices['item:<uid>']`). */
export function itemEffect(
  item: ItemInstance,
  choices: Record<string, string | string[]>,
): { eff?: EffectDef; modifiers: ModifierSpec[]; grants: GrantSpec[]; chosen: I18n[] } {
  const eff = magicEffectOf(item, rules)
  const modifiers = [...(eff?.modifiers ?? [])]
  const grants = [...(eff?.grants ?? [])]
  const chosen: I18n[] = []
  for (const c of eff?.choices ?? []) {
    const key = c.id ? `item:${item.uid}#${c.id}` : `item:${item.uid}`
    const raw = choices[key]
    for (const v of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      const o = c.options?.[v]
      if (!o) continue
      chosen.push(
        c.name
          ? both(
              `${c.name.en}: ${o.name.en}`,
              `${c.name.fr} : ${o.name.fr}`,
              `${c.name.es ?? c.name.en}: ${o.name.es ?? o.name.en}`,
            )
          : o.name,
      )
      modifiers.push(...(o.modifiers ?? []))
      grants.push(...(o.grants ?? []))
    }
  }
  modifiers.push(...(item.custom?.modifiers ?? []))
  return { eff, modifiers, grants, chosen }
}

/** "+1 AC, +1 saving throws": every computed effect of the item, short (undefined when it has none). Two equal 'item.attack'
 * and 'item.damage' parts read "+1 attack and damage". */
export function effectLine(item: ItemInstance, choices: Record<string, string | string[]>): I18n | undefined {
  const { eff, modifiers, grants, chosen } = itemEffect(item, choices)
  const variant = variantOf(item, magicItemOf(item, rules))
  const parts: I18n[] = []
  let mods = modifiers
  const atk = mods.find((m) => m.target === 'item.attack' && !m.condition)
  const dmg = mods.find((m) => m.target === 'item.damage' && !m.condition)
  if (atk && dmg && variantValue(atk, variant) === variantValue(dmg, variant)) {
    const v = sign(variantValue(atk, variant))
    parts.push(both(`${v} attack and damage`, `${v} à l’attaque et aux dégâts`, `${v} al ataque y al daño`))
    mods = mods.filter((m) => m !== atk && m !== dmg)
  }
  const pairs = new Map<string, ModifierSpec>()
  for (const m of mods) {
    // "+2 Mace attack and damage vs Constructs": pair the conditional ones too.
    if ((m.target === 'item.attack' || m.target === 'item.damage') && m.condition) {
      const other = pairs.get(m.condition.en)
      if (other && variantValue(other, variant) === variantValue(m, variant)) {
        const v = sign(variantValue(m, variant))
        parts.push(
          both(
            `${v} attack and damage (${m.condition.en})`,
            `${v} à l’attaque et aux dégâts (${m.condition.fr})`,
            `${v} al ataque y al daño (${m.condition.es ?? m.condition.en})`,
          ),
        )
        pairs.delete(m.condition.en)
        continue
      }
      pairs.set(m.condition.en, m)
      continue
    }
    parts.push(modifierText(m, variant))
  }
  for (const m of pairs.values()) parts.push(modifierText(m, variant))
  if (eff?.acFormula) {
    const ab = eff.acFormula.abilities.map((a) => ABILITY_SHORT[a])
    parts.push(
      both(
        `Base AC ${eff.acFormula.base ?? 10} + ${ab.map((a) => a.en).join(' + ')}${eff.acFormula.noArmor ? ' (no armor)' : ''}`,
        `CA de base ${eff.acFormula.base ?? 10} + ${ab.map((a) => a.fr).join(' + ')}${eff.acFormula.noArmor ? ' (sans armure)' : ''}`,
        `CA base ${eff.acFormula.base ?? 10} + ${ab.map((a) => a.es ?? a.en).join(' + ')}${eff.acFormula.noArmor ? ' (sin armadura)' : ''}`,
      ),
    )
  }
  for (const g of grants) parts.push(grantText(g))
  for (const c of eff?.computed ?? [])
    parts.push(
      both(
        `${c.label.en} ${[c.dice, ...(c.parts ?? []).map(String)].filter(Boolean).join(' + ')}`,
        `${c.label.fr} ${[c.dice, ...(c.parts ?? []).map(String)].filter(Boolean).join(' + ')}`,
        `${c.label.es ?? c.label.en} ${[c.dice, ...(c.parts ?? []).map(String)].filter(Boolean).join(' + ')}`,
      ),
    )
  if (eff?.flags?.includes('no-armor-stealth-disadvantage'))
    parts.push(both('no Stealth Disadvantage', 'pas de Désavantage en Discrétion', 'sin Desventaja en Sigilo'))
  if (eff?.flags?.includes('no-armor-speed-penalty'))
    parts.push(
      both(
        'no Speed loss from Heavy Armor',
        'pas de perte de Vitesse due à l’armure lourde',
        'sin pérdida de velocidad por armadura pesada',
      ),
    )
  if (!parts.length && !chosen.length) return undefined
  return join([...chosen, ...parts])
}

/** Whether the item's effects apply now, and why not. */
export function effectStatus(item: ItemInstance): { active: boolean; reason?: I18n } {
  const reason = inactiveReason(item, rules)
  return { active: !reason, reason }
}

/** The text-only reason of an SRD item whose effect the engine doesn't compute. */
export function textOnlyOf(item: ItemInstance): I18n | undefined {
  return magicEffectOf(item, rules)?.textOnly
}
