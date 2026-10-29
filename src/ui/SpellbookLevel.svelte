<script lang="ts">
  // One Wizard level of the spellbook (SRD 5.2.1 p. 78 "Spellbook", FR p. 59): the spells added at that level, the
  // count the rules give (6 at Wizard level 1, then 2), the highest spell level allowed, and a menu to add one
  // (the shared spell picker).
  import { rules } from '../data/rules'
  import type { SpellDef } from '../data/types'
  import { type SpellbookLevel, spellbookProblems } from '../engine/spellbook'
  import { app, tr } from '../state.svelte'
  import { openPopup } from './popupState.svelte'
  import SpellPicker from './SpellPicker.svelte'
  import { summaryOf } from './summary'

  let { lv, book, list }: { lv: SpellbookLevel; book: string[]; list: Map<string, number> } = $props()

  const entry = $derived(app.character.levels[lv.index])
  const problems = $derived(spellbookProblems(app.character, rules).filter((p) => p.index === lv.index))
  const spells = $derived(lv.learned.map((id) => rules.spells.get(id)).filter((x): x is SpellDef => !!x))
  /** Wizard spells that can be added at this level, grouped by spell level (level 1 only at Wizard level 1). */
  const options = $derived.by(() => {
    const taken = new Set(book)
    const out: { level: number; spells: SpellDef[] }[] = []
    const top = lv.wizardLevel === 1 ? 1 : lv.maxSpellLevel
    for (let l = 1; l <= top; l++) {
      const ids = [...list.entries()].filter(([id, sl]) => sl === l && !taken.has(id)).map(([id]) => id)
      const defs = ids
        .map((id) => rules.spells.get(id))
        .filter((x): x is SpellDef => !!x)
        .sort((a, b) => tr(a.name).localeCompare(tr(b.name)))
      if (defs.length) out.push({ level: l, spells: defs })
    }
    return out
  })
  function add(id: string) {
    if (!id || !entry) return
    entry.spellsLearned = [...(entry.spellsLearned ?? []), id]
  }
  function remove(id: string) {
    if (!entry) return
    entry.spellsLearned = (entry.spellsLearned ?? []).filter((x) => x !== id)
    if (!entry.spellsLearned.length) delete entry.spellsLearned
  }
  const popup = (s: SpellDef) =>
    openPopup({
      title: s.name,
      html: s.text,
      source: s.source,
      noteKey: `spell:${s.id}`,
      summary: summaryOf(`spell:${s.id}`, s.text),
    })
</script>

<li class="lvl">
  <div class="head">
    <strong>{tr({ en: 'Wizard', fr: 'Magicien', es: 'Mago' })} {lv.wizardLevel}</strong>
    <span class="count" class:short={lv.learned.length < lv.expected} class:over={lv.learned.length > lv.expected}
      >{lv.learned.length} / {lv.expected}</span
    >
    <small
      >{tr({ en: 'character level', fr: 'niveau de personnage', es: 'nivel de personaje' })}
      {lv.index + 1} · {lv.wizardLevel === 1
        ? tr({ en: 'level 1 spells', fr: 'sorts du 1er niveau', es: 'conjuros de nivel 1' })
        : tr({
            en: `spell levels 1–${lv.maxSpellLevel}`,
            fr: `sorts de niveau 1 à ${lv.maxSpellLevel}`,
            es: `conjuros de nivel 1 a ${lv.maxSpellLevel}`,
          })}</small
    >
  </div>
  <ul class="chips">
    {#each spells as s (s.id)}
      <li class="school-row school-{s.school}">
        <button class="link" onclick={() => popup(s)}>{tr(s.name)}</button> <small>{s.level}</small>
        <button class="x" onclick={() => remove(s.id)} aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}
          >✕</button
        >
      </li>
    {/each}
    {#if options.length && lv.learned.length < lv.expected}
      <li class="add">
        <SpellPicker
          options={options.flatMap((g) => g.spells)}
          onpick={(sp) => add(sp.id)}
          keepOpen
          label={tr({
            en: 'Add a spell to the spellbook',
            fr: 'Ajouter un sort au grimoire',
            es: 'Añadir un conjuro al libro',
          })}
        />
      </li>
    {/if}
  </ul>
  {#each problems as p, k (k)}<p class="warn">{tr(p)}</p>{/each}
</li>

<style>
  .lvl {
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
  }
  .head strong {
    font-family: var(--font-title);
  }
  .head small {
    color: var(--ink-soft);
  }
  .count {
    font-weight: 600;
  }
  .count.short {
    color: var(--accent);
  }
  .count.over {
    color: var(--danger);
  }
  .warn {
    color: var(--danger);
    font-size: 0.9rem;
    margin: 0.2rem 0;
  }
  .chips {
    list-style: none;
    padding: 0;
    margin: 0.25rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .chips li:not(.add) {
    padding: 0.1rem 0.3rem 0.1rem 0.6rem;
    border-radius: 2px;
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .add {
    flex-basis: 100%;
  }
  .link {
    background: none;
    border: none;
    padding: 0.2em 0;
    text-align: left;
    text-decoration: underline dotted var(--accent);
    color: inherit;
    font: inherit;
  }
  .x {
    background: none;
    border: none;
    color: var(--ink-soft);
    min-width: 2rem;
    min-height: 2rem;
  }
</style>
