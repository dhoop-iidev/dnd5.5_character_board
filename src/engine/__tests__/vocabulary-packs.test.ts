// Effect vocabulary added for content packs (house rule #7, docs/effects.md): weapon conditions, senses, the Medium
// armor Dexterity cap, Death Saving Throw Advantage, a feature weapon's own mastery. Fictional effects on an SRD feat.
import { describe, expect, it } from 'vitest'
import { buildRules } from '../../data/rules'
import type { EffectDef } from '../../data/types'
import type { Character, ItemInstance } from '../../model/character'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'

const rules = buildRules()
const ABIL = { str: 15, dex: 16, con: 14, int: 10, wis: 13, cha: 8 }

function withEffect(eff: Omit<EffectDef, 'id'>, inventory: ItemInstance[] = [], speciesId = 'human') {
  const r = { ...rules, effects: new Map(rules.effects) }
  r.effects.set('feat:alert', { id: 'feat:alert', ...eff })
  const c: Character = newCharacter(
    {
      name: 'T',
      speciesId,
      backgroundId: 'criminal', // Origin feat: Alert
      classId: 'fighter',
      lang: 'en',
      abilities: ABIL,
      speciesChoices: { size: 'medium' },
      backgroundKit: 'B',
    },
    r,
  )
  c.inventory = inventory
  return compute(c, r)
}
const weapon = (refId: string, equipped = true): ItemInstance => ({
  uid: refId,
  kind: 'weapon',
  refId,
  quantity: 1,
  location: 'worn',
  equipped,
})

describe('content-pack vocabulary', () => {
  it('one-handed-melee applies to a lone one-handed melee weapon only', () => {
    const eff = { modifiers: [{ target: 'damage.melee', value: 2, when: 'one-handed-melee' }] }
    const one = withEffect(eff, [weapon('longsword')])
    expect(one.attacks[0].damage.bonus.parts.some((p) => p.sourceId === 'feat:alert')).toBe(true)
    const two = withEffect(eff, [weapon('greatsword')])
    expect(two.attacks[0].damage.bonus.parts.some((p) => p.sourceId === 'feat:alert')).toBe(false)
    const pair = withEffect(eff, [weapon('shortsword'), weapon('dagger')])
    expect(pair.attacks.every((a) => !a.damage.bonus.parts.some((p) => p.sourceId === 'feat:alert'))).toBe(true)
  })

  it('heavy-weapon and thrown-weapon follow the weapon properties', () => {
    const s = withEffect(
      {
        modifiers: [
          { target: 'damage.all', value: 3, when: 'heavy-weapon' },
          { target: 'damage.all', value: 2, when: 'thrown-weapon' },
        ],
      },
      [weapon('greatsword'), weapon('dagger'), weapon('dart')],
    )
    const parts = (id: string) =>
      s.attacks.find((a) => a.weapon.id === id)!.damage.bonus.parts.filter((p) => p.sourceId === 'feat:alert')
    expect(parts('greatsword').map((p) => p.value)).toEqual([3])
    expect(parts('dagger').map((p) => [p.value, !!p.condition])).toEqual([[2, true]]) // melee + Thrown: "when thrown"
    expect(parts('dart').map((p) => [p.value, !!p.condition])).toEqual([[2, false]])
  })

  it('no-weapon-no-shield picks the larger unarmed die only with empty hands', () => {
    const eff = {
      modifiers: [
        { target: 'dice.unarmed', value: '1d6' },
        { target: 'dice.unarmed', value: '1d8', when: 'no-weapon-no-shield' },
      ],
    }
    expect(withEffect(eff).unarmed?.damage.dice).toBe('1d8')
    expect(withEffect(eff, [weapon('dagger')]).unarmed?.damage.dice).toBe('1d6')
  })

  it('senses: extended Darkvision adds to an existing one; blindsight', () => {
    const eff = {
      grants: [
        { kind: 'darkvision' as const, on: 'extend', value: 60 },
        { kind: 'blindsight' as const, value: 10 },
      ],
    }
    expect(withEffect(eff, [], 'dwarf').senses).toMatchObject({ darkvision: 180, blindsight: 10 })
    expect(withEffect(eff, [], 'human').senses.darkvision).toBe(60)
  })

  it('ac.dexMax.medium raises the Medium armor cap; save.death Advantage', () => {
    const armor: ItemInstance = {
      uid: 'a',
      kind: 'armor',
      refId: 'half-plate-armor',
      quantity: 1,
      location: 'worn',
      equipped: true,
    }
    const capped = withEffect({}, [armor])
    const raised = withEffect(
      { modifiers: [{ target: 'ac.dexMax.medium', value: 3 }], grants: [{ kind: 'advantage', on: 'save.death' }] },
      [armor],
    )
    expect(raised.ac.total - capped.ac.total).toBe(1) // Dex 16: +3 instead of +2
    expect(raised.pool.advantage('save.death').length).toBe(1)
  })

  it('a feature weapon may carry its own mastery and properties', () => {
    const s = withEffect({
      weapon: {
        name: { en: 'Blade', fr: 'Lame', es: 'Hoja' },
        base: 'dagger',
        damage: '1d6',
        damageType: 'psychic',
        proficient: true,
        mastery: true,
        masteryProperty: 'vex',
        properties: ['finesse', 'thrown'],
      },
    })
    const blade = s.attacks.find((a) => a.uid === 'feature:feat:alert')!
    expect([blade.mastery.id, blade.mastery.usable]).toEqual(['vex', true])
    expect(blade.weapon.properties).toEqual(['finesse', 'thrown'])
  })
})
