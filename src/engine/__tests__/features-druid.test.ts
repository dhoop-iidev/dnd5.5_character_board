// Druid features against the SRD 5.2.1 text (Druid p. 41–46): Druidic, Primal Order, Wild Shape, Wild Resurgence,
// Elemental Fury, Circle of the Land (Circle Spells, Natural Recovery, Nature's Ward); the examples/druide-niveau-10.json
// build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { newCharacter } from '../../model/newCharacter'
import { compute } from '../compute'
import { validate } from '../validate'
// Spells still to choose (fewer cantrips, prepared or spellbook spells than allowed) are not what these tests check.
const toChoose = (w: { id: string }) => /^(prepared|cantrips|spellbook)-missing/.test(w.id)

type Abilities = Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
const ABIL: Abilities = { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 8 }

/** A human druid of the given level (Circle of the Land from level 3, Ability Score Improvement on Wis at 4 and 8). */
const druid = (
  level: number,
  opts: {
    order?: 'magician' | 'warden'
    fury?: 'potent-spellcasting' | 'primal-strike'
    land?: string
    abilities?: Partial<Abilities>
  } = {},
) => {
  const c = newCharacter(
    {
      name: 'Test',
      speciesId: 'human',
      backgroundId: 'sage',
      classId: 'druid',
      lang: 'en',
      abilities: { ...ABIL, ...opts.abilities },
    },
    rules,
  )
  c.background.abilities = { wis: 2, con: 1 }
  c.background.feat.choices = { list: 'druid', ability: 'wis', cantrips: ['mending', 'resistance'], spell: ['jump'] }
  c.skillProficiencies = ['nature', 'perception']
  c.featureChoices['human:skillful'] = 'insight'
  c.extraFeats['human:versatile'] = { featId: 'alert' }
  c.levels[0].choices['druid:primal-order'] = opts.order ?? 'magician'
  for (let i = 2; i <= level; i++)
    c.levels.push({
      classId: 'druid',
      hpRoll: 5,
      hpFixed: true,
      choices: i === 7 ? { 'druid:elemental-fury': opts.fury ?? 'primal-strike' } : {},
      ...(i === 3 ? { subclassId: 'druid:circle-of-the-land' } : {}),
      ...(i === 4 || i === 8 ? { feat: { featId: 'ability-score-improvement', abilities: { wis: 2 } } } : {}),
    })
  if (opts.land) c.featureChoices['druid:circle-of-the-land:spells'] = opts.land
  c.spellcasting.druid = { prepared: [], cantrips: [] }
  c.inventory = [{ uid: 'w', kind: 'weapon', refId: 'scimitar', quantity: 1, location: 'worn', equipped: true }]
  return c
}

const actionable = (c: ReturnType<typeof druid>) =>
  validate(c, rules).filter((w) => (w.severity === 'error' || w.actionable) && !toChoose(w))
const resource = (c: ReturnType<typeof druid>, id: string) => compute(c, rules).resources.find((r) => r.id === id)
const value = (c: ReturnType<typeof druid>, owner: string, id: string) =>
  compute(c, rules).featureValues.find((v) => v.ownerId === owner && v.id === id)

describe('Druidic and Primal Order (SRD p. 42)', () => {
  it('Druidic: Speak with Animals always prepared (p. 42)', () => {
    const c = druid(1)
    const s = compute(c, rules)
    expect(s.spellcasting[0].alwaysPrepared).toEqual(['speak-with-animals'])
    c.spellcasting.druid = {
      prepared: ['speak-with-animals', 'cure-wounds', 'entangle', 'faerie-fire', 'goodberry'],
      cantrips: [],
    }
    expect(validate(c, rules).filter((w) => w.area === 'spells' && !toChoose(w))).toEqual([]) // 4 counted out of 4
  })
  it('Magician: one extra cantrip (2 + 1 at level 1), Wisdom modifier (min +1) on Arcana and Nature checks (p. 42)', () => {
    const s = compute(druid(1, { order: 'magician' }), rules)
    expect(s.spellcasting[0].cantripsMax).toBe(3)
    expect(s.skills.find((k) => k.id === 'arcana')!.total.total).toBe(1 + 2 + 4) // Int 12, Sage proficiency, Wis 18
    expect(s.skills.find((k) => k.id === 'nature')!.total.total).toBe(1 + 2 + 4)
    expect(s.skills.find((k) => k.id === 'religion')!.total.total).toBe(1) // not a Magician skill
    expect(s.proficiencies.armor).not.toContain('medium')
  })
  it('Warden: Martial weapons and Medium armor training, no extra cantrip (p. 42)', () => {
    const s = compute(druid(1, { order: 'warden' }), rules)
    expect(s.spellcasting[0].cantripsMax).toBe(2)
    expect(s.proficiencies.weapons).toContain('martial')
    expect(s.proficiencies.armor).toContain('medium')
  })
})

