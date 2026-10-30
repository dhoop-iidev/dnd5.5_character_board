// Companions against the SRD 5.2.1 text: Beast Shapes table (p. 42), Wild Shape uses and Temporary Hit Points (p. 42),
// Find Familiar forms (p. 130), Pact of the Chain forms (p. 74), Otherworldly Steed formulas (p. 131).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { newCharacter } from '../../model/newCharacter'
import {
  assumeForm,
  companionAc,
  companionHpMax,
  familiarIneligible,
  newCompanion,
  revertForm,
  wildShapeIneligible,
  wildShapeLimits,
} from '../companions'
import { compute } from '../compute'
import { wildShapeView } from '../wildShapeView'
import { validate } from '../validate'

const druid = (level: number) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'sage',
      classId: 'druid',
      lang: 'en',
      abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 8 },
    },
    rules,
  )
  c.background.abilities = { wis: 2, con: 1 }
  c.skillProficiencies = ['nature', 'perception']
  for (let i = 1; i < level; i++)
    c.levels.push({
      classId: 'druid',
      hpRoll: 5,
      hpFixed: true,
      ...(i === 2 ? { subclassId: 'druid:circle-of-the-land' } : {}),
    })
  return c
}

describe('Beast Shapes table (SRD p. 42)', () => {
  it('no Wild Shape before Druid level 2', () => expect(wildShapeLimits(1)).toBeUndefined())
  it('level 2: 4 forms, CR 1/4, no Fly Speed; 1 hour (half of 2), 2 Temporary HP', () =>
    expect(wildShapeLimits(2)).toEqual({ druidLevel: 2, known: 4, maxCr: 0.25, fly: false, hours: 1, tempHp: 2 }))
  it('level 5: 6 forms, CR 1/2, no Fly Speed; 2 hours (5 ÷ 2 rounded down, p. 5)', () =>
    expect(wildShapeLimits(5)).toMatchObject({ known: 6, maxCr: 0.5, fly: false, hours: 2, tempHp: 5 }))
  it('level 8: 8 forms, CR 1, Fly Speed allowed', () =>
    expect(wildShapeLimits(8)).toMatchObject({ known: 8, maxCr: 1, fly: true }))
  it('eligibility: the Owl flies (not before level 8), the Brown Bear is CR 1 (level 8), the Imp is not a Beast', () => {
    const lim2 = wildShapeLimits(2)!
    expect(wildShapeIneligible(rules.creatures.get('wolf')!, lim2)).toBeUndefined()
    expect(wildShapeIneligible(rules.creatures.get('owl')!, lim2)?.en).toContain('Fly Speed')
    expect(wildShapeIneligible(rules.creatures.get('brown-bear')!, wildShapeLimits(4)!)?.en).toContain('CR 1')
    expect(wildShapeIneligible(rules.creatures.get('brown-bear')!, wildShapeLimits(8)!)).toBeUndefined()
    expect(wildShapeIneligible(rules.creatures.get('owl')!, wildShapeLimits(8)!)).toBeUndefined()
    expect(wildShapeIneligible(rules.creatures.get('imp')!, lim2)?.en).toContain('not a Beast')
  })
})

describe('Wild Shape at the table (SRD p. 42)', () => {
  const c = druid(5)
  c.wildShape.known = ['wolf', 'spider', 'rat', 'riding-horse']
  const s = compute(c, rules)
  it('two uses at level 5 (Druid Features table), one regained per Short Rest', () => {
    const r = s.resources.find((x) => x.id === 'druid:wild-shape')!
    expect(r.max).toBe(2)
    expect(r.per).toBe('long')
    expect(r.shortRestRegain).toBe(1)
  })
  it('assuming a form spends a use and grants Temporary HP equal to the Druid level', () => {
    c.hp.current = s.hpMax.total
    expect(assumeForm(c, s, 'wolf')).toBe(true)
    expect(c.wildShape.active).toBe('wolf')
    expect(c.resources['druid:wild-shape']).toBe(1)
    expect(c.hp.temp).toBe(5)
    revertForm(c)
    expect(c.wildShape.active).toBeUndefined()
    const s2 = compute(c, rules)
    expect(assumeForm(c, s2, 'rat')).toBe(true)
    expect(assumeForm(c, compute(c, rules), 'spider')).toBe(false) // no use left
  })
  it('checks: a legal set gives no warning; too many or illegal forms are flagged', () => {
    expect(validate(c, rules).filter((w) => w.area === 'companions')).toEqual([])
    c.wildShape.known = ['wolf', 'spider', 'rat', 'riding-horse', 'cat', 'crab', 'owl', 'brown-bear']
    const ids = validate(c, rules)
      .filter((w) => w.area === 'companions')
      .map((w) => w.id)
    expect(ids).toContain('wild-shape-count')
    expect(ids).toContain('wild-shape-owl')
    expect(ids).toContain('wild-shape-brown-bear')
    expect(ids).not.toContain('wild-shape-cat')
  })
})

