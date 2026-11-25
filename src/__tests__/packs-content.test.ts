// Full checks of the private content packs (house rule #7, docs/packs.md): run with `PACKS_DIR=<folder> npm test`
// (every `*.pack.json` of the folder). Skipped otherwise: the packs hold book text and never live in this repository.
// The checks are those the SRD data passes (features-coverage, activation-coverage, summaries tests), for every level.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildRules, type Rules } from '../data/rules'
import type { EffectDef, I18n, Source } from '../data/types'
import { ABILITIES } from '../data/types'
import { compute } from '../engine/compute'
import { STANDARD_ACTIONS } from '../engine/turn'
import { validate } from '../engine/validate'
import type { Character } from '../model/character'
import { CUSTOM_BACKGROUND } from '../model/customBackground'
import { newCharacter } from '../model/newCharacter'
import { installPack, readPack, resetPacks, type ContentPack } from '../model/packs'

const DIR = process.env.PACKS_DIR
const files = DIR ? readdirSync(DIR).filter((f) => f.endsWith('.pack.json')) : []
const ABIL = { str: 15, dex: 14, con: 14, int: 13, wis: 13, cha: 13 }
const NAMES_A_TURN_PART =
  /Bonus Action|\b(take|use|as) a Reaction\b|Magic action|take the (Attack|Dash|Disengage|Dodge|Help|Hide|Influence|Magic|Ready|Search|Study|Utilize) action|additional action/i
const strip = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ')
const full = (t: I18n | undefined) => !!t && !!t.en?.trim() && !!t.fr?.trim() && !!t.es?.trim()
const modelled = (e: EffectDef | undefined) =>
  !!e &&
  !!(
    e.modifiers?.length ||
    e.grants?.length ||
    e.uses ||
    e.flags?.length ||
    e.acFormula ||
    e.choices?.length ||
    e.computed?.length ||
    e.spells ||
    e.mastery !== undefined ||
    e.overrides?.length ||
    e.textOnly ||
    e.weapon ||
    e.wildShape
  )

afterAll(() => resetPacks())

