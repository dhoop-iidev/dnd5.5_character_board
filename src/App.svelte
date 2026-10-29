<script lang="ts">
  import { spellChoiceOwners, tabOfWarning } from './ui/spellChoices'
  import { rules } from './data/rules'
  import { UI } from './i18n/ui'
  import { app, tr, view } from './state.svelte'
  import Combat from './ui/panes/Combat.svelte'
  import Companions from './ui/panes/Companions.svelte'
  import Equipment from './ui/panes/Equipment.svelte'
  import General from './ui/panes/General.svelte'
  import Notes from './ui/panes/Notes.svelte'
  import Spells from './ui/panes/Spells.svelte'
  import SaveControls from './ui/SaveControls.svelte'
  import Popup from './ui/Popup.svelte'
  import PrintSheet from './ui/PrintSheet.svelte'
  import { printState } from './ui/print.svelte'
  import Welcome from './ui/Welcome.svelte'

  type Tab = 'general' | 'equipment' | 'combat' | 'spells' | 'companions' | 'notes'
  const TABS: { id: Tab; label: typeof UI.tabGeneral }[] = [
    { id: 'general', label: UI.tabGeneral },
    { id: 'equipment', label: UI.tabEquipment },
    { id: 'combat', label: UI.tabCombat },
    { id: 'spells', label: UI.tabSpells },
    { id: 'companions', label: UI.tabCompanions },
    { id: 'notes', label: UI.tabNotes },
  ]

  const fromHash = (): Tab => {
    const h = location.hash.replace('#/', '') as Tab
    return TABS.some((t) => t.id === h) ? h : 'general'
  }
  let tab = $state<Tab>(fromHash())
  $effect(() => {
    location.hash = `#/${tab}`
  })

  const c = $derived(app.character)
  const classSummary = $derived(
    view.sheet.classOrder.map((id) => `${tr(rules.classes.get(id)?.name)} ${view.sheet.classLevels[id]}`).join(' / '),
  )
  type Theme = 'auto' | 'light' | 'dark'
  const THEME_KEY = 'dnd55-playboard:theme'
  let theme = $state<Theme>(readTheme())
  function readTheme(): Theme {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'auto'
    } catch {
      return 'auto'
    }
  }
  $effect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  })
  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
  const themeIcon: Record<Theme, string> = { auto: '◐', light: '☀', dark: '☾' }

  /** Warnings to fix, counted on the tab where they are fixed (ui/spellChoices.ts `tabOfWarning`). */
  const toFix = $derived.by(() => {
    const n: Record<string, number> = {}
    for (const w of view.warnings)
      if (w.actionable) {
        const t = tabOfWarning(w, view.sheet)
        n[t] = (n[t] ?? 0) + 1
      }
    return n
  })
  // The Spells tab: a Spellcasting class, or spells from a feat, trait or feature (Magic Initiate…).
  const tabs = $derived(
    TABS.filter(
      (t) =>
        t.id !== 'spells' ||
        view.sheet.spellcasting.length ||
        view.sheet.extraSpells.length ||
        spellChoiceOwners(view.sheet).length,
    ),
  )
</script>

<svelte:window onhashchange={() => (tab = fromHash())} />

