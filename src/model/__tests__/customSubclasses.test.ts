// Custom subclasses (house rule #5): a subclass from another book entered by the player replaces the SRD one of an
// example character; its features up to the class level, uses per rest (with steps), turn activation, named options
// (counted by the rule checks), modifiers and always-prepared spells work like an SRD subclass's.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { validate } from '../../engine/validate'
import { turnOptions } from '../../engine/turn'
import type { Character, CustomSubclass } from '../character'
import { readSubclassFile, subclassFile } from '../customSubclasses'
import { migrate } from '../migrate'
import fighter from '../../../examples/guerriere-niveau-5.json'
import cleric from '../../../examples/clerc-niveau-10.json'
import druid from '../../../examples/druide-niveau-10.json'
import { wildShapeLimitsFor } from '../../engine/companions'
import { wildShapeView } from '../../engine/wildShapeView'

const MARTIAL: CustomSubclass = {
  id: 'custom-subclass-1',
  classId: 'fighter',
  name: 'Tactician',
  book: 'Some Book p. 72',
  text: 'Player-written description.',
  features: [
    {
      id: 'f1',
      level: 3,
      name: 'Tactical Dice',
      text: 'Summary.',
      uses: { count: 4, per: 'short', byLevel: { '7': 5 } },
      activation: { kind: 'bonus-action', trigger: 'when you hit' },
      choice: { name: 'Tricks', count: 2, byLevel: { '7': 3 }, options: ['Feint', 'Trip', 'Rally'] },
      modifiers: [{ target: 'initiative', value: 1 }],
    },
    { id: 'f2', level: 7, name: 'Later Feature', text: 'Not yet.' },
  ],
}
const FEATURE = 'fighter:custom-subclass-1:f1'

function withSub(base: unknown, sub: CustomSubclass): Character {
  const c = migrate(structuredClone(base)) as Character
  c.customSubclasses = [sub]
  const l = c.levels.find((x) => x.classId === sub.classId && x.subclassId)!
  l.subclassId = sub.id
  return c
}

describe('custom subclasses', () => {
  it('gives its features up to the class level, uses, modifiers and options', () => {
    const before = compute(migrate(structuredClone(fighter)) as Character, rules)
    const c = withSub(fighter, MARTIAL)
    const s = compute(c, rules)
    expect(s.subclasses.get('fighter')?.name.en).toBe('Tactician')
    const ids = s.features.map((f) => f.def.id)
    expect(ids).toContain(FEATURE)
    expect(ids).not.toContain('fighter:custom-subclass-1:f2')
    expect(ids.some((id) => id.startsWith('fighter:champion:'))).toBe(false)
    const r = s.resources.find((x) => x.id === FEATURE)!
    expect(r).toMatchObject({ max: 4, per: 'short' })
    expect(r.source).toMatchObject({ book: 'Some Book p. 72', houseRule: 5 })
    expect(s.initiative.total).toBe(before.initiative.total + 1)
    // A Bonus Action card in the turn box, spending one use.
    const card = turnOptions(c, s).find((o) => o.ownerId === FEATURE)!
    expect(card).toMatchObject({ kind: 'bonus-action', cost: { resource: FEATURE, amount: 1, left: 4 } })
    expect(card.activation.trigger?.en).toBe('when you hit')

    // The options are a choice the checks count (2 at level 5), placed like any feature choice.
    const missing = validate(c, rules).filter((w) => w.id.startsWith('choice-') && w.id.includes(FEATURE))
    expect(missing.length).toBe(1)
    c.featureChoices[FEATURE] = ['feint', 'trip']
    expect(validate(c, rules).filter((w) => w.id.includes(FEATURE))).toEqual([])
    // The shared rules are untouched.
    expect(rules.classes.get('fighter')!.subclasses.some((x) => x.id === MARTIAL.id)).toBe(false)
  })

  it('makes its spells always prepared from their class level', () => {
    const domain: CustomSubclass = {
      id: 'custom-subclass-1',
      classId: 'cleric',
      name: 'Some Domain',
      book: 'Some Book p. 80',
      text: '',
      features: [{ id: 'f1', level: 3, name: 'Domain Gift', text: '' }],
      spells: [
        { level: 3, spells: ['shield', 'magic-missile'] },
        { level: 11, spells: ['wall-of-force'] },
      ],
    }
    const s = compute(withSub(cleric, domain), rules)
    const sc = s.spellcasting.find((x) => x.classId === 'cleric')!
    expect(sc.alwaysPrepared).toEqual(expect.arrayContaining(['shield', 'magic-missile']))
    expect(sc.alwaysPrepared).not.toContain('wall-of-force')
    expect(sc.alwaysPrepared).not.toContain('bless') // Life Domain spells are gone
  })

  it('round-trips through a subclass file, with a fresh id on collision', () => {
    const file = JSON.parse(JSON.stringify(subclassFile(MARTIAL)))
    expect(readSubclassFile(file, [])).toEqual(MARTIAL)
    expect(readSubclassFile(file, [MARTIAL]).id).toBe('custom-subclass-2')
    expect(() => readSubclassFile({ kind: 'character' }, [])).toThrow()
  })
})

