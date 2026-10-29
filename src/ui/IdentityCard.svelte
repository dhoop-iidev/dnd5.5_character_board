<script lang="ts">
  // Identity block of the character sheet, editable in place (same drawing as the 3.5 playboard's card: small-caps
  // labels over underlined fields). Species, background and classes are shown, not edited here (they are build choices:
  // welcome screen and Progression); their names open the SRD text in the popup.
  import { languageName, languageOf } from '../model/languages'
  import { rules } from '../data/rules'
  import type { I18n, Source } from '../data/types'
  import { SIZE_NAMES } from '../i18n/ui'
  import { app, lang, tr, view } from '../state.svelte'
  import { openPopup } from './popupState.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)

  /** Classes in the order they were first taken, with their level and subclass. */
  const classes = $derived(
    sheet.classOrder.map((id) => ({
      id,
      def: rules.classes.get(id),
      level: sheet.classLevels[id] ?? 0,
      sub: sheet.subclasses.get(id),
    })),
  )
  /** Species offering Small or Medium: the choice is stored in `speciesChoices.size`. */
  const sizes = $derived(sheet.species?.size ?? [])

  function open(name: I18n | undefined, text: I18n | undefined, source: Source | undefined, noteKey: string) {
    if (name) openPopup({ title: name, html: text, source, noteKey })
  }
  /** Languages typed as text: table languages are stored by id (shown in the reader's language), others as typed. */
  function setLanguages(text: string) {
    c.identity.languages = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => languageOf(s)?.id ?? s)
  }
  // Height and weight are stored in m and kg; English shows ft and lb with the French SRD's printed ratios
  // (5 ft = 1,5 m, 1 lb = 0,5 kg).
  const en = $derived(lang() === 'en')
  const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d
  const height = $derived(en ? round((c.identity.height?.m ?? 0) / 0.3) : (c.identity.height?.m ?? 0))
  const weight = $derived(en ? round((c.identity.weight?.kg ?? 0) * 2) : (c.identity.weight?.kg ?? 0))
  function setHeight(v: number) {
    c.identity.height = { m: en ? round(v * 0.3, 2) : v }
  }
  function setWeight(v: number) {
    c.identity.weight = { kg: en ? round(v / 2, 1) : v }
  }
</script>

