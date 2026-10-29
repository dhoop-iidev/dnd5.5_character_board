<script lang="ts">
  // Progression, drawn like the 3.5 playboard: the XP bar first, then one collapsed line per level (level, class, what
  // was picked there, what is still to do) that opens on click to edit that level: class, Hit Point Die roll or fixed
  // value, subclass at class level 3, feat at the Ability Score Improvement levels (SRD 5.2.1 p. 23 "Gaining a Level"),
  // the choices of the features, feats and options gained there, Expertise, and the level-1 skill proficiencies; the
  // level-1 row starts with the Origin (species, background, ability scores). Every build warning is listed in the row
  // that fixes it (user request 2026-10-28), the rest under the levels; Weapon Mastery is in the Combat pane.
  // Never blocks: illegal choices stay possible and show up as warnings.
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { UI } from '../i18n/ui'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import type { RuleWarning } from '../engine/checks/common'
  import { app, tr, view } from '../state.svelte'
  import type { LevelEntry } from '../model/character'
  import { backgroundDef } from '../model/customBackground'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import OriginEditor from './OriginEditor.svelte'
  import CustomFeatsEditor from './CustomFeatsEditor.svelte'
  import { progressionPlaces, type Place } from './progression'
  import WarningList from './WarningList.svelte'
  import XpBar from './XpBar.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const classes = $derived([...rules.classes.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name))))

  /** Index of the level open for editing (one at a time). */
  let open = $state<number | null>(null)

  function classLevelAt(i: number) {
    const id = c.levels[i].classId
    return c.levels.slice(0, i + 1).filter((l) => l.classId === id).length
  }
  function addLevel() {
    const last = c.levels[c.levels.length - 1]
    const def = rules.classes.get(last?.classId ?? 'fighter')
    const entry: LevelEntry = {
      classId: last?.classId ?? 'fighter',
      hpRoll: def ? def.hitDie / 2 + 1 : 5,
      hpFixed: true,
      choices: {},
    }
    c.levels.push(entry)
    open = c.levels.length - 1
  }
  function removeLevel() {
    const n = c.levels.length
    const msg = tr({
      en: `Remove level ${n} and its choices?`,
      fr: `Retirer le niveau ${n} et ses choix ?`,
      es: `¿Quitar el nivel ${n} y sus elecciones?`,
    })
    if (n > 1 && confirm(msg)) {
      c.levels.pop()
      if (open !== null && open >= c.levels.length) open = null
    }
  }
  function needsFeat(i: number) {
    const def = rules.classes.get(c.levels[i].classId)
    const cl = classLevelAt(i)
    return !!def && (def.asiLevels.includes(cl) || cl === 19)
  }
  function featChoices(i: number) {
    const cl = classLevelAt(i)
    // Any feat you qualify for (SRD p. 87; each class's Ability Score Improvement); Epic Boons from level 19.
    return [...view.rules.feats.values()]
      .filter((f) => f.category !== 'epic-boon' || cl === 19)
      .sort((a, b) => a.category.localeCompare(b.category) || tr(a.name).localeCompare(tr(b.name)))
  }
  function setFeat(l: LevelEntry, id: string) {
    if (!id) {
      delete l.feat
      return
    }
    l.feat = { featId: id, abilities: {} }
  }
  function setInc(l: LevelEntry, a: AbilityId, v: number) {
    if (!l.feat) return
    l.feat.abilities ??= {}
    if (v) l.feat.abilities[a] = v
    else delete l.feat.abilities[a]
  }
  const first = $derived(rules.classes.get(c.levels[0]?.classId))
  const skillList = $derived(
    first ? (first.skillChoices.from === 'any' ? [...rules.skills.keys()] : first.skillChoices.from) : [],
  )
  function toggleSkill(id: string) {
    const i = c.skillProficiencies.indexOf(id as never)
    if (i >= 0) c.skillProficiencies.splice(i, 1)
    else c.skillProficiencies.push(id as never)
  }
  /** Owners that ask for a choice (the Fighting Style is picked in its row's own field). */
  const choiceOwners = $derived(
    sheet.owners.filter((o) => (o.effect?.choices ?? []).length && !o.id.endsWith(':fighting-style')),
  )
  // Where each choice and warning goes (ui/progression.ts): a row, the Origin block of row 1, or under the levels.
  const places = $derived(progressionPlaces(c, sheet, rules))
  const ownersAt = (p: Place) => choiceOwners.filter((o) => places.placeOf(o) === p)
  const isChoice = (w: RuleWarning) => w.id.startsWith('choice-')
  const placed = (p: Place) => (w: RuleWarning) => places.placeOfWarning(w) === p
  const choicesAt = (p: Place) => (w: RuleWarning) => isChoice(w) && placed(p)(w)
  const warningsAt = (p: Place) => (w: RuleWarning) => !isChoice(w) && placed(p)(w)
  /** Build warnings no row can fix (a stored choice of a feature the character no longer has…). */
  const unplaced = (w: RuleWarning) =>
    ['abilities', 'skills', 'feats'].includes(w.area) && places.placeOfWarning(w) === undefined
  /** Warnings of a row, its Origin block included for the level-1 row. */
  const rowWarnings = (i: number) =>
    view.warnings.filter((w) => warningsAt(i)(w) || (i === 0 && warningsAt('origin')(w)))
  const rowChoices = (i: number) => view.warnings.filter((w) => choicesAt(i)(w) || (i === 0 && choicesAt('origin')(w)))
  /** Level-1 class skill picks still missing. */
  const skillsLeft = $derived(first ? Math.max(0, first.skillChoices.count - c.skillProficiencies.length) : 0)
  const expertiseGain = $derived(places.expertiseGain)
  const expertiseHere = (i: number) => places.expertiseHere(i)
  function toggleExpertise(i: number, id: string) {
    const k = c.expertise.indexOf(id)
    if (k >= 0) c.expertise.splice(k, 1)
    else c.expertise.splice(places.expertiseEnd(i), 0, id)
  }

  /** One-line summary of what was picked at a level: subclass, feat (with its increases), fighting style. */
  function picked(i: number): string {
    const l = c.levels[i]
    const def = rules.classes.get(l.classId)
    const out: string[] = []
    if (i === 0)
      out.push(
        tr(rules.species.get(c.speciesId)?.name) || c.speciesId,
        tr(backgroundDef(c.background, rules)?.name) || c.background.backgroundId,
      )
    if (l.subclassId) out.push(tr(def?.subclasses.find((s) => s.id === l.subclassId)?.name) || l.subclassId)
    if (l.feat) {
      const inc = Object.entries(l.feat.abilities ?? {})
        .filter(([, v]) => v)
        .map(([a, v]) => `+${v} ${tr(ABILITY_SHORT[a as AbilityId])}`)
        .join(' ')
      out.push((tr(view.rules.feats.get(l.feat.featId)?.name) || l.feat.featId) + (inc ? ` (${inc})` : ''))
    }
    const style = def ? l.choices[`${def.id}:fighting-style`] : undefined
    if (typeof style === 'string' && style) out.push(tr(view.rules.feats.get(style)?.name) || style)
    return out.join(', ')
  }
