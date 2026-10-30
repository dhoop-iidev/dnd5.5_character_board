<script lang="ts">
  // Welcome screen: import a character JSON, or start a new level-1 character, made step by step in the Builder
  // (ui/Builder.svelte, user request 2026-10-30): class, origin, ability scores, spells, Weapon Mastery, starting
  // equipment (SRD 5.2.1 "Character Creation", p. 19–23, FR p. 20–24, ES p. 21–25). It starts as a Human Soldier
  // Fighter with the class's suggested Standard Array and both starting equipment options A, all changed in the steps.
  import { rules } from '../data/rules'
  import { UI } from '../i18n/ui'
  import { migrate } from '../model/migrate'
  import { newCharacter } from '../model/newCharacter'
  import { app, openCharacter, tr } from '../state.svelte'
  import { openBuilder } from './builderState.svelte'
  import { defaultIncreases, suggestedArray, type Kits } from './creation'

  let fileInput: HTMLInputElement | undefined = $state()
  let message = $state('')

  async function importJson(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      openCharacter(migrate(JSON.parse(await file.text())))
    } catch (err) {
      message =
        tr({ en: 'Import failed: ', fr: "Échec de l'import : ", es: 'Error al importar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  let name = $state('')
  let player = $state('')

  function create() {
    const kits: Kits = { classKit: 'A', backgroundKit: 'A', picks: {} }
    const c = newCharacter(
      {
        name: name.trim() || tr({ en: 'Unnamed', fr: 'Sans nom', es: 'Sin nombre' }),
        player: player.trim(),
        speciesId: 'human',
        backgroundId: 'soldier',
        classId: 'fighter',
        abilities: suggestedArray('fighter', rules),
        speciesChoices: { size: 'medium' },
        classKit: kits.classKit,
        backgroundKit: kits.backgroundKit,
        lang: app.character.settings.lang,
      },
      rules,
    )
    defaultIncreases(c, rules)
    openCharacter(c)
    openBuilder(0, { create: true, kits })
  }
</script>

<div class="welcome">
  <h1>{tr(UI.appTitle)}</h1>
  <p class="sub">
    {tr({
      en: '2024 rules (SRD 5.2.1). Your character stays in this browser; export it as a file to move it.',
      fr: 'Règles 2024 (SRD 5.2.1). Votre personnage reste dans ce navigateur ; exportez-le en fichier pour le déplacer.',
      es: 'Reglas de 2024 (SRD 5.2.1). Tu personaje se queda en este navegador; expórtalo como archivo para moverlo.',
    })}
  </p>
  <div class="lang" role="group" aria-label="Language">
    <button class:on={app.character.settings.lang === 'en'} onclick={() => (app.character.settings.lang = 'en')}
      >EN</button
    >
    <button class:on={app.character.settings.lang === 'fr'} onclick={() => (app.character.settings.lang = 'fr')}
      >FR</button
    >
    <button class:on={app.character.settings.lang === 'es'} onclick={() => (app.character.settings.lang = 'es')}
      >ES</button
    >
  </div>

  <section class="box">
    <h3>{tr({ en: 'Import a character', fr: 'Importer un personnage', es: 'Importar un personaje' })}</h3>
    <button class="primary" onclick={() => fileInput?.click()}
      >⭱ {tr({ en: 'Open a JSON file', fr: 'Ouvrir un fichier JSON', es: 'Abrir un archivo JSON' })}</button
    >
    <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={importJson} hidden />
    {#if message}<p class="msg">{message}</p>{/if}
  </section>

  <section class="box">
    <h3>
      {tr({
        en: 'Create a level 1 character',
        fr: 'Créer un personnage de niveau 1',
        es: 'Crear un personaje de nivel 1',
      })}
    </h3>
    <p class="hint">
      {tr({
        en: 'Step by step, as in the SRD (p. 19–23): class, origin, ability scores, spells, Weapon Mastery, starting equipment. Each step says what is still to choose; you can stop at any time and come back later.',
        fr: 'Étape par étape, comme dans le SRD (p. 20–24) : classe, origines, caractéristiques, sorts, bottes d’arme, équipement de départ. Chaque étape indique ce qui reste à choisir ; vous pouvez vous arrêter à tout moment et reprendre plus tard.',
        es: 'Paso a paso, como en el SRD (p. 21–25): clase, origen, características, conjuros, maestría con armas, equipo inicial. Cada paso indica lo que falta por elegir; puedes parar en cualquier momento y seguir más tarde.',
      })}
    </p>
    <div class="grid2">
      <label>{tr({ en: 'Character', fr: 'Personnage', es: 'Personaje' })}<input bind:value={name} /></label>
      <label>{tr({ en: 'Player', fr: 'Joueur', es: 'Jugador' })}<input bind:value={player} /></label>
    </div>
    <div class="go">
      <button class="primary" onclick={create}
        >{tr({ en: 'Start the creation', fr: 'Commencer la création', es: 'Empezar la creación' })} →</button
      >
    </div>
  </section>
</div>

<style>
  .welcome {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  h1 {
    font-family: var(--font-display);
    text-align: center;
    margin: 0;
  }
  .sub {
    text-align: center;
    color: var(--ink-soft);
    margin: 0;
  }
  .lang {
    display: flex;
    justify-content: center;
  }
  .lang button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    font-family: var(--font-num);
    font-weight: 700;
  }
  .lang button.on {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.75rem;
    margin: 0.75rem 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-family: var(--font-title);
  }
  input {
    min-height: 2.75rem;
    padding: 0 0.6rem;
    font: inherit;
    min-width: 0;
  }
  .go {
    display: flex;
    justify-content: flex-end;
    border-top: 1.5px solid var(--frame);
    padding-top: 0.75rem;
  }
  .primary {
    min-height: 2.75rem;
    padding: 0 1.25rem;
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
    font: inherit;
  }
  .hint {
    font-size: 0.92em;
    color: var(--ink-soft);
    margin: 0;
  }
  .msg {
    color: var(--danger);
  }
</style>
