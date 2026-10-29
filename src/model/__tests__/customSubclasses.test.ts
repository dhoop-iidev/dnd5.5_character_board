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
