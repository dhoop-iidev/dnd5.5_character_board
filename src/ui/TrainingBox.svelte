<script lang="ts">
  // General pane: "Training and proficiencies", one slim box like the 2024 character sheet (user request 2026-10-30):
  // armor, weapons, tools and languages in four columns (stacked on narrow screens). A tool opens its ability, Utilize
  // and Craft in the popup (SRD 5.2.1 p. 93–95 "Tools").
  import { rules } from '../data/rules'
  import type { GearDef } from '../data/types'
  import { ABILITY_NAMES } from '../engine/sheet/common'
  import { tr, view } from '../state.svelte'
  import { openPopup } from './popupState.svelte'
  import { trainingRows } from './training'

  const rows = $derived(trainingRows(view.sheet, rules))
  function openTool(t: GearDef) {
    const x = t.tool!
    openPopup({
      title: t.name,
      lines: [
        {
          en: `Ability: ${ABILITY_NAMES[x.ability].en}`,
          fr: `Caractéristique : ${ABILITY_NAMES[x.ability].fr}`,
          es: `Característica: ${ABILITY_NAMES[x.ability].es ?? ABILITY_NAMES[x.ability].en}`,
        },
        {
          en: `Utilize: ${x.utilize.en}`,
          fr: `Utiliser : ${x.utilize.fr}`,
          es: `Usar: ${x.utilize.es ?? x.utilize.en}`,
        },
        ...(x.craft
          ? [
              {
                en: `Craft: ${x.craft.en}`,
                fr: `Fabriquer : ${x.craft.fr}`,
                es: `Fabricar: ${x.craft.es ?? x.craft.en}`,
              },
            ]
          : []),
        ...(x.variants
          ? [
              {
                en: `Variants: ${x.variants.en}`,
                fr: `Variantes : ${x.variants.fr}`,
                es: `Variantes: ${x.variants.es ?? x.variants.en}`,
              },
            ]
          : []),
      ],
      source: t.source,
      noteKey: `tool:${t.id}`,
    })
  }
</script>

<section class="box training">
  <h3>{tr({ en: 'Training and proficiencies', fr: 'Formations et maîtrises', es: 'Entrenamiento y competencias' })}</h3>
  <dl>
    {#each rows as r (r.id)}
      <div>
        <dt>{tr(r.label)}</dt>
        <dd>
          {#each r.items as it, k (k)}{#if k}{', '}{/if}{#if it.tool}<button
                class="link"
                onclick={() => openTool(it.tool!)}>{tr(it.name)}</button
              >{:else}{tr(it.name)}{/if}{:else}—{/each}
        </dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  .training {
    margin-bottom: 1.25rem;
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem 1.25rem;
  }
  dt {
    font-family: var(--font-title);
    font-size: 0.85em;
    color: var(--ink-soft);
    letter-spacing: 0.03em;
  }
  dd {
    margin: 0.15rem 0 0;
    line-height: 1.45;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    color: var(--ink);
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
  @media (max-width: 50rem) {
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 30rem) {
    dl {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
