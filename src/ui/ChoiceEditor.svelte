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
  import SpellPicker from './SpellPicker.svelte'
  import { choicesFor } from './spellChoices'
  import { backgroundDef, CUSTOM_BACKGROUND } from '../model/customBackground'
  import { featListOf } from '../model/newCharacter'

  let {
    owner,
    where = 'rest',
  }: {
    owner: Owner
    /** 'spells': the spell picks made in the Spells pane; 'rest': the others, made in the progression. */
    where?: 'spells' | 'rest'
  } = $props()
  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  // Open Expertise picks (no list) are made with the Expertise chips of the level editor (character.expertise).
  const choices = $derived(choicesFor(owner, where).filter((ch) => !(ch.kind === 'expertise' && !ch.from)))
  /** The spell list an SRD background already names for its feat ("Magic Initiate (Wizard)", SRD p. 83). */
  const fixedList = $derived(
    owner.kind === 'feat' &&
      owner.id === `feat:${c.background.feat?.featId}` &&
      c.background.backgroundId !== CUSTOM_BACKGROUND
      ? featListOf(backgroundDef(c.background, rules)?.featText?.en, rules)
      : undefined,
  )

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
  const proficientIn = (id: string) =>
    ['proficient', 'expertise'].includes(sheet.skills.find((s) => s.id === id)?.proficiency ?? '')
  function skillList(ch: ChoiceDef): string[] {
    if (ch.from) return asList(ch.from)
    if (ch.kind === 'expertise')
      return sheet.skills
        .filter((s) => s.proficiency === 'proficient' || s.proficiency === 'expertise')
        .map((s) => s.id)
    return [...rules.skills.keys()]
  }
  function spellCandidates(ch: ChoiceDef) {
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
      .sort((a, b) => a.level - b.level || tr(a.name).localeCompare(tr(b.name)))
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
  <!-- The owner's name is shown above it; the choice's own name only when it says more. -->
  {@const own = ch.name && ch.name.en !== owner.name.en ? tr(ch.name) : ''}
  <div class="choice">
    {#if own || n > 1}<span class="label">{own}{n > 1 ? `${own ? ' ' : ''}(${vals.length} / ${n})` : ''}</span>{/if}
    {#if ch.kind === 'option'}
      {#if ch.id === 'list' && fixedList && vals[0] === fixedList}
        <!-- Set by the background (e.g. Sage: Magic Initiate (Wizard)): shown, not changed here. -->
        <span class="fixed">{tr(optionList(ch).find((o) => o.id === fixedList)?.name) || fixedList}</span>
      {:else if n === 1}
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
          <!-- A skill already proficient from elsewhere (background, class) would be a wasted pick. -->
          {@const taken = ch.kind === 'skill' && !vals.includes(id) && proficientIn(id)}
          <label
            class="chip"
            class:on={vals.includes(id)}
            class:taken
            title={taken ? tr({ en: 'Already proficient', fr: 'Déjà maîtrisée', es: 'Ya tienes competencia' }) : ''}
            ><input
              type="checkbox"
              checked={vals.includes(id) || taken}
              disabled={taken}
              onchange={() => toggle(ch, id)}
            />{tr(rules.skills.get(id)?.name) || id}</label
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
        <SpellPicker
          options={spellCandidates(ch).filter((s) => !vals.includes(s.id))}
          onpick={(s) => toggle(ch, s.id)}
          keepOpen={n - vals.length > 1}
          label={tr({ en: 'Choose a spell', fr: 'Choisir un sort', es: 'Elegir un conjuro' })}
        />
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
  .fixed {
    font-weight: 600;
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
  .chip.taken {
    opacity: 0.55;
    cursor: default;
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
