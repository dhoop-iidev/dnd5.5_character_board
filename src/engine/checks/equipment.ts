// Equipment: armor training, heavy armor Strength, Attunement, items in hand.
// SRD 5.2.1 p. 92 "Armor Training" (without training: Disadvantage on Str/Dex D20 Tests, no spells), p. 92 "Strength",
// p. 177 "Attunement" (no more than three), p. 89 "Weapon Proficiency".
import type { CheckContext } from './common'
import { esOf, w } from './common'
import type { ItemInstance, WornKind } from '../../model/character'
import { SRC_WORN_KINDS, WORN_KINDS, wornKindOf } from '../items'
import { handsUsed, weaponHands } from '../hands'

export function checkEquipment(ctx: CheckContext) {
  const { char, rules, now, out } = ctx
  const armorOk = (cat: string) => now.proficiencies.armor.includes(cat)
  if (now.armor && !armorOk(now.armor.def.category))
    out.push(
      w(
        'armor-training',
        'warning',
        'inventory',
        `No training with ${now.armor.def.category} armor: Disadvantage on Strength and Dexterity D20 Tests, and you can't cast spells (${now.armor.def.name.en}).`,
        `Pas de formation aux armures ${now.armor.def.category === 'light' ? 'légères' : now.armor.def.category === 'medium' ? 'intermédiaires' : 'lourdes'} : Désavantage aux tests d20 de Force et de Dextérité, et impossible de lancer des sorts (${now.armor.def.name.fr}).`,
        `Sin entrenamiento con armaduras ${now.armor.def.category === 'light' ? 'ligeras' : now.armor.def.category === 'medium' ? 'medias' : 'pesadas'}: Desventaja en las pruebas con d20 de Fuerza y Destreza, y no puedes lanzar conjuros (${esOf(now.armor.def.name)}).`,
        { source: { page: 92, frPage: 98 } },
      ),
    )
  if (now.shield && !armorOk('shield'))
    out.push(
      w(
        'shield-training',
        'warning',
        'inventory',
        `No training with Shields: the Shield gives no Armor Class benefit.`,
        `Pas de formation aux boucliers : le bouclier n’apporte aucun bonus de classe d’armure.`,
        `Sin entrenamiento con escudos: el escudo no da ningún beneficio a la Clase de armadura.`,
        { source: { page: 92, frPage: 98 } },
      ),
    )
  if (now.armor?.def.strength && now.abilities.str.score.total < now.armor.def.strength)
    out.push(
      w(
        'armor-strength',
        'info',
        'inventory',
        `${now.armor.def.name.en} needs Strength ${now.armor.def.strength}: Speed reduced by 10 feet.`,
        `${now.armor.def.name.fr} demande Force ${now.armor.def.strength} : Vitesse réduite de 3 m.`,
        `${esOf(now.armor.def.name)} requiere Fuerza ${now.armor.def.strength}: Velocidad reducida en 3 m.`,
        { source: { page: 92, frPage: 98 } },
      ),
    )
  // Attunement (p. 177): three items at most, one copy of a given item; an attuned item kept in the backpack still counts
  // (the attunement lasts while the item stays within 100 feet for a day).
  const attunedItems = (char.inventory ?? []).filter((i) => i.attuned && i.location !== 'stored')
  const attuneMax = 3 + now.pool.parts('attunement.max').reduce((s, p) => s + p.value, 0)
  if (attunedItems.length > attuneMax)
    out.push(
      w(
        'attunement',
        'error',
        'inventory',
        `Attuned to ${attunedItems.length} items: no more than ${attuneMax} at a time.`,
        `Harmonisé avec ${attunedItems.length} objets : ${attuneMax} au maximum.`,
        `Sintonizado con ${attunedItems.length} objetos: no más de ${attuneMax} a la vez.`,
        { source: { page: 177, frPage: 188 }, actionable: true },
      ),
    )
  const copies = new Map<string, number>()
  // A magic weapon or armor is a copy of its magic item, not of its base item (`magicItemId`).
  for (const i of attunedItems) {
    const key = i.magicItemId ?? i.refId
    if (key) copies.set(key, (copies.get(key) ?? 0) + 1)
  }
  for (const [id, n] of copies)
    if (n > 1)
      out.push(
        w(
          `attune-copy-${id}`,
          'error',
          'inventory',
          `Attuned to ${n} copies of ${rules.magicItems.get(id)?.name.en ?? id}: a creature can be attuned to only one copy of an item.`,
          `Harmonisé avec ${n} exemplaires de ${rules.magicItems.get(id)?.name.fr ?? id} : une créature ne peut être harmonisée qu’avec un seul exemplaire d’un objet.`,
          `Sintonizado con ${n} ejemplares de ${esOf(rules.magicItems.get(id)?.name) || id}: una criatura solo puede sintonizarse con un ejemplar de un objeto.`,
          { source: { page: 177, frPage: 188 }, actionable: true },
        ),
      )
  for (const i of char.inventory ?? []) {
    if (i.attuned) {
      const def = rules.magicItems.get(i.magicItemId ?? i.refId ?? '')
      if (def && !def.attunement)
        out.push(
          w(
            `attune-${i.uid}`,
            'warning',
            'inventory',
            `${def.name.en} doesn't require Attunement.`,
            `${def.name.fr} ne requiert pas d’Harmonisation.`,
            `${esOf(def.name)} no requiere sintonización.`,
            { source: def.source },
          ),
        )
    }
  }
  // Hands (SRD p. 90 "Two-Handed" and "Versatile", p. 92 "Shield"): the weapons and the Shield in hand, a Versatile
  // weapon counting two when the player holds it in two hands (engine/hands.ts), may not need more than two hands.
  // A weapon created by a feature is made when you attack (its text says which hand): not counted here.
  const inHand = now.weapons.filter((x) => !x.item.feature)
  const hands = handsUsed(char, inHand, now.shield)
  if (hands > 2) {
    const held = [
      ...inHand.map((x) => ({ name: x.def.name, n: weaponHands(x.def, char, x.item.uid) })),
      ...(now.shield ? [{ name: now.shield.def.name, n: 1 }] : []),
    ]
    out.push(
      w(
        'hands',
        'warning',
        'combat',
        `Weapons and Shield in hand need ${hands} hands (${held.map((h) => `${h.name.en} ${h.n}`).join(', ')}): you have two.`,
        `Les armes et le bouclier en main demandent ${hands} mains (${held.map((h) => `${h.name.fr} ${h.n}`).join(', ')}) : vous n’en avez que deux.`,
        `Las armas y el escudo en mano requieren ${hands} manos (${held.map((h) => `${esOf(h.name)} ${h.n}`).join(', ')}): solo tienes dos.`,
        {
          source: { page: 90, frPage: 95, section: 'Equipment > Weapons > Properties > Two-Handed' },
          actionable: true,
        },
      ),
    )
  }
  for (const a of now.attacks)
    if (!a.proficient)
      out.push(
        w(
          `weapon-prof-${a.uid}`,
          'info',
          'combat',
          `${a.name.en}: not proficient, no Proficiency Bonus on the attack roll.`,
          `${a.name.fr} : non maîtrisée, pas de bonus de maîtrise au jet d’attaque.`,
          `${esOf(a.name)}: sin competencia, no se suma el bonificador por competencia a la tirada de ataque.`,
          { source: { page: 89, frPage: 95 } },
        ),
      )
  if (now.carry.encumbered)
    out.push(
      w(
        'load',
        'info',
        'inventory',
        `Carrying ${now.carry.load.lb} lb, above the capacity of ${now.carry.capacity.lb} lb.`,
        `Charge de ${now.carry.load.kg} kg, au-delà de la capacité de ${now.carry.capacity.kg} kg.`,
        `Cargas ${now.carry.load.kg} kg, por encima de la capacidad de ${now.carry.capacity.kg} kg.`,
        { source: { page: 178, frPage: 189 } },
      ),
    )
}

