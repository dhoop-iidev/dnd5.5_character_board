// Hit points at the table (SRD 5.2.1 p. 17–19 "Damage and Healing"): damage, healing, Temporary Hit Points, dropping to
// 0 Hit Points, Death Saving Throws, instant death, stabilising.
import type { I18n } from '../data/types'
import type { ActiveEffect, HitPointState } from '../model/character'
import { i18n } from './stacking'

export const SRC_HP = { page: 17, frPage: 17, section: 'Playing the Game > Damage and Healing' }
export const SRC_ZERO = { page: 18, frPage: 18, section: 'Playing the Game > Dropping to 0 Hit Points' }
export const SRC_TEMP = { page: 19, frPage: 19, section: 'Playing the Game > Temporary Hit Points' }

export interface DamageResult {
  /** Damage that got past Temporary Hit Points and the current Hit Points (SRD p. 18: instant death when the remaining
   * damage equals or exceeds the Hit Point maximum). */
  excess: number
  dead: boolean
}

/** Take damage: Temporary Hit Points absorb it first (p. 19); at 0 HP any damage is a failed Death Saving Throw, two on a
 * Critical Hit (p. 18); instant death when the damage left after reaching 0 is at least the Hit Point maximum. */
export function takeDamage(
  hp: HitPointState,
  n: number,
  max: number,
  opts: { critical?: boolean; effects?: ActiveEffect[] } = {},
): DamageResult {
  if (n <= 0) return { excess: 0, dead: false }
  const wasZero = hp.current <= 0
  const fromTemp = Math.min(hp.temp, n)
  hp.temp -= fromTemp
  let left = n - fromTemp
  // The effect that granted the temporary hit points loses them (they don't add up: one source at a time, p. 19).
  if (fromTemp && opts.effects) for (const e of opts.effects) if (e.tempHp) e.tempHp = Math.max(0, e.tempHp - fromTemp)
  const absorbed = Math.min(hp.current, left)
  hp.current -= absorbed
  left -= absorbed
  let dead = false
  if (hp.current <= 0) {
    hp.stable = false
    if (left >= max && max > 0) {
      dead = true // p. 18 "Instant Death"
      hp.deathSaves.failures = 3 // recorded as three failures so the sheet shows the character as dead
    } else if (wasZero) {
      hp.deathSaves.failures = Math.min(3, hp.deathSaves.failures + (opts.critical ? 2 : 1)) // p. 18 "Damage at 0 Hit Points"
      if (hp.deathSaves.failures >= 3) dead = true
    }
  }
  return { excess: left, dead }
}

/** Healing can't exceed the Hit Point maximum (p. 18); regaining Hit Points ends the dying state and resets death saves. */
export function heal(hp: HitPointState, n: number, max: number) {
  if (n <= 0) return
  // A dead creature can't regain Hit Points unless revived by magic (Rules Glossary "Dead", p. 180): the GM revives it.
  if (hp.deathSaves.failures >= 3) return
  hp.current = Math.min(max, hp.current + n)
  if (hp.current > 0) {
    hp.deathSaves = { successes: 0, failures: 0 }
    hp.stable = false
  }
}

/** Temporary Hit Points don't add together: keep the higher value (p. 19). */
export function grantTempHp(hp: HitPointState, n: number): boolean {
  if (n > hp.temp) {
    hp.temp = n
    return true
  }
  return false
}

/** A Death Saving Throw result (p. 18): 10+ success, else failure; natural 20 = regain 1 HP; natural 1 = two failures.
 * `modifier` is what applies to the roll (a saving throw is a D20 Test: Exhaustion −2 × level, p. 181; bonuses to all
 * saving throws); the 1 and the 20 are read on the die. */
export function deathSave(hp: HitPointState, roll: number, modifier = 0): 'alive' | 'stable' | 'dead' | 'ongoing' {
  if (roll === 20) {
    hp.current = 1
    hp.deathSaves = { successes: 0, failures: 0 }
    return 'alive'
  }
  if (roll === 1) hp.deathSaves.failures += 2
  else if (roll + modifier >= 10) hp.deathSaves.successes += 1
  else hp.deathSaves.failures += 1
  if (hp.deathSaves.failures >= 3) return 'dead'
  if (hp.deathSaves.successes >= 3) {
    hp.stable = true
    hp.deathSaves = { successes: 0, failures: 0 }
    return 'stable'
  }
  return 'ongoing'
}

export interface HpState {
  kind: 'ok' | 'bloodied' | 'unconscious' | 'stable' | 'dead'
  text?: I18n
}

/** Bloodied at half HP or fewer (Rules Glossary p. 177); 0 HP = Unconscious and dying unless Stable (p. 18); dead at three
 * failed Death Saving Throws or instant death (p. 18), or at Exhaustion level 6 (p. 181). */
export function hpState(hp: HitPointState, max: number, exhaustion = 0): HpState {
  if (exhaustion >= 6)
    return {
      kind: 'dead',
      text: i18n('Dead (Exhaustion level 6)', 'Mort (niveau d’Épuisement 6)', 'Muerto (Cansancio de nivel 6)'),
    }
  if (hp.deathSaves.failures >= 3)
    return {
      kind: 'dead',
      text: i18n(
        'Dead (three failed Death Saving Throws, or instant death)',
        'Mort (trois échecs aux jets de sauvegarde contre la mort, ou mort instantanée)',
        'Muerto (tres fallos en las tiradas de salvación contra muerte, o muerte instantánea)',
      ),
    }
  if (hp.current <= 0) {
    if (hp.stable)
      return {
        kind: 'stable',
        text: i18n(
          'Stable: Unconscious at 0 HP, no Death Saving Throws; regains 1 HP after 1d4 hours',
          'Stable : Inconscient à 0 PV, pas de jet de sauvegarde contre la mort ; regagne 1 PV après 1d4 heures',
          'Estable: Inconsciente a 0 PG, sin tiradas de salvación contra muerte; recupera 1 PG tras 1d4 horas',
        ),
      }
    return {
      kind: 'unconscious',
      text: i18n(
        '0 HP: Unconscious, make a Death Saving Throw at the start of each turn',
        '0 PV : Inconscient, jet de sauvegarde contre la mort au début de chaque tour',
        '0 PG: Inconsciente, haz una tirada de salvación contra muerte al principio de cada turno',
      ),
    }
  }
  if (hp.current * 2 <= max)
    return {
      kind: 'bloodied',
      text: i18n(
        'Bloodied (half Hit Points or fewer)',
        'En sang (moitié des points de vie ou moins)',
        'Maltrecho (la mitad de los puntos de golpe o menos)',
      ),
    }
  return { kind: 'ok' }
}
