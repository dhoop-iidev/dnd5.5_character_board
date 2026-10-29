// Hands used by the weapons and the Shield in hand, shared by the Combat pane's selector (ui/HandsSelector.svelte)
// and the rule check (engine/checks/equipment.ts).
// SRD 5.2.1 p. 90 "Two-Handed" (FR p. 95: requires two hands when you attack with it), p. 90 "Versatile" (FR p. 96:
// one or two hands, the bracketed damage when used with two hands for a melee attack), p. 92 "Shield" (FR p. 98:
// carried in one hand, donned and doffed with the Utilize action), p. 177 "Attack" (FR p. 188: equip or unequip one
// weapon as part of each attack).
import type { WeaponDef } from '../data/types'
import type { Character } from '../model/character'

/** A Versatile weapon held in two hands (`ItemInstance.twoHanded`). */
export const twoHandedGrip = (char: Pick<Character, 'inventory'>, uid: string) =>
  !!char.inventory?.find((i) => i.uid === uid)?.twoHanded

/** Two of a stack of Light weapons in hand, one in each (`ItemInstance.pair`, quantity 2 or more). */
export const heldAsPair = (char: Pick<Character, 'inventory'>, uid: string) => {
  const i = char.inventory?.find((x) => x.uid === uid)
  return !!i?.pair && i.quantity >= 2
}

/** Hands a weapon needs: 2 for Two-Handed, 2 for a Versatile weapon held in two hands, 2 for a pair of Light weapons,
 * 1 otherwise. */
export function weaponHands(def: WeaponDef, char: Pick<Character, 'inventory'>, uid: string): number {
  if (def.properties.includes('two-handed')) return 2
  if (def.properties.includes('light') && heldAsPair(char, uid)) return 2
  if (def.properties.includes('versatile') && twoHandedGrip(char, uid)) return 2
  return 1
}

/** Total hands used by the weapons and the Shield in hand. */
export function handsUsed(
  char: Pick<Character, 'inventory'>,
  weapons: { item: { uid: string }; def: WeaponDef }[],
  shield: unknown,
): number {
  return weapons.reduce((s, x) => s + weaponHands(x.def, char, x.item.uid), 0) + (shield ? 1 : 0)
}
