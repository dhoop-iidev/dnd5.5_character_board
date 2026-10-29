// Custom items (schema 4): modifiers while worn and attuned, custom weapon and armor overrides, worn kinds (SRD p. 103).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { ItemInstance } from '../../model/character'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { wornKindOf } from '../items'
import { validate } from '../validate'

const fighter = () => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'fighter',
      lang: 'en',
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    },
    rules,
  )
  c.inventory = []
  return c
}

const cloak = (attuned: boolean): ItemInstance => ({
  uid: 'cloak',
  kind: 'custom',
  quantity: 1,
  location: 'worn',
  attuned,
  custom: {
    name: { en: 'Cloak of the Wolf', fr: 'Cape du loup' },
    magic: true,
    attunement: true,
    modifiers: [
      { target: 'save.all', value: 1 },
      { target: 'ac', value: 1 },
    ],
  },
})

describe('custom item modifiers', () => {
  const base = compute(fighter(), rules)
  it('apply while worn and attuned', () => {
    const c = fighter()
    c.inventory.push(cloak(true))
    const s = compute(c, rules)
    expect(s.abilities.wis.save.total).toBe(base.abilities.wis.save.total + 1)
    expect(s.abilities.str.save.total).toBe(base.abilities.str.save.total + 1)
    expect(s.ac.total).toBe(base.ac.total + 1)
  })
  it('do nothing without the required Attunement', () => {
    const c = fighter()
    c.inventory.push(cloak(false))
    expect(compute(c, rules).abilities.wis.save.total).toBe(base.abilities.wis.save.total)
  })
  it('do nothing in the backpack', () => {
    const c = fighter()
    c.inventory.push({ ...cloak(true), location: 'carried' })
    expect(compute(c, rules).ac.total).toBe(base.ac.total)
  })
  it('the custom weight counts in the load', () => {
    const c = fighter()
    c.inventory.push({ ...cloak(true), custom: { ...cloak(true).custom, weightLb: 3 } })
    expect(compute(c, rules).carry.load.lb).toBe(3)
  })
})

describe('custom weapon', () => {
  const c = fighter()
  c.inventory.push({
    uid: 'blade',
    kind: 'weapon',
    refId: 'longsword',
    quantity: 1,
    location: 'worn',
    equipped: true,
    custom: {
      name: { en: 'Frostbite', fr: 'Morsure du givre' },
      magicBonus: 1,
      damageBonus: 1,
      damageType: 'cold',
      mastery: 'topple',
      extraDamage: [{ dice: '1d6', type: 'cold' }],
    },
  })
  const s = compute(c, rules)
  const plain = (() => {
    const p = fighter()
    p.inventory.push({
      uid: 'plain',
      kind: 'weapon',
      refId: 'longsword',
      quantity: 1,
      location: 'worn',
      equipped: true,
    })
    return compute(p, rules).attacks[0]
  })()
  const a = s.attacks.find((x) => x.uid === 'blade')!
  it('shows its name and overrides in the attacks', () => {
    expect(a.name.en).toBe('Frostbite')
    expect(a.weapon.damageType).toBe('cold')
    expect(a.mastery.id).toBe('topple')
    expect(a.weapon.damage).toBe('1d8')
  })
  it('adds the magic bonus to attack and damage, its own damage bonus, and extra dice', () => {
    expect(a.attack.total).toBe(plain.attack.total + 1)
    expect(a.damage.bonus.total).toBe(plain.damage.bonus.total + 2)
    expect(a.extraDamage.some((d) => d.dice === '1d6')).toBe(true)
  })
  it('keeps the base weapon for proficiency', () => expect(a.proficient).toBe(true))
})

describe('custom armor', () => {
  it('base armor + magic bonus to AC', () => {
    const c = fighter()
    c.inventory.push({
      uid: 'mail',
      kind: 'armor',
      refId: 'chain-mail',
      quantity: 1,
      location: 'worn',
      custom: { magicBonus: 1 },
    })
    expect(compute(c, rules).ac.total).toBe(16 + 1)
  })
})

