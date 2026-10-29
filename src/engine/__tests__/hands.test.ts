// Hands in use (SRD 5.2.1 p. 90 "Two-Handed", "Versatile", p. 92 "Shield"): weapons and Shield in hand need at most two
// hands; a Versatile weapon counts two when held in two hands (engine/hands.ts).
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { ItemInstance } from '../../model/character'
import { newCharacter } from '../../model/newCharacter'
import { handsUsed } from '../hands'
import { compute } from '../compute'
import { validate } from '../validate'

const fighter = (items: ItemInstance[], toggles: Record<string, boolean> = {}) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'soldier',
      classId: 'fighter',
      lang: 'en',
      abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 10, cha: 10 },
    },
    rules,
  )
  c.inventory = items
  c.toggles = toggles
  return c
}
const item = (uid: string, kind: ItemInstance['kind'], refId: string, equipped = true): ItemInstance => ({
  uid,
  kind,
  refId,
  quantity: 1,
  location: 'worn',
  equipped,
})
const handsWarning = (c: ReturnType<typeof fighter>) => validate(c, rules).find((x) => x.id === 'hands')

describe('hands check', () => {
  it('a longsword and a Shield use two hands: no warning', () => {
    const c = fighter([item('w', 'weapon', 'longsword'), item('s', 'armor', 'shield')])
    const s = compute(c, rules)
    expect(handsUsed(c, s.weapons, s.shield)).toBe(2)
    expect(handsWarning(c)).toBeUndefined()
  })
  it('a Two-Handed greatsword and a Shield need three hands', () => {
    const c = fighter([item('w', 'weapon', 'greatsword'), item('s', 'armor', 'shield')])
    expect(handsWarning(c)?.message.en).toContain('3 hands')
  })
  it('a Versatile longsword held in two hands counts two', () => {
    const two = { ...item('w', 'weapon', 'longsword'), twoHanded: true }
    expect(handsWarning(fighter([two, item('s', 'armor', 'shield')]))?.message.en).toContain('3 hands')
    const alone = fighter([two])
    expect(handsWarning(alone)).toBeUndefined()
    // The bracketed Versatile damage applies (p. 90).
    expect(compute(alone, rules).attacks.find((a) => a.uid === 'w')?.damage.dice).toBe('1d10')
  })
  it('two Light weapons use two hands; a third weapon is one too many', () => {
    expect(handsWarning(fighter([item('a', 'weapon', 'shortsword'), item('b', 'weapon', 'dagger')]))).toBeUndefined()
    expect(
      handsWarning(
        fighter([item('a', 'weapon', 'shortsword'), item('b', 'weapon', 'dagger'), item('c', 'weapon', 'handaxe')]),
      ),
    ).toBeDefined()
  })
  it('a Shield not in hand is not counted and gives no AC', () => {
    const c = fighter([item('w', 'weapon', 'greatsword'), item('s', 'armor', 'shield', false)])
    expect(handsWarning(c)).toBeUndefined()
    expect(compute(c, rules).ac.parts.some((p) => p.sourceId === 's')).toBe(false)
    c.inventory[1].equipped = true
    expect(compute(c, rules).ac.parts.some((p) => p.sourceId === 's')).toBe(true)
  })
  it('a pair of Light weapons from one stack, one in each hand, counts two', () => {
    const pair = { ...item('d', 'weapon', 'dagger'), quantity: 2, pair: true }
    expect(handsWarning(fighter([pair]))).toBeUndefined()
    expect(handsWarning(fighter([pair, item('s', 'armor', 'shield')]))?.message.en).toContain('3 hands')
    // A single Dagger can't be a pair.
    expect(handsWarning(fighter([{ ...pair, quantity: 1 }, item('s', 'armor', 'shield')]))).toBeUndefined()
  })
})
