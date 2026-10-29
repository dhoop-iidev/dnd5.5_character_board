// Every class or subclass feature, class option, species trait, feat and magic item whose SRD text names a part of the
// turn ("as a Bonus Action", "take a Reaction", "as a Magic action", "take the Dash action"…) says how it is used during
// a turn: an `activation` list in its effect entry (src/data/custom/effects/*.json), empty when the text gives nothing to
// take (an Extra Attack, a feature that only modifies another one). Potions are left out: the "Your turn" box drinks
// every potion as a Bonus Action (SRD 5.2.1 p. 204). The activations themselves must be well formed: known kinds and
// standard actions, resources that exist, switches that some effect reads.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'
import { STANDARD_ACTIONS } from '../engine/turn'

const strip = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ')
const NAMES_A_TURN_PART =
  /Bonus Action|\b(take|use|as) a Reaction\b|Magic action|take the (Attack|Dash|Disengage|Dodge|Help|Hide|Influence|Magic|Ready|Search|Study|Utilize) action|additional action/i

function textOwners(): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = []
  for (const cls of rules.classes.values()) {
    for (const f of cls.features) out.push({ id: f.id, text: strip(f.text.en) })
    for (const sub of cls.subclasses) for (const f of sub.features) out.push({ id: f.id, text: strip(f.text.en) })
    for (const list of Object.values(cls.options ?? {}))
      for (const o of list) out.push({ id: o.id, text: strip(o.text?.en) })
  }
  for (const sp of rules.species.values()) for (const t of sp.traits) out.push({ id: t.id, text: strip(t.text.en) })
  for (const f of rules.feats.values()) out.push({ id: `feat:${f.id}`, text: strip(f.text.en) })
  for (const m of rules.magicItems.values())
    if (m.kind !== 'potion') out.push({ id: `item:${m.id}`, text: strip(m.text.en) })
  return out
}

describe('activation coverage', () => {
  it('every owner whose text names a part of the turn has an activation list', () => {
    const missing = textOwners()
      .filter((o) => NAMES_A_TURN_PART.test(o.text) && !rules.effects.get(o.id)?.activation)
      .map((o) => o.id)
    expect(missing).toEqual([])
  })

  it('activations are well formed', () => {
    const toggles = new Set<string>()
    for (const e of rules.effects.values())
      for (const x of [...(e.modifiers ?? []), ...(e.grants ?? [])])
        if (x.when?.startsWith('toggle:')) toggles.add(x.when.slice('toggle:'.length))
    const problems: string[] = []
    for (const [id, e] of rules.effects)
      for (const a of e.activation ?? []) {
        if (!['action', 'bonus-action', 'reaction', 'free', 'attack'].includes(a.kind))
          problems.push(`${id}: kind ${a.kind}`)
        for (const s of [...(a.actions ?? []), ...(a.action ? [a.action] : [])])
          if (!STANDARD_ACTIONS.includes(s)) problems.push(`${id}: action ${s}`)
        const res = a.cost?.resource
        if (res && !rules.effects.get(res)?.uses) problems.push(`${id}: resource ${res} has no uses`)
        for (const t of [a.setsToggle, a.when?.replace(/^!?toggle:/, '')])
          if (t && !toggles.has(t)) problems.push(`${id}: switch ${t} read by no effect`)
        if (a.name && !(a.name.en && a.name.fr && a.name.es)) problems.push(`${id}: name not in EN/FR/ES`)
        if (a.trigger && !(a.trigger.en && a.trigger.fr && a.trigger.es))
          problems.push(`${id}: trigger not in EN/FR/ES`)
      }
    expect(problems).toEqual([])
  })
})
