// Training and proficiencies (SRD 5.2.1 2024 character sheet, "Equipment Training & Proficiencies"): armor, weapons,
// tools and languages, from `sheet.proficiencies`, named in the three languages. Shared by the General pane
// (ui/TrainingBox.svelte) and the PDF (ui/PrintSheet.svelte).
import type { Rules } from '../data/rules'
import type { GearDef, I18n } from '../data/types'
import type { Sheet } from '../engine/sheet/types'
import { ARMOR_CATEGORY, UI, WEAPON_CATEGORY } from '../i18n/ui'
import { languageName } from '../model/languages'
import { toolOption } from '../model/toolChoices'

const WEAPON_EXTRA: Record<string, I18n> = {
  'martial:light': {
    en: 'Martial weapons with the Light property',
    fr: 'Armes de guerre dotées de la propriété Légère',
    es: 'Armas marciales con la propiedad Ligera',
  },
}

export interface TrainingItem {
  name: I18n
  /** The tool's catalog entry (its ability, Utilize and Craft), when the proficiency is one tool. */
  tool?: GearDef
}
export interface TrainingRow {
  id: 'armor' | 'weapons' | 'tools' | 'languages'
  label: I18n
  items: TrainingItem[]
}

const same = (s: string): I18n => ({ en: s, fr: s, es: s })
/** "Choose 3 Musical Instruments (see “Equipment”)" without the cross-reference. */
const noSee = (t: I18n): I18n =>
  Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, String(v).replace(/\s*\((see|cf\.|consulta)[^)]*\)/, '')]),
  ) as unknown as I18n

export function trainingRows(sheet: Sheet, rules: Rules): TrainingRow[] {
  // Tool proficiencies are stored by their English text or id: find the trilingual name and the catalog entry again.
  const tools = new Map<string, TrainingItem>()
  for (const cl of rules.classes.values()) {
    if (cl.toolProficiencies) tools.set(cl.toolProficiencies.en, { name: noSee(cl.toolProficiencies) })
    for (const t of cl.multiclass?.tools ?? []) tools.set(t.en, { name: t })
  }
  for (const b of rules.backgrounds.values()) if (b.tool?.en) tools.set(b.tool.en, { name: noSee(b.tool) })
  for (const g of rules.gear.values())
    if (g.kind === 'tool') {
      tools.set(g.id, { name: g.name, tool: g })
      tools.set(g.name.en, { name: g.name, tool: g })
    }
  const uniq = (items: TrainingItem[]) => items.filter((x, i) => items.findIndex((y) => y.name.en === x.name.en) === i)
  return [
    {
      id: 'armor',
      label: { en: 'Armor', fr: 'Armures', es: 'Armaduras' },
      items: uniq(sheet.proficiencies.armor.map((a) => ({ name: ARMOR_CATEGORY[a] ?? same(a) }))),
    },
    {
      id: 'weapons',
      label: { en: 'Weapons', fr: 'Armes', es: 'Armas' },
      items: uniq(
        sheet.proficiencies.weapons.map((w) => ({
          name: WEAPON_CATEGORY[w] ?? WEAPON_EXTRA[w] ?? rules.weapons.get(w)?.name ?? same(w),
        })),
      ),
    },
    {
      id: 'tools',
      label: { en: 'Tools', fr: 'Outils', es: 'Herramientas' },
      items: uniq(
        sheet.proficiencies.tools.map((t) => {
          const v = tools.get(t) ? undefined : toolOption(t, rules)
          return tools.get(t) ?? (v ? { name: v.name, tool: rules.gear.get(v.toolId) } : { name: same(t) })
        }),
      ),
    },
    {
      id: 'languages',
      label: UI.languages,
      items: uniq(sheet.proficiencies.languages.map((l) => ({ name: languageName(l) }))),
    },
  ]
}
