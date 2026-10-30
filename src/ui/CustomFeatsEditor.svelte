<script lang="ts">
  // Custom feats (house rule #4, `model/customFeats.ts`): feats from other books that the player enters in their own
  // words with the book and page; they then appear in the feat menus of the progression (a level's feat instead of the
  // Ability Score Improvement, an Origin feat, a Fighting Style). Prerequisites and the +1 Ability Score Increase are
  // checked like SRD feats; modifiers (same vocabulary as custom items) are applied by the engine, the rest is text.
  import type { AbilityId, FeatCategory } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_NAMES, ABILITY_SHORT } from '../engine/sheet/common'
  import type { CustomFeat } from '../model/character'
  import { FEAT_CATEGORY_NAMES, newCustomFeat } from '../model/customFeats'
  import { app, tr } from '../state.svelte'
  import ModifierEditor from './ModifierEditor.svelte'

  const c = $derived(app.character)
  let open = $state<string | null>(null)

  /** Where the feat is taken: it can't be deleted while used. */
  function usedAt(id: string): string[] {
    const out: string[] = []
    if (c.background.feat?.featId === id) out.push(tr({ en: 'background', fr: 'historique', es: 'trasfondo' }))
    c.levels.forEach((l, i) => {
      if (l.feat?.featId === id) out.push(`${tr({ en: 'level', fr: 'niveau', es: 'nivel' })} ${i + 1}`)
    })
    if (Object.entries(c.featureChoices).some(([k, v]) => k.endsWith(':fighting-style') && v === id))
      out.push(tr({ en: 'Fighting Style', fr: 'style de combat', es: 'estilo de combate' }))
    if (Object.values(c.extraFeats ?? {}).some((p) => p.featId === id))
      out.push(tr({ en: 'feature choice', fr: 'choix d’aptitude', es: 'elección de rasgo' }))
    return out
  }

  function add() {
    c.customFeats ??= []
    const f = newCustomFeat(c.customFeats)
    c.customFeats.push(f)
    open = f.id
  }
  function remove(f: CustomFeat) {
    c.customFeats = (c.customFeats ?? []).filter((x) => x.id !== f.id)
    if (open === f.id) open = null
  }
  function toggle(list: AbilityId[] | undefined, a: AbilityId): AbilityId[] {
    const l = list ?? []
    return l.includes(a) ? l.filter((x) => x !== a) : ABILITIES.filter((x) => x === a || l.includes(x))
  }
  function setPrereqLevel(f: CustomFeat, v: number) {
    f.prereq ??= {}
    if (v > 0) f.prereq.level = Math.round(v)
    else delete f.prereq.level
  }
  function setPrereqMin(f: CustomFeat, v: number) {
    f.prereq ??= {}
    f.prereq.min = Math.round(v) || 13
  }
</script>

<h4>{tr({ en: 'Custom feats', fr: 'Dons personnalisés', es: 'Dotes personalizadas' })}</h4>
<p class="sub">
  {tr({
    en: 'Feats from other books (house rule #4), in your own words with the book and page. They then appear in the feat menus above, like the SRD ones.',
    fr: 'Dons d’autres livres (règle maison n° 4), dans vos propres mots, avec le livre et la page. Ils apparaissent ensuite dans les menus de dons ci-dessus, comme ceux du SRD.',
    es: 'Dotes de otros libros (regla de la casa n.º 4), con tus propias palabras, el libro y la página. Después aparecen en los menús de dotes de arriba, como las del SRD.',
  })}
</p>

