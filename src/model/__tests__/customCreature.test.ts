// A creature from another book entered by the player (house rule #5, a subclass's beast companion): its formulas follow
// the character, attack numbers are written into the entry, and the rule checks accept it.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { validate } from '../../engine/validate'
import type { Character, CustomCreature } from '../character'
import { customCreatureDef } from '../customCreature'
import type { FormulaContext } from '../formula'
import { migrate } from '../migrate'
import ranger from '../../../examples/rodeur-niveau-10.json'

const BEAST: CustomCreature = {
  name: 'Beast of the Woods',
  type: 'Beast',
  size: 'medium',
  book: 'Some Book p. 120',
  ac: '13 + wis',
  hp: '5 + rangerLevel*5',
  speed: '40 ft.',
  abilities: { str: 14, dex: 14, con: 15, int: 8, wis: 14, cha: 11 },
  saves: ['str'],
  entries: [
    {
      kind: 'action',
      name: 'Bite',
      text: 'Then a short note.',
      attack: 'pb + wis',
      damageDice: '1d8',
      damageBonus: '2 + wis',
      damageType: 'Piercing',
    },
    { kind: 'trait', name: 'Loyal', text: 'Player-written trait.' },
  ],
}
const ctx: FormulaContext = {
  pb: 3,
  level: 7,
  classLevels: { ranger: 7 },
  mods: { str: 0, dex: 3, con: 1, int: 0, wis: 3, cha: 0 },
}

describe('custom creature', () => {
  it('resolves its formulas with the character', () => {
    const d = customCreatureDef(BEAST, ctx, 'custom:x')
    expect(d.ac).toBe(16)
    expect(d.hp).toEqual({ average: 40, dice: '5 + rangerLevel*5' })
    expect(d.pb).toBe(3)
    expect(d.abilities.str).toEqual({ score: 14, mod: 2, save: 5 })
    expect(d.abilities.dex.save).toBe(2)
    expect(d.actions[0].text.en).toBe('<em>Attack Roll:</em> +6. <em>Hit:</em> 1d8 + 5 Piercing. Then a short note.')
    expect(d.traits[0].name.fr).toBe('Loyal')
    expect(d.source).toMatchObject({ book: 'Some Book p. 120', houseRule: 5 })
    // A level more: more Hit Points.
    expect(customCreatureDef(BEAST, { ...ctx, classLevels: { ranger: 8 } }).hp?.average).toBe(45)
  })

  it('is accepted by the rule checks as a companion', () => {
    const c = migrate(structuredClone(ranger)) as Character
    c.companions.push({
      uid: 'b1',
      kind: 'other',
      creatureId: 'custom',
      custom: BEAST,
      hp: { current: 55, temp: 0, max: 55 },
    })
    expect(validate(c, rules).filter((w) => w.id.includes('b1'))).toEqual([])
  })
})
