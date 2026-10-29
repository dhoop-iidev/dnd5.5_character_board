// The "Your turn" box (engine/turn.ts): one action, one Bonus Action, one Reaction and a move per turn (SRD 5.2.1 p. 10,
// p. 13); Action Surge (p. 48: one more action, not Magic); Haste (p. 139: one more action, Attack with one attack, Dash,
// Disengage, Hide or Utilize; Speed doubled); Extra Attack; the Light extra attack (p. 89) and Nick (p. 90); Dash; options
// from features with their uses and switches; spells by casting time; potions (p. 204); undo.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { Character } from '../../model/character'
import { migrate } from '../../model/migrate'
import { compute } from '../compute'
import {
  actionBlocker,
  actionSlots,
  attackCapacity,
  attackWith,
  castableSpells,
  castInTurn,
  lightDamageBonus,
  lightExtra,
  lightExtraAttacks,
  move,
  movement,
  newTurn,
  potions,
  standUp,
  takeAction,
  turnOf,
  turnOptions,
  undoStep,
  useOption,
} from '../turn'

const example = (file: string): Character =>
  migrate(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', file), 'utf8')))
const L = { en: 'x', fr: 'x', es: 'x' }

describe('one action per turn', () => {
  it('a second action is refused, a new turn gives it back', () => {
    const c = example('guerrier-niveau-10.json')
    const sheet = compute(c, rules)
    expect(actionBlocker(c, sheet, rules, 'dash')).toBeUndefined()
    takeAction(c, 'dash', L)
    expect(actionBlocker(c, sheet, rules, 'dodge')?.en).toMatch(/no action left/)
    newTurn(c)
    expect(actionBlocker(c, sheet, rules, 'dodge')).toBeUndefined()
  })

  it('Extra Attack: one Attack action gives the attacks of the sheet', () => {
    const c = example('guerrier-niveau-10.json')
    const sheet = compute(c, rules)
    expect(sheet.attacksPerAction).toBe(2)
    attackWith(c, sheet, rules, sheet.attacks[0], L)
    expect(turnOf(c).actions).toEqual(['attack'])
    expect(attackCapacity(c, sheet, rules)).toBe(2)
    attackWith(c, sheet, rules, sheet.attacks[0], L)
    expect(turnOf(c).actions).toEqual(['attack'])
    expect(turnOf(c).attacks).toBe(2)
  })
})

describe('extra actions', () => {
  it('Action Surge: one more action, not Magic, its use spent, undone', () => {
    const c = example('guerrier-niveau-10.json')
    let sheet = compute(c, rules)
    const surge = turnOptions(c, sheet).find((o) => o.ownerId === 'fighter:action-surge')!
    expect(surge.kind).toBe('free')
    takeAction(c, 'attack', L)
    useOption(c, surge, L)
    sheet = compute(c, rules)
    expect(c.resources['fighter:action-surge']).toBe(1)
    expect(actionSlots(c, rules).map((s) => s.id)).toEqual(['main', 'surge'])
    // The Magic action can still go in the normal action, the Attack moving to the surge…
    expect(actionBlocker(c, sheet, rules, 'magic')).toBeUndefined()
    takeAction(c, 'attack', L)
    expect(attackCapacity(c, sheet, rules)).toBe(4)
    undoStep(c)
    undoStep(c)
    undoStep(c)
    expect(turnOf(c).actions).toEqual([])
    expect(c.resources['fighter:action-surge']).toBe(0)
    expect(actionSlots(c, rules).map((s) => s.id)).toEqual(['main'])
  })

  it('Action Surge is never a second Magic action', () => {
    const c = example('guerrier-niveau-10.json')
    const sheet = compute(c, rules)
    useOption(
      c,
      turnOptions(c, sheet).find((o) => o.ownerId === 'fighter:action-surge')!,
      L,
    )
    takeAction(c, 'magic', L)
    expect(actionBlocker(c, sheet, rules, 'magic')?.en).toMatch(/Magic/)
    expect(actionBlocker(c, sheet, rules, 'dash')).toBeUndefined()
  })

  it('Haste: one more action limited to Attack (one attack), Dash, Disengage, Hide, Utilize; Speed doubled', () => {
    const c = example('guerrier-niveau-10.json')
    const sheet = compute(c, rules)
    c.activeEffects.push({ uid: 'h', kind: 'spell', refId: 'haste', enabled: true, rounds: 10 })
    takeAction(c, 'dodge', L)
    expect(actionBlocker(c, sheet, rules, 'help')).toBeDefined()
    expect(actionBlocker(c, sheet, rules, 'attack')).toBeUndefined()
    takeAction(c, 'attack', L)
    expect(attackCapacity(c, sheet, rules)).toBe(1)
    expect(movement(c, sheet).total).toBe(sheet.speed.total * 2)
    // With the Attack action in the main slot, the hasted Dodge fits too: the placement keeps the most attacks.
    newTurn(c)
    takeAction(c, 'attack', L)
    takeAction(c, 'dash', L)
    expect(attackCapacity(c, sheet, rules)).toBe(2)
    expect(movement(c, sheet).total).toBe(sheet.speed.total * 2 * 2)
  })
})

describe('movement', () => {
  it('moving is a choice, not a distance; Dash adds the Speed; standing up removes Prone, undone', () => {
    const c = example('guerrier-niveau-10.json')
    const sheet = compute(c, rules)
    const speed = sheet.speed.total
    c.conditions.push('prone')
    standUp(c, L)
    expect(c.conditions).not.toContain('prone')
    expect(turnOf(c).moved).toBe(true)
    takeAction(c, 'dash', L)
    expect(movement(c, sheet).total).toBe(speed * 2)
    undoStep(c)
    undoStep(c)
    expect(c.conditions).toContain('prone')
    expect(turnOf(c).moved).toBe(false)
    move(c, L)
    expect(turnOf(c).moved).toBe(true)
  })
})

describe('features, traits and feats', () => {
  it('Rage: a Bonus Action that spends a use and turns the Rage switch on, then only Extend Rage is offered', () => {
    const c = example('barbare-niveau-10.json')
    let sheet = compute(c, rules)
    const rage = turnOptions(c, sheet).filter((o) => o.ownerId === 'barbarian:rage')
    expect(rage.map((o) => o.name.en)).toEqual(['Rage'])
    useOption(c, rage[0], L)
    expect(c.toggles.rage).toBe(true)
    expect(c.resources['barbarian:rage']).toBe(1)
    expect(turnOf(c).bonus).toBe(`use:${rage[0].key}`)
    sheet = compute(c, rules)
    const after = turnOptions(c, sheet).filter((o) => o.ownerId === 'barbarian:rage')
    expect(after.map((o) => o.name.en)).toEqual(['Extend Rage'])
    expect(after[0].cost).toBeUndefined()
    undoStep(c)
    expect(c.toggles.rage).toBe(false)
    expect(c.resources['barbarian:rage']).toBe(0)
  })

  it('Cunning Action: Dash as a Bonus Action adds the Speed', () => {
    const c = example('voleuse-niveau-10.json')
    const sheet = compute(c, rules)
    const ca = turnOptions(c, sheet).find((o) => o.ownerId === 'rogue:cunning-action')!
    expect(ca.activation.actions).toEqual(['dash', 'disengage', 'hide'])
    useOption(c, ca, L, 'dash')
    expect(turnOf(c).bonus).toBe(`use:${ca.key}>dash`)
    expect(movement(c, sheet).total).toBe(sheet.speed.total * 2)
    expect(turnOf(c).actions).toEqual([])
    // Undo gives the Bonus Action back (the snapshot had no `bonus` field).
    undoStep(c)
    expect(turnOf(c).bonus).toBeUndefined()
    expect(movement(c, sheet).total).toBe(sheet.speed.total)
  })

  it('undo gives the Reaction back', () => {
    const c = example('voleuse-niveau-10.json')
    const sheet = compute(c, rules)
    const ud = turnOptions(c, sheet).find((o) => o.ownerId === 'rogue:uncanny-dodge')!
    useOption(c, ud, L)
    expect(turnOf(c).reaction).toBe(`use:${ud.key}`)
    undoStep(c)
    expect(turnOf(c).reaction).toBeUndefined()
  })

  it('a feature with no use left is offered but blocked', () => {
    const c = example('guerrier-niveau-10.json')
    c.resources['fighter:second-wind'] = 99
    const sheet = compute(c, rules)
    const sw = turnOptions(c, sheet).find((o) => o.ownerId === 'fighter:second-wind')!
    expect(sw.kind).toBe('bonus-action')
    expect(sw.blocked?.en).toMatch(/no use left/)
  })
})

describe('Light weapons', () => {
  it('after an Attack-action attack with a Light weapon, the other Light weapon can make the extra attack', () => {
    const c = example('voleuse-niveau-10.json')
    const sheet = compute(c, rules)
    const light = sheet.attacks.filter((a) => a.weapon.properties.includes('light'))
    expect(light.length).toBe(2)
    expect(lightExtraAttacks(c, sheet)).toEqual([])
    attackWith(c, sheet, rules, light[0], L)
    const extra = lightExtraAttacks(c, sheet)
    expect(extra.map((x) => x.line.uid)).toEqual([light[1].uid])
    // No ability modifier to the extra attack's damage unless negative (p. 89).
    const ability = light[1].damage.bonus.parts.find((p) => p.sourceId === 'ability')!.value
    expect(lightDamageBonus(light[1], sheet)).toBe(light[1].damage.bonus.total - Math.max(0, ability))
    lightExtra(c, extra[0].nick, L)
    expect(lightExtraAttacks(c, sheet)).toEqual([])
    expect(turnOf(c).bonus).toBe(extra[0].nick ? undefined : 'light-attack')
  })
})

describe('spells and potions', () => {
  it('spells are listed by casting time; a slot spent is noted', () => {
    const c = example('clerc-niveau-10.json')
    const sheet = compute(c, rules)
    const bonus = castableSpells(sheet, rules, 'bonus-action')
    expect(bonus.every((x) => x.spell.castingKind === 'bonus-action')).toBe(true)
    const action = castableSpells(sheet, rules, 'action')
    expect(action.length).toBeGreaterThan(0)
    castInTurn(c, 'action', true, L, undefined)
    expect(turnOf(c).actions).toEqual(['magic'])
    expect(turnOf(c).slotSpent).toBe(true)
  })

  it('potions carried are found; stored ones are not', () => {
    const c = example('guerrier-niveau-10.json')
    c.inventory.push(
      { uid: 'p1', kind: 'gear', refId: 'potion-of-healing', quantity: 2, location: 'carried' },
      { uid: 'p2', kind: 'magic', refId: 'potion-of-speed', quantity: 1, location: 'stored' },
      { uid: 'p3', kind: 'magic', refId: 'potion-of-speed', quantity: 1, location: 'worn' },
    )
    expect(potions(c, rules).map((i) => i.uid)).toEqual(['p1', 'p3'])
  })
})
