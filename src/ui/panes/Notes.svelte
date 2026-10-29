<script lang="ts">
  import { app, lang, tr } from '../../state.svelte'
  import { newUid, norm } from '../items'

  let query = $state('')
  const notes = $derived(
    [...app.character.notes]
      .filter((n) => !query.trim() || norm(n.title + ' ' + n.body).includes(norm(query)))
      .sort((a, b) => b.date.localeCompare(a.date)),
  )

  function add() {
    app.character.notes.push({ id: newUid(), date: new Date().toISOString().slice(0, 10), title: '', body: '' })
  }

  function remove(id: string) {
    const n = app.character.notes.find((x) => x.id === id)
    const label = tr({ en: 'Delete this note?', fr: 'Supprimer cette note ?', es: '¿Borrar esta nota?' })
    if (n && (n.body.trim() || n.title.trim()) && !confirm(label)) return
    app.character.notes = app.character.notes.filter((x) => x.id !== id)
  }
</script>

<div class="bar">
  <button class="add" onclick={add}>＋ {tr({ en: 'New note', fr: 'Nouvelle note', es: 'Nueva nota' })}</button>
  <input
    type="search"
    bind:value={query}
    placeholder={tr({ en: 'Search notes…', fr: 'Chercher dans les notes…', es: 'Buscar en las notas…' })}
  />
</div>

{#each notes as n (n.id)}
  {@const note = app.character.notes.find((x) => x.id === n.id)!}
  <article class="note">
    <header>
      <input type="date" bind:value={note.date} />
      <input
        class="title"
        bind:value={note.title}
        placeholder={tr({ en: 'Title (session, place…)', fr: 'Titre (séance, lieu…)', es: 'Título (sesión, lugar…)' })}
      />
      <button class="del" onclick={() => remove(n.id)} aria-label={tr({ en: 'Delete', fr: 'Supprimer', es: 'Borrar' })}
        >✕</button
      >
    </header>
    <textarea
      bind:value={note.body}
      rows="6"
      lang={lang()}
      placeholder={tr({
        en: 'What happened, NPCs, loot, quests…',
        fr: 'Ce qui s’est passé, PNJ, butin, quêtes…',
        es: 'Qué pasó, PNJ, botín, misiones…',
      })}></textarea>
  </article>
{:else}
  <p class="empty">{tr({ en: 'No notes yet.', fr: 'Pas encore de notes.', es: 'Aún no hay notas.' })}</p>
{/each}

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .bar input {
    flex: 1;
    min-width: 12rem;
  }
  input,
  textarea,
  button {
    font: inherit;
    background: var(--box);
    color: var(--ink);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    min-height: 2.75rem;
    padding: 0 0.7rem;
  }
  button {
    cursor: pointer;
  }
  .add {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  .note {
    border: 1.5px solid var(--frame);
    border-radius: 3px;
    padding: 0.75rem 1rem 1rem;
    margin-bottom: 1.25rem;
    background: var(--box);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  header input {
    border-color: transparent;
    background: transparent;
  }
  header input:hover {
    border-color: var(--rule);
  }
  .title {
    flex: 1;
    min-width: 10rem;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 1.1rem;
  }
  textarea {
    width: 100%;
    padding: 0.6rem 0.7rem;
    resize: vertical;
    line-height: 1.5;
    border-color: var(--rule);
  }
  .del {
    color: var(--danger);
    border-color: transparent;
    background: transparent;
  }
  .del:hover {
    border-color: var(--rule);
  }
  .empty {
    font-style: italic;
    color: var(--ink-soft);
  }
</style>
