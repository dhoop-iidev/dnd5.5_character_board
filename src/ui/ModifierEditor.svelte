<script lang="ts">
  // Modifier rows of a custom item: target (docs/effects.md vocabulary), value, and an optional condition ("against
  // poison"), which makes the bonus situational (switched on in its breakdown popup). Bonuses
  // with the same name don't stack (Rules Glossary, SRD p. 180), so a row takes the item's name.
  import type { ModifierSpec } from '../data/types'
  import { tr } from '../state.svelte'
  import { MODIFIER_TARGETS } from './items'

  let { mods = $bindable() }: { mods: ModifierSpec[] } = $props()

  function add() {
    mods.push({ target: 'ac', value: 1 })
  }
  function setCondition(m: ModifierSpec, v: string) {
    if (v.trim()) m.condition = { en: v.trim(), fr: v.trim(), es: v.trim() }
    else delete m.condition
  }
</script>

<div class="mods">
  {#each mods as m, i (i)}
    <div class="mod">
      <input type="number" bind:value={m.value} aria-label={tr({ en: 'Value', fr: 'Valeur', es: 'Valor' })} />
      <select bind:value={m.target} aria-label={tr({ en: 'Applies to', fr: 'S’applique à', es: 'Se aplica a' })}>
        {#each MODIFIER_TARGETS as t (t.id)}<option value={t.id}>{tr(t.name)}</option>{/each}
      </select>
      <input
        class="cond"
        value={tr(m.condition ?? { en: '', fr: '', es: '' })}
        onchange={(e) => setCondition(m, e.currentTarget.value)}
        placeholder={tr({
          en: 'condition (optional): against poison…',
          fr: 'condition (facultatif) : contre le poison…',
          es: 'condición (opcional): contra veneno…',
        })}
      />
      <button onclick={() => mods.splice(i, 1)} aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
      >
    </div>
  {/each}
  <button onclick={add}>＋ {tr({ en: 'Add a bonus', fr: 'Ajouter un bonus', es: 'Añadir un bonificador' })}</button>
</div>

<style>
  .mods {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: flex-start;
  }
  .mod {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  select,
  input,
  button {
    min-height: 2.5rem;
    font: inherit;
    padding: 0 0.5rem;
  }
  input[type='number'] {
    width: 4.5rem;
  }
  .cond {
    min-width: 14rem;
  }
</style>
