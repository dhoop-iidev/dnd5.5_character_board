<script lang="ts">
  // Origin, in the level-1 row of the progression (user request 2026-10-28: what the welcome screen chose must stay
  // editable, and its warnings belong here): species and size, background with its ability increases (+2 / +1 or
  // +1 / +1 / +1 among its three abilities, SRD 5.2.1 p. 20–21), base ability scores (Standard Array, Point Cost or
  // rolled, p. 21), then the choices of the species traits and origin feats (lineage, Skillful, Magic Initiate…). Changing
  // the background resets its increases and gives its own Origin feat; changing the species clears its trait choices.
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import type { RuleWarning } from '../engine/checks/common'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import type { Owner } from '../engine/sheet/types'
  import { SIZE_NAMES, UI } from '../i18n/ui'
  import { featListOf } from '../model/newCharacter'
  import { app, tr } from '../state.svelte'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import WarningList from './WarningList.svelte'

  let { owners, warnings }: { owners: Owner[]; warnings: (w: RuleWarning) => boolean } = $props()

  const c = $derived(app.character)
  const sp = $derived(rules.species.get(c.speciesId))
  const bg = $derived(rules.backgrounds.get(c.background.backgroundId))
  const byName = <T extends { name: { en: string } }>(list: T[]) =>
    [...list].sort((a, b) => tr(a.name as never).localeCompare(tr(b.name as never)))
  const speciesList = $derived(byName([...rules.species.values()]))
  const backgroundList = $derived(byName([...rules.backgrounds.values()]))

  function setSpecies(id: string) {
    const old = c.speciesId
    c.speciesId = id
    const def = rules.species.get(id)
    c.speciesChoices = def && def.size.length > 1 ? { size: def.size.includes('medium') ? 'medium' : def.size[0] } : {}
    // The old species' trait choices and trait feats (Human Versatile) no longer apply.
    for (const k of Object.keys(c.featureChoices)) if (k.startsWith(`${old}:`)) delete c.featureChoices[k]
    for (const k of Object.keys(c.extraFeats)) if (k.startsWith(`${old}:`)) delete c.extraFeats[k]
  }
  function setBackground(id: string) {
    const def = rules.backgrounds.get(id)
    const list = featListOf(def?.featText?.en, rules)
    c.background = {
      backgroundId: id,
      abilities: {},
      feat: { featId: def?.feat ?? '', ...(list ? { choices: { list } } : {}) },
    }
  }
  function setIncrease(a: AbilityId, v: number) {
    if (v) c.background.abilities[a] = v
    else delete c.background.abilities[a]
  }
  function setBase(a: AbilityId, v: number) {
    if (Number.isFinite(v)) c.baseAbilities[a] = Math.round(v)
  }
</script>

<div class="origin">
  <h4>{tr({ en: 'Origin', fr: 'Origine', es: 'Origen' })}</h4>
  <div class="fields">
    <label>
      {tr(UI.species)}
      <select value={c.speciesId} onchange={(e) => setSpecies(e.currentTarget.value)}>
        {#each speciesList as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
      </select>
    </label>
    {#if sp && sp.size.length > 1}
      <label>
        {tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}
        <select bind:value={c.speciesChoices.size}>
          {#each sp.size as z (z)}<option value={z}>{SIZE_NAMES[z] ? tr(SIZE_NAMES[z]) : z}</option>{/each}
        </select>
      </label>
    {/if}
    <label>
      {tr(UI.background)}
      <select value={c.background.backgroundId} onchange={(e) => setBackground(e.currentTarget.value)}>
        {#each backgroundList as b (b.id)}<option value={b.id}>{tr(b.name)}</option>{/each}
      </select>
    </label>
  </div>

  {#if bg}
    <p class="sub">
      {tr({
        en: 'Background increases: +2 to one and +1 to another, or +1 to all three (no score above 20).',
        fr: 'Augmentations de l’historique : +2 à l’une et +1 à une autre, ou +1 aux trois (aucune valeur au-delà de 20).',
        es: 'Aumentos del trasfondo: +2 a una y +1 a otra, o +1 a las tres (ninguna puntuación por encima de 20).',
      })}
    </p>
    <div class="inc">
      {#each bg.abilities as a (a)}
        <label class="inline"
          >{tr(ABILITY_SHORT[a])}
          <select
            value={String(c.background.abilities[a] ?? 0)}
            onchange={(e) => setIncrease(a, +e.currentTarget.value)}
          >
            <option value="0">—</option>
            <option value="1">+1</option>
            <option value="2">+2</option>
          </select></label
        >
      {/each}
    </div>
  {/if}

  <p class="sub">
    {tr({
      en: 'Base scores, before any increase: Standard Array (15, 14, 13, 12, 10, 8), Point Cost (27 points) or rolled.',
      fr: 'Valeurs de base, avant toute augmentation : série standard (15, 14, 13, 12, 10, 8), achat de points (27 points) ou tirage.',
      es: 'Puntuaciones base, antes de cualquier aumento: serie estándar (15, 14, 13, 12, 10, 8), compra de puntos (27 puntos) o tirada.',
    })}
  </p>
  <div class="inc">
    {#each ABILITIES as a (a)}
      <label class="inline"
        >{tr(ABILITY_SHORT[a])}
        <input
          type="number"
          min="3"
          max="18"
          inputmode="numeric"
          value={c.baseAbilities[a]}
          onchange={(e) => setBase(a, +e.currentTarget.value)}
        /></label
      >
    {/each}
  </div>

  {#each owners as o (o.id)}
    <div class="owner"><span class="meta">{tr(o.name)}</span><ChoiceEditor owner={o} /></div>
  {/each}

  <WarningList filter={warnings} compact />
</div>

<style>
  .origin {
    margin-bottom: 0.6rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--rule);
  }
  h4 {
    margin: 0 0 0.4rem;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  .fields label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  .sub {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .inc {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-title);
  }
  .inline input {
    width: 3.6rem;
  }
  .owner {
    margin-top: 0.5rem;
  }
  .meta {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