describe('Wild Shape (SRD p. 42) and Wild Resurgence (p. 43)', () => {
  it('two uses at level 2, three at level 6 (Druid Features table p. 41); one back per Short Rest (p. 42)', () => {
    expect(resource(druid(1), 'druid:wild-shape')).toBeUndefined()
    const r = resource(druid(2), 'druid:wild-shape')!
    expect(r.max).toBe(2)
    expect(r.per).toBe('long')
    expect(r.shortRestRegain).toBe(1)
    expect(resource(druid(5), 'druid:wild-shape')!.max).toBe(2)
    expect(resource(druid(6), 'druid:wild-shape')!.max).toBe(3)
  })
  it('Temporary Hit Points equal to the Druid level when assuming a form (p. 42)', () => {
    expect(value(druid(2), 'druid:wild-shape', 'temp-hp')!.stat.total).toBe(2)
    expect(value(druid(9), 'druid:wild-shape', 'temp-hp')!.stat.total).toBe(9)
  })
  it('Wild Resurgence (level 5): a Wild Shape use for a level 1 slot, once per Long Rest (p. 43)', () => {
    expect(resource(druid(4), 'druid:wild-resurgence')).toBeUndefined()
    const r = resource(druid(5), 'druid:wild-resurgence')!
    expect(r.max).toBe(1)
    expect(r.per).toBe('long')
  })
})

describe('Elemental Fury (SRD p. 43)', () => {
  it('Primal Strike: an extra 1d8 Cold, Fire, Lightning or Thunder on a hit, once per turn', () => {
    const s = compute(druid(7, { fury: 'primal-strike' }), rules)
    expect(s.attacks[0].extraDamage.map((d) => d.dice)).toContain('1d8')
    expect(compute(druid(6), rules).attacks[0].extraDamage).toEqual([])
  })
  it('Potent Spellcasting: Wisdom modifier added to Druid cantrip damage', () => {
    const c = druid(7, { fury: 'potent-spellcasting' })
    expect(value(c, 'druid:elemental-fury', 'potent-spellcasting')!.stat.total).toBe(5) // Wis 16 + 2 + 2 = 20
    expect(compute(c, rules).attacks[0].extraDamage).toEqual([])
  })
})

