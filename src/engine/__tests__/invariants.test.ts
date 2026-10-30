// Core invariants, for every example at each of its levels and for fresh level-1 characters of every class: owner ids,
// warning ids and the lists the panes show with a keyed {#each} are unique (a duplicate key stops a pane from opening);
// computing and validating never change the character.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { Character } from '../../model/character'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'

const EXAMPLES = join(__dirname, '..', '..', '..', 'examples')
const examples = readdirSync(EXAMPLES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, migrate(JSON.parse(readFileSync(join(EXAMPLES, f), 'utf8')))] as const)

const ABIL = { str: 13, dex: 14, con: 14, int: 12, wis: 15, cha: 10 }
const fresh: [string, Character][] = []
for (const cls of rules.classes.keys())
  for (const [sp, bg] of [
    ['human', 'sage'],
    ['elf', 'criminal'],
    ['tiefling', 'acolyte'],
  ]) {
    const c = newCharacter(
      { name: 'T', speciesId: sp, backgroundId: bg, classId: cls, lang: 'fr', abilities: ABIL },
      rules,
    )
    if (sp === 'human') c.extraFeats = { 'human:versatile': { featId: 'magic-initiate', choices: { list: 'wizard' } } }
    fresh.push([`${cls} · ${sp} · ${bg}`, c])
  }

/** Messy states a player reaches by editing: picks left behind by a change, values that don't fit any more. */
const messy: [string, Character][] = []
{
  const c = newCharacter(
    { name: 'T', speciesId: 'human', backgroundId: 'sage', classId: 'cleric', lang: 'fr', abilities: ABIL },
    rules,
  )
  // Magic Initiate (Wizard) holding cleric cantrips and a level 2 spell; the same pick twice.
  c.background.feat.choices = { list: 'wizard', cantrips: ['guidance', 'guidance', 'sacred-flame'], spell: ['aid'] }
  c.extraFeats = { 'human:versatile': { featId: 'magic-initiate', choices: { list: 'wizard', spell: ['aid'] } } }
  c.featureChoices['human:skillful'] = ['arcana', 'arcana']
  messy.push(['Magic Initiate with off-list and repeated picks', c])
  const f = newCharacter(
    { name: 'T', speciesId: 'elf', backgroundId: 'soldier', classId: 'fighter', lang: 'fr', abilities: ABIL },
    rules,
  )
  f.featureChoices['fighter:fighting-style'] = 'archery'
  f.levels[0].classId = 'wizard' // the row's class changed after the Fighting Style was picked
  messy.push(['class changed after a Fighting Style', f])
}
for (const [name, c] of examples)
  if (c.levels.length > 2) {
    const cut = structuredClone(c)
    cut.levels = cut.levels.slice(0, 1) // the levels removed, their feature and feat choices left behind
    messy.push([`${name} cut to level 1 with its choices left`, cut])
  }

const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i)

/** A character cut to its first `level` levels. */
const atLevel = (c: Character, level: number): Character => ({
  ...structuredClone(c),
  levels: c.levels.slice(0, level),
})

function check(c: Character) {
  const frozen = JSON.stringify(c)
  const s = compute(c, rules)
  expect(dupes(s.owners.map((o) => o.id)), 'owner ids').toEqual([])
  expect(dupes(validate(c, rules).map((w) => w.id)), 'warning ids').toEqual([])
  expect(dupes(s.spellcasting.map((x) => x.classId)), 'spellcasting classes').toEqual([])
  expect(dupes(s.extraSpells.map((x) => x.ownerId)), 'feat and trait spell owners').toEqual([])
  for (const x of s.extraSpells) expect(dupes(x.spells), `spells of ${x.ownerId}`).toEqual([])
  expect(dupes(s.resources.map((r) => r.id)), 'resources').toEqual([])
  expect(dupes(s.attacks.map((a) => a.uid ?? a.name.en)), 'attacks').toEqual([])
  for (const [cls, st] of Object.entries(c.spellcasting)) {
    expect(dupes(st.cantrips), `${cls} cantrips`).toEqual([])
    expect(dupes(st.prepared), `${cls} prepared`).toEqual([])
  }
  expect(JSON.stringify(c), 'compute and validate leave the character unchanged').toBe(frozen)
}

describe('core invariants', () => {
  for (const [name, c] of examples)
    it(`example ${name}, every level`, () => {
      for (let L = 1; L <= c.levels.length; L++) check(atLevel(c, L))
    })
  for (const [name, c] of fresh) it(`new character ${name}`, () => check(c))
  for (const [name, c] of messy) it(`messy: ${name}`, () => check(c))
})

describe('two copies of a feat', () => {
  it('two Magic Initiates sharing Detect Magic each have their own slot-free cast', async () => {
    const { freeCast } = await import('../casting')
    const c = newCharacter(
      { name: 'T', speciesId: 'human', backgroundId: 'sage', classId: 'fighter', lang: 'fr', abilities: ABIL },
      rules,
    )
    c.background.feat.choices = {
      list: 'wizard',
      ability: 'int',
      cantrips: ['light', 'mage-hand'],
      spell: 'detect-magic',
    }
    c.extraFeats = {
      'human:versatile': {
        featId: 'magic-initiate',
        choices: { list: 'cleric', ability: 'wis', cantrips: ['guidance', 'light'], spell: 'detect-magic' },
      },
    }
    const s = compute(c, rules)
    const dm = rules.spells.get('detect-magic')!
    const a = freeCast(c, s, dm, 'feat:magic-initiate')!
    const b = freeCast(c, s, dm, 'feat:magic-initiate@human:versatile')!
    expect(a.key).not.toBe(b.key)
    // Spend the first copy's cast (its uses, or the once-per-Long-Rest mark), then recompute.
    if (a.resource) c.resources[a.resource] = 1
    else c.freeCasts = [a.key]
    const s2 = compute(c, rules)
    expect(freeCast(c, s2, dm, 'feat:magic-initiate')!.available).toBe(false)
    expect(freeCast(c, s2, dm, 'feat:magic-initiate@human:versatile')!.available).toBe(true)
  })
})