// Worn kinds (SRD 5.2.1 p. 103 "Multiple Items of the Same Kind", FR p. 109): one pair of footwear, one pair of gloves or
// gauntlets, one pair of bracers, one suit of armor, one item of headwear, one cloak at a time ("The GM might make
// exceptions": a warning, never a block). The kind is inferred from the item (engine/items.ts `wornKindOf`).
export function checkWornKinds(ctx: CheckContext) {
  const { char, rules, out } = ctx
  const byKind = new Map<WornKind, ItemInstance[]>()
  for (const i of char.inventory ?? []) {
    if (i.location !== 'worn') continue
    const k = wornKindOf(i, rules)
    if (k) byKind.set(k, [...(byKind.get(k) ?? []), i])
  }
  for (const [k, items] of byKind) {
    if (items.length < 2) continue
    const kind = WORN_KINDS.find((x) => x.id === k)!.name
    const names = (l: 'en' | 'fr' | 'es') =>
      items.map((i) => (l === 'es' ? esOf(itemNameOf(i, rules)) : itemNameOf(i, rules)[l])).join(', ')
    out.push(
      w(
        `worn-kind-${k}`,
        'warning',
        'inventory',
        `Two items of the same kind worn (${kind.en}: ${names('en')}): you can't normally wear more than one.`,
        `Deux objets du même type portés (${kind.fr} : ${names('fr')}) : on ne peut normalement en porter qu’un.`,
        `Llevas dos objetos del mismo tipo (${esOf(kind)}: ${names('es')}): normalmente no puedes llevar más de uno.`,
        { source: SRC_WORN_KINDS, actionable: true },
      ),
    )
  }
}

function itemNameOf(i: ItemInstance, rules: CheckContext['rules']) {
  const id = i.refId ?? ''
  const def =
    i.kind === 'weapon'
      ? rules.weapons.get(id)
      : i.kind === 'armor'
        ? rules.armor.get(id)
        : i.kind === 'gear'
          ? rules.gear.get(id)
          : i.kind === 'magic'
            ? rules.magicItems.get(id)
            : undefined
  return i.custom?.name ?? def?.name ?? { en: id || '?', fr: id || '?', es: id || '?' }
}
