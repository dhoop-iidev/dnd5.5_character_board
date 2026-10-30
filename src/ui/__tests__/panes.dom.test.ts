// Every pane mounted with Svelte's browser runtime, every level row and every <details> opened in turn, for every
// example and fresh level-1 characters of every class: no error. The server-side render test can't see the errors that
// made the Spells tab refuse to open (a keyed {#each} with a duplicate key, state written while rendering).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { Character } from '../../model/character'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { app } from '../../state.svelte'
import App from '../../App.svelte'
import { builder } from '../builderState.svelte'

const EXAMPLES = join(__dirname, '..', '..', '..', 'examples')
const examples = readdirSync(EXAMPLES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, migrate(JSON.parse(readFileSync(join(EXAMPLES, f), 'utf8')))] as const)

const ABIL = { str: 13, dex: 14, con: 14, int: 12, wis: 15, cha: 10 }
const fresh = (classId: string, speciesId: string, backgroundId: string): Character =>
  newCharacter({ name: 'Test', speciesId, backgroundId, classId, lang: 'fr', abilities: ABIL }, rules)

/** Fresh characters: every class, with origins that grant feats, spells and choices (human Versatile + Sage = Magic
 * Initiate twice, the case that broke the Spells tab). */
const freshOnes: [string, Character][] = []
for (const cls of rules.classes.keys())
  for (const [sp, bg] of [
    ['human', 'sage'],
    ['elf', 'criminal'],
    ['gnome', 'acolyte'],
  ]) {
    const c = fresh(cls, sp, bg)
    if (sp === 'human') c.extraFeats = { 'human:versatile': { featId: 'magic-initiate', choices: { list: 'cleric' } } }
    freshOnes.push([`${cls} · ${sp} · ${bg}`, c])
  }

/** Messy saves: repeated picks, off-list values, choices left behind by a class change. */
const messyOnes: [string, Character][] = []
{
  const c = fresh('cleric', 'human', 'sage')
  c.background.feat.choices = { list: 'wizard', cantrips: ['guidance', 'guidance', 'sacred-flame'], spell: ['aid'] }
  c.extraFeats = { 'human:versatile': { featId: 'magic-initiate', choices: { list: 'wizard', spell: ['aid'] } } }
  c.featureChoices['human:skillful'] = ['arcana', 'arcana']
  c.spellcasting.cleric = { cantrips: ['guidance', 'guidance'], prepared: ['bless', 'bless', 'fireball'] }
  messyOnes.push(['repeated and off-list picks', c])
  const f = fresh('fighter', 'elf', 'soldier')
  f.featureChoices['fighter:fighting-style'] = 'archery'
  f.levels[0].classId = 'wizard'
  f.weaponMastery = ['longsword', 'longsword']
  messyOnes.push(['class changed after its choices', f])
}

let target: HTMLElement | undefined
let cmp: ReturnType<typeof mount> | undefined
afterEach(() => {
  builder.open = false
  if (cmp) unmount(cmp)
  target?.remove()
  cmp = target = undefined
})

const openDetails = () => {
  for (const d of target!.querySelectorAll('details')) d.open = true
  flushSync()
}
const $$ = <T extends Element = HTMLButtonElement>(sel: string) => [...target!.querySelectorAll<T>(sel)]

/** In the open Builder, visit every step (each step button in turn) with its <details> open, then go back. */
function visitBuilder() {
  const steps = $$('ol.steps button').length
  expect(steps, 'Builder steps').toBeGreaterThan(1)
  for (let k = 0; k < steps; k++) {
    $$('ol.steps button')[k].click()
    flushSync()
    expect($$('ol.steps button')[k].classList.contains('on'), `step ${k + 1} opens`).toBe(true)
    openDetails()
  }
  $$('.builder .head button')[0].click()
  flushSync()
  expect(target!.querySelector('.builder')).toBeNull()
}

function mountApp() {
  target = document.createElement('div')
  document.body.append(target)
  cmp = mount(App, { target })
  flushSync()
}

