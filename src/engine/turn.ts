// The turn at the table (Combat pane "Your turn" box). SRD 5.2.1 p. 13 "Your Turn" (FR p. 14): move up to your Speed and
// take one action, in either order; communicate briefly and interact with one object for free (a second object needs
// the Utilize action). p. 10 "Bonus Actions" (FR p. 10): only when a feature, spell or ability grants one, one per turn.
// p. 10 "Reactions" (FR p. 11): one per round, back at the start of your turn. p. 14 "Breaking Up Your Move" (FR p. 15):
// movement can be split around the action, Bonus Action and Reaction. Extra actions: Action Surge (p. 48: one more
// action, not the Magic action, once per turn) and Haste (p. 139: one more action, only Attack with one attack, Dash,
// Disengage, Hide or Utilize; Potion of Speed p. 236 gives Haste's effects). Light property (p. 89): after an Attack
// action with a Light weapon, one extra attack with a different Light weapon as a Bonus Action, no ability modifier to
// its damage unless negative; Nick (p. 90) makes it part of the Attack action, once per turn. Potions: a Bonus Action
// to drink (p. 204 "Potions", FR p. 215); other magic items: usually a Magic action (p. 206 "Activating a Magic Item").
// One spell slot per turn (p. 105).
import type { Rules } from '../data/rules'
import type { ActivationDef, I18n, SpellDef, Source } from '../data/types'
import type { ActiveEffect, Character, ItemInstance, TurnState, TurnUndo } from '../model/character'
import type { AttackLine, Sheet } from './sheet/types'
import { magicItemOf } from './items'

export const SRC_YOUR_TURN: Source = { page: 13, frPage: 14, esPage: 14, section: 'Playing the Game > Your Turn' }
export const SRC_BONUS_ACTIONS: Source = {
  page: 10,
  frPage: 10,
  esPage: 11,
  section: 'Playing the Game > Bonus Actions',
}
export const SRC_REACTIONS: Source = { page: 10, frPage: 11, esPage: 11, section: 'Playing the Game > Reactions' }
export const SRC_BREAKING_UP: Source = {
  page: 14,
  frPage: 15,
  esPage: 15,
  section: 'Playing the Game > Breaking Up Your Move',
}
export const SRC_POTIONS: Source = { page: 204, frPage: 215, esPage: 216, section: 'Magic Items > Potions' }
export const SRC_ACTIVATING: Source = {
  page: 206,
  frPage: 217,
  esPage: 225,
  section: 'Magic Items > Activating a Magic Item',
}
export const SRC_LIGHT: Source = { page: 89, frPage: 95, esPage: 97, section: 'Equipment > Weapons > Light' }
export const SRC_NICK: Source = { page: 90, frPage: 96, esPage: 98, section: 'Equipment > Weapons > Nick' }
export const SRC_PRONE: Source = { page: 186, frPage: 187, esPage: 199, section: 'Rules Glossary > Prone' }

/** The twelve actions of the Rules Glossary, the five a new player needs most first (the rest fold away). */
export const MAIN_ACTIONS = ['attack', 'magic', 'dash', 'disengage', 'dodge'] as const
export const OTHER_ACTIONS = ['help', 'hide', 'influence', 'ready', 'search', 'study', 'utilize'] as const
export const STANDARD_ACTIONS: readonly string[] = [...MAIN_ACTIONS, ...OTHER_ACTIONS]
/** Cards of the box with a one-line summary `action:<id>` in custom/summaries.json. */
export const TURN_CARDS: readonly string[] = [
  ...STANDARD_ACTIONS,
  'opportunity-attacks',
  'light-attack',
  'potion',
  'object',
  'stand-up',
  'move',
]

/** Haste's extra action: Attack (one attack only), Dash, Disengage, Hide or Utilize (p. 139). */
const HASTE_ACTIONS = ['attack', 'dash', 'disengage', 'hide', 'utilize']

export function emptyTurn(): TurnState {
  return { actions: [], object: false, moved: false, attacks: 0, surge: false, slotSpent: false, undo: [] }
}

/** The character's turn state, created when missing (for the steps, which change it). */
export function turnOf(char: Character): TurnState {
  return (char.turn ??= emptyTurn())
}

