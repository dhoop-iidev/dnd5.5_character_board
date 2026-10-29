import type { Distance, Lang, Weight } from '../data/types'

const LOCALE: Record<Lang, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES' }
/** The number locale of a language (en-US, fr-FR, es-ES). */
export const locale = (lang: Lang) => LOCALE[lang]
const num = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 })

/** Metric units for French and Spanish: both translated SRD PDFs print kg and m (1,5 m per 5 feet). */
export const isMetric = (lang: Lang) => lang !== 'en'

/** lb / ft in English, kg / m in French and Spanish (as printed in the three SRD PDFs). */
export const fmtWeight = (w: Weight, lang: Lang) => (isMetric(lang) ? `${num(w.kg, lang)} kg` : `${num(w.lb, lang)} lb`)
export const fmtDistance = (d: Distance, lang: Lang) =>
  isMetric(lang) ? `${num(d.m, lang)} m` : `${num(d.ft, lang)} ft`
/** A distance in feet from the engine (speed): the French and Spanish SRDs print 1,5 m per 5 feet. */
export const fmtFeet = (ft: number, lang: Lang) => fmtDistance({ ft, m: Math.round(ft * 0.3 * 100) / 100 }, lang)
