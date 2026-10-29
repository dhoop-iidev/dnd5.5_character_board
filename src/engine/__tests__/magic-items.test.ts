// SRD magic item effects (custom/effects/magic-items.json) applied while the item is active, and items that cast spells
// or have charges (engine/spellItems.ts). SRD 5.2.1 "Magic Items" (p. 206 "Charges", "Spells Cast from Items"), "Cloak of
// Protection", "Belt of Giant Strength", "Weapon, +1, +2, or +3", "Wand of Magic Missiles", "Spell Scroll".
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { ItemInstance } from '../../model/character'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { inactiveReason, magicBase } from '../items'
import {
  canCast,
  castFromItem,
  castLevels,
  chargeCost,
  initialCharges,
  itemSpellNumbers,
  rechargeItem,
  spellItemInfo,
  wielderNumbers,
} from '../spellItems'
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

const magic = (refId: string, extra: Partial<ItemInstance> = {}): ItemInstance => ({
  uid: refId,
  kind: 'magic',
  refId,
  quantity: 1,
  location: 'worn',
  ...extra,
})

describe('magic item effects', () => {
  const base = compute(fighter(), rules)

  it('Cloak of Protection worn and attuned: +1 AC and +1 to every saving throw', () => {
    const c = fighter()
    c.inventory.push(magic('cloak-of-protection', { attuned: true }))
    const s = compute(c, rules)
    expect(s.ac.total).toBe(base.ac.total + 1)
    for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)
      expect(s.abilities[a].save.total).toBe(base.abilities[a].save.total + 1)
  })

  it('Cloak of Protection unattuned or in the backpack: nothing', () => {
    for (const extra of [{ attuned: false }, { attuned: true, location: 'carried' as const }]) {
      const c = fighter()
      const item = magic('cloak-of-protection', extra)
      c.inventory.push(item)
      const s = compute(c, rules)
      expect(s.ac.total).toBe(base.ac.total)
      expect(s.abilities.wis.save.total).toBe(base.abilities.wis.save.total)
      expect(inactiveReason(item, rules)).toBeDefined()
    }
  })

  it('Belt of Giant Strength (hill) sets Strength to 21 (storm: 29), only while attuned', () => {
    const c = fighter()
    c.inventory.push(magic('belt-of-giant-strength', { attuned: true, variant: 0 }))
    expect(compute(c, rules).abilities.str.score.total).toBe(21)
    c.inventory[0].variant = 4
    expect(compute(c, rules).abilities.str.score.total).toBe(29)
    c.inventory[0].attuned = false
    expect(compute(c, rules).abilities.str.score.total).toBe(16)
  })

  it('Weapon +2 on a longsword: +2 to attack and damage with that weapon only', () => {
    const def = rules.magicItems.get('weapon-1-2-or-3')!
    expect(magicBase(def, rules)).toEqual({ kind: 'weapon', refId: 'longsword' })
    const c = fighter()
    c.inventory.push(
      { uid: 'plain', kind: 'weapon', refId: 'longsword', quantity: 1, location: 'worn', equipped: true },
      {
        uid: 'magic',
        kind: 'weapon',
        refId: 'longsword',
        magicItemId: 'weapon-1-2-or-3',
        variant: 1,
        quantity: 1,
        location: 'worn',
        equipped: true,
      },
    )
    const s = compute(c, rules)
    const plain = s.attacks.find((a) => a.uid === 'plain')!
    const sword = s.attacks.find((a) => a.uid === 'magic')!
    expect(sword.attack.total).toBe(plain.attack.total + 2)
    expect(sword.damage.bonus.total).toBe(plain.damage.bonus.total + 2)
    expect(sword.name.en).toContain('Longsword')
  })

  it('a worn SRD magic item raises no actionable warning', () => {
    const c = fighter()
    c.inventory.push(magic('cloak-of-protection', { attuned: true }))
    expect(validate(c, rules).filter((w) => w.area === 'inventory')).toEqual([])
  })
})

describe('items with spells and charges', () => {
  it('Wand of Magic Missiles: 7 charges, one more charge per level above 1st, regains 1d6 + 1 at dawn', () => {
    const item = magic('wand-of-magic-missiles', { location: 'carried' })
    const info = spellItemInfo(item, rules)!
    expect(info.maxCharges).toBe(7)
    const s = info.spells[0]
    expect(castLevels(s, rules, item)).toEqual([1, 2, 3])
    expect(chargeCost(s, 3, rules)).toBe(3)
    expect(canCast(item, info, s, 3, rules)).toBe(true)
    castFromItem(item, info, s, 3, rules)
    castFromItem(item, info, s, 3, rules)
    expect(item.charges).toBe(1)
    expect(canCast(item, info, s, 2, rules)).toBe(false)
    expect(rechargeItem(item, info, () => 0.99)).toBe(6) // 1d6 rolls 6, +1 = 7, capped at 7
    expect(item.charges).toBe(7)
  })

  it('Wand of Fireballs: its own save DC 15', () => {
    const item = magic('wand-of-fireballs', { location: 'carried', attuned: true })
    const info = spellItemInfo(item, rules)!
    expect(itemSpellNumbers(info.spells[0], info, 3, { dc: 12, attack: 4 })).toMatchObject({ dc: 15, from: 'item' })
  })

  it('Spell Scroll: the scroll table gives DC and attack by level, and casting uses it up', () => {
    const item = magic('spell-scroll', { location: 'carried', variant: 3, spells: [{ spellId: 'fireball' }] })
    const info = spellItemInfo(item, rules)!
    const s = info.spells[0]
    expect(castLevels(s, rules, item)).toEqual([3])
    expect(itemSpellNumbers(s, info, 3, { dc: 12, attack: 4 })).toEqual({ dc: 15, attack: 7, from: 'scroll' })
    expect(canCast(item, info, s, 3, rules)).toBe(true)
    castFromItem(item, info, s, 3, rules)
    expect(item.quantity).toBe(0)
    expect(canCast(item, info, s, 3, rules)).toBe(false)
  })

  it('a stored item can’t be used; dice charges are rolled once', () => {
    const item = magic('wand-of-magic-missiles', { location: 'stored' })
    const info = spellItemInfo(item, rules)!
    expect(canCast(item, info, info.spells[0], 1, rules)).toBe(false)
    expect(initialCharges({ spells: [], charges: '1d3' }, () => 0.5)).toEqual({ charges: 2, maxCharges: 2 })
  })

  it('a wielder without Spellcasting uses 8 + PB and + PB', () => {
    const s = compute(fighter(), rules)
    expect(wielderNumbers(s)).toEqual({ dc: 8 + s.pb, attack: s.pb })
  })
})