describe('Find Familiar (SRD p. 130) and Pact of the Chain (p. 74)', () => {
  it('named animals and CR 0 Beasts are forms; the Imp needs a Warlock; the Wolf is never one', () => {
    expect(familiarIneligible(rules.creatures.get('owl')!, false)).toBeUndefined()
    expect(familiarIneligible(rules.creatures.get('crab')!, false)).toBeUndefined() // Beast, CR 0
    expect(familiarIneligible(rules.creatures.get('imp')!, false)?.en).toContain('Pact of the Chain')
    expect(familiarIneligible(rules.creatures.get('imp')!, true)).toBeUndefined()
    expect(familiarIneligible(rules.creatures.get('wolf')!, false)?.en).toContain('not a Find Familiar form')
  })
  it('one familiar only', () => {
    const c = druid(2)
    c.companions.push(newCompanion(rules.creatures.get('owl')!, 'familiar', { creatureType: 'fey' }))
    expect(validate(c, rules).filter((w) => w.area === 'companions')).toEqual([])
    c.companions.push(newCompanion(rules.creatures.get('cat')!, 'familiar', { creatureType: 'fey' }))
    expect(validate(c, rules).map((w) => w.id)).toContain('familiar-count')
  })
})

describe('Otherworldly Steed (SRD p. 131)', () => {
  const steed = rules.creatures.get('otherworldly-steed')!
  it('AC 10 + 1 per spell level, HP 5 + 10 per spell level', () => {
    expect(companionAc(steed, 2)).toBe(12)
    expect(companionHpMax(steed, 2)).toBe(25)
    expect(companionHpMax(steed, 4)).toBe(45)
    expect(newCompanion(steed, 'steed', { spellLevel: 3 }).hp).toEqual({ current: 35, temp: 0, max: 35 })
  })
  it('an ordinary creature starts at its average Hit Points', () =>
    expect(newCompanion(rules.creatures.get('wolf')!, 'mount').hp.max).toBe(11))
})

describe('Wild Shape in-play view (SRD p. 42–43 "Rules While Shape-Shifted")', () => {
  const c = druid(8)
  c.skillProficiencies = ['nature', 'perception']
  c.wildShape.known = ['brown-bear']
  const s = compute(c, rules)
  const v = wildShapeView(c, s, rules.creatures.get('brown-bear')!, rules)
  it('Str, Dex, Con come from the Beast; Int, Wis, Cha stay yours; HP are yours', () => {
    expect(v.abilities.str.score).toMatchObject({ value: 17, from: 'beast' }) // Brown Bear Str 17 (SRD p. 346)
    expect(v.abilities.wis.score.value).toBe(s.abilities.wis.score.total)
    expect(v.abilities.wis.score.from).toBe('you')
    expect(v.hp.max).toBe(s.hpMax.total)
    expect(v.ac).toMatchObject({ value: 11, from: 'beast' })
  })
  it("saving throws keep your proficiency with your PB on the form's ability, or take the stat block when higher", () => {
    // Druid: Int and Wis proficient. Str save = bear Str +3 + nothing = +3 (the bear's own +3 is not higher)
    expect(v.abilities.str.save.value).toBe(3)
    expect(v.abilities.wis.save.value).toBe(s.abilities.wis.save.total)
    expect(v.abilities.wis.save.from).toBe('you')
  })
  it("skills: your proficiency on the form's ability, or the stat block's higher modifier (bear Perception +3 vs yours)", () => {
    const perception = v.skills.find((k) => k.id === 'perception')!
    expect(perception.total.value).toBe(Math.max(3, s.skills.find((k) => k.id === 'perception')!.total.total))
    const athletics = v.skills.find((k) => k.id === 'athletics')!
    expect(athletics.total.value).toBe(3) // bear Str +3, not proficient
    expect(athletics.total.from).toBe('merged')
  })
})
