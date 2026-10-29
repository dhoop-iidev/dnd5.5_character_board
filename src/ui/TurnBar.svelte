<script module lang="ts">
  // Display name of an active effect: its own name, else the spell or condition it refers to.
  import { rules } from '../data/rules'
  import type { ActiveEffect } from '../model/character'

  export function effectName(e: ActiveEffect) {
    return (
      e.name ??
      (e.refId ? (rules.spells.get(e.refId)?.name ?? rules.conditions.get(e.refId)?.name) : undefined) ?? {
        en: e.refId ?? '?',
        fr: e.refId ?? '?',
        es: e.refId ?? '?',
      }
    )
  }
</script>

<script lang="ts">
  // Turn tracker: round counter, next round (timed effects lose 1 round, removed at 0), end of the encounter, and the
  // effect being concentrated on (one at a time, Rules Glossary "Concentration" p. 180). A round is about 6 seconds
  // (Rules Glossary "Round" p. 186): 1 minute = 10 rounds.
  import { UI } from '../i18n/ui'
  import { app, tr } from '../state.svelte'
  import { endConcentration } from '../engine/casting'
  import { pruneSummons, tickSummons } from '../engine/summons'
  import { newTurn } from '../engine/turn'

  /** Inside the "Your turn" box (ui/TurnBox.svelte): no frame, title or note of its own. */
  let { embedded = false }: { embedded?: boolean } = $props()

  const c = $derived(app.character)
  const timed = $derived(c.activeEffects.filter((e) => e.rounds !== undefined))
  const concentrating = $derived(c.activeEffects.find((e) => e.uid === c.concentration))
  let message = $state('')

  function nextRound() {
    c.round = (c.round || 0) + 1
    // Your action, Bonus Action, Reaction, movement and object interaction come back (the "Your turn" box).
    newTurn(c)
    const expired: string[] = []
    for (const e of c.activeEffects) {
      if (e.rounds === undefined) continue
      // A duration keeps running while the effect is switched off.
      e.rounds -= 1
      if (e.rounds <= 0) expired.push(tr(effectName(e)))
    }
    c.activeEffects = c.activeEffects.filter((e) => e.rounds === undefined || e.rounds > 0)
    if (c.concentration && !c.activeEffects.some((e) => e.uid === c.concentration)) c.concentration = undefined
    // Summoned creatures (Combat pane) count down too, and vanish with the spell they depend on.
    for (const id of tickSummons(c)) expired.push(tr(rules.creatures.get(id)?.name ?? { en: id, fr: id, es: id }))
    const notes: string[] = []
    if (expired.length) notes.push(tr({ en: 'Ended: ', fr: 'Terminé : ', es: 'Terminado: ' }) + expired.join(', '))
    // At 0 Hit Points and not Stable: a Death Saving Throw at the start of each turn (SRD p. 18).
    if (c.hp.current <= 0 && !c.hp.stable && c.hp.deathSaves.failures < 3)
      notes.push(
        tr({
          en: 'Death Saving Throw at the start of your turn',
          fr: 'JS contre la mort au début de votre tour',
          es: 'Tirada de salvación contra muerte al comienzo de tu turno',
        }),
      )
    message = notes.join(' · ')
  }
  function endEncounter() {
    c.round = 0
    newTurn(c)
    // Effects with a minute or less left end with the fight; longer ones (Mage Armor's 8 hours…) keep running.
    const short = (e: (typeof timed)[number]) => e.rounds !== undefined && e.rounds <= 10
    const ended = timed.filter(short).map((e) => tr(effectName(e)))
    c.activeEffects = c.activeEffects.filter((e) => !short(e))
    if (c.concentration && !c.activeEffects.some((e) => e.uid === c.concentration)) c.concentration = undefined
    pruneSummons(c)
    message =
      tr({ en: 'Encounter over.', fr: 'Rencontre terminée.', es: 'Encuentro terminado.' }) +
      (ended.length ? ' ' + tr({ en: 'Ended: ', fr: 'Terminé : ', es: 'Terminado: ' }) + ended.join(', ') : '')
  }
  function dropConcentration() {
    // Losing Concentration ends the effect (p. 179).
    const e = endConcentration(c)
    if (e) {
      message =
        tr({ en: 'Concentration ended: ', fr: 'Concentration terminée : ', es: 'Concentración terminada: ' }) +
        tr(effectName(e))
    }
  }
