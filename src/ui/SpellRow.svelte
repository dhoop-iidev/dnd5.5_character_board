<script lang="ts">
  // One spell on one line (like the 3.5 playboard): level, name (opens the SRD text), one-line summary cut with an
  // ellipsis (only ⓘ on phones), C / R tags, ✦ when a known Metamagic option fits the spell (its options open on a
  // second line with their Sorcery Point cost; greyed with the reason when they don't apply or can't be paid), the slot
  // to use when several fit (a feat or species spell offers its slot-free cast first), and a Cast button that turns into
  // Cast ✓ (click again to undo). Casting spends the slot and starts the timed effect shown in the Combat pane's turn bar
  // (engine/casting.ts). In the "Your turn" box, `blocked` greys the Cast button with the reason (the part of the turn is
  // spent, or a spell slot was already spent this turn).
  import { rules } from '../data/rules'
  import type { SpellDef } from '../data/types'
  import {
    castSpell,
    metamagicBlocker,
    metamagicOptions,
    type SlotChoice,
    slotChoices,
    sorceryPointsLeft,
    undoCast,
  } from '../engine/casting'
  import { UI } from '../i18n/ui'
  import type { ActiveEffect } from '../model/character'
  import { app, tr, view } from '../state.svelte'
  import { castLog } from './castLog.svelte'
  import { newUid } from './items'
  import { openPopup } from './popupState.svelte'
  import RuleText from './RuleText.svelte'
  import { summaryOf } from './summary'

  let {
    s,
    classId,
    ownerId,
    pactFirst = false,
    castable = true,
    blocked,
    slotSpentThisTurn = false,
    onremove,
    oncast,
    onundo,
  }: {
    s: SpellDef
    /** The class the spell is prepared for (undefined: a feat or species spell). */
    classId?: string
    /** A feat or species spell: the feat or trait it comes from (each copy has its own slot-free cast). */
    ownerId?: string
    /** Pact Magic class: its slots come first. */
    pactFirst?: boolean
    castable?: boolean
    /** Why it can't be cast now (Cast ✓ can still be undone). */
    blocked?: string
    /** A spell slot was already spent this turn: only a slot-free cast is left (SRD p. 105). */
    slotSpentThisTurn?: boolean
    onremove?: () => void
    /** Called after "Cast ✓" is undone from this row. */
    onundo?: () => void
    /** Called after a cast (the Combat pane's "Your turn" box spends the action and notes the slot). */
    oncast?: (r: { slotUsed: boolean; cast: NonNullable<ActiveEffect['cast']>; effectUid?: string }) => void
  } = $props()

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const key = $derived(`${classId ?? ownerId ?? 'extra'}:${s.id}`)
  const summary = $derived(summaryOf(`spell:${s.id}`, s.text))
  const html = $derived(
    s.upcast
      ? {
          en: s.text.en + s.upcast.en,
          fr: s.text.fr + s.upcast.fr,
          es: (s.text.es ?? s.text.en) + (s.upcast.es ?? s.upcast.en),
        }
      : s.text,
  )
  const lines = $derived([
    {
      en: `${s.level ? `Level ${s.level}` : 'Cantrip'} · ${s.school} · ${s.castingTime.en} · ${s.range.en} · ${s.duration.en}`,
      fr: `${s.level ? `Niveau ${s.level}` : 'Sort mineur'} · ${s.school} · ${s.castingTime.fr} · ${s.range.fr} · ${s.duration.fr}`,
      es: `${s.level ? `Nivel ${s.level}` : 'Truco'} · ${s.school} · ${s.castingTime.es ?? s.castingTime.en} · ${s.range.es ?? s.range.en} · ${s.duration.es ?? s.duration.en}`,
    },
  ])
  const popup = () => openPopup({ title: s.name, html, source: s.source, noteKey: `spell:${s.id}`, lines, summary })

  // ---- slot
  const slotKey = (x: SlotChoice) => (x.free ? 'free' : x.pact ? 'pact' : String(x.level))
  const choices = $derived(slotChoices(c, sheet, s, pactFirst, classId === undefined, ownerId))
  let slotPick = $state('')
  const slot = $derived(choices.find((x) => slotKey(x) === slotPick) ?? choices[0])

  // ---- Metamagic
  const mmAll = $derived(metamagicOptions(sheet, rules, s))
  const mmFits = $derived(mmAll.some((o) => !o.notApplicable))
  let mmOpen = $state(false)
  let mmSel = $state<string[]>([])
  const selected = $derived(mmAll.filter((o) => mmSel.includes(o.id)))
  const points = $derived(sorceryPointsLeft(sheet))
  function toggleMm(id: string, on: boolean) {
    mmSel = on ? [...mmSel, id] : mmSel.filter((x) => x !== id)
  }

  // ---- cast / undo
  const effect = $derived(
    c.activeEffects.find((e) => e.kind === 'spell' && e.refId === s.id && e.cast && e.cast.classId === classId),
  )
  const record = $derived(castLog.rows[key])
  // A spell with no duration stays "Cast ✓" during the round it was cast (one spell slot per turn, SRD p. 105).
  const done = $derived(!!effect || (!!record && !record.effectUid && c.round > 0 && record.round === c.round))
  const noSlot = $derived(s.level > 0 && !slot)
  const usesSlot = $derived(s.level > 0 && !!slot && !slot.free)
  /** Why Cast is greyed: the caller's reason, no slot left, or a second slot this turn. */
  const why = $derived(
    done
      ? undefined
      : (blocked ??
          (noSlot
            ? tr({ en: 'No spell slot left', fr: 'Plus d’emplacement de sort', es: 'No quedan espacios de conjuro' })
            : slotSpentThisTurn && usesSlot
              ? tr({
                  en: 'one spell slot per turn: already spent',
                  fr: 'un emplacement de sort par tour : déjà dépensé',
                  es: 'un espacio de conjuro por turno: ya gastado',
                })
              : undefined)),
  )
  // Starting another Concentration spell ends the current one (Rules Glossary "Concentration", p. 179).
  const ends = $derived.by(() => {
    if (!s.concentration || done) return undefined
    const e = c.activeEffects.find((x) => x.uid === c.concentration)
    if (!e) return undefined
    const n = e.refId ? rules.spells.get(e.refId)?.name : e.name
    return n ?? e.name
  })
  function cast() {
    if (done) {
      if (effect?.cast) undoCast(c, effect.cast, effect.uid)
      else if (record) undoCast(c, record.cast, record.effectUid)
      delete castLog.rows[key]
      castLog.message = {
        en: `${s.name.en}: cast undone`,
        fr: `${s.name.fr} : lancement annulé`,
        es: `${s.name.es ?? s.name.en}: lanzamiento anulado`,
      }
      onundo?.()
      return
    }
    if (why) return
    const r = castSpell(c, sheet, rules, s, {
      classId,
      ownerId,
      slot: s.level ? slot : undefined,
      metamagic: selected,
      newUid,
    })
    castLog.rows[key] = { cast: r.cast, round: c.round, effectUid: r.effect?.uid }
    castLog.message = r.message
    oncast?.({ slotUsed: usesSlot, cast: r.cast, effectUid: r.effect?.uid })
    mmSel = []
    mmOpen = false
    slotPick = ''
  }