/** The turn state to read, without creating it (safe inside derived values). */
export function peekTurn(char: Character): TurnState {
  return char.turn ?? emptyTurn()
}

/** Start a new turn: everything is back (the Reaction comes back at the start of your turn, p. 10). */
export function newTurn(char: Character) {
  char.turn = emptyTurn()
}

// ---------- actions ----------

export interface ActionSlot {
  id: 'main' | 'surge' | 'haste'
  label: I18n
  /** Can this action go in this slot? ('use:<key>' actions are features: any slot but Haste's.) */
  allows: (action: string) => boolean
  /** Attacks one Attack action makes in this slot. */
  attacks: (sheet: Sheet) => number
  source?: Source
}

/** Haste is on the character: an enabled spell effect (cast on yourself, or a Potion of Speed). */
export function hasted(char: Character): ActiveEffect | undefined {
  return char.activeEffects.find((e) => e.enabled && e.refId === 'haste')
}

/** Which standard action a taken action counts as ('use:<key>|magic' → 'magic'). */
const baseAction = (a: string) => (a.startsWith('use:') ? (a.split('|')[1] ?? 'feature') : a)

export function actionSlots(char: Character, rules: Rules): ActionSlot[] {
  const turn = peekTurn(char)
  const slots: ActionSlot[] = [
    {
      id: 'main',
      label: { en: 'Action', fr: 'Action', es: 'Acción' },
      allows: () => true,
      attacks: (s) => s.attacksPerAction,
      source: SRC_YOUR_TURN,
    },
  ]
  if (turn.surge)
    slots.push({
      id: 'surge',
      label: { en: 'Action Surge', fr: 'Sursaut d’action', es: 'Acción súbita' },
      allows: (a) => baseAction(a) !== 'magic',
      attacks: (s) => s.attacksPerAction,
      source: { page: 48, frPage: 57, esPage: 63, section: 'Classes > Fighter Class Features > Level 2: Action Surge' },
    })
  if (hasted(char))
    slots.push({
      id: 'haste',
      label: rules.spells.get('haste')?.name ?? { en: 'Haste', fr: 'Hâte', es: 'Acelerar' },
      allows: (a) => HASTE_ACTIONS.includes(a),
      attacks: () => 1,
      source: rules.spells.get('haste')?.source,
    })
  return slots
}

/** Places the actions in the slots (every order is tried; at most three slots). Returns the slot of each action, the
 * placement giving the most attacks, or undefined when they don't fit. */
export function placeActions(actions: string[], slots: ActionSlot[], sheet: Sheet): ActionSlot[] | undefined {
  if (actions.length > slots.length) return undefined
  let best: ActionSlot[] | undefined
  let bestAttacks = -1
  const permute = (left: ActionSlot[], chosen: ActionSlot[]) => {
    if (chosen.length === actions.length) {
      const n = chosen.reduce((t, s, i) => t + (actions[i] === 'attack' ? s.attacks(sheet) : 0), 0)
      if (n > bestAttacks) {
        bestAttacks = n
        best = [...chosen]
      }
      return
    }
    for (const s of left)
      if (s.allows(actions[chosen.length]))
        permute(
          left.filter((x) => x !== s),
          [...chosen, s],
        )
  }
  permute(slots, [])
  return best
}

/** Why this action can't be taken now (undefined = it can). */
export function actionBlocker(char: Character, sheet: Sheet, rules: Rules, action: string): I18n | undefined {
  const turn = peekTurn(char)
  const slots = actionSlots(char, rules)
  if (placeActions([...turn.actions, action], slots, sheet)) return undefined
  if (turn.actions.length >= slots.length)
    return { en: 'no action left this turn', fr: 'plus d’action ce tour-ci', es: 'no te quedan acciones este turno' }
  return baseAction(action) === 'magic'
    ? {
        en: 'Action Surge can’t be a Magic action',
        fr: 'le Sursaut d’action ne peut pas servir à l’action Magie',
        es: 'la Acción súbita no puede ser la acción de Magia',
      }
    : {
        en: 'Haste’s action can’t do that',
        fr: 'l’action de Hâte ne le permet pas',
        es: 'la acción de Acelerar no lo permite',
      }
}

