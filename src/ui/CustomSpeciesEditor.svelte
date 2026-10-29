<script lang="ts">
  // Custom species (house rule #6, `model/customSpecies.ts`): species from other books (Tabaxi…) entered by the player in
  // their own words, with the book and page. No ability score increases: under the 2024 rules they come from the
  // background (SRD 5.2.1 p. 20). Each trait: character level, name, summary, and optionally what the sheet uses
  // (Darkvision, other speeds, skill proficiencies, resistances, uses per rest, the part of the turn it takes, modifiers).
  // A species can be exported to a file and imported into another character; it then appears in the Origin's species
  // menu.
  import { rules } from '../data/rules'
  import type { AbilityId, DamageType, I18n, RestKind, Size, SkillId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_NAMES } from '../engine/sheet/common'
  import { SIZE_NAMES } from '../i18n/ui'
  import type { CustomSpecies, CustomSpeciesTrait } from '../model/character'
  import { newCustomSpecies, newCustomTrait, readSpeciesFile, speciesFile } from '../model/customSpecies'
  import { app, tr } from '../state.svelte'
  import ModifierEditor from './ModifierEditor.svelte'

  const c = $derived(app.character)
  let open = $state<string | null>(null)
  let message = $state('')
  let fileInput: HTMLInputElement | undefined = $state()

  const SIZES: Size[] = ['tiny', 'small', 'medium', 'large']
  const RESTS: RestKind[] = ['short', 'long']
  const SPEEDS = [
    { id: 'climb', name: { en: 'Climb Speed', fr: 'Vitesse d’escalade', es: 'Velocidad trepando' } },
    { id: 'swim', name: { en: 'Swim Speed', fr: 'Vitesse de nage', es: 'Velocidad nadando' } },
    { id: 'fly', name: { en: 'Fly Speed', fr: 'Vitesse de vol', es: 'Velocidad volando' } },
  ] as const
  const KINDS = [
    { id: 'action', name: { en: 'Action', fr: 'Action', es: 'Acción' } },
    { id: 'bonus-action', name: { en: 'Bonus Action', fr: 'Action bonus', es: 'Acción adicional' } },
    { id: 'reaction', name: { en: 'Reaction', fr: 'Réaction', es: 'Reacción' } },
    { id: 'free', name: { en: 'No action (free)', fr: 'Sans action (libre)', es: 'Sin acción (libre)' } },
  ]
  const skills = $derived([...rules.skills.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name))))
  const DAMAGE_TYPES = Object.entries(rules.damageTypeNames) as [DamageType, I18n][]

  const inUse = (sp: CustomSpecies) => c.speciesId === sp.id

  function add() {
    c.customSpecies ??= []
    const sp = newCustomSpecies(c.customSpecies)
    c.customSpecies.push(sp)
    open = sp.id
  }
  function remove(sp: CustomSpecies) {
    c.customSpecies = (c.customSpecies ?? []).filter((s) => s.id !== sp.id)
    if (open === sp.id) open = null
  }
  /** Take this species for the character (as the Origin's species menu does). */
  function use(sp: CustomSpecies) {
    const old = c.speciesId
    c.speciesId = sp.id
    c.speciesChoices = sp.size.length > 1 ? { size: sp.size.includes('medium') ? 'medium' : sp.size[0] } : {}
    for (const k of Object.keys(c.featureChoices)) if (k.startsWith(`${old}:`)) delete c.featureChoices[k]
    for (const k of Object.keys(c.extraFeats)) if (k.startsWith(`${old}:`)) delete c.extraFeats[k]
  }
  function toggleSize(sp: CustomSpecies, z: Size) {
    const next = sp.size.includes(z)
      ? sp.size.filter((x) => x !== z)
      : SIZES.filter((x) => x === z || sp.size.includes(x))
    if (!next.length) return
    sp.size = next
    // The character's size choice follows (SRD p. 20: some species choose Small or Medium).
    if (inUse(sp)) {
      if (next.length > 1 && !next.includes(c.speciesChoices.size as Size))
        c.speciesChoices.size = next.includes('medium') ? 'medium' : next[0]
      if (next.length === 1) delete c.speciesChoices.size
    }
  }
  function exportSpecies(sp: CustomSpecies) {
    const blob = new Blob([JSON.stringify(speciesFile($state.snapshot(sp) as CustomSpecies), null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(sp.name || sp.id).replace(/[^\p{L}\p{N}]+/gu, '_')}.species.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function importSpecies(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      c.customSpecies ??= []
      const sp = readSpeciesFile(JSON.parse(await file.text()), c.customSpecies)
      c.customSpecies.push(sp)
      open = sp.id
      message = ''
    } catch (err) {
      message =
        tr({ en: 'Import failed: ', fr: 'Échec de l’import : ', es: 'Error al importar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  // --- Uses: a number, PB or an ability modifier (min 1) ---
  type CountKind = '' | 'n' | 'pb' | AbilityId
  function countKind(t: CustomSpeciesTrait): CountKind {
    const n = t.uses?.count
    if (n === undefined || n === '') return ''
    if (typeof n === 'number') return 'n'
    if (n === 'pb') return 'pb'
    return (ABILITIES as readonly string[]).includes(n) ? (n as AbilityId) : ''
  }
  function setCountKind(t: CustomSpeciesTrait, k: CountKind) {
    if (!k) delete t.uses
    else t.uses = { count: k === 'n' ? 1 : k, per: t.uses?.per ?? 'long' }
  }
  function setActivation(t: CustomSpeciesTrait, k: string) {
    if (!k) delete t.activation
    else
      t.activation = {
        kind: k as NonNullable<CustomSpeciesTrait['activation']>['kind'],
        trigger: t.activation?.trigger,
      }
  }
  /** Other speed field: a number of feet, or "=" for "equal to your Speed". */
  const speedText = (v: number | 'speed' | undefined) => (v === 'speed' ? '=' : v ? String(v) : '')
  function setSpeed(t: CustomSpeciesTrait, kind: 'climb' | 'swim' | 'fly', text: string) {
    const s = text.trim()
    const v = s === '=' ? 'speed' : Math.max(0, Math.round(+s || 0))
    t.speeds ??= {}
    if (v) t.speeds[kind] = v
    else delete t.speeds[kind]
    if (!Object.keys(t.speeds).length) delete t.speeds
  }
  function toggleIn<T>(list: T[] | undefined, v: T): T[] | undefined {
    const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]
    return next.length ? next : undefined
  }
</script>

<h4>{tr({ en: 'Custom species', fr: 'Espèces personnalisées', es: 'Especies personalizadas' })}</h4>
<p class="sub">
  {tr({
    en: 'Species from other books (house rule #6), in your own words with the book and page. Under the 2024 rules they give no ability score increases: those come from your background. They then appear in the Origin’s species menu.',
    fr: 'Espèces d’autres livres (règle maison n° 6), dans vos propres mots, avec le livre et la page. Selon les règles de 2024, elles ne donnent aucune augmentation de caractéristique : celles-ci viennent de l’historique. Elles apparaissent ensuite dans le menu des espèces de l’Origine.',
    es: 'Especies de otros libros (regla de la casa n.º 6), con tus propias palabras, el libro y la página. Según las reglas de 2024 no dan aumentos de característica: vienen del trasfondo. Después aparecen en el menú de especies del Origen.',
  })}
</p>

{#each c.customSpecies ?? [] as sp (sp.id)}
  <div class="item">
    <div class="head">
      <button class="name" onclick={() => (open = open === sp.id ? null : sp.id)} aria-expanded={open === sp.id}
        >{open === sp.id ? '▾' : '▸'}
        {sp.name || tr({ en: '(unnamed)', fr: '(sans nom)', es: '(sin nombre)' })}</button
      >
      <span class="meta">{sp.book}</span>
      {#if inUse(sp)}
        <span class="meta">✓ {tr({ en: 'your species', fr: 'votre espèce', es: 'tu especie' })}</span>
      {:else}
        <button class="ghost" onclick={() => use(sp)}
          >{tr({
            en: 'Use for this character',
            fr: 'Prendre pour ce personnage',
            es: 'Usar para este personaje',
          })}</button
        >
      {/if}
      <button class="ghost" onclick={() => exportSpecies(sp)}
        >{tr({ en: 'Export', fr: 'Exporter', es: 'Exportar' })}</button
      >
      <button
        class="ghost"
        disabled={inUse(sp)}
        title={inUse(sp)
          ? tr({ en: 'Your character’s species', fr: 'L’espèce de votre personnage', es: 'La especie de tu personaje' })
          : tr({ en: 'Delete', fr: 'Supprimer', es: 'Eliminar' })}
        onclick={() => remove(sp)}>✕</button
      >
    </div>
    {#if open === sp.id}
      <div class="form">
        <label class="grow"
          >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={sp.name} /></label
        >
        <label class="grow"
          >{tr({ en: 'Book and page', fr: 'Livre et page', es: 'Libro y página' })}<input
            type="text"
            bind:value={sp.book}
            placeholder={tr({ en: 'Book p. …', fr: 'Livre p. …', es: 'Libro p. …' })}
          /></label
        >
        <label
          >{tr({ en: 'Creature type', fr: 'Type de créature', es: 'Tipo de criatura' })}<input
            type="text"
            bind:value={sp.creatureType}
          /></label
        >
        <label class="lv"
          >{tr({ en: 'Speed (ft)', fr: 'Vitesse (pieds)', es: 'Velocidad (pies)' })}<input
            type="number"
            min="0"
            step="5"
            bind:value={sp.speedFt}
          /></label
        >
        <div class="wide">
          <span class="lab"
            >{tr({
              en: 'Size (two = the player chooses)',
              fr: 'Taille (deux = au choix du joueur)',
              es: 'Tamaño (dos = a elección del jugador)',
            })}</span
          >
          {#each SIZES as z (z)}
            <label class="chip"
              ><input type="checkbox" checked={sp.size.includes(z)} onchange={() => toggleSize(sp, z)} />{tr(
                SIZE_NAMES[z],
              )}</label
            >
          {/each}
        </div>
        <label class="wide"
          >{tr({
            en: 'Description (your own words)',
            fr: 'Description (vos propres mots)',
            es: 'Descripción (tus propias palabras)',
          })}<textarea rows="2" bind:value={sp.text}></textarea></label
        >

        <h5 class="wide">{tr({ en: 'Traits', fr: 'Traits', es: 'Rasgos' })}</h5>
        {#each [...sp.traits].sort((a, b) => a.level - b.level) as t (t.id)}
          <div class="trait wide">
            <div class="row">
              <label class="lv"
                >{tr({ en: 'From level', fr: 'Dès le niveau', es: 'Desde el nivel' })}<input
                  type="number"
                  min="1"
                  max="20"
                  bind:value={t.level}
                /></label
              >
              <label class="grow"
                >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={t.name} /></label
              >
              <button
                class="ghost"
                title={tr({ en: 'Remove the trait', fr: 'Retirer le trait', es: 'Quitar el rasgo' })}
                onclick={() => (sp.traits = sp.traits.filter((x) => x.id !== t.id))}>✕</button
              >
            </div>
            <label
              >{tr({
                en: 'What it does (your own summary)',
                fr: 'Ce qu’il fait (votre propre résumé)',
                es: 'Qué hace (tu propio resumen)',
              })}<textarea rows="3" bind:value={t.text}></textarea></label
            >
            <div class="row">
              <label class="lv"
                >{tr({
                  en: 'Darkvision (ft)',
                  fr: 'Vision dans le noir (pieds)',
                  es: 'Visión en la oscuridad (pies)',
                })}<input
                  type="number"
                  min="0"
                  step="5"
                  value={t.darkvisionFt ?? ''}
                  onchange={(e) =>
                    +e.currentTarget.value ? (t.darkvisionFt = +e.currentTarget.value) : delete t.darkvisionFt}
                /></label
              >
              {#each SPEEDS as s (s.id)}
                <label class="lv"
                  >{tr(s.name)}<input
                    type="text"
                    value={speedText(t.speeds?.[s.id])}
                    placeholder={tr({ en: 'ft or =', fr: 'pieds ou =', es: 'pies o =' })}
                    title={tr({
                      en: 'Feet, or “=” for “equal to your Speed”',
                      fr: 'En pieds, ou « = » pour « égale à votre Vitesse »',
                      es: 'En pies, o «=» para «igual a tu Velocidad»',
                    })}
                    onchange={(e) => setSpeed(t, s.id, e.currentTarget.value)}
                  /></label
                >
              {/each}
            </div>
            <details>
              <summary class="lab"
                >{tr({
                  en: 'Skill proficiencies',
                  fr: 'Maîtrises de compétences',
                  es: 'Competencias en habilidades',
                })}{t.skills?.length
                  ? ` (${t.skills.map((id) => tr(rules.skills.get(id)?.name)).join(', ')})`
                  : ''}</summary
              >
              {#each skills as sk (sk.id)}
                <label class="chip"
                  ><input
                    type="checkbox"
                    checked={t.skills?.includes(sk.id)}
                    onchange={() => (t.skills = toggleIn<SkillId>(t.skills, sk.id))}
                  />{tr(sk.name)}</label
                >
              {/each}
            </details>
            <details>
              <summary class="lab"
                >{tr({ en: 'Resistances', fr: 'Résistances', es: 'Resistencias' })}{t.resistances?.length
                  ? ` (${t.resistances.map((d) => tr(rules.damageTypeNames[d])).join(', ')})`
                  : ''}</summary
              >
              {#each DAMAGE_TYPES as [id, n] (id)}
                <label class="chip"
                  ><input
                    type="checkbox"
                    checked={t.resistances?.includes(id)}
                    onchange={() => (t.resistances = toggleIn<DamageType>(t.resistances, id))}
                  />{tr(n)}</label
                >
              {/each}
            </details>
            <div class="row">
              <label
                >{tr({ en: 'Uses', fr: 'Utilisations', es: 'Usos' })}
                <select value={countKind(t)} onchange={(e) => setCountKind(t, e.currentTarget.value as CountKind)}>
                  <option value="">—</option>
                  <option value="n">{tr({ en: 'Number', fr: 'Nombre', es: 'Número' })}</option>
                  <option value="pb"
                    >{tr({
                      en: 'Proficiency Bonus',
                      fr: 'Bonus de maîtrise',
                      es: 'Bonificador por competencia',
                    })}</option
                  >
                  {#each ABILITIES as a (a)}<option value={a}
                      >{tr({ en: 'Modifier', fr: 'Modificateur', es: 'Modificador' })} {tr(ABILITY_NAMES[a])}</option
                    >{/each}
                </select>
              </label>
              {#if t.uses}
                {#if typeof t.uses.count === 'number'}
                  <label class="lv"
                    >{tr({ en: 'Number', fr: 'Nombre', es: 'Número' })}<input
                      type="number"
                      min="1"
                      bind:value={t.uses.count}
                    /></label
                  >
                {/if}
                <label
                  >{tr({ en: 'Back on', fr: 'Récupérées après', es: 'Se recuperan tras' })}
                  <select bind:value={t.uses.per}>
                    {#each RESTS as r (r)}<option value={r}
                        >{r === 'short'
                          ? tr({ en: 'Short Rest', fr: 'Repos court', es: 'Descanso corto' })
                          : tr({ en: 'Long Rest', fr: 'Repos long', es: 'Descanso largo' })}</option
                      >{/each}
                  </select>
                </label>
              {/if}
              <label
                >{tr({ en: 'Takes', fr: 'Demande', es: 'Requiere' })}
                <select value={t.activation?.kind ?? ''} onchange={(e) => setActivation(t, e.currentTarget.value)}>
                  <option value="">—</option>
                  {#each KINDS as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
                </select>
              </label>
              {#if t.activation}
                <label class="grow"
                  >{tr({
                    en: 'Trigger or reminder',
                    fr: 'Déclencheur ou rappel',
                    es: 'Desencadenante o recordatorio',
                  })}<input type="text" bind:value={t.activation.trigger} /></label
                >
              {/if}
            </div>
            <span class="lab"
              >{tr({
                en: 'Other numbers the sheet applies (optional)',
                fr: 'Autres valeurs appliquées par la feuille (facultatif)',
                es: 'Otros valores que aplica la hoja (opcional)',
              })}</span
            >
            <ModifierEditor bind:mods={() => t.modifiers ?? [], (v) => (t.modifiers = v)} />
          </div>
        {/each}
        <div class="wide">
          <button onclick={() => sp.traits.push(newCustomTrait(sp))}
            >＋ {tr({ en: 'Add a trait', fr: 'Ajouter un trait', es: 'Añadir un rasgo' })}</button
          >
        </div>
      </div>
    {/if}
  </div>
{/each}

<div class="bar">
  <button onclick={add}
    >＋ {tr({
      en: 'New custom species',
      fr: 'Nouvelle espèce personnalisée',
      es: 'Nueva especie personalizada',
    })}</button
  >
  <button class="ghost" onclick={() => fileInput?.click()}
    >{tr({
      en: 'Import a species file',
      fr: 'Importer un fichier d’espèce',
      es: 'Importar un archivo de especie',
    })}</button
  >
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={importSpecies} />
</div>
{#if message}<p class="msg">{message}</p>{/if}

<style>
  .sub {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .item {
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.6rem;
  }
  .name {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-title);
    cursor: pointer;
    text-align: left;
  }
  .meta {
    flex: 1;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.4rem 0 0.4rem 1rem;
  }
  .form label:not(.chip) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  h5 {
    margin: 0.5rem 0 0;
    font-family: var(--font-title);
  }
  .wide {
    flex-basis: 100%;
  }
  .grow {
    flex: 1;
    min-width: 10rem;
  }
  .trait {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    border-left: 2px solid var(--rule-strong);
    padding-left: 0.6rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.4rem 0.8rem;
  }
  .lv input {
    width: 5rem;
  }
  .lab {
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  summary.lab {
    cursor: pointer;
  }
  textarea {
    width: 100%;
    font: inherit;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 0.4rem 0.3rem 0;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.1em 0.6em;
  }
  .bar {
    display: flex;
    gap: 0.6rem;
    margin: 0.4rem 0;
  }
  .msg {
    color: var(--accent);
  }
</style>
