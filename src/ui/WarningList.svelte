<script module lang="ts">
  import type { RuleWarning } from '../engine/checks/common'
  import { openPopup } from './popupState.svelte'

  const TITLE = {
    error: { en: 'Rule check: error', fr: 'Vérification de règle : erreur', es: 'Comprobación de reglas: error' },
    warning: {
      en: 'Rule check: warning',
      fr: 'Vérification de règle : avertissement',
      es: 'Comprobación de reglas: aviso',
    },
    info: { en: 'Rule check: note', fr: 'Vérification de règle : remarque', es: 'Comprobación de reglas: nota' },
  } as const

  /** Opens a warning in the popup: the message and its SRD source (sources are shown only inside popups). */
  export function openWarning(w: RuleWarning) {
    openPopup({ title: TITLE[w.severity], summary: w.message, source: w.source })
  }
</script>

<script lang="ts">
  // Rule warnings (never blocking). Each line is a button that opens the popup with the source.
  import type { WarningArea } from '../engine/validate'
  import { tr, view } from '../state.svelte'

  let {
    areas,
    level,
    withoutLevel = false,
    filter,
    compact = false,
  }: {
    /** Only the warnings of these areas (every area when omitted). */
    areas?: WarningArea[]
    /** Only the warnings about this character level. */
    level?: number
    /** Only the warnings that concern no particular level. */
    withoutLevel?: boolean
    /** Any extra condition. */
    filter?: (w: RuleWarning) => boolean
    /** Tighter lines (inside a table row). */
    compact?: boolean
  } = $props()

  const list = $derived(
    view.warnings.filter(
      (w) =>
        (!areas || areas.includes(w.area)) &&
        (level === undefined || w.level === level) &&
        (!withoutLevel || w.level === undefined) &&
        (!filter || filter(w)),
    ),
  )
  const icon = { error: '⛔', warning: '⚠', info: 'ℹ' }
</script>

{#if list.length}
  <ul class="warnings" class:compact>
    {#each list as w (w.id)}
      <li class={w.severity}>
        <button onclick={() => openWarning(w)}>
          <span class="icon" aria-hidden="true">{icon[w.severity]}</span>
          {tr(w.message)}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .warnings {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    font-size: 0.92em;
  }
  .compact {
    margin: 0.25rem 0 0.1rem;
    font-size: 0.88em;
  }
  li {
    border-left: 3px solid var(--rule-strong);
    margin-bottom: 0.3em;
    background: var(--paper-2);
    border-radius: 0 3px 3px 0;
  }
  .compact li {
    margin-bottom: 0.2em;
  }
  button {
    display: block;
    width: 100%;
    min-height: 2.4rem;
    padding: 0.35em 0.7em;
    border: none;
    border-radius: 0 3px 3px 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .compact button {
    min-height: 2rem;
    padding: 0.25em 0.6em;
  }
  button:hover {
    background: var(--box);
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .icon {
    margin-right: 0.2em;
  }
  .error {
    border-color: var(--danger);
  }
  .error .icon {
    color: var(--danger);
  }
  .warning {
    border-color: var(--warn);
  }
  .warning .icon {
    color: var(--warn);
  }
  .info {
    border-color: var(--ink-soft);
  }
</style>