describe('Circle of the Land (SRD p. 46)', () => {
  it('Circle Spells follow the land chosen after a Long Rest, by Druid level (p. 46)', () => {
    const polar3 = compute(druid(3, { land: 'polar' }), rules).spellcasting[0]
    expect(polar3.spellChoice?.value).toBe('polar')
    expect([...polar3.alwaysPrepared].sort()).toEqual([
      'fog-cloud',
      'hold-person',
      'ray-of-frost',
      'speak-with-animals',
    ])
    expect(compute(druid(5, { land: 'polar' }), rules).spellcasting[0].alwaysPrepared).toContain('sleet-storm')
    expect(compute(druid(7, { land: 'polar' }), rules).spellcasting[0].alwaysPrepared).toContain('ice-storm')
    const polar9 = compute(druid(9, { land: 'polar' }), rules).spellcasting[0]
    expect(polar9.alwaysPrepared).toContain('cone-of-cold')
    expect(polar9.alwaysPrepared).toHaveLength(7)
    expect(compute(druid(3, { land: 'arid' }), rules).spellcasting[0].alwaysPrepared).toContain('fire-bolt')
    expect(compute(druid(3, { land: 'temperate' }), rules).spellcasting[0].alwaysPrepared).toContain('misty-step')
    expect(compute(druid(3, { land: 'tropical' }), rules).spellcasting[0].alwaysPrepared).toContain('web')
  })
  it('a Circle Spell prepared doesn’t count and may exceed the Druid list (Ray of Frost is a Sorcerer/Wizard cantrip)', () => {
    const c = druid(3, { land: 'polar' })
    c.spellcasting.druid = {
      prepared: [
        'fog-cloud',
        'hold-person',
        'cure-wounds',
        'entangle',
        'faerie-fire',
        'goodberry',
        'healing-word',
        'barkskin',
      ],
      cantrips: ['ray-of-frost', 'druidcraft', 'guidance'],
    }
    expect(validate(c, rules).filter((w) => w.area === 'spells' && !toChoose(w))).toEqual([]) // 6 counted of 6; Ray of Frost accepted off-list
  })
  it('Natural Recovery (level 6): one free Circle Spell per Long Rest (p. 46)', () => {
    expect(resource(druid(5), 'druid:circle-of-the-land:natural-recovery')).toBeUndefined()
    const r = resource(druid(6), 'druid:circle-of-the-land:natural-recovery')!
    expect(r.max).toBe(1)
    expect(r.per).toBe('long')
  })
  it('Nature’s Ward (level 10): immune to the Poisoned condition (p. 46)', () => {
    const immune = (level: number) =>
      compute(druid(level), rules).pool.grants.some((g) => g.grant.kind === 'immunity' && g.grant.on === 'poisoned')
    expect(immune(9)).toBe(false)
    expect(immune(10)).toBe(true)
  })
  it('Land’s Aid: 2d6 at level 3, 3d6 at level 10, 4d6 at level 14 (p. 46)', () => {
    const dice = (lvl: number) =>
      compute(druid(lvl), rules).featureValues.find((v) => v.ownerId === 'druid:circle-of-the-land:lands-aid')?.dice
    expect(dice(3)).toBe('2d6')
    expect(dice(10)).toBe('3d6')
    expect(dice(14)).toBe('4d6')
  })
})

describe('examples/druide-niveau-10.json: forest gnome Druid 10, Circle of the Land, Criminal', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'druide-niveau-10.json'), 'utf8')),
  )
  const s = compute(c, rules)
  it('level 10, PB +4, Wis 19 (15 + 2 + 2), Dex 16, hit points 8 + 9 × 5 + 10 × 2', () => {
    expect(s.level).toBe(10)
    expect(s.pb).toBe(4)
    expect(s.abilities.wis.score.total).toBe(19)
    expect(s.abilities.dex.score.total).toBe(16)
    expect(s.hpMax.total).toBe(73)
    expect(c.hp.current).toBe(s.hpMax.total)
  })
  it('initiative Dex +3 + PB (Alert); AC 11 + 3 + 2; Wild Shape 3 uses, 8 known forms', () => {
    expect(s.initiative.total).toBe(3 + 4)
    expect(s.ac.total).toBe(16)
    expect(s.resources.find((r) => r.id === 'druid:wild-shape')!.max).toBe(3)
    expect(c.wildShape.known).toHaveLength(8)
  })
  it('spells: 5 cantrips (Magician), 15 prepared, Speak with Animals + temperate Circle Spells always prepared, DC 16', () => {
    const sc = s.spellcasting[0]
    expect(sc.cantripsMax).toBe(5)
    expect(sc.cantrips.length).toBe(5)
    expect(sc.prepared.length).toBe(sc.preparedMax)
    expect(sc.spellChoice?.value).toBe('temperate')
    expect([...sc.alwaysPrepared].sort()).toEqual([
      'freedom-of-movement',
      'lightning-bolt',
      'misty-step',
      'shocking-grasp',
      'sleep',
      'speak-with-animals',
      'tree-stride',
    ])
    expect(sc.dc.total).toBe(8 + 4 + 4)
    expect(s.extraSpells.find((x) => x.ownerId === 'gnome:gnomish-lineage')?.spells).toEqual([
      'minor-illusion',
      'speak-with-animals',
    ])
  })
  it('Potent Spellcasting +4; immune to Poisoned; no error or actionable warning', () => {
    expect(s.featureValues.find((v) => v.ownerId === 'druid:elemental-fury')!.stat.total).toBe(4)
    expect(s.pool.grants.some((g) => g.grant.kind === 'immunity' && g.grant.on === 'poisoned')).toBe(true)
    expect(actionable(c).map((w) => `${w.id}: ${w.message.en}`)).toEqual([])
  })
})
