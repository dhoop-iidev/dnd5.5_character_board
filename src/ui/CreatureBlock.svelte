<script lang="ts">
  // A creature stat block (SRD 5.2.1 "Monsters" layout) with, for a companion, its own hit points.
  import type { CreatureDef } from '../data/types'
  import { companionAc, companionHpMax } from '../engine/companions'
  import type { Companion } from '../model/character'
  import { lang, tr } from '../state.svelte'
  import { UI } from '../i18n/ui'
  import { creatureHtml } from './creatureHtml'
  import { openPopup } from './popupState.svelte'
  import { creatureI18nHtml } from './creatureHtml'

  let {
    def,
    companion,
    open = false,
    title,
    onremove,
  }: { def: CreatureDef; companion?: Companion; open?: boolean; title?: string; onremove?: () => void } = $props()

  let amount = $state(1)
  const html = $derived(
    creatureHtml(def, lang(), {
      ac: companionAc(def, companion?.spellLevel),
      hpMax: companionHpMax(def, companion?.spellLevel),
      noName: true,
    }),
  )
  const TYPE_NAME = {
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial' },
    fey: { en: 'Fey', fr: 'Fée', es: 'Feérico' },
    fiend: { en: 'Fiend', fr: 'Fiélon', es: 'Infernal' },
  }

  function damage(n: number) {
    if (!companion || n <= 0) return
    const fromTemp = Math.min(companion.hp.temp, n)
    companion.hp.temp -= fromTemp
    companion.hp.current = Math.max(0, companion.hp.current - (n - fromTemp))
  }
  function heal(n: number) {
    if (!companion || n <= 0) return
    companion.hp.current = Math.min(companion.hp.max, companion.hp.current + n)
  }
</script>

<details class="cb" {open}>
  <summary>
    <span class="name">{title ?? (companion?.name ? `${companion.name} (${tr(def.name)})` : tr(def.name))}</span>
    {#if companion?.creatureType}<span class="meta">{tr(TYPE_NAME[companion.creatureType])}</span>{/if}
    {#if companion}
      <span class="hp" class:zero={companion.hp.current <= 0}
        >{tr(UI.hpShort)}
        {companion.hp.current}{companion.hp.temp ? ` (+${companion.hp.temp})` : ''} / {companion.hp.max}</span
      >
      {#if companion.away}<span class="meta">{tr({ en: 'dismissed', fr: 'renvoyé', es: 'despedido' })}</span>{/if}
    {/if}
    <button
      class="info"
      onclick={(e) => {
        e.preventDefault()
        openPopup({ title: def.name, html: creatureI18nHtml(def), source: def.source, noteKey: `creature:${def.id}` })
      }}
      aria-label={tr({ en: 'Source', fr: 'Source', es: 'Fuente' })}>ⓘ</button
    >
  </summary>
  <div class="body">
    {#if companion}
      <div class="hpctl">
        <input type="number" min="1" bind:value={amount} aria-label={tr(UI.damage)} />
        <button class="dmg" onclick={() => damage(amount)}>− {tr(UI.damage)}</button>
        <button onclick={() => heal(amount)}>+ {tr({ en: 'Heal', fr: 'Soin', es: 'Curar' })}</button>
        <button onclick={() => (companion.hp.temp = Math.max(companion.hp.temp, amount))}>{tr(UI.tempHp)}</button>
        <label
          >{tr({ en: 'Max', fr: 'Max', es: 'Máx.' })}
          <input type="number" min="1" bind:value={companion.hp.max} /></label
        >
        <label class="chk"
          ><input type="checkbox" bind:checked={companion.away} />
          {tr({ en: 'Dismissed / absent', fr: 'Renvoyé / absent', es: 'Despedido / ausente' })}</label
        >
        {#if onremove}<button class="del" onclick={onremove}>{tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}</button
          >{/if}
      </div>
      <input
        class="note"
        type="text"
        bind:value={companion.note}
        placeholder={tr({
          en: 'Note (tricks, orders, where it is…)',
          fr: 'Note (tours, ordres, où il se trouve…)',
          es: 'Nota (trucos, órdenes, dónde está…)',
        })}
      />
    {/if}
    <div class="rule-text stat-block">{@html html}</div>
  </div>
</details>

<style>
  .cb {
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    margin-bottom: 0.5rem;
    background: var(--paper);
  }
  summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3rem 0.8rem;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    min-height: 2.5rem;
  }
  .info {
    font: inherit;
    background: none;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    min-width: 2rem;
  }
  .name {
    font-family: var(--font-title);
    font-size: 1.1rem;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
  }
  .hp {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .hp.zero {
    color: var(--danger);
  }
  .body {
    padding: 0 0.8rem 0.8rem;
    border-top: 1px solid var(--rule);
  }
  .hpctl {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin: 0.6rem 0;
  }
  .hpctl input[type='number'] {
    width: 4.5rem;
    min-height: 2.4rem;
  }
  .hpctl button {
    min-height: 2.4rem;
  }
  .dmg {
    color: var(--danger);
  }
  .del {
    margin-left: auto;
    color: var(--ink-soft);
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .note {
    width: 100%;
    min-height: 2.4rem;
    padding: 0 0.6rem;
    margin-bottom: 0.5rem;
  }
  .stat-block :global(p) {
    margin: 0.25rem 0;
  }
  .stat-block :global(.cb-type) {
    color: var(--ink-soft);
  }
  .stat-block :global(h5) {
    font-family: var(--font-title);
    font-weight: 400;
    font-size: 1rem;
    letter-spacing: 0.04em;
    margin: 0.8rem 0 0.2rem;
    border-bottom: 1.5px solid var(--frame);
  }
  .stat-block :global(.cb-abilities) {
    width: auto;
    margin: 0.4rem 0;
    font-family: var(--font-num);
  }
  .stat-block :global(.cb-abilities th),
  .stat-block :global(.cb-abilities td) {
    padding: 0.1em 0.6em;
    text-align: center;
  }
  .stat-block :global(.cb-abilities tbody th) {
    text-align: left;
    font-family: var(--font-title);
    border-bottom: 1px solid var(--rule);
  }
  .stat-block :global(.cb-errata) {
    margin-top: 0.6rem;
    padding: 0.4rem 0.6rem;
    border-left: 3px solid var(--accent);
    color: var(--ink-soft);
    font-size: 0.9em;
  }
</style>
