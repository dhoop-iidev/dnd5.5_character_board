<script lang="ts">
  import { app, tr } from '../state.svelte'
  import { UI } from '../i18n/ui'
  import { fmt } from '../engine/stacking'
  import type { Part } from '../engine/stacking'
  import SourceLink from './SourceLink.svelte'
  import { closePopup, popup } from './popupState.svelte'

  let dialog: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (!dialog) return
    if (popup.content && !dialog.open) dialog.showModal()
    if (!popup.content && dialog.open) dialog.close()
  })

  const stat = $derived(popup.content?.stat?.())

  function toggle(p: Part) {
    if (!p.toggleKey) return
    const t = (app.character.toggles ??= {})
    t[p.toggleKey] = !t[p.toggleKey]
  }

  function setNote(key: string, text: string) {
    const notes = (app.character.annotations ??= {})
    if (text.trim()) notes[key] = text
    else delete notes[key]
  }

  const reason = (p: Part) =>
    p.inactiveReason === 'sameName' ? tr(UI.sameName) : p.inactiveReason === 'situational' ? tr(UI.situational) : ''
</script>

<dialog bind:this={dialog} onclose={closePopup} onclick={(e) => e.target === dialog && closePopup()}>
  {#if popup.content}
    {@const c = popup.content}
    <header>
      <h2>{tr(c.title)}</h2>
      <button class="close" onclick={closePopup} aria-label={tr(UI.close)}>✕</button>
    </header>

    {#if stat}
      <table>
        <tbody>
          {#each stat.parts as p, i (i)}
            <tr class:inactive={!p.active}>
              <td>
                {tr(p.label)}
                {#if p.condition}
                  <button class="cond" class:on={p.situationalOn} onclick={() => toggle(p)}>
                    {p.situationalOn ? '☑' : '☐'}
                    {tr(p.condition)}
                  </button>
                {/if}
                {#if !p.active && p.inactiveReason !== 'situational'}<em> ({reason(p)})</em>{/if}
              </td>
              <td class="num">{fmt(p.value)}</td>
              <td><SourceLink source={p.source} name={p.label.en} /></td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th>{tr(UI.total)}</th>
            <th class="num">{c.signed === false ? stat.total : fmt(stat.total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
      {#if stat.advantage?.length}
        <p class="roll adv">▲ {tr(UI.advantage)} : {stat.advantage.map((x) => tr(x)).join(', ')}</p>
      {/if}
      {#if stat.disadvantage?.length}
        <p class="roll dis">▼ {tr(UI.disadvantage)} : {stat.disadvantage.map((x) => tr(x)).join(', ')}</p>
      {/if}
    {/if}

    {#if c.summary}<p class="summary">{tr(c.summary)}</p>{/if}
    {#each c.lines ?? [] as line}<p class="line">{tr(line)}</p>{/each}
    {#if c.html}<div class="rule-text">{@html tr(c.html)}</div>{/if}
    {#if c.source}<p><strong>{tr(UI.source)} :</strong> <SourceLink source={c.source} name={c.title.en} /></p>{/if}
    {#if c.noteKey}
      <label class="note">
        <span>{tr({ en: 'Campaign note', fr: 'Note de campagne', es: 'Nota de campaña' })}</span>
        <textarea
          rows="3"
          value={app.character.annotations?.[c.noteKey] ?? ''}
          oninput={(e) => setNote(c.noteKey!, e.currentTarget.value)}
          placeholder={tr({
            en: 'Your own explanation for this campaign…',
            fr: 'Votre explication pour cette campagne…',
            es: 'Tu propia explicación para esta campaña…',
          })}></textarea>
      </label>
    {/if}
  {/if}
</dialog>

<style>
  dialog {
    width: min(42rem, calc(100vw - 2rem));
    max-height: 85vh;
    border: 1.5px solid var(--frame);
    border-radius: 6px;
    background: var(--box);
    color: var(--ink);
    padding: 1.1rem 1.4rem 1.2rem;
    box-shadow: var(--shadow-pop);
  }
  dialog::backdrop {
    background: rgb(20 17 14 / 0.45);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding-bottom: 0.4rem;
    border-bottom: 1.5px solid var(--frame);
    margin-bottom: 0.6rem;
  }
  h2 {
    margin: 0;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 1.3rem;
    letter-spacing: 0.02em;
  }
  .close {
    flex: none;
    font-size: 1.1rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--ink-soft);
    cursor: pointer;
    min-width: 2.75rem;
    min-height: 2.75rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td,
  th {
    padding: 0.35em 0.4em;
    border-bottom: 1px solid var(--rule);
    text-align: left;
    vertical-align: top;
  }
  tfoot th {
    border-top: 1.5px solid var(--frame);
    border-bottom: none;
    font-family: var(--font-title);
    font-weight: 400;
    font-size: 1.1em;
  }
  tfoot th.num {
    font-family: var(--font-num);
    font-weight: 700;
    color: var(--accent);
  }
  .num {
    text-align: right;
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .inactive {
    color: var(--ink-soft);
    text-decoration: line-through;
  }
  .inactive .cond {
    text-decoration: none;
  }
  .cond {
    display: block;
    margin-top: 0.3em;
    font: inherit;
    font-size: 0.85em;
    min-height: 2.75rem;
    background: var(--box);
    border: 1px dashed var(--rule-strong);
    border-radius: 4px;
    color: var(--ink);
    cursor: pointer;
    padding: 0.2em 0.7em;
  }
  .cond.on {
    border-style: solid;
    border-color: var(--frame);
  }
  .roll {
    margin: 0.5rem 0 0;
    font-size: 0.95em;
  }
  .adv {
    color: var(--accent);
  }
  .dis {
    color: var(--ink-soft);
  }
  .summary {
    font-weight: 600;
  }
  .rule-text {
    font-size: 0.95em;
    border-top: 1px solid var(--rule);
    margin-top: 0.75rem;
  }
  .rule-text :global(table) {
    border-collapse: collapse;
    margin: 0.5em 0;
  }
  .rule-text :global(th),
  .rule-text :global(td) {
    border-bottom: 1px solid var(--rule);
    padding: 0.2em 0.5em;
    font-size: 0.9em;
  }
  .rule-text :global(aside) {
    border: 1px solid var(--rule-strong);
    padding: 0.3em 0.8em;
    margin: 0.5em 0;
    font-size: 0.92em;
  }
  .note {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.75rem;
    font-family: var(--font-title);
  }
  .note textarea {
    font: inherit;
    font-family: var(--font-body);
    padding: 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    background: var(--box);
    color: var(--ink);
    resize: vertical;
  }
</style>
