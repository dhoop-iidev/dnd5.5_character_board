// Casting from the Spells pane (engine/casting.ts) and the Wizard spellbook level by level (engine/spellbook.ts):
// durations in rounds (1 minute = 10 rounds, Rules Glossary "Round"), slot spent, Concentration on one effect at a time
// (Rules Glossary "Concentration", SRD 5.2.1 p. 179), Metamagic options and their Sorcery Point cost (p. 66–67), the
// spells added to the spellbook at each Wizard level (p. 78 "Spellbook").
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { Character } from '../../model/character'
import { migrate } from '../../model/migrate'
import { castSpell, metamagicBlocker, metamagicOptions, slotChoices, spellRounds, undoCast } from '../casting'
import { compute } from '../compute'
import { spellbookContents, spellbookLevels, spellbookProblems } from '../spellbook'
import { validate } from '../validate'

const example = (file: string): Character =>
  migrate(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', file), 'utf8')))
const sp = (id: string) => rules.spells.get(id)!
let n = 0
const newUid = () => `u${++n}`

describe('spell durations in rounds', () => {
  it('1 minute = 10 rounds, 1 hour = 600, Instantaneous has none', () => {
    expect(spellRounds(sp('bless'))).toBe(10)
    expect(spellRounds(sp('mage-armor'))).toBe(8 * 600)
    expect(spellRounds(sp('fireball'))).toBeUndefined()
    expect(spellRounds(sp('alarm'))).toBe(4800)
  })
})

describe('casting: slot, timed effect, Concentration', () => {
  it('spends the lowest slot that fits and starts a timed Concentration effect, ending the previous one', () => {
    const c = example('magicien-niveau-10.json')
    c.slotsUsed = []
    c.activeEffects = []
    const sheet = compute(c, rules)
    const choices = slotChoices(c, sheet, sp('fly'))
    expect(choices[0]).toEqual({ level: 3 })
    const r1 = castSpell(c, sheet, rules, sp('fly'), { classId: 'wizard', slot: choices[0], newUid })
    expect(c.slotsUsed[2]).toBe(1)
    expect(r1.effect).toMatchObject({ refId: 'fly', rounds: 100, concentration: true })
    expect(c.concentration).toBe(r1.effect!.uid)
    const r2 = castSpell(c, compute(c, rules), rules, sp('web'), { classId: 'wizard', slot: { level: 2 }, newUid })
    expect(c.activeEffects.map((e) => e.refId)).toEqual(['web'])
    expect(c.concentration).toBe(r2.effect!.uid)
    expect(r2.message.en).toContain('Concentration on Fly ends')
  })
  it('an Instantaneous spell spends its slot without an effect; undo gives the slot back', () => {
    const c = example('magicien-niveau-10.json')
    c.slotsUsed = []
    c.activeEffects = []
    const r = castSpell(c, compute(c, rules), rules, sp('fireball'), { slot: { level: 5 }, newUid })
    expect(r.effect).toBeUndefined()
    expect(c.slotsUsed[4]).toBe(1)
    undoCast(c, r.cast)
    expect(c.slotsUsed[4]).toBe(0)
  })
})

describe('Metamagic at casting (Sorcerer, SRD p. 66–67)', () => {
  const c = example('ensorceleuse-niveau-10.json')
  const sheet = compute(c, rules)
  it('lists the known options with their cost and whether they fit the spell', () => {
    const opts = metamagicOptions(sheet, rules, sp('fireball'))
    const by = Object.fromEntries(opts.map((o) => [o.id.split(':').pop(), o]))
    expect(Object.keys(by).sort()).toEqual(['careful-spell', 'quickened-spell', 'subtle-spell', 'twinned-spell'])
    expect(by['quickened-spell'].cost).toBe(2)
    expect(by['careful-spell'].cost).toBe(1)
    expect(by['careful-spell'].notApplicable).toBeUndefined() // Dexterity save
    expect(by['twinned-spell'].notApplicable).toBeDefined() // a higher slot adds damage, not a target
    const charm = metamagicOptions(sheet, rules, sp('charm-person'))
    expect(charm.find((o) => o.id.endsWith('twinned-spell'))!.notApplicable).toBeUndefined()
  })
  it('one option per spell, and not more than the Sorcery Points left', () => {
    const opts = metamagicOptions(sheet, rules, sp('fireball'))
    const quick = opts.find((o) => o.id.endsWith('quickened-spell'))!
    const subtle = opts.find((o) => o.id.endsWith('subtle-spell'))!
    expect(metamagicBlocker(subtle, [quick], 10)?.en).toBe('one Metamagic option per spell')
    expect(metamagicBlocker(quick, [], 1)?.en).toContain('2 Sorcery Points needed')
    expect(metamagicBlocker(quick, [], 10)).toBeUndefined()
  })
  it('casting with an option spends the Sorcery Points', () => {
    const ch = example('ensorceleuse-niveau-10.json')
    ch.resources['sorcerer:font-of-magic'] = 0
    const s = compute(ch, rules)
    const quick = metamagicOptions(s, rules, sp('fireball')).filter((o) => o.id.endsWith('quickened-spell'))
    const r = castSpell(ch, s, rules, sp('fireball'), { slot: { level: 3 }, metamagic: quick, newUid })
    expect(ch.resources['sorcerer:font-of-magic']).toBe(2)
    undoCast(ch, r.cast)
    expect(ch.resources['sorcerer:font-of-magic']).toBe(0)
  })
})

describe('Wizard spellbook level by level (SRD p. 78)', () => {
  it('the level 10 example: six spells at level 1, two per level after, no warning', () => {
    const c = example('magicien-niveau-10.json')
    const lv = spellbookLevels(c, rules)
    expect(lv.map((l) => `${l.learned.length}/${l.expected}`)).toEqual([
      '6/6',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
      '2/2',
    ])
    expect(lv.map((l) => l.maxSpellLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    expect(spellbookProblems(c, rules)).toEqual([])
    expect(spellbookContents(c, rules)).toHaveLength(30)
    // Prepared spells come from the whole book (per-level + copied).
    expect(validate(c, rules).filter((w) => w.area === 'spells')).toEqual([])
  })
  it('too many spells at a level, or a spell level without a slot, is flagged at that level', () => {
    const c = example('magicien-niveau-10.json')
    c.levels[1].spellsLearned = ['mage-armor', 'shield', 'fireball']
    const ids = validate(c, rules)
      .filter((w) => w.id.startsWith('spellbook-level-2'))
      .map((w) => w.id)
    expect(ids).toEqual(['spellbook-level-2', 'spellbook-level-2-fireball'])
  })
})

describe('feat and species spells without a slot (Fiendish Legacy p. 86, Magic Initiate p. 87)', () => {
  it('a Tiefling Rogue casts Hellish Rebuke once without a slot, back on a Long Rest', () => {
    const c = example('voleuse-niveau-10.json')
    const sheet = compute(c, rules)
    const choices = slotChoices(c, sheet, sp('hellish-rebuke'), false, true)
    expect(choices).toEqual([{ level: 1, free: true }])
    const r = castSpell(c, sheet, rules, sp('hellish-rebuke'), { slot: choices[0], newUid })
    expect(r.cast.free).toBeDefined()
    expect(c.slotsUsed.every((x) => !x)).toBe(true)
    expect(slotChoices(c, compute(c, rules), sp('hellish-rebuke'), false, true)).toEqual([])
    undoCast(c, r.cast)
    expect(slotChoices(c, compute(c, rules), sp('hellish-rebuke'), false, true)).toHaveLength(1)
  })
  it('a class spell gets no slot-free cast', () => {
    const c = example('magicien-niveau-10.json')
    expect(slotChoices(c, compute(c, rules), sp('shield'), false, false).some((x) => x.free)).toBe(false)
  })
})
