<script lang="ts">
  // Pick a spell from a list you can browse (user request 2026-10-30: the search box showed nothing until two letters
  // were typed, so the player had to know the spell's name). A button opens the list, grouped by spell level, each line
  // with the school colour, a one-line summary and ⓘ for the full text; the box above narrows it while typing.
  import type { SpellDef } from '../data/types'
  import { tr } from '../state.svelte'
  import { norm } from './items'
  import { openPopup } from './popupState.svelte'
  import { summaryOf } from './summary'

  let {
    options,
    onpick,
    label,
    keepOpen = false,
  }: {
    /** Spells that can be picked (already filtered by the caller: list, level, not taken). */
    options: SpellDef[]
    onpick: (s: SpellDef) => void
    /** Text of the opening button ("Add a cantrip"). */
    label: string
    /** Stay open after a pick (several picks in a row). */
    keepOpen?: boolean
  } = $props()

  let open = $state(false)
  let query = $state('')
  const LEVEL = (l: number) =>
    l === 0
      ? tr({ en: 'Cantrips', fr: 'Sorts mineurs', es: 'Trucos' })
      : `${tr({ en: 'Level', fr: 'Niveau', es: 'Nivel' })} ${l}`
  const groups = $derived.by(() => {
    const q = norm(query)
    const hits = options
      .filter((s) => !q || norm(tr(s.name)).includes(q) || norm(s.name.en).includes(q))
      .sort((a, b) => a.level - b.level || tr(a.name).localeCompare(tr(b.name)))
    const out: { level: number; spells: SpellDef[] }[] = []
    for (const s of hits) {
      const g = out.at(-1)
      if (g && g.level === s.level) g.spells.push(s)
      else out.push({ level: s.level, spells: [s] })
    }
    return out
  })
  function pick(s: SpellDef) {
    onpick(s)
    query = ''
    if (!keepOpen) open = false
  }
  const info = (s: SpellDef) =>
    openPopup({
      title: s.name,
      html: s.text,
      source: s.source,
      noteKey: `spell:${s.id}`,
      summary: summaryOf(`spell:${s.id}`, s.text),
    })
</script>

<div class="picker">
  <button class="opener" aria-expanded={open} onclick={() => (open = !open)} disabled={!options.length}
    >{open ? '▾' : '＋'} {label}{options.length ? '' : ' —'}</button
  >
  {#if open}
    <div class="panel">
      <input
        type="search"
        bind:value={query}
        placeholder={tr({ en: 'Filter by name…', fr: 'Filtrer par nom…', es: 'Filtrar por nombre…' })}
      />
      <div class="list">
        {#each groups as g (g.level)}
          <h5>{LEVEL(g.level)} <span class="n">{g.spells.length}</span></h5>
          <ul>
            {#each g.spells as s (s.id)}
              <li class="school-row school-{s.school}">
                <button class="add" onclick={() => pick(s)} title={tr({ en: 'Add', fr: 'Ajouter', es: 'Añadir' })}
                  ><strong>{tr(s.name)}</strong>
                  <span class="sum">{tr(summaryOf(`spell:${s.id}`, s.text))}</span></button
                >
                <button
                  class="info"
                  onclick={() => info(s)}
                  aria-label={tr({ en: 'Details', fr: 'Détails', es: 'Detalles' })}>ⓘ</button
                >
              </li>
            {/each}
          </ul>
        {:else}
          <p class="none">
            {tr({ en: 'No spell matches.', fr: 'Aucun sort ne correspond.', es: 'Ningún conjuro coincide.' })}
          </p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .picker {
    flex-basis: 100%;
    margin: 0.3rem 0;
  }
  .opener {
    min-height: 2.4rem;
  }
  .panel {
    margin-top: 0.35rem;
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    padding: 0.5rem;
    background: var(--box);
  }
  input {
    width: 100%;
    min-height: 2.4rem;
    font: inherit;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }
  .list {
    max-height: 22rem;
    overflow-y: auto;
    margin-top: 0.4rem;
  }
  h5 {
    margin: 0.5rem 0 0.2rem;
    font-family: var(--font-title);
    font-weight: 400;
    color: var(--ink-soft);
  }
  .n {
    font-size: 0.8em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: stretch;
    gap: 0.2rem;
    margin-bottom: 0.2rem;
  }
  .add {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    min-height: 2.6rem;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .add:hover {
    background: var(--paper-2);
  }
  .add strong {
    white-space: nowrap;
  }
  .sum {
    color: var(--ink-soft);
    font-size: 0.85em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .info {
    background: none;
    border: none;
    min-width: 2.4rem;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .none {
    color: var(--ink-soft);
  }
  @media (max-width: 600px) {
    .sum {
      display: none;
    }
  }
</style>
