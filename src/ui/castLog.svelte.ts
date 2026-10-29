// Spells pane, not saved: the last cast of each spell row (so "Cast ✓" can be undone during the round it was cast,
// for a spell with no duration) and the message of the last cast.
import type { I18n } from '../data/types'
import type { ActiveEffect } from '../model/character'

export interface CastRecord {
  cast: NonNullable<ActiveEffect['cast']>
  round: number
  effectUid?: string
}

export const castLog = $state<{ rows: Record<string, CastRecord>; message?: I18n }>({ rows: {} })
