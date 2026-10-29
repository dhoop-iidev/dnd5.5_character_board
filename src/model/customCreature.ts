// A creature from another book entered by the player (house rule #5: a subclass's beast companion…), turned into an
// ordinary stat block (CreatureDef) so the Companions pane shows it like an SRD creature. Its Armor Class, Hit Points,
// Proficiency Bonus and attack numbers are formulas that follow the character (model/formula.ts).
import type { AbilityId, CreatureAttack, CreatureDef, I18n } from '../data/types'
import { ABILITIES } from '../data/types'
import type { CustomCreature } from './character'
import { evalFormula, type FormulaContext } from './formula'
import { CUSTOM_SUBCLASS_HOUSE_RULE } from './customSubclasses'

export const CUSTOM_CREATURE_ID = 'custom'

const same = (s: string): I18n => ({ en: s, fr: s, es: s })
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

export function newCustomCreature(): CustomCreature {
  return {
    name: '',
    type: 'Beast',
    size: 'medium',
    book: '',
    ac: '',
    hp: '',
    speed: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    entries: [],
  }
}

/** One entry's text: its attack numbers (when given) then the player's words. */
function entryText(e: CustomCreature['entries'][number], ctx: FormulaContext): I18n {
  const atk = evalFormula(e.attack, ctx)
  const bonus = evalFormula(e.damageBonus, ctx)
  const dice = e.damageDice?.trim()
  const dmg = dice
    ? `${dice}${bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : ''}`
    : bonus
      ? String(bonus)
      : ''
  const type = e.damageType?.trim() ? ` ${escape(e.damageType.trim())}` : ''
  const words = escape(e.text.trim())
  const t = (attackLabel: string, hitLabel: string) =>
    [
      atk !== undefined ? `<em>${attackLabel}</em> ${signed(atk)}.` : '',
      dmg ? `<em>${hitLabel}</em> ${escape(dmg)}${type}.` : '',
      words,
    ]
      .filter(Boolean)
      .join(' ')
  return {
    en: t('Attack Roll:', 'Hit:'),
    fr: t('Jet d’attaque :', 'Touché :'),
    es: t('Tirada de ataque:', 'Impacto:'),
  }
}

/** The stat block of a custom creature for this character (formulas resolved with its sheet). */
export function customCreatureDef(cc: CustomCreature, ctx: FormulaContext, id = CUSTOM_CREATURE_ID): CreatureDef {
  const pb = evalFormula(cc.pb?.trim() || 'pb', ctx) ?? ctx.pb
  const hp = evalFormula(cc.hp, ctx)
  const abilities = Object.fromEntries(
    ABILITIES.map((a) => {
      const score = cc.abilities[a] ?? 10
      const m = mod(score)
      return [a, { score, mod: m, save: m + (cc.saves?.includes(a) ? pb : 0) }]
    }),
  ) as Record<AbilityId, { score: number; mod: number; save: number }>
  const of = (kind: CustomCreature['entries'][number]['kind']): CreatureAttack[] =>
    cc.entries
      .filter((e) => e.kind === kind)
      .map((e) => ({ name: same(e.name.trim() || '—'), text: entryText(e, ctx) }))
  const bonusActions = of('bonus-action')
  const reactions = of('reaction')
  return {
    id,
    name: same(cc.name.trim() || '—'),
    size: [cc.size],
    type: same(cc.type.trim() || '—'),
    tags: cc.type
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean),
    alignment: same('—'),
    ac: evalFormula(cc.ac, ctx) ?? null,
    acText: same(cc.ac),
    initiative: { mod: abilities.dex.mod, score: 10 + abilities.dex.mod },
    hp: hp !== undefined ? { average: hp, dice: cc.hp.trim() } : null,
    hpText: same(cc.hp),
    speed: { text: same(cc.speed.trim() || '—') },
    abilities,
    senses: same(cc.senses?.trim() || '—'),
    passivePerception: 10 + abilities.wis.mod,
    languages: same(cc.languages?.trim() || '—'),
    cr: null,
    xp: 0,
    pb,
    crText: same('—'),
    traits: of('trait'),
    actions: of('action'),
    ...(bonusActions.length ? { bonusActions } : {}),
    ...(reactions.length ? { reactions } : {}),
    source: { book: cc.book.trim(), houseRule: CUSTOM_SUBCLASS_HOUSE_RULE },
  }
}
