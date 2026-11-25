<script lang="ts">
  // Content packs (house rule #7, model/packs.ts): load a book's pack file into this browser or remove it. The app
  // ships none; the packs are the player's private files, made from their own books (docs/packs.md). Loading or
  // removing one reloads the page so the rules are built again with it.
  import { readPack } from '../model/packs'
  import { removePack, storePack } from '../model/packStore'
  import { packs, tr } from '../state.svelte'

  let fileInput: HTMLInputElement | undefined = $state()
  let message = $state('')

  async function load(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const pack = readPack(JSON.parse(await file.text()))
      await storePack(pack)
      location.reload()
    } catch (err) {
      message =
        tr({ en: 'Loading failed: ', fr: 'Échec du chargement : ', es: 'Error al cargar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  async function remove(id: string) {
    await removePack(id)
    location.reload()
  }
</script>

<div class="packs">
  <p class="hint">
    {tr({
      en: 'Content from your own books (house rule #7): one pack file per book, kept in this browser. Characters keep a copy of what they use, so their files open anywhere.',
      fr: 'Le contenu de vos propres livres (règle maison n° 7) : un fichier de pack par livre, conservé dans ce navigateur. Les personnages gardent une copie de ce qu’ils utilisent : leurs fichiers s’ouvrent partout.',
      es: 'El contenido de tus propios libros (regla de la casa n.º 7): un archivo de paquete por libro, guardado en este navegador. Los personajes guardan una copia de lo que usan, así que sus archivos se abren en cualquier parte.',
    })}
  </p>
  {#if packs.stored.length}
    <ul>
      {#each packs.stored as p (p.id)}
        <li>
          <span class="name">{tr(p.book)}</span>
          <span class="meta">{p.version}</span>
          <button class="ghost" onclick={() => remove(p.id)}
            >✕ {tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}</button
          >
        </li>
      {/each}
    </ul>
  {:else}
    <p class="meta">{tr({ en: 'No pack loaded.', fr: 'Aucun pack chargé.', es: 'Ningún paquete cargado.' })}</p>
  {/if}
  <button onclick={() => fileInput?.click()}
    >⭱ {tr({ en: 'Load a pack file', fr: 'Charger un fichier de pack', es: 'Cargar un archivo de paquete' })}</button
  >
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={load} />
  {#if message}<p class="msg">{message}</p>{/if}
</div>

<style>
  .hint,
  .meta {
    font-size: 0.85rem;
    color: var(--ink-soft);
    margin: 0 0 0.4rem;
  }
  ul {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
  }
  .name {
    flex: 1;
    font-family: var(--font-title);
  }
  .msg {
    color: var(--accent);
  }
</style>