/** Attacks the Attack actions taken so far allow. */
export function attackCapacity(char: Character, sheet: Sheet, rules: Rules): number {
  const turn = peekTurn(char)
  const place = placeActions(turn.actions, actionSlots(char, rules), sheet)
  if (!place) return 0
  return place.reduce((n, s, i) => n + (turn.actions[i] === 'attack' ? s.attacks(sheet) : 0), 0)
}

/** Actions not yet taken this turn. */
export function actionsLeft(char: Character, rules: Rules): number {
  return Math.max(0, actionSlots(char, rules).length - peekTurn(char).actions.length)
}

// ---------- movement ----------

/** Dash taken this turn (as an action, or as a Bonus Action through a feature: 'use:<key>>dash'). */
function dashes(turn: TurnState): number {
  const all = [...turn.actions, turn.bonus ?? '']
  return all.filter((a) => a === 'dash' || a.endsWith('>dash')).length
}

/** Speed this turn: the sheet's Speed (doubled by Haste, p. 139), plus the Speed again for each Dash (Rules Glossary
 * "Dash"). */
export function movement(char: Character, sheet: Sheet): { speed: number; total: number } {
  const turn = peekTurn(char)
  const speed = sheet.speed.total * (hasted(char) ? 2 : 1)
  const total = speed * (1 + dashes(turn))
  return { speed, total }
}

// ---------- options from features, traits, feats and items ----------

export interface TurnOption {
  /** Unique key: '<owner id>#<index>'. */
  key: string
  ownerId: string
  kind: ActivationDef['kind']
  name: I18n
  text?: I18n
  source?: Source
  activation: ActivationDef
  /** Resource spent and what is left. */
  cost?: { resource: string; amount: number; left: number; name: I18n }
  /** Why it can't be used now (undefined = it can). */
  blocked?: I18n
  /** An inventory item (magic item owner) and its effect entry id ('item:<magic item id>', its summary key). */
  itemUid?: string
  effectId?: string
}

function holds(char: Character, when: string | undefined): boolean {
  if (!when) return true
  const neg = when.startsWith('!')
  const w = neg ? when.slice(1) : when
  const on = w.startsWith('toggle:') ? !!char.toggles[w.slice('toggle:'.length)] : true
  return neg ? !on : on
}

/** The ways the character's features, traits, feats and active items can be used this turn. */
export function turnOptions(char: Character, sheet: Sheet): TurnOption[] {
  const out: TurnOption[] = []
  for (const o of sheet.owners) {
    const acts = o.eff.activation ?? o.effect?.activation
    if (!acts?.length) continue
    acts.forEach((a, i) => {
      if (a.minLevel && sheet.level < a.minLevel) return
      if (!holds(char, a.when)) return
      // A cost of 0 spends nothing (extending a Rage, leaving Wild Shape early, Lay On Hands' variable pool).
      const resId = a.cost?.amount === 0 ? undefined : (a.cost?.resource ?? (o.eff.uses ? o.id : undefined))
      let cost: TurnOption['cost']
      let blocked: I18n | undefined
      if (resId) {
        const r = sheet.resources.find((x) => x.id === resId)
        const amount = a.cost?.amount ?? 1
        const left = r ? Math.max(0, r.max - r.spent) : 0
        cost = { resource: resId, amount, left, name: r?.name ?? o.name }
        if (left < amount) blocked = { en: 'no use left', fr: 'plus d’utilisation', es: 'no quedan usos' }
      }
      if (a.setsToggle && char.toggles[a.setsToggle]) blocked = { en: 'already on', fr: 'déjà actif', es: 'ya activo' }
      out.push({
        key: `${o.id}#${i}`,
        ownerId: o.id,
        kind: a.kind,
        name: a.name ?? o.name,
        text: o.text,
        source: o.source,
        activation: a,
        cost,
        blocked,
        itemUid: o.itemUid,
        effectId: o.effectId,
      })
    })
  }
  return out
}

// ---------- spells ----------

export interface CastableSpell {
  spell: SpellDef
  classId?: string
  pactFirst: boolean
}