{#if !app.loaded}
  <Welcome />
{:else}
  <header class="top">
    <div class="who">
      <h1>{c.identity.name}</h1>
      {#if c.identity.title}<p class="title">{c.identity.title}</p>{/if}
      <p>
        {tr(view.sheet.species?.name)} · {tr(view.sheet.background?.name)} · {classSummary} · {tr(UI.level)}
        {view.sheet.level}
      </p>
    </div>
    <div class="controls">
      <button class="theme" title={tr(UI.theme)} onclick={() => (theme = nextTheme[theme])}>{themeIcon[theme]}</button>
      <div class="lang" role="group" aria-label="Language">
        <button class:on={c.settings.lang === 'en'} onclick={() => (app.character.settings.lang = 'en')}>EN</button>
        <button class:on={c.settings.lang === 'fr'} onclick={() => (app.character.settings.lang = 'fr')}>FR</button>
        <button class:on={c.settings.lang === 'es'} onclick={() => (app.character.settings.lang = 'es')}>ES</button>
      </div>
    </div>
  </header>

  <nav class="tabs">
    {#each tabs as t (t.id)}
      <button class:active={tab === t.id} onclick={() => (tab = t.id)}>
        {tr(t.label)}
        {#if toFix[t.id]}<span
            class="count"
            title={tr({ en: 'Choices to make', fr: 'Choix à faire', es: 'Elecciones pendientes' })}>{toFix[t.id]}</span
          >{/if}
      </button>
    {/each}
  </nav>

  <main>
    {#if tab === 'general'}
      <General />
    {:else if tab === 'equipment'}
      <Equipment />
    {:else if tab === 'combat'}
      <Combat />
    {:else if tab === 'spells'}
      <Spells />
    {:else if tab === 'companions'}
      <Companions />
    {:else}
      <Notes />
    {/if}
  </main>

  <footer>
    <SaveControls />
    <p class="legal">
      This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC,
      available at
      <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener">dndbeyond.com/srd</a>. The SRD 5.2.1 is
      licensed under the
      <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener"
        >Creative Commons Attribution 4.0 International License</a
      >.
      <a href="CC-BY.txt" target="_blank">CC-BY.txt</a>
    </p>
    {#if c.settings.lang === 'es'}
      <p class="legal" lang="es">
        Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of
        the Coast LLC, disponible en <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener"
          >https://www.dndbeyond.com/srd</a
        >. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de
        atribución/reconocimiento 4.0 de Creative Commons, disponible en
        <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener"
          >https://creativecommons.org/licenses/by/4.0/legalcode</a
        >.
      </p>
    {/if}
  </footer>

  <Popup />
  {#if printState.on}<PrintSheet />{/if}
{/if}

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem 1.5rem;
    padding: 1.4rem 1.5rem 1rem;
    color: var(--ink);
    background: var(--paper);
    border-bottom: 3px solid var(--frame);
    box-shadow:
      0 4px 0 -2px var(--paper),
      0 5px 0 -2px var(--frame);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(1.7rem, 4.2vw, 2.6rem);
    line-height: 1.05;
  }
  .who p {
    margin: 0.35rem 0 0;
    font-family: var(--font-title);
    font-size: 1.05rem;
    color: var(--ink-soft);
    letter-spacing: 0.03em;
  }
  .title {
    font-style: italic;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .theme,
  .lang button {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 0.9rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: 1px solid var(--rule-strong);
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
  }
  .theme {
    border-radius: 4px;
    font-size: 1.1rem;
  }
  .lang {
    display: flex;
  }
  .lang button:first-child {
    border-radius: 4px 0 0 4px;
  }
  .lang button + button {
    margin-left: -1px;
  }
  .lang button:last-child {
    border-radius: 0 4px 4px 0;
  }
  .lang button.on {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.4rem 1rem 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--rule);
    scrollbar-width: none;
  }
  .tabs button {
    position: relative;
    font-family: var(--font-title);
    font-size: 1.15rem;
    letter-spacing: 0.04em;
    min-height: 3rem;
    padding: 0 0.9rem;
    border: none;
    background: none;
    color: var(--ink-soft);
    cursor: pointer;
    white-space: nowrap;
  }
  .tabs button::after {
    content: '';
    position: absolute;
    left: 0.6rem;
    right: 0.6rem;
    bottom: -1px;
    height: 3px;
    background: transparent;
  }
  .tabs button.active {
    color: var(--ink);
  }
  .tabs button.active::after {
    background: var(--accent);
  }
  .count {
    display: inline-block;
    min-width: 1.35rem;
    margin-left: 0.3em;
    padding: 0 0.3em;
    border-radius: 1em;
    background: var(--accent);
    color: var(--paper);
    font-family: var(--font-num);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.35rem;
    text-align: center;
    vertical-align: 0.15em;
  }
  main {
    padding: 1.5rem;
  }
  footer {
    padding: 1.25rem 1rem 1.5rem;
    font-size: 0.85em;
    color: var(--ink-soft);
    text-align: center;
    border-top: 1px solid var(--rule);
  }
  footer a {
    color: var(--ink-soft);
  }
  .legal {
    max-width: 60rem;
    margin: 0 auto;
    font-size: 0.85em;
  }
  @media (max-width: 30rem) {
    .top {
      padding: 1rem 1rem 0.8rem;
    }
    main {
      padding: 1rem;
    }
  }
</style>
