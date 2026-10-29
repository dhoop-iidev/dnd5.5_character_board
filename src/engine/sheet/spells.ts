// Stage 7: spellcasting. Spell save DC = 8 + Proficiency Bonus + ability modifier, spell attack = PB + modifier (SRD p. 23
// and each class's Spellcasting feature); slots from the class table, or from the Multiclass Spellcaster table when the
// character has the Spellcasting feature from several classes (full levels + half the Paladin/Ranger levels rounded up,
// SRD p. 25); Pact Magic slots stay separate (p. 26). Each class prepares as if single-classed (p. 25): its own table row
// gives its highest spell level; subclass spell lists and features' always-prepared spells don't count (each subclass
// "… Spells" feature, Favored Enemy p. 58, Faithful Steed p. 54…).
import type { AbilityId } from '../../data/types'
import { type Part, esOf, resolve, i18n } from '../stacking'
import { spellbookContents } from '../spellbook'
import { ABILITY_SHORT, SRC } from './common'
import type {
  BuildResult,
  ComputeOptions,
  CoreResult,
  ExtraSpells,
  ModifiersResult,
  SpellcastingBlock,
  SpellsResult,
} from './types'

type In = BuildResult & ModifiersResult & CoreResult

/** Spells granted from a level on ('spells.byLevel': { "3": [...], "5": [...] }, by class level for a class feature, by
 * character level for a species trait or feat). */
function byLevelSpells(
  o: { classId?: string; eff: { spells?: { byLevel?: Record<string, string[]> } } },
  b?: In,
): string[] {
  const by = o.eff.spells?.byLevel
  if (!by || !b) return []
  const lvl = o.classId ? (b.classLevels[o.classId] ?? 0) : b.level
  const out: string[] = []
  for (const [k, ids] of Object.entries(by)) if (lvl >= parseInt(k, 10)) out.push(...ids)
  return out
}

