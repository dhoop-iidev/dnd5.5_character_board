// The cleanup after a structural change (model/reconcile.ts): it keeps every choice of a legal character, and removes
// what a change left behind (a Fighting Style of a class the row no longer has, the choices of removed levels, a feat on
// a row that is no longer an Ability Score Improvement level, a feat granted by a feature that is gone).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { compute } from '../../engine/compute'
import { migrate } from '../migrate'
import { reconcile, structureOf } from '../reconcile'

const EXAMPLES = join(__dirname, '..', '..', '..', 'examples')
const load = (f: string) => migrate(JSON.parse(readFileSync(join(EXAMPLES, f), 'utf8')))
const files = readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'))

describe('reconcile', () => {
  for (const f of files)
    it(`keeps everything of ${f}`, () => {
      const c = load(f)
      const before = JSON.stringify(c)
      expect(reconcile(c, rules)).toEqual([])
      expect(JSON.stringify(c)).toBe(before)
    })

  it('a Fighter whose rows all become Wizard loses the Fighting Style', () => {
    const c = load('guerrier-niveau-10.json')
    for (const l of c.levels) l.classId = 'wizard'
    const removed = reconcile(c, rules)
    expect(removed).toContain('featureChoices.fighter:fighting-style')
    expect(c.featureChoices['fighter:fighting-style']).toBeUndefined()
  })

  it('removed levels take their feature choices, subclass feats and granted feats with them', () => {
    const c = load('guerrier-niveau-10.json')
    const had = Object.keys(c.featureChoices).length + Object.keys(c.extraFeats).length
    c.levels = c.levels.slice(0, 1)
    reconcile(c, rules)
    const s = compute(c, rules)
    expect(Object.keys(c.featureChoices).length + Object.keys(c.extraFeats).length).toBeLessThan(had)
    expect(reconcile(c, rules)).toEqual([]) // stable
    expect(s.feats.every((f) => f.from !== 'class' || c.featureChoices[f.grantedBy ?? ''] !== undefined)).toBe(true)
  })

  it('a feat on a row that is no longer an Ability Score Improvement level is removed', () => {
    const c = load('guerrier-niveau-10.json')
    const i = c.levels.findIndex((l) => l.feat)
    c.levels.splice(0, 1) // every later row moves one class level down
    const removed = reconcile(c, rules)
    expect(removed.some((r) => r.endsWith('.feat'))).toBe(true)
    expect(c.levels[i - 1].feat).toBeUndefined()
  })

  it('the structure key changes with a class, a subclass, a feat or the species, not with a skill pick', () => {
    const c = load('guerrier-niveau-10.json')
    const k = structureOf(c)
    c.featureChoices['human:skillful'] = 'arcana'
    expect(structureOf(c)).toBe(k)
    c.levels[2].subclassId = undefined
    expect(structureOf(c)).not.toBe(k)
  })
})

describe('reconcile with custom content', () => {
  it('keeps a custom subclass (house rule #5)', () => {
    const c = load('guerrier-niveau-10.json')
    const sub = c.levels[2].subclassId
    c.customSubclasses = [
      { id: 'custom-subclass-1', classId: 'fighter', name: 'Mine', book: 'X', text: '', features: [] } as never,
    ]
    c.levels[2].subclassId = 'custom-subclass-1'
    reconcile(c, rules)
    expect(c.levels[2].subclassId).toBe('custom-subclass-1')
    expect(sub).toBeTruthy()
  })
})
