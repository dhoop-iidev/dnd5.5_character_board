// Rests (SRD 5.2.1 Rules Glossary p. 187 "Short Rest", p. 185 "Long Rest"). Both need at least 1 Hit Point to start, and
// a dead character isn't revived by resting (p. 180 "Dead").
import type { Character } from '../model/character'
import type { Sheet } from './sheet/types'
import { heal, hpState } from './hitPoints'

export const SRC_SHORT_REST = { page: 187, frPage: 198, section: 'Rules Glossary > Short Rest' }
export const SRC_LONG_REST = { page: 185, frPage: 199, section: 'Rules Glossary > Long Rest' }

/** Can the character start a rest? "To start a Short Rest, you must have at least 1 Hit Point" (p. 187), same for a Long
 * Rest (p. 185); a dead character can't. */
export function canRest(char: Character, sheet: Sheet): boolean {
  return char.hp.current > 0 && hpState(char.hp, sheet.hpMax.total, char.exhaustion).kind !== 'dead'
}

/** Spend Hit Point Dice during a Short Rest: each die rolled + Constitution modifier, minimum 1 HP per die (p. 187). */
export function spendHitDice(char: Character, sheet: Sheet, classId: string, rolls: number[]) {
  const pool = sheet.hitDice.find((h) => h.classId === classId)
  if (!pool) return
  const con = sheet.abilities.con.mod
  let spent = char.hitDiceSpent[classId] ?? 0
  for (const r of rolls) {
    if (spent >= pool.total) break
    spent += 1
    heal(char.hp, Math.max(1, r + con), sheet.hpMax.total)
  }
  char.hitDiceSpent[classId] = spent
}

/** Short Rest: features that recharge on a Short Rest regain their uses (all of them, or the "shortRestRegain" number
 * of a Long-Rest feature such as Rage or Second Wind). Hit Point Dice are spent separately (spendHitDice). Returns false
 * when the character can't rest. */
export function shortRest(char: Character, sheet: Sheet): boolean {
  if (!canRest(char, sheet)) return false
  for (const r of sheet.resources) {
    const spent = char.resources[r.id] ?? 0
    if (!spent) continue
    if (r.per === 'short') delete char.resources[r.id]
    else if (r.shortRestRegain) char.resources[r.id] = Math.max(0, spent - r.shortRestRegain)
  }
  // Warlock Pact Magic slots come back on a Short Rest (SRD p. 71).
  if (sheet.pact) char.pactUsed = 0
  // Ranger Tireless: "whenever you finish a Short Rest, your Exhaustion level, if any, decreases by 1" (p. 58).
  if (sheet.pool.flags.has('tireless') && char.exhaustion > 0) char.exhaustion -= 1
  return true
}

/** Long Rest: all Hit Points and all spent Hit Point Dice, Exhaustion −1, every feature and spell slot (p. 185);
 * Temporary Hit Points end (p. 18 "last until they're depleted or you finish a Long Rest"). Returns false when the
 * character can't rest. */
export function longRest(char: Character, sheet: Sheet): boolean {
  if (!canRest(char, sheet)) return false
  char.hp.current = sheet.hpMax.total
  char.hp.temp = 0
  char.hp.deathSaves = { successes: 0, failures: 0 }
  char.hp.stable = false
  char.hitDiceSpent = {}
  char.resources = {}
  char.slotsUsed = []
  char.pactUsed = 0
  // Feat and species spells can be cast without a slot again (Elven Lineage p. 84, Fiendish Legacy p. 86, Magic
  // Initiate p. 87: "you regain the ability to cast it in that way when you finish a Long Rest").
  char.freeCasts = []
  if (char.exhaustion > 0) char.exhaustion -= 1
  // Timed effects end with the day; conditions set by hand stay (the GM decides).
  char.activeEffects = char.activeEffects.filter((e) => e.rounds === undefined)
  for (const e of char.activeEffects) if (e.tempHp) e.tempHp = 0
  char.concentration = undefined
  // Human Resourceful: "You gain Heroic Inspiration whenever you finish a Long Rest" (p. 86).
  if (sheet.pool.flags.has('resourceful')) char.heroicInspiration = true
  return true
}