/** Spells the character can cast with this casting time: prepared, always prepared, cantrips, and those granted by
 * feats and traits. */
export function castableSpells(sheet: Sheet, rules: Rules, kind: SpellDef['castingKind']): CastableSpell[] {
  const out: CastableSpell[] = []
  const seen = new Set<string>()
  const add = (id: string, classId: string | undefined, pactFirst: boolean) => {
    const s = rules.spells.get(id)
    const k = `${classId ?? ''}:${id}`
    if (!s || s.castingKind !== kind || seen.has(k)) return
    seen.add(k)
    out.push({ spell: s, classId, pactFirst })
  }
  for (const sc of sheet.spellcasting)
    for (const id of [...sc.cantrips, ...sc.alwaysPrepared, ...sc.prepared]) add(id, sc.classId, sc.kind === 'pact')
  for (const x of sheet.extraSpells) for (const id of x.spells) add(id, undefined, false)
  return out.sort((a, b) => a.spell.level - b.spell.level || a.spell.name.en.localeCompare(b.spell.name.en))
}

// ---------- potions ----------

/** Potions the character carries (worn or in the backpack): magic potions and the Potion of Healing of the gear list. */
export function potions(char: Character, rules: Rules): ItemInstance[] {
  return char.inventory.filter(
    (i) =>
      i.location !== 'stored' &&
      i.quantity > 0 &&
      (magicItemOf(i, rules)?.kind === 'potion' || (i.kind === 'gear' && i.refId === 'potion-of-healing')),
  )
}

// ---------- attacks ----------

const isLight = (a: AttackLine) => a.weapon.properties.includes('light')

/** The Light extra attack's weapons: a different Light weapon in hand, once an Attack-action attack was made with a
 * Light weapon. `nick`: it is part of the Attack action (Nick mastery of that weapon), not a Bonus Action. */
export function lightExtraAttacks(char: Character, sheet: Sheet): { line: AttackLine; nick: boolean }[] {
  const turn = peekTurn(char)
  if (!turn.lightAttack || turn.lightExtraDone) return []
  return sheet.attacks
    .filter((a) => isLight(a) && a.uid !== turn.lightAttack)
    .map((line) => ({ line, nick: line.mastery.id === 'nick' && line.mastery.usable }))
}

/** Damage bonus of the Light extra attack: the ability modifier is left out unless negative (p. 89); the Two-Weapon
 * Fighting feat adds it back (p. 88). */
export function lightDamageBonus(line: AttackLine, sheet: Sheet): number {
  const ability = line.damage.bonus.parts.find((p) => p.sourceId === 'ability')?.value ?? 0
  const twf = sheet.owners.some((o) => o.id === 'feat:two-weapon-fighting')
  return twf || ability < 0 ? line.damage.bonus.total : line.damage.bonus.total - ability
}

// ---------- steps (each one can be undone) ----------

function snapshot(turn: TurnState): Omit<TurnState, 'undo'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { undo, ...rest } = turn
  return JSON.parse(JSON.stringify(rest))
}

function step(
  char: Character,
  label: I18n,
  change: (t: TurnState) => void,
  extra: Omit<TurnUndo, 'label' | 'before'> = {},
) {
  const turn = turnOf(char)
  const before = snapshot(turn)
  change(turn)
  turn.undo.push({ label, before, ...extra })
}

/** Take a standard action (Dash, Dodge…, or the Attack action before the attacks). */
export function takeAction(char: Character, action: string, label: I18n) {
  step(char, label, (t) => {
    t.actions.push(action)
  })
}

/** Spend the Bonus Action or the Reaction on something. */
export function spend(
  char: Character,
  part: 'bonus' | 'reaction',
  what: string,
  label: I18n,
  extra: Omit<TurnUndo, 'label' | 'before'> = {},
) {
  step(
    char,
    label,
    (t) => {
      t[part] = what
    },
    extra,
  )
}

export function useObject(char: Character, label: I18n) {
  step(char, label, (t) => {
    t.object = true
  })
}

/** The player moves this turn: up to the movement limit, split as they like (p. 14 "Breaking Up Your Move"). */
export function move(char: Character, label: I18n) {
  step(char, label, (t) => {
    t.moved = true
  })
}

