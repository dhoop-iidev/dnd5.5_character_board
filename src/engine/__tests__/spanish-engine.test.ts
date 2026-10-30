// Every text the engine produces carries Spanish: the warnings of deliberately broken characters and of the examples,
// and every label, note and name inside a computed sheet (breakdown parts first).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import type { Character, ItemInstance } from '../../model/character'
import { migrate } from '../../model/migrate'
import { compute } from '../compute'
import { validate } from '../validate'
import { castSpell, metamagicOptions } from '../casting'
import { wildShapeIneligible, wildShapeLimits } from '../companions'
import { hpState } from '../hitPoints'
import { SUMMON_SPELLS, multiattack, summonAttacks } from '../summons'
import { wildShapeView } from '../wildShapeView'
import type { RuleWarning } from '../checks/common'

const DIR = join(__dirname, '..', '..', '..', 'examples')
const load = (f: string): Character => migrate(JSON.parse(readFileSync(join(DIR, f), 'utf8')))
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))

const item = (
  uid: string,
  kind: ItemInstance['kind'],
  refId: string,
  extra: Partial<ItemInstance> = {},
): ItemInstance => ({
  uid,
  kind,
  refId,
  quantity: 1,
  location: 'worn',
  ...extra,
})

/** Broken builds: each mutation breaks one or more rules of a legal example. */
const BROKEN: [string, string, (c: Character) => void][] = [
  [
    'guerrier-niveau-10.json',
    'abilities and background',
    (c) => {
      c.baseAbilities.str = 25
      c.background.abilities = { str: 3 }
      c.background.feat = { featId: 'alert' }
    },
  ],
  [
    'guerrier-niveau-10.json',
    'no background',
    (c) => {
      c.background.backgroundId = 'nope'
    },
  ],
  [
    'guerrier-niveau-10.json',
    'levels',
    (c) => {
      c.levels[1].hpFixed = false
      c.levels[1].hpRoll = 99
      c.levels[2].feat = { featId: 'alert' }
      c.levels[3].feat = { featId: 'nope' }
      c.levels.push({ ...c.levels[0], classId: 'nope', feat: undefined })
      while (c.levels.length < 22) c.levels.push({ classId: 'wizard', hpRoll: 4, hpFixed: true })
    },
  ],
  [
    'guerrier-niveau-10.json',
    'no level',
    (c) => {
      c.levels = []
    },
  ],
  [
    'guerrier-niveau-10.json',
    'feats, skills, mastery, choices',
    (c) => {
      c.levels[3].feat = { featId: 'ability-score-improvement', abilities: { str: 1 } }
      c.levels[5].feat = { featId: 'great-weapon-master', abilities: { int: 2 } }
      c.skillProficiencies = ['arcana', 'religion', 'athletics', 'history', 'nature']
      c.featureChoices['fighter:expertise'] = ['stealth', 'arcana', 'history']
      c.weaponMastery = ['longsword', 'greatsword', 'dagger', 'whip', 'net', 'blowgun', 'shortbow', 'longbow', 'club']
      c.featureChoices = { ...c.featureChoices, 'bogus:feature': 'x' }
      for (const k of Object.keys(c.featureChoices)) c.featureChoices[k] = 'not-an-option'
    },
  ],
  [
    'magicien-niveau-10.json',
    'armor, attunement, hands, load',
    (c) => {
      c.inventory.push(
        item('a1', 'armor', 'plate-armor'),
        item('a2', 'armor', 'shield', { equipped: true }),
        item('w1', 'weapon', 'greatsword', { equipped: true }),
        item('w2', 'weapon', 'whip', { equipped: true }),
        item('m1', 'magic', 'amulet-of-health', { attuned: true }),
        item('m2', 'magic', 'amulet-of-health', { attuned: true }),
        item('m3', 'magic', 'amulet-of-the-planes', { attuned: true }),
        item('m4', 'magic', 'armor-of-resistance', { attuned: true }),
        item('m5', 'magic', 'adamantine-armor', { attuned: true }),
        item('g1', 'armor', 'plate-armor', { location: 'carried', quantity: 20 }),
      )
    },
  ],
  [
    'magicien-niveau-10.json',
    'spells',
    (c) => {
      const s = c.spellcasting.wizard
      s.prepared.push('nope', 'cure-wounds', 'wish', 'fire-bolt', 'sleep', 'identify', 'thunderwave', 'chromatic-orb')
      s.cantrips.push('fireball', 'eldritch-blast', 'guidance', 'druidcraft')
      s.spellbook = [...(s.spellbook ?? []), 'fire-bolt', 'cure-wounds', 'wish', 'sleep']
    },
  ],
  [
    'guerrier-niveau-10.json',
    'companions',
    (c) => {
      c.wildShape = { known: ['wolf', 'nope'], active: 'cat' }
      const fam = (uid: string, creatureId: string) => ({
        uid,
        kind: 'familiar' as const,
        creatureId,
        hp: { current: 1, temp: 0, max: 1 },
      })
      c.companions = [
        fam('f1', 'owl'),
        fam('f2', 'giant-eagle'),
        fam('f3', 'nope'),
        { uid: 's1', kind: 'steed', creatureId: 'wolf', hp: { current: 1, temp: 0, max: 1 } },
        { uid: 's2', kind: 'steed', creatureId: 'otherworldly-steed', hp: { current: 1, temp: 0, max: 1 } },
        { uid: 'o1', kind: 'other', creatureId: 'nope', hp: { current: 1, temp: 0, max: 1 } },
      ]
    },
  ],
  [
    'druide-niveau-10.json',
    'wild shape forms',
    (c) => {
      c.wildShape = {
        known: ['giant-eagle', 'owlbear', 'werewolf', 'wolf', 'cat', 'owl', 'eagle', 'dire-wolf', 'nope'],
      }
    },
  ],
]