</script>

<li class="school-row school-{s.school}">
  <span class="lvl">{s.level || 'C'}</span>
  <RuleText name={s.name} text={html} source={s.source} noteKey="spell:{s.id}" {lines} {summary} />
  <button class="sum" title={tr(summary)} onclick={popup}>ⓘ <span class="sumtext">{tr(summary)}</span></button>
  {#if s.concentration}<span
      class="tag"
      class:warn={!!ends}
      title={ends
        ? tr({
            en: `Casting it ends your Concentration on ${ends.en}`,
            fr: `Le lancer met fin à votre Concentration sur ${ends.fr}`,
            es: `Lanzarlo termina tu Concentración en ${ends.es ?? ends.en}`,
          })
        : tr(UI.concentration)}>C{ends ? ' ⚠' : ''}</span
    >{/if}
  {#if s.ritual}<span class="tag" title={tr(UI.ritual)}>R</span>{/if}
  {#if castable}
    {#if mmFits}
      <button
        class="mmbtn"
        class:on={selected.length > 0}
        aria-expanded={mmOpen}
        title={tr({ en: 'Metamagic', fr: 'Métamagie', es: 'Metamagia' })}
        onclick={() => (mmOpen = !mmOpen)}
        >✦{selected.length ? ` ${selected.reduce((n, o) => n + o.cost, 0)}` : ''}</button
      >
    {/if}
    {#if !done && choices.length > 1 && (s.upcast || choices.some((x) => x.free))}
      <select
        class="slotsel"
        value={slot ? slotKey(slot) : ''}
        onchange={(e) => (slotPick = e.currentTarget.value)}
        aria-label={tr({ en: 'Spell slot', fr: 'Emplacement de sort', es: 'Espacio de conjuro' })}
      >
        {#each choices as x (slotKey(x))}
          <option value={slotKey(x)}
            >{x.free
              ? tr({ en: 'No slot', fr: 'Sans empl.', es: 'Sin espacio' })
              : x.pact
                ? tr({ en: `Pact ${x.level}`, fr: `Pacte ${x.level}`, es: `Pacto ${x.level}` })
                : `${tr({ en: 'Slot', fr: 'Empl.', es: 'Espacio' })} ${x.level}`}</option
          >
        {/each}
      </select>
    {/if}
    <button class="cast" class:done disabled={!!why} title={why} onclick={cast}
      >{done
        ? tr({ en: 'Cast ✓', fr: 'Lancé ✓', es: 'Lanzado ✓' })
        : `${tr(UI.cast)}${
            s.level && slot
              ? slot.free
                ? ` (${tr({ en: 'no slot', fr: 'sans empl.', es: 'sin espacio' })})`
                : ` (${slot.pact ? tr({ en: 'pact ', fr: 'pacte ', es: 'pacto ' }) : ''}${slot.level})`
              : ''
          }`}</button
    >
  {/if}
  {#if onremove}
    <button class="del" onclick={onremove} aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button>
  {/if}
  {#if mmOpen && castable}
    <div class="mmrow">
      <span class="meta"
        >{tr({ en: 'Sorcery Points', fr: 'Points de sorcellerie', es: 'Puntos de hechicería' })}
        {points - selected.reduce((n, o) => n + o.cost, 0)}
        / {points}</span
      >
      {#each mmAll as o (o.id)}
        {@const on = mmSel.includes(o.id)}
        {@const no = on ? undefined : metamagicBlocker(o, selected, points)}
        <label class="mmchip" class:on class:off={!!no} title={no ? tr(no) : undefined}>
          <input
            type="checkbox"
            checked={on}
            disabled={!!no}
            onchange={(e) => toggleMm(o.id, e.currentTarget.checked)}
          />
          {tr(o.name)} ({o.cost}){#if no}<small> · {tr(no)}</small>{/if}
        </label>
      {/each}
    </div>
  {/if}
</li>

<style>
  /* One line per spell; the Metamagic options open on a second line only when asked. */
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.3rem 0.15rem 0.6rem;
    margin-bottom: 2px;
    border-radius: 2px;
  }
  .lvl {
    font-family: var(--font-num);
    font-weight: 700;
    min-width: 1.1rem;
  }
  .sum {
    flex: 1 1 8rem;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;
    font: inherit;
    font-size: 0.92em;
    color: var(--ink-soft);
    background: none;
    border: none;
    padding: 0;
    min-height: 2rem;
    cursor: pointer;
  }
  /* Phones: the summary shrinks to its ⓘ (the popup has it), so a spell still fits on one line. */
  @media (max-width: 40rem) {
    .sum {
      flex: 0 0 auto;
    }
    .sumtext {
      display: none;
    }
  }
  .tag {
    font-size: 0.8rem;
    font-family: var(--font-title);
    color: var(--accent);
  }
  .tag.warn {
    font-weight: 700;
  }
  .mmbtn {
    min-height: 2.2rem;
    padding: 0 0.5rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .mmbtn.on,
  .mmbtn[aria-expanded='true'] {
    color: var(--accent);
    border-color: var(--accent);
  }
  .slotsel {
    min-height: 2.2rem;
    font-size: 0.85rem;
  }
  .cast {
    min-height: 2.2rem;
    font: inherit;
    font-size: 0.9em;
    padding: 0 0.6rem;
  }
  .cast.done {
    color: var(--ink-soft);
    background: var(--paper-2);
  }
  .del {
    color: var(--danger);
    border-color: transparent;
    background: transparent;
    min-width: 2.2rem;
    min-height: 2.2rem;
  }
  .mmrow {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 0.6rem;
    font-size: 0.9rem;
  }
  .mmchip {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    min-height: 2.2rem;
  }
  .mmchip.on {
    font-weight: 600;
  }
  .mmchip.off {
    color: var(--ink-soft);
  }
  .meta {
    color: var(--ink-soft);
    font-family: var(--font-title);
  }
</style>