{#each c.customFeats ?? [] as f (f.id)}
  {@const used = usedAt(f.id)}
  <div class="feat">
    <div class="head">
      <button class="name" onclick={() => (open = open === f.id ? null : f.id)} aria-expanded={open === f.id}
        >{open === f.id ? '▾' : '▸'}
        {f.name || tr({ en: '(unnamed)', fr: '(sans nom)', es: '(sin nombre)' })}</button
      >
      <span class="meta">{tr(FEAT_CATEGORY_NAMES[f.category])}{f.book ? ` · ${f.book}` : ''}</span>
      <button
        class="ghost"
        disabled={used.length > 0}
        title={used.length
          ? `${tr({ en: 'Taken at', fr: 'Pris au', es: 'Elegida en' })}: ${used.join(', ')}`
          : tr({ en: 'Delete', fr: 'Supprimer', es: 'Eliminar' })}
        onclick={() => remove(f)}>✕</button
      >
    </div>
    {#if open === f.id}
      <div class="form">
        <label class="wide"
          >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={f.name} /></label
        >
        <label
          >{tr({ en: 'Category', fr: 'Catégorie', es: 'Categoría' })}
          <select bind:value={f.category}>
            {#each Object.keys(FEAT_CATEGORY_NAMES) as k (k)}<option value={k}
                >{tr(FEAT_CATEGORY_NAMES[k as FeatCategory])}</option
              >{/each}
          </select>
        </label>
        <label class="grow"
          >{tr({ en: 'Book and page', fr: 'Livre et page', es: 'Libro y página' })}<input
            type="text"
            bind:value={f.book}
            placeholder={tr({
              en: 'Player’s Handbook (2024) p. …',
              fr: 'Manuel des joueurs (2024) p. …',
              es: 'Manual del jugador (2024) p. …',
            })}
          /></label
        >
        <label
          >{tr({ en: 'Prerequisite: level', fr: 'Prérequis : niveau', es: 'Requisito: nivel' })}<input
            type="number"
            min="0"
            max="20"
            value={f.prereq?.level ?? ''}
            onchange={(e) => setPrereqLevel(f, +e.currentTarget.value)}
          /></label
        >
        <div class="wide">
          <span class="lab"
            >{tr({
              en: 'Prerequisite: one of these abilities at',
              fr: 'Prérequis : une de ces caractéristiques à',
              es: 'Requisito: una de estas características a',
            })}
            <input
              type="number"
              min="1"
              max="30"
              value={f.prereq?.min ?? 13}
              onchange={(e) => setPrereqMin(f, +e.currentTarget.value)}
            />+</span
          >
          {#each ABILITIES as a (a)}
            <label class="chip" class:on={f.prereq?.abilities?.includes(a)}
              ><input
                type="checkbox"
                checked={f.prereq?.abilities?.includes(a)}
                onchange={() => ((f.prereq ??= {}), (f.prereq.abilities = toggle(f.prereq.abilities, a)))}
              />{tr(ABILITY_SHORT[a])}</label
            >
          {/each}
        </div>
        <label class="wide"
          >{tr({ en: 'Other prerequisite (text)', fr: 'Autre prérequis (texte)', es: 'Otro requisito (texto)' })}<input
            type="text"
            value={f.prereq?.text ?? ''}
            onchange={(e) => ((f.prereq ??= {}), (f.prereq.text = e.currentTarget.value.trim() || undefined))}
          /></label
        >
        <div class="wide">
          <span class="lab"
            >{tr({
              en: 'Ability Score Increase: +1 to one of',
              fr: 'Augmentation de caractéristique : +1 à l’une de',
              es: 'Mejora de característica: +1 a una de',
            })}</span
          >
          {#each ABILITIES as a (a)}
            <label class="chip" class:on={f.abilityIncrease?.includes(a)} title={tr(ABILITY_NAMES[a])}
              ><input
                type="checkbox"
                checked={f.abilityIncrease?.includes(a)}
                onchange={() => (f.abilityIncrease = toggle(f.abilityIncrease, a))}
              />{tr(ABILITY_SHORT[a])}</label
            >
          {/each}
          <label class="chip" class:on={f.repeatable}
            ><input type="checkbox" bind:checked={f.repeatable} />{tr({
              en: 'Repeatable',
              fr: 'Répétable',
              es: 'Repetible',
            })}</label
          >
        </div>
        <label class="wide"
          >{tr({
            en: 'What it does (your own summary)',
            fr: 'Ce qu’il fait (votre propre résumé)',
            es: 'Qué hace (tu propio resumen)',
          })}<textarea rows="4" bind:value={f.text}></textarea></label
        >
        <div class="wide">
          <span class="lab"
            >{tr({
              en: 'Numbers the sheet applies (optional)',
              fr: 'Valeurs appliquées par la feuille (facultatif)',
              es: 'Valores que aplica la hoja (opcional)',
            })}</span
          >
          <ModifierEditor bind:mods={() => f.modifiers ?? [], (v) => (f.modifiers = v)} />
        </div>
      </div>
    {/if}
  </div>
{/each}

<div class="bar">
  <button onclick={add}
    >＋ {tr({ en: 'New custom feat', fr: 'Nouveau don personnalisé', es: 'Nueva dote personalizada' })}</button
  >
</div>

<style>
  .sub {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .feat {
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
  }
  .head {
    display: flex;
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
  .wide {
    flex-basis: 100%;
  }
  .grow {
    flex: 1;
  }
  .lab {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85rem;
    margin-bottom: 0.2rem;
  }
  .lab input {
    width: 3.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 0.4rem 0.3rem 0;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.2em 0.7em;
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  textarea {
    width: 100%;
    font: inherit;
  }
  .bar {
    margin: 0.4rem 0;
  }
</style>