</script>

<svelte:element this={embedded ? 'div' : 'section'} class={embedded ? 'turn embedded' : 'box wide turn'}>
  {#if !embedded}<h3>{tr({ en: 'Turn', fr: 'Tour', es: 'Turno' })}</h3>{/if}
  <div class="row">
    <span class="round">{tr(UI.round)} <strong>{c.round > 0 ? c.round : '—'}</strong></span>
    <button class="main" onclick={nextRound}
      >⏵ {c.round > 0
        ? tr({ en: 'Next round', fr: 'Round suivant', es: 'Siguiente asalto' })
        : tr({ en: 'Start the encounter', fr: 'Début de la rencontre', es: 'Empezar el encuentro' })}</button
    >
    <button onclick={endEncounter} disabled={!c.round && !timed.length}
      >{tr({ en: 'End of encounter', fr: 'Fin de la rencontre', es: 'Fin del encuentro' })}</button
    >
    <span class="conc" class:on={!!concentrating}>
      <span class="label">{tr(UI.concentration)} :</span>
      {#if concentrating}
        <strong>{tr(effectName(concentrating))}</strong>
        {#if concentrating.rounds !== undefined}<small
            >{concentrating.rounds} {tr({ en: 'rd', fr: 'rd', es: 'as.' })}</small
          >{/if}
        <button
          class="drop"
          onclick={dropConcentration}
          aria-label={tr({ en: 'Drop Concentration', fr: 'Cesser la concentration', es: 'Dejar la concentración' })}
          >✕</button
        >
      {:else}
        <small>{tr({ en: 'none', fr: 'aucune', es: 'ninguna' })}</small>
      {/if}
    </span>
    {#if message}<span class="msg" role="status">{message}</span>{/if}
  </div>
  {#if timed.length}
    <ul class="timed">
      {#each timed as e (e.uid)}
        <li class:off={!e.enabled}>
          <span>{tr(effectName(e))}</span>
          <strong>{e.rounds} {tr({ en: 'rd', fr: 'rd', es: 'as.' })}</strong>
        </li>
      {/each}
    </ul>
  {/if}
  {#if !embedded}<p class="note">
      {tr({
        en: 'Next round: effects with a duration lose 1 round (removed at 0; 1 minute = 10 rounds). Taking damage while concentrating calls for a Constitution saving throw, DC 10 or half the damage, whichever is higher.',
        fr: 'Round suivant : les effets avec une durée perdent 1 round (retirés à 0 ; 1 minute = 10 rounds). Subir des dégâts en se concentrant impose un jet de sauvegarde de Constitution, DD 10 ou la moitié des dégâts si c’est plus.',
        es: 'Siguiente asalto: los efectos con duración pierden 1 asalto (se retiran a 0; 1 minuto = 10 asaltos). Recibir daño mientras te concentras exige una tirada de salvación de Constitución, CD 10 o la mitad del daño, lo que sea mayor.',
      })}
    </p>{/if}
</svelte:element>

<style>
  /* Same spacing as the grid of boxes below it. */
  .turn {
    margin-bottom: 1.25rem;
  }
  .turn.embedded {
    margin-bottom: 0.6rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .round {
    font-family: var(--font-title);
    margin-right: 0.5rem;
  }
  .round strong {
    font-family: var(--font-num);
    font-size: 1.4rem;
  }
  button {
    min-height: 2.75rem;
    padding: 0 0.9rem;
  }
  button.main {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
  }
  button:disabled {
    opacity: 0.45;
  }
  .conc {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 0.8rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1.4rem;
  }
  .conc.on {
    border-color: var(--arcane);
  }
  .conc .label {
    font-family: var(--font-title);
    color: var(--ink-soft);
  }
  .conc small {
    color: var(--ink-soft);
  }
  .drop {
    min-width: 2.2rem;
    min-height: 2.2rem;
    padding: 0;
    color: var(--danger);
    border-color: transparent;
  }
  .msg {
    color: var(--accent);
  }
  .timed {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    margin: 0.6rem 0 0;
    padding: 0;
    font-size: 0.95em;
  }
  .timed li {
    display: inline-flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  .timed li.off {
    opacity: 0.6;
  }
  .timed strong {
    font-family: var(--font-num);
  }
  .note {
    font-size: 0.88rem;
    color: var(--ink-soft);
    margin: 0.5rem 0 0;
  }
</style>
