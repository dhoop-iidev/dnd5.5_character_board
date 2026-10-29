<script lang="ts">
  // "SRD 5.2.1 p. 29 / FR p. 31", the English part linking to the cited paragraph of 5e24srd.com (an HTML rendering
  // of SRD 5.2.1, CC-BY-4.0) in a new tab (CLAUDE.md: every rule shows its source). Used only inside popups.
  import type { Source } from '../data/types'
  import { pdfUrl, srdUrl } from '../data/links'
  import { lang, tr } from '../state.svelte'
  import { UI } from '../i18n/ui'

  /** `name`: English name of the entry (popup title or breakdown label), to find its paragraph when the section is
   * only a chapter ("Spells", "Weapons", "Rules Glossary"). */
  let { source, name }: { source?: Source; name?: string } = $props()
  const href = $derived(srdUrl(source, name))
</script>

{#if source}
  <span class="source" title={source.section ?? ''}>
    {#if source.page}
      <a {href} target="_blank" rel="noopener">{tr(UI.srd)} {tr(UI.page)} {source.page}</a>
      {#if lang() === 'es' && source.esPage}<span
          >/ <a href={pdfUrl('es', source.esPage)} target="_blank" rel="noopener">ES p. {source.esPage}</a></span
        >{:else if source.frPage}<span
          >/ <a href={pdfUrl('fr', source.frPage)} target="_blank" rel="noopener">{tr(UI.frPage)} {source.frPage}</a
          ></span
        >{/if}
    {/if}
    {#if source.book}<span>{source.book}</span>{/if}
    {#if source.houseRule}
      <span class="house">{tr(UI.houseRule)} #{source.houseRule}</span>
    {/if}
  </span>
{/if}

<style>
  .source {
    display: inline-flex;
    gap: 0.4em;
    font-size: 0.8em;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  a {
    color: var(--accent);
  }
  .house {
    font-style: italic;
  }
</style>