<section class="box identity">
  <h3>{tr({ en: 'Identity', fr: 'Identité', es: 'Identidad' })}</h3>
  <div class="fields">
    <label class="half"
      >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input class="name" bind:value={c.identity.name} /></label
    >
    <label class="half"
      >{tr({ en: 'Title', fr: 'Titre', es: 'Título' })}<input
        bind:value={c.identity.title}
        placeholder={tr({
          en: 'e.g. Knight of the Realm',
          fr: 'ex. Chevalier du royaume',
          es: 'p. ej. Caballero del reino',
        })}
      /></label
    >
    <label>{tr({ en: 'Player', fr: 'Joueur', es: 'Jugador' })}<input bind:value={c.identity.player} /></label>
    <div class="field">
      <span class="lab">{tr({ en: 'Species', fr: 'Espèce', es: 'Especie' })}</span>
      <button
        class="value link"
        onclick={() => open(sheet.species?.name, sheet.species?.text, sheet.species?.source, `species:${c.speciesId}`)}
        >{tr(sheet.species?.name) || c.speciesId || '—'}</button
      >
    </div>
    {#if sizes.length > 1}
      <label
        >{tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}
        <select
          value={c.speciesChoices.size ?? ''}
          onchange={(e) => {
            const v = e.currentTarget.value
            if (v) c.speciesChoices.size = v
            else delete c.speciesChoices.size
          }}
        >
          <option value="">— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
          {#each sizes as s (s)}<option value={s}>{tr(SIZE_NAMES[s])}</option>{/each}
        </select></label
      >
    {:else}
      <label
        >{tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}<input
          value={tr(SIZE_NAMES[sizes[0] ?? ''] ?? undefined)}
          disabled
        /></label
      >
    {/if}
    <div class="field">
      <span class="lab">{tr({ en: 'Background', fr: 'Historique', es: 'Trasfondo' })}</span>
      <button
        class="value link"
        onclick={() =>
          open(
            sheet.background?.name,
            sheet.background?.text,
            sheet.background?.source,
            `background:${c.background.backgroundId}`,
          )}>{tr(sheet.background?.name) || c.background.backgroundId || '—'}</button
      >
    </div>
    <div class="field classes">
      <span class="lab"
        >{tr({ en: 'Class and level', fr: 'Classe et niveau', es: 'Clase y nivel' })} · {sheet.level}</span
      >
      <span class="value">
        {#each classes as k, i (k.id)}
          {#if i}<span class="sep"> / </span>{/if}
          <button class="link" onclick={() => open(k.def?.name, k.def?.text, k.def?.source, `class:${k.id}`)}
            >{tr(k.def?.name) || k.id} {k.level}</button
          >{#if k.sub}
            <span class="sub"
              >(<button
                class="link"
                onclick={() => open(k.sub?.name, k.sub?.text, k.sub?.source, `subclass:${k.sub?.id}`)}
                >{tr(k.sub.name)}</button
              >)</span
            >{/if}
        {/each}
      </span>
    </div>
    <label
      >{tr({ en: 'Alignment', fr: 'Alignement', es: 'Alineamiento' })}<input bind:value={c.identity.alignment} /></label
    >
    <label>{tr({ en: 'Deity', fr: 'Divinité', es: 'Deidad' })}<input bind:value={c.identity.deity} /></label>
    <label>{tr({ en: 'Age', fr: 'Âge', es: 'Edad' })}<input bind:value={c.identity.age} /></label>
    <label
      >{tr({ en: 'Height (ft)', fr: 'Taille (m)', es: 'Altura (m)' })}<input
        type="number"
        step={en ? 0.1 : 0.01}
        min="0"
        value={height || ''}
        onchange={(e) => setHeight(+e.currentTarget.value)}
      /></label
    >
    <label
      >{tr({ en: 'Weight (lb)', fr: 'Poids (kg)', es: 'Peso (kg)' })}<input
        type="number"
        step={en ? 1 : 0.5}
        min="0"
        value={weight || ''}
        onchange={(e) => setWeight(+e.currentTarget.value)}
      /></label
    >
    <label class="wide"
      >{tr({
        en: 'Languages (comma-separated)',
        fr: 'Langues (séparées par des virgules)',
        es: 'Idiomas (separados por comas)',
      })}<input
        value={(c.identity.languages ?? []).map((l) => tr(languageName(l))).join(', ')}
        onchange={(e) => setLanguages(e.currentTarget.value)}
      /></label
    >
  </div>
</section>

<style>
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 0.5rem 0.75rem;
  }
  label,
  .field {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .lab {
    line-height: 1.2;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .half {
    grid-column: span 2;
  }
  .classes {
    grid-column: span 3;
  }
  @media (max-width: 30rem) {
    .half,
    .classes {
      grid-column: 1 / -1;
    }
  }
  .name {
    font-family: var(--font-num);
    font-weight: 700;
  }
  input,
  select,
  .value {
    font: inherit;
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--ink);
    min-height: 2.4rem;
    padding: 0 0.4rem;
    border: none;
    border-bottom: 1px solid var(--rule-strong);
    background: transparent;
    min-width: 0;
  }
  input:disabled {
    color: var(--ink);
    border-bottom-style: dotted;
  }
  /* Read-only build values: dotted underline like the disabled fields, the names are buttons. */
  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.25rem;
    border-bottom-style: dotted;
    text-align: left;
  }
  .link {
    font: inherit;
    padding: 0;
    border: none;
    background: none;
    color: var(--ink);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.22em;
    text-align: left;
  }
  button.value.link {
    padding: 0 0.4rem;
    border-bottom: 1px dotted var(--rule-strong);
  }
  .link:hover {
    color: var(--accent);
    text-decoration-color: currentColor;
  }
  .sep,
  .sub {
    color: var(--ink-soft);
  }
  .sub .link {
    color: var(--ink-soft);
  }
</style>
