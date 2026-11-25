// A custom weapon's extra dice may say when they apply (Dragon Slayer: "if the target is a Dragon"): shown as situational.
import { expect, it } from 'vitest'
import { buildRules } from '../../data/rules'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'

it('a custom extra damage keeps its condition', () => {
  const rules = buildRules()
  const c = newCharacter(
    {
      name: 'T',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'fighter',
      lang: 'en',
      abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      speciesChoices: { size: 'medium' },
      backgroundKit: 'B',
    },
    rules,
  )
  c.inventory = [
    {
      uid: 'w',
      kind: 'weapon',
      refId: 'greataxe',
      quantity: 1,
      location: 'worn',
      equipped: true,
      custom: { extraDamage: [{ dice: '3d6', type: 'slashing', condition: 'against a Dragon' }, { dice: '1d4' }] },
    },
  ]
  const x = compute(c, rules).attacks[0].extraDamage
  expect(x.map((e) => [e.dice, e.condition?.en])).toEqual([
    ['3d6', 'against a Dragon'],
    ['1d4', undefined],
  ])
})
