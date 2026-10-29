// One-line summary of a rule entry for lists: the hand-written line in custom/summaries.json when there is one, else the
// first sentence of the SRD text (CC-BY-4.0), tags stripped and cut at ~140 characters.
import { rules } from '../data/rules'
import type { I18n } from '../data/types'

function firstSentence(html: string | undefined): string {
  if (!html) return ''
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const m = text.match(/^(.{20,}?[.!?])(\s|$)/)
  const s = m ? m[1] : text
  return s.length > 140 ? s.slice(0, 137).replace(/\s+\S*$/, '') + '…' : s
}

export function summaryOf(key: string, text?: I18n): I18n {
  const s = rules.summaries.get(key)
  if (s) return s
  return { en: firstSentence(text?.en), fr: firstSentence(text?.fr), es: firstSentence(text?.es) }
}
