// The starting-equipment table (model/startingEquipment.ts) matches the SRD text of every class and background option,
// item by item and GP by GP, and every item resolves to a catalog entry (or is a documented custom item).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { BACKGROUND_KITS, CLASS_KITS, kitInventory, type KitOption } from '../startingEquipment'

/** The options of an SRD "Choose A or B: (A) …, and 15 GP; or (B) 75 GP" text: items as printed and GP. */
function parseOptions(text: string): { letter: string; items: string[]; gp: number }[] {
  const out: { letter: string; items: string[]; gp: number }[] = []
  // Non-breaking spaces of the PDF extraction ("4 GP") count as spaces.
  for (const m of text.replace(/ /g, ' ').matchAll(/\(([A-C])\)\s*([^;]+)/g)) {
    const parts = m[2]
      .split(/,\s*/)
      .map((s) => s.replace(/^(and|or)\s+/, '').trim())
      .filter(Boolean)
    const gpPart = parts.pop()!
    const gp = parseInt(gpPart.match(/^(\d+) GP$/)![1], 10)
    out.push({ letter: m[1], items: parts, gp })
  }
  return out
}

function checkKits(kits: KitOption[] | undefined, text: string) {
  expect(kits).toBeDefined()
  const parsed = parseOptions(text)
  expect(kits!.map((k) => k.letter)).toEqual(parsed.map((p) => p.letter))
  kits!.forEach((k, i) => {
    expect(k.gp).toBe(parsed[i].gp)
    expect(k.items.map((x) => x.text)).toEqual(parsed[i].items)
  })
}

describe('starting equipment table', () => {
  it('parses an SRD option text', () => {
    expect(parseOptions('Choose A or B: (A) Greataxe, 4 Handaxes, Explorer’s Pack, and 15 GP; or (B) 75 GP')).toEqual([
      { letter: 'A', items: ['Greataxe', '4 Handaxes', 'Explorer’s Pack'], gp: 15 },
      { letter: 'B', items: [], gp: 75 },
    ])
  })
  for (const cls of rules.classes.values())
    it(`${cls.id}: options as printed`, () => checkKits(CLASS_KITS[cls.id], cls.startingEquipment.en))
  for (const bg of rules.backgrounds.values())
    it(`${bg.id}: options as printed`, () => checkKits(BACKGROUND_KITS[bg.id], bg.equipment.en))

  it('every item resolves to the catalog, with the printed quantity', () => {
    const all = [...Object.values(CLASS_KITS), ...Object.values(BACKGROUND_KITS)].flat().flatMap((o) => o.items)
    for (const k of all) {
      const has = (id: string | undefined) =>
        k.kind === 'weapon'
          ? rules.weapons.has(id ?? '')
          : k.kind === 'armor'
            ? rules.armor.has(id ?? '')
            : k.kind === 'gear'
              ? rules.gear.has(id ?? '')
              : false
      if (k.kind === 'custom') {
        // Documented custom items only: the Wizard's Spellbook (no catalog entry, Wizard "Spellcasting" p. 78).
        expect(k.text).toBe('Spellbook')
        expect(k.name?.es).toBeTruthy()
        continue
      }
      expect(has(k.id), `${k.text} → ${k.id}`).toBe(true)
      for (const id of k.choose ?? []) expect(rules.gear.has(id), `${k.text} → ${id}`).toBe(true)
      const n = k.text.match(/^(\d+) /)?.[1] ?? k.text.match(/\((\d+) sheets\)/)?.[1] ?? '1'
      expect(k.qty ?? 1, k.text).toBe(parseInt(n, 10))
      if (k.name) expect(k.name.fr && k.name.es, k.text).toBeTruthy()
    }
  })

  it('Rogue A + Criminal A: daggers merged, shortsword in hand, arrows worn, tools in the backpack', () => {
    const { items, gp } = kitInventory({
      classId: 'rogue',
      classOption: 'A',
      backgroundId: 'criminal',
      backgroundOption: 'A',
    })
    expect(gp).toBe(8 + 16)
    const dagger = items.filter((i) => i.refId === 'dagger')
    expect(dagger).toHaveLength(1)
    expect(dagger[0].quantity).toBe(4)
    expect(items.find((i) => i.refId === 'shortsword')?.equipped).toBe(true)
    expect(items.filter((i) => i.equipped).map((i) => i.refId)).toEqual(['shortsword'])
    expect(items.find((i) => i.refId === 'arrows')).toMatchObject({ quantity: 20, location: 'worn' })
    expect(items.find((i) => i.refId === 'thieves-tools')).toMatchObject({ quantity: 2, location: 'carried' })
  })
  it('Fighter C + Soldier A: GP only from the class, the background spear in hand', () => {
    const { items, gp } = kitInventory({
      classId: 'fighter',
      classOption: 'C',
      backgroundId: 'soldier',
      backgroundOption: 'A',
    })
    expect(gp).toBe(155 + 14)
    expect(items.filter((i) => i.equipped).map((i) => i.refId)).toEqual(['spear'])
  })
  it('Monk A: the chosen Artisan’s Tools', () => {
    const text = CLASS_KITS.monk[0].items.find((k) => k.choose)!.text
    const { items } = kitInventory({
      classId: 'monk',
      classOption: 'A',
      backgroundId: 'sage',
      backgroundOption: 'B',
      picks: { [text]: 'smiths-tools' },
    })
    expect(items.some((i) => i.refId === 'smiths-tools')).toBe(true)
    expect(items.some((i) => i.refId === 'musical-instrument')).toBe(false)
  })
})
