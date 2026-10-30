<script lang="ts">
  // Tool picks of a class or background (model/toolChoices.ts): Bard instruments, Monk's Artisan's Tools or instrument,
  // Soldier's Gaming Set. Chips; a single pick replaces the previous one; a tool already known elsewhere is greyed.
  import { rules } from '../data/rules'
  import { toolOption, toolPicks, type ToolChoice } from '../model/toolChoices'
  import { app, tr, view } from '../state.svelte'

  let { choice }: { choice: ToolChoice } = $props()

  const c = $derived(app.character)
  const picks = $derived(toolPicks(c, choice))
  const options = $derived(
    choice.options
      .map((id) => ({ id, name: toolOption(id, rules)?.name ?? { en: id, fr: id, es: id } }))
      .sort((a, b) => tr(a.name).localeCompare(tr(b.name))),
  )
  function toggle(id: string) {
    const next = picks.includes(id) ? picks.filter((x) => x !== id) : choice.count === 1 ? [id] : [...picks, id]
    c.featureChoices[choice.key] = choice.count === 1 ? (next[0] ?? '') : next
  }
  const known = (id: string) =>
    !picks.includes(id) &&
    (view.sheet.proficiencies.tools.includes(id) ||
      view.sheet.proficiencies.tools.includes(rules.gear.get(id)?.name.en ?? '\u0000'))
</script>

<div class="tools">
  <span class="label">{tr(choice.name)} ({picks.length} / {choice.count})</span>
  <div class="chips">
    {#each options as o (o.id)}
      {@const taken = known(o.id)}
      <label
        class="chip"
        class:on={picks.includes(o.id)}
        class:taken
        title={taken ? tr({ en: 'Already proficient', fr: 'Déjà maîtrisé', es: 'Ya tienes competencia' }) : ''}
        ><input
          type="checkbox"
          checked={picks.includes(o.id) || taken}
          disabled={taken}
          onchange={() => toggle(o.id)}
        />{tr(o.name)}</label
      >
    {/each}
  </div>
</div>

<style>
  .tools {
    margin: 0.5rem 0;
  }
  .label {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85em;
    color: var(--ink-soft);
    margin-bottom: 0.3rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.2em 0.7em;
    min-height: 2.4rem;
    cursor: pointer;
    font-size: 0.9em;
    background: var(--box);
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .chip.taken {
    opacity: 0.55;
    cursor: default;
  }
</style>
