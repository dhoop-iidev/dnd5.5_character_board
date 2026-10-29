// A level-1 character made by the welcome screen's creation, for every class with a few origins and both equipment
// options: inventory and coins as chosen, background increases applied, full Hit Points, and the rule checks list only
// choices still to make (skills, Weapon Mastery, spells, feat and trait options), never an error or a false warning.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { AbilityId } from '../../data/types'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { newCharacter } from '../newCharacter'
import { BACKGROUND_KITS, CLASS_KITS } from '../startingEquipment'

const ORIGINS = [
  { speciesId: 'human', size: 'medium', backgroundId: 'soldier', kit: 'A', bgKit: 'A' },
  { speciesId: 'elf', lineage: { 'elf:elven-lineage': 'high-elf' }, backgroundId: 'acolyte', kit: 'B', bgKit: 'B' },
  { speciesId: 'dwarf', backgroundId: 'sage', kit: 'A', bgKit: 'B' },
  { speciesId: 'tiefling', size: 'small', backgroundId: 'criminal', kit: 'B', bgKit: 'A' },
  { speciesId: 'halfling', backgroundId: 'criminal', kit: 'A', bgKit: 'A' },
]

/** The warnings a fresh character may show: choices still to make. */
const TO_CHOOSE =
  /^(skills-count|mastery-missing|expertise-missing|cantrips-missing-|prepared-missing-|spellbook-missing-|choice-)/

/** +2 to the background ability with the best base score, +1 to the next (ties: the background's order). */
function increases(base: Record<AbilityId, number>, abilities: AbilityId[]) {
  const [first, second] = [...abilities].sort((x, y) => base[y] - base[x])
  return { [first]: 2, [second]: 1 } as Partial<Record<AbilityId, number>>
}

describe('level-1 creation', () => {
  for (const cls of rules.classes.values())
    for (const o of ORIGINS) {
      const kitLetter = o.kit === 'B' ? CLASS_KITS[cls.id].at(-1)!.letter : 'A'
      it(`${cls.id} · ${o.speciesId} · ${o.backgroundId} · kit ${kitLetter}/${o.bgKit}`, () => {
        const base = { ...rules.tables.standardArrayByClass[cls.id] } as Record<AbilityId, number>
        const bg = rules.backgrounds.get(o.backgroundId)!
        const inc = increases(base, bg.abilities)
        const c = newCharacter(
          {
            name: 'Test',
            player: 'P',
            speciesId: o.speciesId,
            backgroundId: o.backgroundId,
            classId: cls.id,
            abilities: base,
            backgroundAbilities: inc,
            speciesChoices: o.size ? { size: o.size } : {},
            featureChoices: o.lineage ?? {},
            classKit: kitLetter,
            backgroundKit: o.bgKit,
            lang: 'en',
          },
          rules,
        )
        // Coins and inventory: the chosen options' GP and items.
        const ck = CLASS_KITS[cls.id].find((k) => k.letter === kitLetter)!
        const bk = BACKGROUND_KITS[o.backgroundId].find((k) => k.letter === o.bgKit)!
        expect(c.money.gp).toBe(ck.gp + bk.gp)
        const expected = [...ck.items, ...bk.items].reduce((s, k) => s + (k.qty ?? 1), 0)
        expect(c.inventory.reduce((s, i) => s + i.quantity, 0)).toBe(expected)
        if (!ck.items.length && !bk.items.length) expect(c.inventory).toEqual([])
        // At most one weapon in hand, plus the Shield.
        expect(c.inventory.filter((i) => i.kind === 'weapon' && i.equipped).length).toBe(
          ck.items.length || bk.items.some((k) => k.kind === 'weapon') ? 1 : 0,
        )
        // Abilities: base + background increases; full Hit Points.
        const s = compute(c, rules)
        for (const a of Object.keys(base) as AbilityId[])
          expect(s.abilities[a].score.total, a).toBe(base[a] + (inc[a] ?? 0))
        expect(s.level).toBe(1)
        expect(c.hp.current).toBe(s.hpMax.total)
        expect(s.hpMax.total).toBe(cls.hitDie + s.abilities.con.mod + (o.speciesId === 'dwarf' ? 1 : 0))
        // Only choices still to make.
        const ws = validate(c, rules)
        const bad = ws.filter((x) => x.severity !== 'warning' || !x.actionable || !TO_CHOOSE.test(x.id))
        expect(bad.map((x) => `${x.severity} ${x.id}: ${x.message.en}`)).toEqual([])
        // And they are listed: skills, spells, Weapon Mastery, Expertise, the Wizard's spellbook.
        const ids = ws.map((x) => x.id)
        expect(ids).toContain('skills-count')
        for (const sc of s.spellcasting) {
          if (sc.cantripsMax) expect(ids).toContain(`cantrips-missing-${sc.classId}`)
          if (sc.preparedMax) expect(ids).toContain(`prepared-missing-${sc.classId}`)
        }
        if (cls.id === 'wizard') expect(ids).toContain('spellbook-missing-1')
        if (s.masteryMax) expect(ids).toContain('mastery-missing')
        if (s.expertiseMax) expect(ids).toContain('expertise-missing')
      })
    }

  it('Acolyte fixes Magic Initiate on the Cleric list; Sage on the Wizard list', () => {
    const make = (backgroundId: string) =>
      newCharacter(
        {
          name: 'X',
          speciesId: 'human',
          backgroundId,
          classId: 'fighter',
          abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
          lang: 'fr',
        },
        rules,
      )
    expect(make('acolyte').background.feat).toEqual({ featId: 'magic-initiate', choices: { list: 'cleric' } })
    expect(make('sage').background.feat.choices?.list).toBe('wizard')
    expect(make('soldier').background.feat).toEqual({ featId: 'savage-attacker' })
  })
})
