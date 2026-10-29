<script lang="ts">
  import type { I18n } from '../data/types'
  import type { Stat } from '../engine/stacking'
  import { fmt } from '../engine/compute'
  import { openPopup } from './popupState.svelte'

  let {
    stat,
    title,
    signed = true,
    big = false,
    suffix = '',
  }: { stat: () => Stat; title: I18n; signed?: boolean; big?: boolean; suffix?: string } = $props()

  const value = $derived(stat().total)
  const hasSituational = $derived(stat().parts.some((p) => p.condition))
</script>

<button class="stat" class:big onclick={() => openPopup({ title, stat, signed, noteKey: `stat:${title.en}` })}>
  {signed ? fmt(value) : value}{suffix}{#if hasSituational}<sup>*</sup>{/if}
</button>

<style>
  /* Clickable value: quiet at rest, clearly tappable (44px), outlined on hover/focus. */
  .stat {
    font: inherit;
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums lining-nums;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.1em 0.5em;
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
    transition:
      border-color 0.12s,
      background-color 0.12s;
  }
  .stat:hover {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .stat:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .stat:active {
    background: var(--paper-2);
  }
  .big {
    font-size: 1.5em;
  }
  sup {
    color: var(--accent);
    font-size: 0.55em;
    margin-left: 0.05em;
  }
</style>