export function spellsStage(b: In, _opts: ComputeOptions): SpellsResult {
  const { pool, abilities, pb, char } = b
  const blocks: SpellcastingBlock[] = []
  let fullLevels = 0
  let halfLevels = 0
  let singleSlots: number[] | undefined
  let casters = 0
  let pact: SpellsResult['pact']
  for (const cid of b.classOrder) {
    const def = b.classes.get(cid)
    const sc = def?.spellcasting
    if (!def || !sc) continue
    const cl = b.classLevels[cid]
    const row = def.table[cl - 1]
    const mod = abilities[sc.ability].mod
    const state = char.spellcasting?.[cid]
    const dcParts: Part[] = [
      { sourceId: 'base', label: i18n('Base', 'Base', 'Base'), value: 8, source: sc.source },
      {
        sourceId: 'pb',
        label: i18n('Proficiency Bonus', 'Bonus de maîtrise', 'Bonificador por competencia'),
        value: pb,
        effectName: 'Proficiency Bonus',
        source: sc.source,
      },
      {
        sourceId: 'ability',
        label: {
          en: `${ABILITY_SHORT[sc.ability].en} modifier`,
          fr: `Modificateur de ${ABILITY_SHORT[sc.ability].fr}`,
          es: `Modificador de ${esOf(ABILITY_SHORT[sc.ability])}`,
        },
        value: mod,
        source: sc.source,
      },
      ...pool.parts('spell.dc'),
      ...pool.parts(`spell.dc.${cid}`),
    ]
    const atkParts: Part[] = [
      {
        sourceId: 'pb',
        label: i18n('Proficiency Bonus', 'Bonus de maîtrise', 'Bonificador por competencia'),
        value: pb,
        effectName: 'Proficiency Bonus',
        source: sc.source,
      },
      {
        sourceId: 'ability',
        label: {
          en: `${ABILITY_SHORT[sc.ability].en} modifier`,
          fr: `Modificateur de ${ABILITY_SHORT[sc.ability].fr}`,
          es: `Modificador de ${esOf(ABILITY_SHORT[sc.ability])}`,
        },
        value: mod,
        source: sc.source,
      },
      ...pool.parts('attack.spell'),
      ...pool.parts('d20'),
    ]
    const sum = (target: string) => pool.parts(target).reduce((s, p) => s + p.value, 0)
    const cantripsMax =
      (typeof row?.resources.cantrips === 'number' ? row.resources.cantrips : 0) + sum(`cantrips.${cid}`)
    // Blessed Warrior (Paladin) / Druidic Warrior (Ranger): two cantrips in place of a Fighting Style feat (p. 54, p. 58).
    const warriorStyle = b.levels.some(
      (l) =>
        (l.choices ?? {})[`${cid}:fighting-style`] === 'blessed-warrior' ||
        (l.choices ?? {})[`${cid}:fighting-style`] === 'druidic-warrior',
    )
    const preparedMax =
      (typeof row?.resources.preparedSpells === 'number' ? row.resources.preparedSpells : 0) + sum(`prepared.${cid}`)
    // Always-prepared spells: the subclass list (by class level), a chosen list (Circle of the Land), features' `spells.always`.
    const always: string[] = []
    const sub = b.subclasses.get(cid)
    for (const lv of sub?.spells ?? []) if (lv.level <= cl) always.push(...lv.spells)
    let spellChoice: SpellcastingBlock['spellChoice']
    if (sub?.spellChoices) {
      const key = `${sub.id}:spells`
      const ids = Object.keys(sub.spellChoices.options)
      const stored = b.choices[key]
      const value = typeof stored === 'string' && ids.includes(stored) ? stored : ids[0]
      for (const lv of sub.spellChoices.options[value]?.spells ?? []) if (lv.level <= cl) always.push(...lv.spells)
      spellChoice = {
        key,
        name: sub.spellChoices.name,
        options: ids.map((id) => ({ id, name: sub.spellChoices!.options[id].name })),
        value,
      }
    }
    const extraLists: string[] = []
    for (const o of b.owners) {
      if (!o.eff.spells) continue
      if (o.classId !== cid) continue
      always.push(...(o.eff.spells.always ?? []), ...byLevelSpells(o, b))
      for (const c of o.eff.spells.fromChoices ?? []) always.push(...(o.choiceValues[c] ?? []))
      extraLists.push(...(o.eff.spells.lists ?? []))
    }
    const maxSpellLevel = sc.kind === 'pact' ? (row?.pact?.level ?? 0) : (row?.slots ?? []).filter((n) => n > 0).length
    blocks.push({
      classId: cid,
      className: def.name,
      ability: sc.ability,
      mod,
      dc: resolve(dcParts),
      attack: resolve(atkParts),
      kind: sc.kind,
      cantripsMax: cantripsMax + (warriorStyle ? 2 : 0),
      preparedMax,
      prepared: state?.prepared ?? [],
      cantrips: state?.cantrips ?? [],
      // The book = the spells added at each Wizard level + the copied ones (engine/spellbook.ts, SRD p. 78).
      spellbook: sc.spellbook ? spellbookContents(char, b.rules) : undefined,
      alwaysPrepared: [...new Set(always)],
      extraLists: [...new Set(extraLists)],
      maxSpellLevel,
      spellChoice,
      source: sc.source,
    })
    if (sc.kind === 'pact') {
      if (row?.pact) pact = { slots: row.pact.slots, level: row.pact.level, used: char.pactUsed ?? 0 }
    } else {
      casters++
      if (sc.kind === 'full') fullLevels += cl
      else halfLevels += cl
      singleSlots = row?.slots
    }
  }
  let slots: number[] = []
  let casterLevel = 0
  if (casters === 1 && singleSlots) {
    slots = [...singleSlots]
    casterLevel = fullLevels + halfLevels
  } else if (casters > 1) {
    casterLevel = fullLevels + Math.ceil(halfLevels / 2)
    slots = [...(b.rules.tables.multiclassSlots[Math.min(20, casterLevel) - 1] ?? [])]
  }
  while (slots.length && slots[slots.length - 1] === 0) slots.pop()
  const slotsUsed = slots.map((_, i) => char.slotsUsed?.[i] ?? 0)
  // Spells from feats and species traits (Magic Initiate, lineages…): not tied to a class's Spellcasting.
  const extraSpells: ExtraSpells[] = []
  for (const o of b.owners) {
    if (o.classId || !o.eff.spells) continue
    const ids = [...(o.eff.spells.always ?? []), ...byLevelSpells(o, b)]
    for (const c of o.eff.spells.fromChoices ?? []) ids.push(...(o.choiceValues[c] ?? []))
    if (ids.length)
      extraSpells.push({
        ownerId: o.id,
        name: o.name,
        spells: ids,
        ability: o.eff.spells.ability as AbilityId | undefined,
        source: o.source,
      })
  }
  return { spellcasting: blocks, slots, slotsUsed, pact, casterLevel, extraSpells }
}

export { SRC }
