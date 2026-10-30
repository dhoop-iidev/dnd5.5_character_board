<script lang="ts">
  // Alignment as the 3 × 3 square (SRD 5.2.1 p. 21 "Step 4: Alignment", user request 2026-10-30): rows good, neutral,
  // evil; columns lawful, neutral, chaotic. Picking a square stores its id in `identity.alignment`; picking it again
  // clears it. The chosen alignment's SRD description is shown under the square.
  import { ALIGNMENTS, alignmentOf } from '../model/alignments'
  import { app, tr } from '../state.svelte'

  const c = $derived(app.character)
  const current = $derived(alignmentOf(c.identity.alignment))
  const pick = (id: string) => (c.identity.alignment = current?.id === id ? '' : id)
</script>

<div class="grid" role="radiogroup" aria-label={tr({ en: 'Alignment', fr: 'Alignement', es: 'Alineamiento' })}>
  {#each ALIGNMENTS as a (a.id)}
    <button
      role="radio"
      aria-checked={current?.id === a.id}
      class:on={current?.id === a.id}
      title={tr(a.text)}
      onclick={() => pick(a.id)}
    >
      <b>{tr(a.abbr)}</b>
      <span>{tr(a.name)}</span>
    </button>
  {/each}
</div>
{#if current}
  <p class="text">{tr(current.text)}</p>
{:else if c.identity.alignment}
  <p class="text">{c.identity.alignment}</p>
{/if}
<p class="hint">
  {tr({
    en: 'The game assumes that player characters aren’t of an evil alignment: check with your GM before making an evil character.',
    fr: 'Le jeu part du principe que les personnages joueurs ne sont pas d’alignement mauvais : demandez l’accord du MJ avant d’en créer un.',
    es: 'El juego da por hecho que los personajes jugadores no son de alineamiento malvado: consulta a tu DM antes de crear uno.',
  })}
</p>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
    max-width: 30rem;
  }
  .grid button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    min-height: 3.6rem;
    padding: 0.3rem;
    font: inherit;
    background: var(--box);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    cursor: pointer;
  }
  .grid button.on {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  .grid b {
    font-family: var(--font-num);
  }
  .grid span {
    font-size: 0.85em;
    text-align: center;
  }
  .text {
    margin: 0.5rem 0 0;
    max-width: 40rem;
  }
  .hint {
    margin: 0.4rem 0 0;
    font-size: 0.85em;
    color: var(--ink-soft);
  }
</style>