describe.skipIf(!files.length)('content packs in PACKS_DIR', () => {
  for (const f of files) {
    describe(f, () => {
      const pack: ContentPack = readPack(JSON.parse(readFileSync(join(DIR!, f), 'utf8')))
      resetPacks()
      const rules: Rules = buildRules()
      const skipped = installPack(rules, pack)
      // The other packs of the folder after it: a pack may use another book's entries (MotM's Earth Genasi casts the
      // PHB's Blade Ward), as when both are loaded in the app.
      for (const g of files) if (g !== f) installPack(rules, readPack(JSON.parse(readFileSync(join(DIR!, g), 'utf8'))))

      it('installs without replacing an SRD entry', () => expect(skipped).toEqual([]))

      /** Every owner of the pack (species trait, feat, subclass feature, class option) with its English text. */
      const owners: { id: string; text: string }[] = []
      for (const sp of pack.species ?? []) for (const t of sp.traits) owners.push({ id: t.id, text: strip(t.text.en) })
      for (const ft of pack.feats ?? []) owners.push({ id: `feat:${ft.id}`, text: strip(ft.text.en) })
      for (const sc of pack.subclasses ?? [])
        for (const x of sc.features) owners.push({ id: x.id, text: strip(x.text.en) })
      for (const o of pack.classOptions ?? []) owners.push({ id: o.id, text: strip(o.text.en) })
      const ownerIds = new Set(owners.map((o) => o.id))

      it('names and texts in English, French and Spanish; sources point to the book', () => {
        const bad: string[] = []
        const check = (id: string, e: { name?: I18n; text?: I18n; source?: Source }) => {
          if (e.name && !full(e.name)) bad.push(`${id}: name`)
          if (e.text && !full(e.text)) bad.push(`${id}: text`)
          if (e.source?.pack !== pack.id || !e.source?.bookPage) bad.push(`${id}: source`)
        }
        for (const s of pack.species ?? []) {
          check(s.id, s)
          if (!full(s.sizeText) || !full(s.creatureType)) bad.push(`${s.id}: size/type text`)
          for (const t of s.traits) check(t.id, t)
        }
        for (const b of pack.backgrounds ?? []) {
          check(b.id, b)
          if (!full(b.featText) || !full(b.tool) || !full(b.equipment)) bad.push(`${b.id}: feat/tool/equipment text`)
        }
        for (const x of pack.feats ?? []) {
          check(x.id, x)
          if (!full(x.categoryText)) bad.push(`${x.id}: categoryText`)
        }
        for (const s of pack.spells ?? []) {
          check(s.id, s)
          for (const k of ['castingTime', 'range', 'duration'] as const) if (!full(s[k])) bad.push(`${s.id}: ${k}`)
          if (s.upcast && !full(s.upcast)) bad.push(`${s.id}: upcast`)
          if (s.components.m && !full(s.components.m)) bad.push(`${s.id}: material`)
        }
        for (const sc of pack.subclasses ?? []) {
          check(sc.id, sc)
          for (const x of sc.features) check(x.id, x)
        }
        for (const o of pack.classOptions ?? []) check(o.id, o)
        expect(bad).toEqual([])
      })

      it('every owner has an effect entry, and every effect an owner', () => {
        expect(owners.filter((o) => !modelled(rules.effects.get(o.id))).map((o) => o.id)).toEqual([])
        expect((pack.effects ?? []).filter((e) => !ownerIds.has(e.id)).map((e) => e.id)).toEqual([])
      })

      it('owners whose text names a part of the turn have an activation; activations are well formed', () => {
        expect(
          owners.filter((o) => NAMES_A_TURN_PART.test(o.text) && !rules.effects.get(o.id)?.activation).map((o) => o.id),
        ).toEqual([])
        const toggles = new Set<string>()
        for (const e of rules.effects.values())
          for (const x of [...(e.modifiers ?? []), ...(e.grants ?? [])])
            if (x.when?.startsWith('toggle:')) toggles.add(x.when.slice('toggle:'.length))
        const problems: string[] = []
        for (const e of pack.effects ?? [])
          for (const a of e.activation ?? []) {
            if (!['action', 'bonus-action', 'reaction', 'free', 'attack'].includes(a.kind))
              problems.push(`${e.id}: kind ${a.kind}`)
            for (const s of [...(a.actions ?? []), ...(a.action ? [a.action] : [])])
              if (!STANDARD_ACTIONS.includes(s)) problems.push(`${e.id}: action ${s}`)
            const res = a.cost?.resource
            if (res && !rules.effects.get(res)?.uses) problems.push(`${e.id}: resource ${res} has no uses`)
            for (const t of [a.setsToggle, a.when?.replace(/^!?toggle:/, '')])
              if (t && !toggles.has(t)) problems.push(`${e.id}: switch ${t} read by no effect`)
            if (a.name && !full(a.name)) problems.push(`${e.id}: activation name`)
            if (a.trigger && !full(a.trigger)) problems.push(`${e.id}: trigger`)
          }
        expect(problems).toEqual([])
      })

      it('effects name known spells, skills, abilities and options; choices are complete', () => {
        const problems: string[] = []
        const spellOk = (id: string, where: string) => {
          if (!rules.spells.has(id)) problems.push(`${where}: unknown spell ${id}`)
        }
        const spellsOf = (s: EffectDef['spells'], where: string) => {
          for (const id of s?.always ?? []) spellOk(id, where)
          for (const l of Object.values(s?.byLevel ?? {})) for (const id of l) spellOk(id, where)
        }
        for (const e of pack.effects ?? []) {
          spellsOf(e.spells, e.id)
          if (e.textOnly && !full(e.textOnly)) problems.push(`${e.id}: textOnly`)
          for (const c of e.choices ?? []) {
            if (c.name && !full(c.name)) problems.push(`${e.id}: choice name`)
            for (const [k, o] of Object.entries(c.options ?? {})) {
              if (!full(o.name)) problems.push(`${e.id}: option ${k} name`)
              spellsOf(o.spells, `${e.id}#${k}`)
            }
            if (c.kind === 'skill' && Array.isArray(c.from))
              for (const s of c.from) if (!rules.skills.has(s)) problems.push(`${e.id}: skill ${s}`)
          }
          for (const g of e.grants ?? [])
            if (g.kind === 'proficiency' && g.on?.startsWith('skill.') && !rules.skills.has(g.on.slice(6)))
              problems.push(`${e.id}: skill ${g.on}`)
          for (const c of e.computed ?? []) if (!full(c.label)) problems.push(`${e.id}: computed label`)
        }
        for (const sc of pack.subclasses ?? [])
          for (const l of sc.spells ?? []) for (const id of l.spells) spellOk(id, sc.id)
        expect(problems).toEqual([])
      })

      it('summaries for every entry, in three languages', () => {
        const keys = [
          ...(pack.species ?? []).flatMap((s) => [`species:${s.id}`, ...s.traits.map((t) => `trait:${t.id}`)]),
          ...(pack.backgrounds ?? []).map((b) => `background:${b.id}`),
          ...(pack.feats ?? []).map((x) => `feat:${x.id}`),
          ...(pack.spells ?? []).map((s) => `spell:${s.id}`),
          ...(pack.subclasses ?? []).flatMap((s) => s.features.map((x) => `feature:${x.id}`)),
        ]
        expect(keys.filter((k) => !full(pack.summaries?.[k]))).toEqual([])
      })

      it('backgrounds, spells and subclasses are well formed', () => {
        const problems: string[] = []
        for (const b of pack.backgrounds ?? []) {
          if (b.abilities.length !== 3 || b.abilities.some((a) => !ABILITIES.includes(a)))
            problems.push(`${b.id}: abilities`)
          if (b.skills.length !== 2 || b.skills.some((s) => !rules.skills.has(s))) problems.push(`${b.id}: skills`)
          if (rules.feats.get(b.feat)?.category !== 'origin') problems.push(`${b.id}: feat ${b.feat}`)
          for (const k of b.kits ?? [])
            for (const it of k.items)
              if (it.id && !rules.weapons.has(it.id) && !rules.armor.has(it.id) && !rules.gear.has(it.id))
                problems.push(`${b.id}: kit item ${it.id}`)
        }
        for (const s of pack.spells ?? []) {
          if (s.level < 0 || s.level > 9) problems.push(`${s.id}: level`)
          for (const c of s.classes) if (!rules.classes.has(c)) problems.push(`${s.id}: class ${c}`)
          if (!s.classes.length) problems.push(`${s.id}: no class list`)
        }
        for (const sc of pack.subclasses ?? []) {
          if (!sc.id.startsWith(`${sc.classId}:`)) problems.push(`${sc.id}: id`)
          for (const x of sc.features) if (!x.id.startsWith(`${sc.id}:`)) problems.push(`${x.id}: id`)
        }
        expect(problems).toEqual([])
      })

      it('characters built with every entry compute and check without errors', () => {
        const errors: string[] = []
        const tryIt = (what: string, c: Character) => {
          try {
            compute(c, rules)
            validate(c, rules)
          } catch (e) {
            errors.push(`${what}: ${(e as Error).message}`)
          }
        }
        const make = (o: { speciesId?: string; backgroundId?: string; classId?: string }) =>
          newCharacter(
            {
              name: 'T',
              speciesId: o.speciesId ?? 'human',
              backgroundId: o.backgroundId ?? 'soldier',
              classId: o.classId ?? 'fighter',
              lang: 'en',
              abilities: ABIL,
              speciesChoices: { size: 'medium' },
              backgroundKit: 'A',
            },
            rules,
          )
        const level = (c: Character, n: number, subclassId?: string) => {
          while (c.levels.length < n)
            c.levels.push({
              classId: c.levels[0].classId,
              hpRoll: 0,
              hpFixed: true,
              ...(c.levels.length === 2 && subclassId ? { subclassId } : {}),
            })
          return c
        }
        for (const s of pack.species ?? []) tryIt(s.id, level(make({ speciesId: s.id }), 20))
        for (const b of pack.backgrounds ?? []) tryIt(b.id, make({ backgroundId: b.id }))
        for (const x of pack.feats ?? []) {
          const c = level(make({}), 20)
          if (x.category === 'origin') {
            c.background = {
              backgroundId: CUSTOM_BACKGROUND,
              abilities: {},
              feat: { featId: x.id },
              custom: { abilities: ['str', 'dex', 'con'], skills: ['athletics', 'insight'], tool: '' },
            }
          } else if (x.category === 'fighting-style') c.featureChoices['fighter:fighting-style'] = x.id
          else c.levels[x.category === 'epic-boon' ? 18 : 3].feat = { featId: x.id, abilities: {} }
          tryIt(`feat ${x.id}`, c)
        }
        for (const sc of pack.subclasses ?? []) tryIt(sc.id, level(make({ classId: sc.classId }), 20, sc.id))
        expect(errors).toEqual([])
      })
    })
  }
})

if (!files.length) describe('content packs', () => it.skip('PACKS_DIR not set', () => {}))