/** Mount the app, then visit every tab with its <details> open, then every level in the Builder. */
function visitAll(c: Character) {
  app.character = c
  app.loaded = true
  location.hash = '#/general'
  mountApp()
  const tabs = $$('nav.tabs button')
  expect(tabs.length).toBeGreaterThan(3)
  const visited: string[] = []
  for (let t = 0; t < tabs.length; t++) {
    const tab = $$('nav.tabs button')[t]
    tab.click()
    flushSync()
    expect(tab.classList.contains('active'), `tab ${tab.textContent} opens`).toBe(true)
    visited.push(tab.textContent!.trim())
    openDetails()
  }
  // Every level of the progression (General tab) in the Builder.
  $$('nav.tabs button')[0].click()
  flushSync()
  const rows = $$('ol.levels button.row').length
  expect(rows).toBe(c.levels.length)
  for (let r = 0; r < rows; r++) {
    $$('ol.levels button.row')[r].click()
    flushSync()
    visitBuilder()
  }
  return visited
}

describe('every pane mounts in the browser runtime', () => {
  for (const [name, c] of examples) it(`example ${name}`, () => void visitAll(structuredClone(c)))
  for (const [name, c] of freshOnes) it(`new character ${name}`, () => void visitAll(c))
  for (const [name, c] of messyOnes) it(`messy save: ${name}`, () => void visitAll(c))
})

describe('the app cleans up after a structural change (model/reconcile.ts)', () => {
  it('a Fighter turned Wizard loses the Fighting Style; opening a character changes nothing', () => {
    const c = structuredClone(examples.find(([f]) => f === 'guerriere-niveau-5.json')![1])
    const before = JSON.stringify(c)
    visitAll(c)
    expect(JSON.stringify(app.character)).toBe(before)
    for (const l of app.character.levels) l.classId = 'wizard'
    flushSync()
    expect(app.character.featureChoices['fighter:fighting-style']).toBeUndefined()
  })
})

describe('creation and level up in the Builder (ui/Builder.svelte)', () => {
  it('creates a character step by step from the welcome screen', () => {
    app.loaded = false
    app.character = { settings: { lang: 'fr' } } as unknown as Character
    mountApp()
    const name = $$<HTMLInputElement>('.welcome .grid2 input')[0]
    name.value = 'Aelis'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    $$('.welcome .go button')[0].click()
    flushSync()
    expect(app.loaded).toBe(true)
    expect(target!.querySelector('.builder')).not.toBeNull()
    expect(app.character.identity.name).toBe('Aelis')
    // Alignment: the 3 × 3 square, Chaotic Good is the third square.
    $$('.builder .grid button')[2].click()
    flushSync()
    expect(app.character.identity.alignment).toBe('chaotic-good')
    // Class: a Wizard; the scores follow its suggested array, its starting equipment replaces the Fighter's.
    const cls = target!.querySelector<HTMLSelectElement>('.builder .fields select')!
    cls.value = 'wizard'
    cls.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    const c = app.character
    expect(c.levels[0].classId).toBe('wizard')
    expect(c.baseAbilities).toEqual(rules.tables.standardArrayByClass.wizard)
    expect(c.inventory.some((it) => it.refId === 'quarterstaff')).toBe(true)
    expect(c.money.gp).toBe(5 + 14) // Wizard A and Soldier A
    // The steps of a level-1 Wizard: Spells, no Weapon Mastery, and the starting equipment.
    const labels = $$('ol.steps button').map((b) => b.textContent!)
    expect(labels.some((t) => t.includes('Sorts'))).toBe(true)
    expect(labels.some((t) => t.includes('Équipement'))).toBe(true)
    expect(labels.some((t) => t.includes('Bottes'))).toBe(false)
    visitBuilder()
    // Back on the sheet: the banner shows what is left and opens the Builder again.
    const banner = target!.querySelector<HTMLButtonElement>('button.resume')
    expect(banner).not.toBeNull()
    banner!.click()
    flushSync()
    expect(target!.querySelector('.builder')).not.toBeNull()
  })
  it('levels up from the progression', () => {
    const c = structuredClone(examples.find(([f]) => f === 'guerriere-niveau-5.json')![1])
    app.character = c
    app.loaded = true
    location.hash = '#/general'
    mountApp()
    const up = $$('.bar button.primary')[0]
    up.click()
    flushSync()
    expect(app.character.levels).toHaveLength(6)
    expect(builder.open && builder.index).toBe(5)
    visitBuilder()
  })
})