const noEs = (ws: RuleWarning[]) => ws.filter((w) => !w.message.es?.trim()).map((w) => `${w.id}: ${w.message.en}`)

describe('warnings carry Spanish', () => {
  const ids = new Set<string>()
  for (const [f, what, mutate] of BROKEN)
    it(`${f}, broken ${what}`, () => {
      const c = load(f)
      mutate(c)
      const ws = validate(c, rules)
      expect(ws.length).toBeGreaterThan(0)
      expect(noEs(ws)).toEqual([])
      for (const w of ws) {
        ids.add(w.id.replace(/-\d+$|-[\w:]+$/, ''))
        // A translated message, not the English one copied (names alone may coincide).
        if (w.message.en.length > 25) expect(w.message.es, w.id).not.toBe(w.message.en)
      }
    })
  it('the broken builds cover many different checks', () => expect(ids.size).toBeGreaterThan(30))
  for (const f of files) it(`${f}`, () => expect(noEs(validate(load(f), rules))).toEqual([]))
})

/** Every { en, fr } object inside a value (a sheet), with its path. */
function untranslated(v: unknown, path = '', out: string[] = [], seen = new Set<unknown>()): string[] {
  if (!v || typeof v !== 'object' || seen.has(v)) return out
  seen.add(v)
  const o = v as Record<string, unknown>
  if (typeof o.en === 'string' && typeof o.fr === 'string') {
    if (o.en.trim() && !(typeof o.es === 'string' && o.es.trim())) out.push(`${path}: ${o.en}`)
    return out
  }
  for (const [k, x] of Object.entries(o)) if (k !== 'char' && k !== 'rules') untranslated(x, `${path}.${k}`, out, seen)
  return out
}

/** Labels of every breakdown part (any object with a `parts` array). */
function partLabels(
  v: unknown,
  out: { path: string; label: { en: string; es?: string } }[] = [],
  path = '',
  seen = new Set<unknown>(),
) {
  if (!v || typeof v !== 'object' || seen.has(v)) return out
  seen.add(v)
  const o = v as Record<string, unknown>
  if (Array.isArray(o.parts))
    for (const p of o.parts as { label?: { en: string; es?: string }; value?: unknown }[])
      if (p?.label && typeof p.value === 'number') out.push({ path, label: p.label })
  for (const [k, x] of Object.entries(o)) if (k !== 'char' && k !== 'rules') partLabels(x, out, `${path}.${k}`, seen)
  return out
}

describe('computed sheets carry Spanish', () => {
  for (const f of files)
    it(`${f}: breakdown labels and every text`, () => {
      const s = compute(load(f), rules)
      const labels = partLabels(s)
      expect(labels.length).toBeGreaterThan(20)
      expect(labels.filter((l) => !l.label.es?.trim()).map((l) => `${l.path}: ${l.label.en}`)).toEqual([])
      expect(untranslated(s)).toEqual([])
    })
})

describe('other engine texts carry Spanish', () => {
  it('hit point states', () => {
    const hp = (current: number, failures = 0, stable = false) =>
      ({ current, temp: 0, deathSaves: { successes: 0, failures }, stable }) as never
    const texts = [
      hpState(hp(5), 20, 6),
      hpState(hp(0, 3), 20),
      hpState(hp(0, 0, true), 20),
      hpState(hp(0), 20),
      hpState(hp(5), 20),
    ]
    expect(untranslated(texts)).toEqual([])
  })
  it('summoned creatures: attacks, multiattack, notes', () => {
    const caster = { attack: 7, dc: 15, mod: 4 }
    const out: unknown[] = [SUMMON_SPELLS]
    for (const sp of SUMMON_SPELLS)
      for (const c of sp.creatures) {
        const d = rules.creatures.get(c.creatureId)
        if (!d) continue
        for (const v of sp.variants?.map((x) => x.id) ?? [undefined]) out.push(summonAttacks(d, 7, v, caster))
        out.push(multiattack(d))
      }
    expect(untranslated(out)).toEqual([])
  })
  it('casting messages and Metamagic blockers', () => {
    const c = load('magicien-niveau-10.json')
    c.slotsUsed = []
    c.activeEffects = []
    let n = 0
    const newUid = () => `u${++n}`
    const r1 = castSpell(c, compute(c, rules), rules, rules.spells.get('fly')!, {
      classId: 'wizard',
      slot: { level: 3 },
      newUid,
    })
    const r2 = castSpell(c, compute(c, rules), rules, rules.spells.get('web')!, {
      classId: 'wizard',
      slot: { level: 2 },
      newUid,
    })
    const sorc = load('ensorceleuse-niveau-10.json')
    const opts = metamagicOptions(compute(sorc, rules), rules, rules.spells.get('fireball')!)
    expect(untranslated([r1, r2, opts])).toEqual([])
  })
  it('Wild Shape: view of a form and ineligible forms', () => {
    const c = load('druide-niveau-10.json')
    const s = compute(c, rules)
    const lim = wildShapeLimits(2)!
    const why = ['giant-eagle', 'owlbear', 'dire-wolf'].map((id) => wildShapeIneligible(rules.creatures.get(id)!, lim))
    expect(why.filter(Boolean).length).toBeGreaterThan(0)
    expect(untranslated([wildShapeView(c, s, rules.creatures.get('brown-bear')!, rules), why])).toEqual([])
  })
})
