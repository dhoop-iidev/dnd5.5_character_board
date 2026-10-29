import type { I18n, Source } from '../data/types'
import type { Stat } from '../engine/stacking'

export interface PopupContent {
  title: I18n
  /** Getter so the breakdown updates live (e.g. after toggling a situational bonus). */
  stat?: () => Stat
  /** How to show the total: signed (+3) or plain (21). */
  signed?: boolean
  summary?: I18n
  /** Rule text (HTML from the SRD data). */
  html?: I18n
  source?: Source
  /** Extra lines (prerequisites, notes…). */
  lines?: I18n[]
  /** Key of the campaign note attached to this popup (character.annotations), e.g. "feat:dodge". */
  noteKey?: string
}

export const popup = $state<{ content: PopupContent | null }>({ content: null })

export function openPopup(content: PopupContent) {
  popup.content = content
}

export function closePopup() {
  popup.content = null
}