// A subclass that gives its class spellcasting (tier 3): the player's tables, their list, and their share of the
// Multiclass Spellcaster table (the SRD has none for such classes, p. 25).
describe('custom subclass spellcasting', () => {
  const caster: CustomSubclass = {
    id: 'custom-subclass-1',
    classId: 'fighter',
    name: 'Spell Knight',
    book: 'Some Book p. 90',
    text: '',
    features: [{ id: 'f1', level: 3, name: 'Spellcasting', text: '' }],
    spellcasting: {
      ability: 'int',
      list: 'wizard',
      change: 'level',
      cantrips: { '3': 2, '10': 3 },
      prepared: { '3': 3, '4': 4 },
      slots: { '3': [2], '4': [3], '7': [4, 2] },
    },
  }

  it('casts from its list with its own tables', () => {
    const s = compute(withSub(fighter, caster), rules)
    const sc = s.spellcasting.find((x) => x.classId === 'fighter')!
    expect(sc).toMatchObject({ kind: 'subclass', list: 'wizard', ability: 'int', cantripsMax: 2, preparedMax: 4 })
    expect(sc.maxSpellLevel).toBe(1)
    expect(s.slots).toEqual([3])
    // A Wizard spell is on its list; a Cleric-only one is not.
    const c = withSub(fighter, caster)
    c.spellcasting.fighter = { prepared: ['magic-missile', 'cure-wounds'], cantrips: [] }
    const ids = validate(c, rules).map((w) => w.id)
    expect(ids.some((id) => id.includes('cure-wounds'))).toBe(true)
    expect(ids.some((id) => id.includes('magic-missile'))).toBe(false)
  })

  it('adds its share to the Multiclass Spellcaster table only as entered', () => {
    const c = withSub(fighter, caster)
    c.levels.push({ classId: 'wizard', hpRoll: 4, hpFixed: true })
    // Not entered: counts 0 (Wizard 1 alone → 2 slots) and a check asks for it.
    let s = compute(c, rules)
    expect(s.slots).toEqual([2])
    expect(validate(c, rules).map((w) => w.id)).toContain('subclass-multiclass-fighter')
    // Fighter 5 ÷ 3 rounded down = 1, + Wizard 1 = level 2 of the Multiclass Spellcaster table → 3 slots.
    c.customSubclasses![0].spellcasting!.multiclass = { divisor: 3, round: 'down' }
    s = compute(c, rules)
    expect(s.casterLevel).toBe(2)
    expect(s.slots).toEqual([3])
    expect(validate(c, rules).map((w) => w.id)).not.toContain('subclass-multiclass-fighter')
  })
})

