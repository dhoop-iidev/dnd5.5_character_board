// Spells cast from any item (SRD 5.2.1 p. 206 "Spells Cast from Items"): a custom sword casting Light at will, a ring
// usable once per dawn, a custom wand with charges.
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { ItemInstance } from '../../model/character'
import { canCast, castFromItem, rechargeItem, spellItemInfo } from '../spellItems'

const sword = (spells: ItemInstance['spells'], extra: Partial<ItemInstance> = {}): ItemInstance => ({
  uid: 's',
  kind: 'weapon',
  refId: 'longsword',
  quantity: 1,
  location: 'worn',
  custom: { name: { en: 'Dawnbringer', fr: 'Porte-aube', es: 'Portador del alba' }, magic: true },
  spells,
  ...extra,
})

describe('spells cast from items', () => {
  it('a custom sword casts Light at will', () => {
    const item = sword([{ spellId: 'light', atWill: true }])
    const info = spellItemInfo(item, rules)!
    const s = info.spells[0]
    expect(s.atWill).toBe(true)
    for (let i = 0; i < 5; i++) {
      expect(canCast(item, info, s, 0, rules)).toBe(true)
      castFromItem(item, info, s, 0, rules)
    }
  })
  it('without charges a spell is at will by default', () => {
    const item = sword([{ spellId: 'light' }])
    const info = spellItemInfo(item, rules)!
    castFromItem(item, info, info.spells[0], 0, rules)
    expect(canCast(item, info, info.spells[0], 0, rules)).toBe(true)
  })
  it('once per dawn: used, then renewed at dawn', () => {
    const item = sword([{ spellId: 'light', perDay: 1 }])
    const info = spellItemInfo(item, rules)!
    const s = info.spells[0]
    castFromItem(item, info, s, 0, rules)
    expect(canCast(item, info, s, 0, rules)).toBe(false)
    rechargeItem(item, info, () => 0.5)
    expect(canCast(item, info, s, 0, rules)).toBe(true)
  })
  it('charges: a custom wand spends its charges and keeps a fixed DC', () => {
    const item = sword([{ spellId: 'fireball', chargeCost: 2, dc: 15 }], { maxCharges: 3, charges: 3 })
    const info = spellItemInfo(item, rules)!
    const s = info.spells[0]
    expect(s.dc).toBe(15)
    castFromItem(item, info, s, 3, rules)
    expect(item.charges).toBe(1)
    expect(canCast(item, info, s, 3, rules)).toBe(false)
  })
})
