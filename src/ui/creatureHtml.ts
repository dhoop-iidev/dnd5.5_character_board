// Renders a creature stat block (CreatureDef, SRD 5.2.1 "Monsters" p. 254 layout) as HTML, in one language, for the
// CreatureBlock component and the popups (RuleText takes bilingual HTML).
import type { CreatureDef, I18n, Lang } from '../data/types'
import { crText } from '../engine/companions'
import { SIZE_NAMES, UI } from '../i18n/ui'
import { locale } from './format'

const ABILITY_LABEL: Record<string, I18n> = {
  str: { en: 'Str', fr: 'For', es: 'Fue' },
  dex: { en: 'Dex', fr: 'Dex', es: 'Des' },
  con: { en: 'Con', fr: 'Con', es: 'Con' },
  int: { en: 'Int', fr: 'Int', es: 'Int' },
  wis: { en: 'Wis', fr: 'Sag', es: 'Sab' },
  cha: { en: 'Cha', fr: 'Cha', es: 'Car' },
}
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface CreatureHtmlOptions {
  /** AC and maximum Hit Points when they come from a formula (Otherworldly Steed). */
  ac?: number
  hpMax?: number
  /** Leave out the name line (shown by the component itself). */
  noName?: boolean
}

export function creatureHtml(def: CreatureDef, lang: Lang, opts: CreatureHtmlOptions = {}): string {
  const t = (x: I18n | undefined) => (x ? x[lang] || x.en : '')
  const sizes = def.size.map((s) => t(SIZE_NAMES[s])).join(lang === 'fr' ? ' ou ' : lang === 'es' ? ' o ' : ' or ')
  const parts: string[] = []
  if (!opts.noName) parts.push(`<p class="cb-name">${esc(t(def.name))}</p>`)
  parts.push(
    `<p class="cb-type"><em>${esc(lang === 'fr' ? `${t(def.type)} de taille ${sizes}, ${t(def.alignment)}` : lang === 'es' ? `${t(def.type)} ${sizes}, ${t(def.alignment)}` : `${sizes} ${t(def.type)}, ${t(def.alignment)}`)}</em></p>`,
  )
  const ac = opts.ac ?? def.ac
  const ini = def.initiative ? `${signed(def.initiative.mod)} (${def.initiative.score})` : ''
  parts.push(
    `<p><strong>${t(UI.acShort)}</strong> ${ac ?? esc(t(def.acText))}${ini ? ` <strong>${t(UI.initiative)}</strong> ${ini}` : ''}</p>`,
  )
  const hp = def.hp
    ? `${def.hp.average} (${def.hp.dice})`
    : opts.hpMax !== undefined
      ? `${opts.hpMax} — ${esc(t(def.hpText))}`
      : esc(t(def.hpText))
  parts.push(`<p><strong>${t(UI.hpShort)}</strong> ${hp}</p>`)
  parts.push(`<p><strong>${t(UI.speed)}</strong> ${esc(t(def.speed.text))}</p>`)
  const rows = Object.entries(def.abilities)
    .map(
      ([k, v]) =>
        `<tr><th>${t(ABILITY_LABEL[k])}</th><td>${v.score}</td><td>${signed(v.mod)}</td><td>${signed(v.save)}</td></tr>`,
    )
    .join('')
  parts.push(
    `<table class="cb-abilities"><thead><tr><th></th><th>${t(UI.score)}</th><th>${t(UI.modifier)}</th><th>${t(UI.save)}</th></tr></thead><tbody>${rows}</tbody></table>`,
  )
  const line = (label: I18n, value: I18n | undefined) =>
    value && t(value) && parts.push(`<p><strong>${t(label)}</strong> ${esc(t(value))}</p>`)
  line(UI.skillsBlock, def.skills)
  line(UI.resistances, def.resistances)
  line(UI.vulnerabilities, def.vulnerabilities)
  line(UI.immunities, def.immunities)
  line(UI.gear, def.gear)
  line(UI.senses, def.senses)
  line(UI.languages, def.languages)
  const cr = def.crText
    ? esc(t(def.crText))
    : lang === 'fr'
      ? `${crText(def.cr)} (${def.xp.toLocaleString('fr-FR')} PX${def.xpInLair ? `, ou ${def.xpInLair.toLocaleString('fr-FR')} dans son repaire` : ''} ; BM ${signed(def.pb ?? 0)})`
      : lang === 'es'
        ? `${crText(def.cr)} (${def.xp.toLocaleString(locale('es'))} PX${def.xpInLair ? `, o ${def.xpInLair.toLocaleString(locale('es'))} en su guarida` : ''}; BC ${signed(def.pb ?? 0)})`
        : `${crText(def.cr)} (XP ${def.xp.toLocaleString('en-US')}${def.xpInLair ? `, or ${def.xpInLair.toLocaleString('en-US')} in lair` : ''}; PB ${signed(def.pb ?? 0)})`
  parts.push(`<p><strong>${t(UI.challenge)}</strong> ${cr}</p>`)
  const section = (label: I18n, entries: CreatureDef['traits'] | undefined, intro?: I18n) => {
    if (!entries?.length) return
    parts.push(`<h5>${t(label)}</h5>`)
    if (intro) parts.push(`<p><em>${t(intro)}</em></p>`)
    for (const e of entries) parts.push(`<p><strong>${esc(t(e.name))}.</strong> ${t(e.text)}</p>`)
  }
  section(UI.traitsBlock, def.traits)
  section(UI.actions, def.actions)
  section(UI.bonusActions, def.bonusActions)
  section(UI.reactions, def.reactions)
  section(UI.legendaryActions, def.legendaryActions, def.legendaryActionsIntro)
  for (const e of def.errata ?? [])
    parts.push(`<p class="cb-errata"><strong>${t(UI.errata)}.</strong> ${esc(t(e))}</p>`)
  return parts.join('')
}

/** Bilingual HTML of a stat block, for RuleText / popups. */
export const creatureI18nHtml = (def: CreatureDef, opts: CreatureHtmlOptions = {}): I18n => ({
  en: creatureHtml(def, 'en', opts),
  es: creatureHtml(def, 'es', opts),
  fr: creatureHtml(def, 'fr', opts),
})
