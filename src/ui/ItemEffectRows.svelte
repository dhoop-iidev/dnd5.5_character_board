<script lang="ts">
  // The active item effects, under the Combat pane's effects list: one read-only row per item whose effects apply now
  // (worn, in hand, attuned when required: engine/items.ts `inactiveReason`), with what it does ("+1 AC, +1 saving
  // throws"). The item's name opens its popup; it is switched off in the Equipment pane (location, Attunement).
  import { rules } from '../data/rules'
  import { inactiveReason } from '../engine/items'
  import { app, tr } from '../state.svelte'
  import { effectLine } from './itemEffects'
  import { itemName, openItem } from './items'

  const c = $derived(app.character)
  const rows = $derived(
    (c.inventory ?? [])
      .filter((i) => !inactiveReason(i, rules))
      .map((item) => ({ item, line: effectLine(item, c.featureChoices ?? {}) }))
      .filter((x) => !!x.line),
  )
</script>

{#if rows.length}
  <ul class="items">
    {#each rows as { item, line } (item.uid)}
      <li>
        <span class="arcane" title={tr({ en: 'Item effect', fr: 'Effet d’objet', es: 'Efecto del objeto' })}>✦</span>
        <button class="link" onclick={() => openItem(item)}>{tr(itemName(item))}</button>
        <small>{tr(line!)}</small>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .items {
    list-style: none;
    margin: 0.3rem 0 0.6rem;
    padding: 0;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.5rem;
    padding: 0.3rem 0;
    border-top: 1px solid var(--rule);
  }
  .arcane {
    color: var(--arcane);
  }
  small {
    color: var(--ink-soft);
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-underline-offset: 0.2em;
  }
  .link:hover {
    color: var(--accent);
  }
</style>
