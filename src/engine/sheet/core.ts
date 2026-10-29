// Stage 3: ability scores and modifiers, Proficiency Bonus, saving throws, hit point maximum and Hit Point Dice.
import type { AbilityId } from '../../data/types'
import { ABILITIES } from '../../data/types'
import { type Part, esOf, resolve, i18n } from '../stacking'
import { ABILITY_NAMES, SRC, abilityMod, fixedHp, pbForLevel } from './common'
import type { AbilityBlock, BuildResult, ComputeOptions, CoreResult, ModifiersResult } from './types'

type In = BuildResult & ModifiersResult

export function coreStage(b: In, _opts: ComputeOptions): CoreResult {
  const { char, rules } = b
  const pb = pbForLevel(rules, b.level)
  const exhaustion = -2 * (char.exhaustion ?? 0)
  // First class: saving-throw proficiencies (a later class grants none, SRD p. 25 "Multiclassing > Proficiencies").
  const first = b.classes.get(b.classOrder[0])
  const abilities = {} as Record<AbilityId, AbilityBlock>
  // Epic Boons raise the maximum of the score they increase to 30 (SRD p. 88 "Ability Score Increase… to a maximum of 30").
  const boonRaised = new Set<AbilityId>()
  const picks = [char.background?.feat, ...b.levels.map((l) => l.feat), ...Object.values(char.extraFeats ?? {})]
  for (const p of picks) {
    if (!p) continue
    if (rules.feats.get(p.featId)?.category !== 'epic-boon') continue
    for (const [a, v] of Object.entries(p.abilities ?? {})) if (v) boonRaised.add(a as AbilityId)
  }
  const scores = {} as Record<AbilityId, ReturnType<typeof resolve>>
  for (const id of ABILITIES) {
    const parts: Part[] = [
      {
        sourceId: 'base',
        label: i18n('Base score', 'Valeur de base', 'Puntuación base'),
        value: char.baseAbilities?.[id] ?? 10,
        source: { page: 20, frPage: 21, section: 'Character Creation > Ability Scores' },
      },
    ]
    const bg = char.background?.abilities?.[id]
    if (bg)
      parts.push({
        sourceId: 'background',
        label: b.background?.name ?? i18n('Background', 'Historique', 'Trasfondo'),
        value: bg,
        source: { page: 20, frPage: 21, section: 'Character Creation > Background' },
      })
    const bgFeat = char.background?.feat?.abilities?.[id]
    if (bgFeat)
      parts.push({
        sourceId: `feat:${char.background.feat.featId}`,
        label: rules.feats.get(char.background.feat.featId)?.name ?? i18n('Feat', 'Don', 'Dote'),
        value: bgFeat,
      })
    b.levels.forEach((l, i) => {
      const v = l.feat?.abilities?.[id]
      if (v && l.feat) {
        const def = rules.feats.get(l.feat.featId)
        parts.push({
          sourceId: `feat:${l.feat.featId}:${i + 1}`,
          label: {
            en: `${def?.name.en ?? l.feat.featId} (level ${i + 1})`,
            fr: `${def?.name.fr ?? l.feat.featId} (niveau ${i + 1})`,
            es: `${esOf(def?.name) || l.feat.featId} (nivel ${i + 1})`,
          },
          value: v,
          source: def?.source,
        })
      }
    })
    for (const [i, f] of Object.entries(char.extraFeats ?? {})) {
      const v = f.abilities?.[id]
      if (v) {
        const def = rules.feats.get(f.featId)
        parts.push({
          sourceId: `feat:${f.featId}:${i}`,
          label: def?.name ?? i18n(f.featId, f.featId, f.featId),
          value: v,
          source: def?.source,
        })
      }
    }
    // Feature parts that also raise the maximum (Primal Champion, Body and Mind) apply after the cap of 20, like Epic Boons.
    const maxParts = b.pool.parts(`ability.${id}.max`)
    const raisers = new Set(maxParts.map((p) => p.sourceId))
    const featureParts = b.pool.parts(`ability.${id}`)
    const boonParts = parts.filter((p) => {
      const pick = picks.find((x) => x && p.sourceId.startsWith(`feat:${x.featId}`))
      return pick && rules.feats.get(pick.featId)?.category === 'epic-boon'
    })
    const phaseA = [
      ...parts.filter((p) => !boonParts.includes(p)),
      ...featureParts.filter((p) => !raisers.has(p.sourceId)),
    ]
    const phaseB = [...boonParts, ...featureParts.filter((p) => raisers.has(p.sourceId))]
    const score = resolve([...phaseA, ...phaseB])
    const capSource = { page: 20, frPage: 21, section: 'Character Creation > Ability Scores' }
    // Phase A can't exceed 20 (p. 20; Ability Score Improvement "can't increase an ability score above 20", p. 87).
    const totalA = resolve(phaseA).total
    if (totalA > 20) {
      score.parts.push({
        sourceId: 'max',
        label: i18n('Maximum 20', 'Maximum 20', 'Máximo 20'),
        value: 20 - totalA,
        active: true,
        source: capSource,
      })
      score.total -= totalA - 20
    }
    // Phase B: Epic Boons to 30 (p. 88), capstones to 20 + their '.max' parts (p. 30, p. 52).
    const max = boonRaised.has(id) ? 30 : 20 + maxParts.reduce((s, p) => s + p.value, 0)
    if (score.total > max) {
      score.parts.push({
        sourceId: 'max',
        label: i18n(`Maximum ${max}`, `Maximum ${max}`, `Máximo ${max}`),
        value: max - score.total,
        active: true,
        source: capSource,
      })
      score.total = max
    }
    // Items that set a score ("Your Strength is 19 while you wear these gauntlets. They have no effect on you if your
    // Strength is 19 or higher without them", SRD p. 223; Belt of Giant Strength p. 213; Amulet of Health p. 209;
    // Headband of Intellect p. 225): 'ability.<id>.set' parts; the highest applies, only when it raises the score.
    const setParts = b.pool.parts(`ability.${id}.set`).filter((p) => !p.condition || p.situationalOn)
    const setTo = setParts.reduce<(typeof setParts)[number] | undefined>(
      (best, p) => (!best || p.value > best.value ? p : best),
      undefined,
    )
    if (setTo && setTo.value > score.total) {
      score.parts.push({
        ...setTo,
        label: {
          en: `${setTo.label.en}: score ${setTo.value}`,
          fr: `${setTo.label.fr} : valeur ${setTo.value}`,
          es: `${esOf(setTo.label)}: puntuación ${setTo.value}`,
        },
        value: setTo.value - score.total,
        effectName: undefined,
        active: true,
      })
      score.total = setTo.value
    }
    scores[id] = score
  }
  // Ability-valued parts ('cha:min1' of Aura of Protection…) can resolve from here on.
  b.pool.setAbilityMods(
    Object.fromEntries(ABILITIES.map((id) => [id, abilityMod(scores[id].total)])) as Record<AbilityId, number>,
  )
  for (const id of ABILITIES) {
    const score = scores[id]
    const mod = abilityMod(score.total)
    const grantedSave = b.pool.grants.find((g) => g.grant.kind === 'proficiency' && g.grant.on === `save.${id}`)
    const saveProficient = !!first?.saveProficiencies.includes(id) || !!grantedSave
    const saveParts: Part[] = [
      {
        sourceId: 'ability',
        label: {
          en: `${ABILITY_NAMES[id].en} modifier`,
          fr: `Modificateur de ${ABILITY_NAMES[id].fr}`,
          es: `Modificador de ${esOf(ABILITY_NAMES[id])}`,
        },
        value: mod,
        source: SRC.saves,
      },
    ]
    if (first?.saveProficiencies.includes(id))
      saveParts.push({
        sourceId: 'pb',
        label: {
          en: `Proficiency Bonus (${first.name.en})`,
          fr: `Bonus de maîtrise (${first.name.fr})`,
          es: `Bonificador por competencia (${esOf(first.name)})`,
        },
        value: pb,
        effectName: 'Proficiency Bonus',
        source: SRC.saves,
      })
    else if (grantedSave)
      saveParts.push({
        sourceId: 'pb',
        label: {
          en: `Proficiency Bonus (${grantedSave.owner.name.en})`,
          fr: `Bonus de maîtrise (${grantedSave.owner.name.fr})`,
          es: `Bonificador por competencia (${esOf(grantedSave.owner.name)})`,
        },
        value: pb,
        effectName: 'Proficiency Bonus',
        source: grantedSave.owner.source ?? SRC.saves,
      })
    saveParts.push(...b.pool.parts(`save.${id}`), ...b.pool.parts('save.all'), ...b.pool.parts('d20'))
    if (exhaustion)
      saveParts.push({
        sourceId: 'exhaustion',
        label: i18n('Exhaustion', 'Épuisement', 'Cansancio'),
        value: exhaustion,
        source: SRC.exhaustion,
      })
    abilities[id] = {
      id,
      score,
      mod,
      save: resolve(saveParts, {
        advantage: b.pool.advantage(`save.${id}`),
        disadvantage: b.pool.disadvantage(`save.${id}`),
      }),
      saveProficient,
    }
  }
  // Hit points: level 1 = max of the first class's Hit Point Die + Con; each later level = roll or fixed value + Con, at
  // least 1 per level (SRD p. 22 "Hit Points", p. 23 "Gaining a Level", p. 24 "Multiclassing > Hit Points").
  const con = abilities.con.mod
  const hpParts: Part[] = []
  const hitDice: CoreResult['hitDice'] = []
  const byClass: Record<string, { dice: number; from: number }> = {}
  b.levels.forEach((l, i) => {
    const def = rules.classes.get(l.classId)
    const die = def?.hitDie ?? 8
    let gained: number
    if (i === 0) gained = die + con
    else gained = Math.max(1, (l.hpFixed ? fixedHp(die) : l.hpRoll) + con)
    const e = (byClass[l.classId] ??= { dice: 0, from: 0 })
    e.dice += 1
    e.from += gained
  })
  for (const [cid, e] of Object.entries(byClass)) {
    const def = rules.classes.get(cid)
    hpParts.push({
      sourceId: `hp:${cid}`,
      label: {
        en: `${def?.name.en ?? cid}: ${e.dice} × d${def?.hitDie ?? 8} + Con`,
        fr: `${def?.name.fr ?? cid} : ${e.dice} × d${def?.hitDie ?? 8} + Con`,
        es: `${esOf(def?.name) || cid}: ${e.dice} × d${def?.hitDie ?? 8} + Con`,
      },
      value: e.from,
      source: SRC.hitPoints,
    })
    hitDice.push({ classId: cid, die: def?.hitDie ?? 8, total: e.dice, spent: char.hitDiceSpent?.[cid] ?? 0 })
  }
  hpParts.push(...b.pool.parts('hp.max'))
  const hpMax = resolve(hpParts)
  hpMax.total = Math.max(1, hpMax.total)
  return { pb, abilities, hpMax, hitDice }
}