/** Stand up from Prone: it costs half your Speed (Rules Glossary "Prone"); the rest of the move is still there. */
export function standUp(char: Character, label: I18n) {
  step(
    char,
    label,
    (t) => {
      t.moved = true
    },
    { condition: 'prone' },
  )
  char.conditions = char.conditions.filter((c) => c !== 'prone')
}

/** One attack of the Attack action (taking the action first when no attack is left). */
export function attackWith(char: Character, sheet: Sheet, rules: Rules, line: AttackLine | undefined, label: I18n) {
  const turn = turnOf(char)
  const needAction = turn.attacks >= attackCapacity(char, sheet, rules)
  step(char, label, (t) => {
    if (needAction) t.actions.push('attack')
    t.attacks += 1
    if (line && isLight(line) && !t.lightAttack) t.lightAttack = line.uid
  })
}

/** The Light extra attack: a Bonus Action, or part of the Attack action with Nick. */
export function lightExtra(char: Character, nick: boolean, label: I18n) {
  step(char, label, (t) => {
    t.lightExtraDone = true
    if (!nick) t.bonus = 'light-attack'
  })
}

/** Use a feature, trait, feat or item: its part of the turn, its uses, its switch. `sub` = the standard action it
 * lets you take (Cunning Action → 'dash'). */
export function useOption(char: Character, opt: TurnOption, label: I18n, sub?: string) {
  const a = opt.activation
  const what = `use:${opt.key}${sub ? `>${sub}` : ''}`
  const extra: Omit<TurnUndo, 'label' | 'before'> = {}
  if (opt.cost) {
    char.resources[opt.cost.resource] = (char.resources[opt.cost.resource] ?? 0) + opt.cost.amount
    extra.resource = { id: opt.cost.resource, amount: opt.cost.amount }
  }
  if (a.setsToggle) {
    char.toggles[a.setsToggle] = true
    extra.toggle = a.setsToggle
  }
  step(
    char,
    label,
    (t) => {
      if (a.extraAction) t.surge = true
      if (a.kind === 'action') t.actions.push(sub ?? (a.action ? `use:${opt.key}|${a.action}` : what))
      else if (a.kind === 'bonus-action') t.bonus = what
      else if (a.kind === 'reaction') t.reaction = what
      else if (a.kind === 'attack') t.attacks += 1
    },
    extra,
  )
}

/** Record a spell cast from the turn box: its part of the turn and the slot spent. */
export function castInTurn(
  char: Character,
  kind: SpellDef['castingKind'],
  slotUsed: boolean,
  label: I18n,
  cast: TurnUndo['cast'],
) {
  step(
    char,
    label,
    (t) => {
      if (kind === 'action') t.actions.push('magic')
      else if (kind === 'bonus-action') t.bonus = 'spell'
      else if (kind === 'reaction') t.reaction = 'spell'
      if (slotUsed) t.slotSpent = true
    },
    { cast },
  )
}

/** Undo the last step: the turn as it was, and the uses, switch, condition, spell and item it spent. Returns its label. */
export function undoStep(char: Character, undoCast?: (u: NonNullable<TurnUndo['cast']>) => void): I18n | undefined {
  const turn = turnOf(char)
  const u = turn.undo.pop()
  if (!u) return undefined
  // The snapshot leaves out the fields that were unset (JSON drops undefined): clear them before restoring, or a spent
  // Bonus Action or Reaction would stay spent.
  for (const k of Object.keys(turn) as (keyof TurnState)[]) if (k !== 'undo' && !(k in u.before)) delete turn[k]
  Object.assign(turn, u.before)
  if (u.resource) char.resources[u.resource.id] = Math.max(0, (char.resources[u.resource.id] ?? 0) - u.resource.amount)
  if (u.toggle) char.toggles[u.toggle] = false
  if (u.condition && !char.conditions.includes(u.condition)) char.conditions.push(u.condition)
  if (u.cast && undoCast) undoCast(u.cast)
  if (u.item) {
    const item = char.inventory.find((i) => i.uid === u.item)
    if (item) item.quantity += 1
  }
  return u.label
}