</script>

<XpBar />

<ol class="levels">
  {#each c.levels as l, i (i)}
    {@const def = rules.classes.get(l.classId)}
    {@const cl = classLevelAt(i)}
    {@const warns = rowWarnings(i)}
    {@const todo = rowChoices(i).length + (i === 0 ? (skillsLeft ? 1 : 0) : 0)}
    <li class:open={open === i} class:flagged={warns.length > 0}>
      <button class="row" onclick={() => (open = open === i ? null : i)} aria-expanded={open === i}>
        <span class="lvl">{i + 1}</span>
        <span class="cls">{tr(def?.name) || l.classId} {cl}</span>
        <span class="picks">{picked(i)}</span>
        <span class="status">
          {#if warns.length}<span
              class="flag"
              title={tr({
                en: 'Rule warning at this level',
                fr: 'Avertissement de règle à ce niveau',
                es: 'Aviso de reglas en este nivel',
              })}>⚠ {warns.length}</span
            >{/if}
          {#if todo}<span class="todo"
              >{todo}
              {tr(
                todo > 1
                  ? { en: 'choices', fr: 'choix', es: 'elecciones' }
                  : { en: 'choice', fr: 'choix', es: 'elección' },
              )}</span
            >{/if}
          {#if !warns.length && !todo}<span class="ok">✓</span>{/if}
          <span class="chev" aria-hidden="true">{open === i ? '▾' : '▸'}</span>
        </span>
      </button>

      {#if open === i}
        <div class="editor">
          {#if i === 0}<OriginEditor owners={ownersAt('origin')} warnings={placed('origin')} />{/if}
          <div class="fields">
            <label>
              {tr(UI.class)}
              <select bind:value={l.classId}>
                {#each classes as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
              </select>
            </label>
            <div class="field">
              <span>{tr(UI.hitDice)} (d{def?.hitDie})</span>
              {#if i === 0}
                <span class="fixed"
                  >{def?.hitDie} ({tr({
                    en: 'maximum at level 1',
                    fr: 'maximum au niveau 1',
                    es: 'máximo en el nivel 1',
                  })})</span
                >
              {:else}
                <span class="hp">
                  <label class="inline"
                    ><input type="checkbox" bind:checked={l.hpFixed} />
                    {tr({ en: 'fixed', fr: 'fixe', es: 'fijo' })} ({(def?.hitDie ?? 8) / 2 + 1})</label
                  >
                  {#if !l.hpFixed}<input
                      class="roll"
                      type="number"
                      min="1"
                      max={def?.hitDie}
                      bind:value={l.hpRoll}
                      aria-label={tr({ en: 'Roll', fr: 'Jet', es: 'Tirada' })}
                    />{/if}
                </span>
              {/if}
            </div>
            {#if cl === 3 && def}
              <label>
                {tr(UI.subclass)}
                <select bind:value={l.subclassId}>
                  <option value={undefined}>— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
                  {#each def.subclasses as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
                </select>
              </label>
            {/if}
            {#if def && def.features.some((f) => f.id.endsWith(':fighting-style') && f.level === cl)}
              <label>
                {tr({ en: 'Fighting Style', fr: 'Style de combat', es: 'Estilo de combate' })}
                <select
                  value={l.choices[`${def.id}:fighting-style`] ?? ''}
                  onchange={(e) => (l.choices[`${def.id}:fighting-style`] = e.currentTarget.value)}
                >
                  <option value="">— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
                  {#each [...view.rules.feats.values()].filter((f) => f.category === 'fighting-style') as f (f.id)}<option
                      value={f.id}>{tr(f.name)}</option
                    >{/each}
                </select>
              </label>
            {/if}
          </div>

          {#if needsFeat(i)}
            <h4>{tr({ en: 'Feat', fr: 'Don', es: 'Dote' })}</h4>
            <div class="feat">
              <select value={l.feat?.featId ?? ''} onchange={(e) => setFeat(l, e.currentTarget.value)}>
                <option value="">— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
                {#each featChoices(i) as f (f.id)}<option value={f.id}>{tr(f.name)}</option>{/each}
              </select>
              {#if l.feat}
                <span class="inc">
                  {#each ABILITIES as a (a)}
                    <label class="inline"
                      >{tr(ABILITY_SHORT[a])}<input
                        type="number"
                        min="0"
                        max="2"
                        value={l.feat.abilities?.[a] ?? 0}
                        onchange={(e) => setInc(l, a, +e.currentTarget.value)}
                      /></label
                    >
                  {/each}
                </span>
              {/if}
            </div>
          {/if}

          {#if ownersAt(i).length}
            <h4>{tr({ en: 'Choices', fr: 'Choix', es: 'Elecciones' })}</h4>
            {#each ownersAt(i) as o (o.id)}
              <div class="owner"><span class="meta">{tr(o.name)}</span><ChoiceEditor owner={o} /></div>
            {/each}
          {/if}

          {#if i === 0 && first}
            <h4>
              {tr({
                en: `Skill proficiencies of the ${first.name.en} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
                fr: `Maîtrises de compétence du ${first.name.fr} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
                es: `Competencias en habilidades de ${first.name.es ?? first.name.en} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
              })}
            </h4>
            <div class="chips">
              {#each skillList as id (id)}
                <label class="chip" class:on={c.skillProficiencies.includes(id as never)}
                  ><input
                    type="checkbox"
                    checked={c.skillProficiencies.includes(id as never)}
                    onchange={() => toggleSkill(id)}
                  />{tr(rules.skills.get(id)?.name)}</label
                >
              {/each}
            </div>
          {/if}

          {#if expertiseGain[i]}
            <h4>{tr(UI.expertise)} ({expertiseHere(i).length} / {expertiseGain[i]})</h4>
            <div class="chips">
              {#each sheet.skills.filter((s) => s.proficiency !== 'none' && s.proficiency !== 'half') as s (s.id)}
                {@const here = expertiseHere(i).includes(s.id)}
                {@const elsewhere = !here && c.expertise.includes(s.id)}
                <label class="chip" class:on={here} class:taken={elsewhere}
                  ><input
                    type="checkbox"
                    checked={here || elsewhere}
                    disabled={elsewhere || (!here && expertiseHere(i).length >= expertiseGain[i])}
                    onchange={() => toggleExpertise(i, s.id)}
                  />{tr(s.name)}</label
                >
              {/each}
            </div>
          {/if}

          <WarningList filter={choicesAt(i)} compact />
          <WarningList filter={warningsAt(i)} compact />
        </div>
      {/if}
    </li>
  {/each}
</ol>

<div class="bar">
  <button onclick={addLevel}>＋ {tr({ en: 'Add a level', fr: 'Ajouter un niveau', es: 'Añadir un nivel' })}</button>
  {#if c.levels.length > 1}
    <button class="ghost" onclick={removeLevel}
      >− {tr({ en: 'Remove the last level', fr: 'Retirer le dernier niveau', es: 'Quitar el último nivel' })}</button
    >
  {/if}
</div>
<WarningList areas={['levels']} withoutLevel />

<CustomFeatsEditor />

{#if view.warnings.some(unplaced) || ownersAt(undefined).length}
  <h4>{tr({ en: 'Other choices', fr: 'Autres choix', es: 'Otras elecciones' })}</h4>
  {#each ownersAt(undefined) as o (o.id + (o.pick ? (o.level ?? '') : ''))}
    <div class="owner"><span class="meta">{tr(o.name)}</span><ChoiceEditor owner={o} /></div>
  {/each}
  <WarningList filter={unplaced} />
{/if}

<style>
  .levels {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid var(--rule);
  }
  .levels > li {
    border-bottom: 1px solid var(--rule);
  }
  .levels > li.open {
    background: var(--paper-2);
  }
  /* Collapsed line: level, class, picks, status. */
  .row {
    display: grid;
    grid-template-columns: 2.2rem minmax(7rem, auto) minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    width: 100%;
    min-height: 2.8rem;
    padding: 0.2rem 0.3rem;
    font: inherit;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  }
  .row:hover .cls {
    color: var(--accent);
  }
  .lvl {
    font-family: var(--font-num);
    font-weight: 700;
    text-align: center;
  }
  /* A level with an unresolved rule warning: red level number. */
  .flagged .lvl {
    color: var(--danger);
  }
  .cls {
    font-family: var(--font-title);
    white-space: nowrap;
  }
  .picks {
    font-size: 0.9em;
    color: var(--ink-soft);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    white-space: nowrap;
  }
  .todo,
  .flag {
    font-size: 0.8em;
    padding: 0 0.4em;
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 3px;
  }
  .flag {
    border-color: var(--danger);
    color: var(--danger);
    font-weight: 700;
  }
  .ok {
    color: var(--ink-soft);
  }
  .chev {
    width: 1rem;
    text-align: center;
    color: var(--ink-soft);
  }
  .editor {
    padding: 0.4rem 0.4rem 0.8rem 2.8rem;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
  }
  .fields > label,
  .field {
    display: flex;
    flex-direction: column;
    font-size: 0.85em;
    font-family: var(--font-title);
    color: var(--ink-soft);
  }
  .fields select,
  .fixed,
  .hp {
    font-family: var(--font-body);
    font-size: 1.05rem;
    color: var(--ink);
  }
  .fixed,
  .hp {
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  select,
  input {
    min-height: 2.4rem;
    font: inherit;
    padding: 0 0.4rem;
    max-width: 100%;
  }
  .roll,
  .inc input {
    width: 3.6rem;
  }
  .meta {
    display: block;
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-right: 0.5rem;
    font-size: 0.9em;
  }
  .feat {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    align-items: center;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    align-items: center;
  }
  .bar button {
    min-height: 2.75rem;
    padding: 0 0.9rem;
    font: inherit;
    cursor: pointer;
  }
  h4 {
    font-family: var(--font-title);
    font-weight: 400;
    margin: 0.9rem 0 0.35rem;
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
    background: var(--box);
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .chip input {
    min-height: 0;
  }
  /* Picked at another level. */
  .chip.taken {
    opacity: 0.55;
  }
  .owner {
    margin: 0.3rem 0;
    padding-left: 0.6rem;
    border-left: 2px solid var(--rule);
  }
  @media (max-width: 40rem) {
    .row {
      grid-template-columns: 2rem minmax(0, 1fr) auto;
    }
    .picks {
      display: none;
    }
    .editor {
      padding-left: 0.4rem;
    }
  }
</style>
