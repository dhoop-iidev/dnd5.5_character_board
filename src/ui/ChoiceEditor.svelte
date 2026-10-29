<script lang="ts">
  // Controls for the choices a feature, species trait, feat or class option asks for (effects' `choices`): options from a
  // list, skills, Expertise, spells, a damage type, an extra feat. Values go to `character.featureChoices` (or to the
  // feat's own `choices` for a feat owner, or `character.extraFeats` for an extra feat).
  import { rules } from '../data/rules'
  import type { ChoiceDef } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { choiceKey } from '../engine/sheet/build'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import { resolveCount } from '../engine/sheet/modifiers'
  import type { Owner } from '../engine/sheet/types'
  import { app, tr, view } from '../state.svelte'
  import { norm } from './items'

  let { owner }: { owner: Owner } = $props()
  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  // Open Expertise picks (no list) are made with the Expertise chips of the level editor (character.expertise).
  const choices = $derived((owner.effect?.choices ?? []).filter((ch) => !(ch.kind === 'expertise' && !ch.from)))
  let spellQuery = $state<Record<string, string>>({})

  const count = (ch: ChoiceDef) => resolveCount(ch.count, ch.byLevel, { ...sheet, char: c, rules }, owner) ?? 1
  const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : [])
  function values(ch: ChoiceDef): string[] {
    if (owner.pick) return asList(owner.pick.choices?.[ch.id ?? 'choice'])
    return asList(
      c.featureChoices[choiceKey(owner.id, ch)] ??
        c.levels.map((l) => l.choices?.[choiceKey(owner.id, ch)]).find((v) => v),
    )
  }
  function setValues(ch: ChoiceDef, vals: string[]) {
    const n = count(ch)
    const v = n === 1 ? (vals[0] ?? '') : vals
    if (owner.pick) {
      owner.pick.choices ??= {}
      owner.pick.choices[ch.id ?? 'choice'] = v
    } else {
      // Level-bound storage of an older save: move the value to featureChoices.
      for (const l of c.levels)
        if (l.choices?.[choiceKey(owner.id, ch)] !== undefined) delete l.choices[choiceKey(owner.id, ch)]
      c.featureChoices[choiceKey(owner.id, ch)] = v
    }
  }
  function toggle(ch: ChoiceDef, id: string) {
    const cur = values(ch)
    setValues(ch, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }
  function optionList(
    ch: ChoiceDef,
  ): { id: string; name: { en: string; fr: string; es?: string }; prereq?: { en: string; fr: string; es?: string } }[] {
    if (ch.options) return Object.entries(ch.options).map(([id, o]) => ({ id, name: o.name }))
    const cls = owner.classId ? rules.classes.get(owner.classId) : undefined
    return asList(ch.from)
      .flatMap((k) => cls?.options?.[k] ?? [])
      .map((o) => ({ id: o.id, name: o.name, prereq: o.prereq }))
  }
  function skillList(ch: ChoiceDef): string[] {
    if (ch.from) return asList(ch.from)
    if (ch.kind === 'expertise')
      return sheet.skills
        .filter((s) => s.proficiency === 'proficient' || s.proficiency === 'expertise')
        .map((s) => s.id)
    return [...rules.skills.keys()]
  }
  function spellCandidates(ch: ChoiceDef) {
    const q = norm(spellQuery[ch.id ?? 'choice'] ?? '')
    const lists = ch.list ?? (owner.choiceValues.list?.length ? owner.choiceValues.list : undefined)
    const allowed = lists
      ? new Set(lists.flatMap((cid) => rules.classes.get(cid)?.spellList?.flatMap((lv) => lv.spells) ?? []))
      : undefined
    return [...rules.spells.values()]
      .filter(
        (s) =>
          (ch.level === undefined || s.level === ch.level) &&
          (ch.maxLevel === undefined || s.level <= ch.maxLevel) &&
          (!allowed || allowed.has(s.id)),
      )
      .filter((s) => q.length >= 2 && norm(tr(s.name)).includes(q))
      .sort((a, b) => a.level - b.level || tr(a.name).localeCompare(tr(b.name)))
      .slice(0, 20)
  }
  const DAMAGE = [
    'acid',
    'bludgeoning',
    'cold',
    'fire',
    'force',
    'lightning',
    'necrotic',
    'piercing',
    'poison',
    'psychic',
    'radiant',
    'slashing',
    'thunder',
  ]
  function setExtraFeat(id: string) {
    if (!id) delete c.extraFeats[owner.id]
    else c.extraFeats[owner.id] = { featId: id }
  }
  function setInc(a: (typeof ABILITIES)[number], v: number) {
    const pick = c.extraFeats[owner.id]
    if (!pick) return
    pick.abilities ??= {}
    if (v) pick.abilities[a] = v
    else delete pick.abilities[a]
  }
</script>

{#each choices as ch (ch.id ?? 'choice')}
  {@const n = count(ch)}
  {@const vals = values(ch)}
  <div class="choice">
    <span class="label">{tr(ch.name ?? owner.name)}{n > 1 ? ` (${vals.length} / ${n})` : ''}</span>
    {#if ch.kind === 'option'}
      {#if n === 1}
        <select
          value={vals[0] ?? ''}
          onchange={(e) => setValues(ch, e.currentTarget.value ? [e.currentTarget.value] : [])}
        >
          <option value="">—</option>
          {#each optionList(ch) as o (o.id)}<option value={o.id}
              >{tr(o.name)}{o.prereq ? ` (${tr(o.prereq)})` : ''}</option
            >{/each}
        </select>
      {:else}
        <div class="chips">
          {#each optionList(ch) as o (o.id)}
            <label class="chip" class:on={vals.includes(o.id)} title={o.prereq ? tr(o.prereq) : ''}
              ><input type="checkbox" checked={vals.includes(o.id)} onchange={() => toggle(ch, o.id)} />{tr(
                o.name,
              )}</label
            >
          {/each}
        </div>
      {/if}
    {:else if ch.kind === 'skill' || ch.kind === 'expertise'}
      <div class="chips">
        {#each skillList(ch) as id (id)}
          <label class="chip" class:on={vals.includes(id)}
            ><input type="checkbox" checked={vals.includes(id)} onchange={() => toggle(ch, id)} />{tr(
              rules.skills.get(id)?.name,
            ) || id}</label
          >
        {/each}
      </div>
    {:else if ch.kind === 'spell'}
      <div class="chips">
        {#each vals as id (id)}
          <label class="chip on"
            ><input type="checkbox" checked onchange={() => toggle(ch, id)} />{tr(rules.spells.get(id)?.name) ||
              id}</label
          >
        {/each}
      </div>
      {#if vals.length < n}
        <input
          type="search"
          bind:value={spellQuery[ch.id ?? 'choice']}
          placeholder={tr({ en: 'Search a spell…', fr: 'Chercher un sort…', es: 'Buscar un conjuro…' })}
        />
        {#if spellCandidates(ch).length}
          <ul class="results">
            {#each spellCandidates(ch) as s (s.id)}
              <li>
                <button
                  onclick={() => {
                    toggle(ch, s.id)
                    spellQuery[ch.id ?? 'choice'] = ''
                  }}>＋ {s.level || 'C'} · {tr(s.name)}</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    {:else if ch.kind === 'damage-type'}
      <select
        value={vals[0] ?? ''}
        onchange={(e) => setValues(ch, e.currentTarget.value ? [e.currentTarget.value] : [])}
      >
        <option value="">—</option>
        {#each DAMAGE as d (d)}<option value={d}
            >{tr(rules.damageTypeNames[d as keyof typeof rules.damageTypeNames])}</option
          >{/each}
      </select>
    {:else if ch.kind === 'feat'}
      {@const pick = c.extraFeats[owner.id]}
      <select value={pick?.featId ?? ''} onchange={(e) => setExtraFeat(e.currentTarget.value)}>
        <option value="">—</option>
        {#each [...view.rules.feats.values()].filter((f) => !ch.category || f.category === ch.category) as f (f.id)}<option
            value={f.id}>{tr(f.name)}</option
          >{/each}
      </select>
      {#if pick && view.rules.feats.get(pick.featId)?.abilityIncrease}
        <span class="inc">
          {#each ABILITIES as a (a)}
            <label class="inline"
              >{tr(ABILITY_SHORT[a])}<input
                type="number"
                min="0"
                max="1"
                value={pick.abilities?.[a] ?? 0}
                onchange={(e) => setInc(a, +e.currentTarget.value)}
              /></label
            >
          {/each}
        </span>
      {/if}
    {:else}
      <input
        type="text"
        value={vals[0] ?? ''}
        onchange={(e) => setValues(ch, e.currentTarget.value ? [e.currentTarget.value] : [])}
      />
    {/if}
  </div>
{/each}

<style>
  .choice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    margin: 0.3rem 0;
  }
  .label {
    font-family: var(--font-title);
    color: var(--ink-soft);
    font-size: 0.9em;
  }
  select,
  input {
    min-height: 2.4rem;
    font: inherit;
    padding: 0 0.4rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.2em 0.7em;
    min-height: 2.4rem;
    cursor: pointer;
    font-size: 0.9em;
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .chip input {
    min-height: 0;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
  }
  .results button {
    width: 100%;
    text-align: left;
    min-height: 2.4rem;
    font: inherit;
    border-color: transparent;
    background: none;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-right: 0.4rem;
    font-size: 0.9em;
  }
  .inc input {
    width: 3.2rem;
  }
</style>
