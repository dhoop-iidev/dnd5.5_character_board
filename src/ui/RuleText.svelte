<script lang="ts">
  // A clickable name that opens the verbatim SRD text of a feature, feat, trait, item or spell.
  import type { I18n, Source } from '../data/types'
  import { tr } from '../state.svelte'
  import { openPopup } from './popupState.svelte'

  let {
    name,
    text,
    source,
    noteKey,
    lines = [],
    summary,
  }: { name: I18n; text?: I18n; source?: Source; noteKey?: string; lines?: I18n[]; summary?: I18n } = $props()
</script>

<button class="rule" onclick={() => openPopup({ title: name, html: text, source, noteKey, lines, summary })}
  >{tr(name)}</button
>

<style>
  .rule {
    font: inherit;
    padding: 0;
    border: none;
    background: none;
    color: var(--ink);
    cursor: pointer;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
    text-align: left;
    min-height: 2rem;
  }
  .rule:hover {
    color: var(--accent);
  }
</style>
