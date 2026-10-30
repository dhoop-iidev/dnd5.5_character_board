<script lang="ts">
  // Language chips (SRD 5.2.1 p. 20 "Choose Languages"): the Standard Languages, the rare ones from a menu, and any
  // other language typed as text (a regional or campaign language, user request 2026-10-30). Values are table ids
  // ('elvish') or the text as typed; a language known from elsewhere (origin, class) is greyed. Used by the Origin step
  // (ui/OriginEditor.svelte) and by features that grant a language of your choice (ui/ChoiceEditor.svelte).
  import { LANGUAGES, languageOf } from '../model/languages'
  import { tr } from '../state.svelte'

  let {
    values,
    onchange,
    known = new Set(),
    rare = false,
  }: {
    values: string[]
    onchange: (values: string[]) => void
    /** Ids (or lower-case text) of the languages known from elsewhere. */
    known?: Set<string>
    /** Rare languages shown as chips too (a feature choosing from both tables), not only in the menu. */
    rare?: boolean
  } = $props()

  const keyOf = (v: string) => languageOf(v)?.id ?? v.trim().toLowerCase()
  const mine = $derived(new Set(values.map(keyOf)))
  const custom = $derived(values.filter((v) => !languageOf(v)))
  function toggle(v: string) {
    const k = keyOf(v)
    onchange(mine.has(k) ? values.filter((x) => keyOf(x) !== k) : [...values, languageOf(v)?.id ?? v.trim()])
  }
  let text = $state('')
  function addText() {
    const v = text.trim()
    text = ''
    if (v && !mine.has(keyOf(v)) && !known.has(keyOf(v))) onchange([...values, languageOf(v)?.id ?? v])
  }
</script>

<div class="chips">
  {#each LANGUAGES.filter((l) => !l.rare || rare || mine.has(l.id)) as l (l.id)}
    {@const taken = !mine.has(l.id) && known.has(l.id)}
    <label
      class="chip"
      class:on={mine.has(l.id)}
      class:taken
      title={taken ? tr({ en: 'Already known', fr: 'Déjà connue', es: 'Ya lo conoces' }) : ''}
      ><input type="checkbox" checked={mine.has(l.id) || taken} disabled={taken} onchange={() => toggle(l.id)} />{tr(
        l.name,
      )}</label
    >
  {/each}
  {#each custom as v (v)}
    <label class="chip on"><input type="checkbox" checked onchange={() => toggle(v)} />{v}</label>
  {/each}
  {#if !rare}
    <select
      value=""
      onchange={(e) => {
        if (e.currentTarget.value) toggle(e.currentTarget.value)
        e.currentTarget.value = ''
      }}
      aria-label={tr({ en: 'Rare language', fr: 'Langue rare', es: 'Idioma inusual' })}
    >
      <option value="">＋ {tr({ en: 'rare language', fr: 'langue rare', es: 'idioma inusual' })}</option>
      {#each LANGUAGES.filter((l) => l.rare && !mine.has(l.id) && !known.has(l.id)) as l (l.id)}<option value={l.id}
          >{tr(l.name)}</option
        >{/each}
    </select>
  {/if}
  <span class="other">
    <input
      bind:value={text}
      placeholder={tr({ en: 'other language…', fr: 'autre langue…', es: 'otro idioma…' })}
      aria-label={tr({
        en: 'Other language (regional, from your campaign)',
        fr: 'Autre langue (régionale, de votre campagne)',
        es: 'Otro idioma (regional, de tu campaña)',
      })}
      onkeydown={(e) => e.key === 'Enter' && addText()}
    />
    <button onclick={addText} disabled={!text.trim()}>＋</button>
  </span>
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
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
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .chip.taken {
    opacity: 0.55;
    cursor: default;
  }
  select,
  input {
    min-height: 2.4rem;
    font: inherit;
    font-size: 1rem;
  }
  .other {
    display: inline-flex;
    gap: 0.25rem;
  }
  .other input {
    width: 11rem;
    padding: 0 0.5rem;
  }
  .other button {
    min-width: 2.4rem;
    min-height: 2.4rem;
  }
</style>