describe('worn kinds (SRD p. 103)', () => {
  const item = (kind: ItemInstance['kind'], refId: string, uid = refId): ItemInstance => ({
    uid,
    kind,
    refId,
    quantity: 1,
    location: 'worn',
  })
  it('infers the kind of SRD items', () => {
    expect(wornKindOf(item('magic', 'boots-of-elvenkind'), rules)).toBe('footwear')
    expect(wornKindOf(item('magic', 'slippers-of-spider-climbing'), rules)).toBe('footwear')
    expect(wornKindOf(item('magic', 'cloak-of-protection'), rules)).toBe('cloak')
    expect(wornKindOf(item('magic', 'cape-of-the-mountebank'), rules)).toBe('cloak')
    expect(wornKindOf(item('magic', 'bracers-of-defense'), rules)).toBe('bracers')
    expect(wornKindOf(item('magic', 'gauntlets-of-ogre-power'), rules)).toBe('gloves')
    expect(wornKindOf(item('magic', 'headband-of-intellect'), rules)).toBe('headwear')
    expect(wornKindOf(item('magic', 'helm-of-brilliance'), rules)).toBe('headwear')
    expect(wornKindOf(item('magic', 'horseshoes-of-speed'), rules)).toBeUndefined()
    expect(wornKindOf(item('magic', 'ring-of-protection'), rules)).toBeUndefined()
    expect(wornKindOf(item('magic', 'elven-chain'), rules)).toBe('armor')
    expect(wornKindOf(item('magic', 'sentinel-shield'), rules)).toBeUndefined()
    expect(wornKindOf(item('armor', 'chain-mail'), rules)).toBe('armor')
    expect(wornKindOf(item('armor', 'shield'), rules)).toBeUndefined()
    expect(wornKindOf(item('weapon', 'longsword'), rules)).toBeUndefined()
  })
  it('custom items: from the name (EN or FR), or the explicit override', () => {
    const custom = (name: string, wornKind?: 'none' | 'cloak'): ItemInstance => ({
      uid: name,
      kind: 'custom',
      quantity: 1,
      location: 'worn',
      custom: { name: { en: name, fr: name }, wornKind },
    })
    expect(wornKindOf(custom('Bottes de l’ours'), rules)).toBe('footwear')
    expect(wornKindOf(custom('Gantelets du titan'), rules)).toBe('gloves')
    expect(wornKindOf(custom('Hat of Many Feathers'), rules)).toBe('headwear')
    expect(wornKindOf(custom('Hat of Many Feathers', 'none'), rules)).toBeUndefined()
    expect(wornKindOf(custom('Wolf pelt', 'cloak'), rules)).toBe('cloak')
  })
  it('warns when two items of a kind are worn', () => {
    const c = fighter()
    c.inventory.push(item('magic', 'boots-of-elvenkind'), item('magic', 'boots-of-striding-and-springing'))
    expect(validate(c, rules).some((w) => w.id === 'worn-kind-footwear')).toBe(true)
    c.inventory[1].location = 'carried'
    expect(validate(c, rules).some((w) => w.id === 'worn-kind-footwear')).toBe(false)
  })
})

describe('schema 4 migration', () => {
  it('keeps Attunement on custom items that were attuned, and the doll picture default', () => {
    const c = fighter() as unknown as Record<string, unknown>
    c.schemaVersion = 3
    c.images = {}
    c.inventory = [
      {
        uid: 'x',
        kind: 'custom',
        quantity: 1,
        location: 'worn',
        attuned: true,
        custom: { name: { en: 'X', fr: 'X' } },
      },
    ]
    const m = migrate(c)
    expect(m.schemaVersion).toBe(4)
    expect(m.inventory[0].custom?.attunement).toBe(true)
    expect(m.images.doll).toBeUndefined()
  })
})
