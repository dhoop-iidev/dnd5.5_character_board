<script lang="ts">
  // Move the character between PC and tablet as a JSON file (CLAUDE.md: no backend).
  import { migrate } from '../model/migrate'
  import { app, closeCharacter, openCharacter, tr } from '../state.svelte'
  import { printSheet } from './print.svelte'

  let fileInput: HTMLInputElement | undefined = $state()
  let message = $state('')

  function exportJson() {
    const c = app.character
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${c.identity.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importJson(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const character = migrate(JSON.parse(await file.text()))
      if (
        !confirm(
          tr({
            en: `Replace the current character with "${character.identity.name}"?`,
            fr: `Remplacer le personnage actuel par « ${character.identity.name} » ?`,
            es: `¿Reemplazar el personaje actual por «${character.identity.name}»?`,
          }),
        )
      )
        return
      openCharacter(character)
      message = tr({ en: 'Character imported.', fr: 'Personnage importé.', es: 'Personaje importado.' })
    } catch (err) {
      message =
        tr({ en: 'Import failed: ', fr: "Échec de l'import : ", es: 'Error al importar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  function reset() {
    if (
      confirm(
        tr({
          en: 'Close this character and remove it from this browser? Export it first: changes not exported are lost.',
          fr: 'Fermer ce personnage et l’effacer de ce navigateur ? Exportez-le d’abord : les modifications non exportées seront perdues.',
          es: '¿Cerrar este personaje y borrarlo de este navegador? Expórtalo antes: los cambios no exportados se perderán.',
        }),
      )
    )
      closeCharacter()
  }
</script>

<div class="save">
  <button onclick={exportJson}>⭳ {tr({ en: 'Export (JSON)', fr: 'Exporter (JSON)', es: 'Exportar (JSON)' })}</button>
  <button onclick={() => fileInput?.click()}>⭱ {tr({ en: 'Import', fr: 'Importer', es: 'Importar' })}</button>
  <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={importJson} hidden />
  <button onclick={reset}
    >✕ {tr({ en: 'Close the character', fr: 'Fermer le personnage', es: 'Cerrar el personaje' })}</button
  >
  <button
    onclick={printSheet}
    title={tr({
      en: 'Opens the print dialog with a printable sheet: choose “Save as PDF” as the printer.',
      fr: 'Ouvre l’impression avec une fiche imprimable : choisissez « Enregistrer au format PDF » comme imprimante.',
      es: 'Abre el cuadro de impresión con una hoja imprimible: elige «Guardar como PDF» como impresora.',
    })}>⎙ {tr({ en: 'Generate the PDF', fr: 'Générer le PDF', es: 'Generar el PDF' })}</button
  >
  {#if message}<span>{message}</span>{/if}
</div>

<style>
  .save {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.9rem;
  }
  button {
    font: inherit;
    min-height: 2.75rem;
    padding: 0 0.9rem;
    background: var(--box);
    color: var(--ink);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    border-color: var(--frame);
    background: var(--paper-2);
  }
</style>