// A weapon created by a feature (tier 3, Psychic Blades style): listed with the attacks, proficiency with that weapon
// only, its mastery usable without a pick, not counted against the hands.
describe('custom subclass feature weapon', () => {
  const blades: CustomSubclass = {
    id: 'custom-subclass-1',
    classId: 'fighter',
    name: 'Mind Blade',
    book: 'Some Book p. 95',
    text: '',
    features: [
      {
        id: 'f1',
        level: 3,
        name: 'Mind Blades',
        text: '',
        weapon: {
          name: 'Mind Blade',
          base: 'dagger',
          damage: '1d6',
          damageType: 'psychic',
          rangeFt: { normal: 60, long: 120 },
          proficient: true,
          mastery: true,
        },
      },
    ],
  }

  it('adds an attack line', () => {
    const c = withSub(fighter, blades)
    const s = compute(c, rules)
    const a = s.attacks.find((x) => x.uid === 'feature:fighter:custom-subclass-1:f1')!
    expect(a.name.en).toBe('Mind Blade')
    expect(a.damage.dice).toBe('1d6')
    expect(a.damage.type.en).toMatch(/psychic/i)
    expect(a.proficient).toBe(true)
    expect(a.mastery).toMatchObject({ id: 'nick', usable: true })
    expect(a.range?.normal.en).toMatch(/60/)
    // Not in the inventory, not counted against the hands.
    expect(c.inventory.some((i) => i.uid.startsWith('feature:'))).toBe(false)
    expect(validate(c, rules).filter((w) => w.id.startsWith('hands') || w.id.includes('weapon-prof'))).toEqual([])
  })

  it('without its boxes: proficiency from the base weapon category, mastery only with a Weapon Mastery pick', () => {
    const sub = structuredClone(blades)
    sub.features[0].weapon!.proficient = false
    sub.features[0].weapon!.mastery = false
    const c = withSub(fighter, sub)
    const a = compute(c, rules).attacks.find((x) => x.uid.startsWith('feature:'))!
    expect(a.proficient).toBe(true) // a Fighter is proficient with Simple weapons, and it is built like a Dagger
    expect(a.mastery.usable).toBe(false)
  })
})

// Wild Shape changed by a feature (tier 3, Circle Forms style): the highest of the table and the formulas applies.
describe('custom subclass Wild Shape', () => {
  const moon: CustomSubclass = {
    id: 'custom-subclass-1',
    classId: 'druid',
    name: 'Some Circle',
    book: 'Some Book p. 99',
    text: '',
    features: [
      {
        id: 'f1',
        level: 3,
        name: 'Circle Shapes',
        text: '',
        wildShape: { maxCr: 'druidLevel/3', tempHp: 'druidLevel*3', acMin: '13 + wis' },
      },
    ],
  }

  it('raises the CR limit and Temporary Hit Points, sets an AC minimum', () => {
    const base = compute(migrate(structuredClone(druid)) as Character, rules)
    expect(wildShapeLimitsFor(base)).toMatchObject({ maxCr: 1, tempHp: 10 })
    const c = withSub(druid, moon)
    const s = compute(c, rules)
    const lim = wildShapeLimitsFor(s)!
    expect(lim).toMatchObject({ maxCr: 3, tempHp: 30 })
    expect(lim.acMin?.value).toBe(13 + s.abilities.wis.mod)
    expect(lim.changedBy?.[0].en).toBe('Circle Shapes')
    // A CR 2 beast is now a legal known form; on the card, its AC is raised to the minimum.
    c.wildShape.known = ['giant-constrictor-snake']
    expect(validate(c, rules).filter((w) => w.id.startsWith('wild-shape'))).toEqual([])
    const v = wildShapeView(c, s, rules.creatures.get('giant-constrictor-snake')!, rules)
    expect(v.ac.value).toBe(Math.max(12, 13 + s.abilities.wis.mod))
  })
})
