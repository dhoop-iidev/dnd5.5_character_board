<script lang="ts">
  // Progression, drawn like the 3.5 playboard: the XP bar first, then one line per level (level, class, what was picked
  // there, what is still to do). A line opens that level in the Builder (ui/Builder.svelte, user request 2026-10-30: one
  // place to choose, step by step); "Level up" adds a level and opens it there. Choices that belong to no level (a
  // stored choice of a feature the character no longer has…) are listed under the levels.
  import { choicesFor } from './spellChoices'
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import type { RuleWarning } from '../engine/checks/common'
  import { app, tr, view } from '../state.svelte'
  import type { LevelEntry } from '../model/character'
  import { backgroundDef } from '../model/customBackground'
  import { openBuilder } from './builderState.svelte'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import { stepOfWarning } from './creation'
  import CustomFeatsEditor from './CustomFeatsEditor.svelte'
  import CustomSubclassesEditor from './CustomSubclassesEditor.svelte'
  import CustomSpeciesEditor from './CustomSpeciesEditor.svelte'
  import { progressionPlaces } from './progression'
  import WarningList from './WarningList.svelte'
  import XpBar from './XpBar.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const places = $derived(progressionPlaces(c, sheet, rules))

  /** Level up (SRD 5.2.1 p. 23): a level of the last class, fixed Hit Points to start with, opened in the Builder. */
  function levelUp() {
    const last = c.levels[c.levels.length - 1]
    const def = view.rules.classes.get(last?.classId ?? 'fighter')
    const entry: LevelEntry = {
      classId: last?.classId ?? 'fighter',
      hpRoll: def ? def.hitDie / 2 + 1 : 5,
      hpFixed: true,
    }
    c.levels.push(entry)
    openBuilder(c.levels.length - 1)
  }
  function removeLevel() {
    const n = c.levels.length
    const msg = tr({
      en: `Remove level ${n} and its choices?`,
      fr: `Retirer le niveau ${n} et ses choix ?`,
      es: `¿Quitar el nivel ${n} y sus elecciones?`,
    })
    if (n > 1 && confirm(msg)) c.levels.pop()
  }
  /** Warnings of a level's own Builder steps (its class level, and at level 1 the Origin and ability scores). */
  const ROW_STEPS = ['level', 'origin', 'abilities']
  const ofRow = (i: number, actionable: boolean) =>
    view.warnings.filter(
      (w) => !!w.actionable === actionable && ROW_STEPS.includes(stepOfWarning(w, c, sheet, rules, i) ?? ''),
    ).length
  /** Owners whose choices belong to no level. */
  const looseOwners = $derived(
    sheet.owners.filter(
      (o) => choicesFor(o, 'rest').length && !o.id.endsWith(':fighting-style') && places.placeOf(o) === undefined,
    ),
  )
  /** Build warnings no level can fix. */
  const unplaced = (w: RuleWarning) =>
    ['abilities', 'skills', 'feats'].includes(w.area) && places.placeOfWarning(w) === undefined

  /** Paladin and Ranger options in place of a Fighting Style feat (SRD p. 54, p. 58). */
  const WARRIOR_STYLES: Record<string, { en: string; fr: string; es: string }> = {
    'blessed-warrior': { en: 'Blessed Warrior', fr: 'Guerrier béni', es: 'Guerrero bendito' },
    'druidic-warrior': { en: 'Druidic Warrior', fr: 'Guerrier druidique', es: 'Guerrero druídico' },
  }
  /** One-line summary of what was picked at a level: subclass, feat (with its increases), fighting style. */
  function picked(i: number): string {
    const l = c.levels[i]
    const def = view.rules.classes.get(l.classId)
    const out: string[] = []
    if (i === 0)
      out.push(
        tr(view.rules.species.get(c.speciesId)?.name) || c.speciesId,
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
    const style = def?.features.some((f) => f.id === `${def.id}:fighting-style` && f.level === places.classLevelAt(i))
      ? c.featureChoices[`${def!.id}:fighting-style`]
      : undefined
    if (typeof style === 'string' && style)
      out.push(tr(view.rules.feats.get(style)?.name ?? WARRIOR_STYLES[style]) || style)
    return out.join(', ')
  }
</script>

<XpBar />

<ol class="levels">
  {#each c.levels as l, i (i)}
    {@const def = view.rules.classes.get(l.classId)}
    {@const warns = ofRow(i, false)}
    {@const todo = ofRow(i, true)}
    <li class:flagged={warns > 0}>
      <button
        class="row"
        onclick={() => openBuilder(i)}
        title={tr({ en: 'Edit this level', fr: 'Modifier ce niveau', es: 'Editar este nivel' })}
      >
        <span class="lvl">{i + 1}</span>
        <span class="cls">{tr(def?.name) || l.classId} {places.classLevelAt(i)}</span>
        <span class="picks">{picked(i)}</span>
        <span class="status">
          {#if warns}<span
              class="flag"
              title={tr({
                en: 'Rule warning at this level',
                fr: 'Avertissement de règle à ce niveau',
                es: 'Aviso de reglas en este nivel',
              })}>⚠ {warns}</span
            >{/if}
          {#if todo}<span class="todo"
              >{todo}
              {tr(
                todo > 1
                  ? { en: 'choices', fr: 'choix', es: 'elecciones' }
                  : { en: 'choice', fr: 'choix', es: 'elección' },
              )}</span
            >{/if}
          {#if !warns && !todo}<span class="ok">✓</span>{/if}
          <span class="chev" aria-hidden="true">✎</span>
        </span>
      </button>
    </li>
  {/each}
</ol>

<div class="bar">
  <button class="primary" onclick={levelUp}
    >＋ {tr({ en: 'Level up', fr: 'Monter de niveau', es: 'Subir de nivel' })}</button
  >
  {#if c.levels.length > 1}
    <button class="ghost" onclick={removeLevel}
      >− {tr({ en: 'Remove the last level', fr: 'Retirer le dernier niveau', es: 'Quitar el último nivel' })}</button
    >
  {/if}
</div>
<WarningList areas={['levels']} withoutLevel />

<CustomFeatsEditor />
<CustomSubclassesEditor />
<CustomSpeciesEditor />

{#if view.warnings.some(unplaced) || looseOwners.length}
  <h4>{tr({ en: 'Other choices', fr: 'Autres choix', es: 'Otras elecciones' })}</h4>
  {#each looseOwners as o (o.id)}
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
  .meta {
    display: block;
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    align-items: center;
  }
  .bar .primary {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
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
  }
</style>
