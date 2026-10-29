<script lang="ts">
  // Hit points at the table (SRD 5.2.1 p. 17–19 "Damage and Healing"): damage (Temporary Hit Points absorb it first),
  // healing, Temporary Hit Points, Death Saving Throws at 0 Hit Points, Hit Point Dice, rests and Heroic Inspiration.
  // Same layout as the 3.5 playboard's block: ±1/5/10 buttons, then an amount field.
  import { deathSave, grantTempHp, heal, hpState, takeDamage } from '../engine/hitPoints'
  import { canRest, longRest, shortRest, spendHitDice } from '../engine/rests'
  import { concentrationDc, endConcentration } from '../engine/casting'
  import { fmt } from '../engine/stacking'
  import { UI } from '../i18n/ui'
  import { app, tr, view } from '../state.svelte'
  import StatValue from './StatValue.svelte'
  import { effectName } from './TurnBar.svelte'

  let { compact = false }: { compact?: boolean } = $props()

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const hp = $derived(c.hp)
  const max = $derived(sheet.hpMax.total)
  const st = $derived(hpState(hp, max, c.exhaustion))
  // A Death Saving Throw is a D20 Test: Exhaustion and bonuses to all saving throws apply (SRD p. 181, p. 18).
  const deathMod = $derived(sheet.exhaustionPenalty + sheet.pool.parts('save.all').reduce((s, p) => s + p.value, 0))
  const restOk = $derived(canRest(c, sheet))
  const dying = $derived(hp.current <= 0 && st.kind !== 'dead')
  const restReason = $derived(
    restOk
      ? ''
      : tr({
          en: 'A rest needs at least 1 Hit Point (SRD p. 185, 187)',
          fr: 'Un repos demande au moins 1 point de vie (SRD p. 198–199 FR)',
          es: 'Un descanso requiere al menos 1 punto de golpe (SRD p. 185, 187)',
        }),
  )

  let amount = $state<number | undefined>(undefined)
  const n = $derived(Math.max(0, Math.floor(Number(amount) || 0)))
  let dieRoll = $state<number | undefined>(undefined)
  let hitDieRoll = $state<number | undefined>(undefined)
  let message = $state('')
  /** DC of the Constitution save to keep Concentration after the last damage, until the player answers. */
  let concSave = $state<number | undefined>(undefined)
  const concName = $derived.by(() => {
    const e = c.activeEffects.find((x) => x.uid === c.concentration)
    return e ? tr(effectName(e)) : ''
  })
  function concResult(kept: boolean) {
    if (!kept) {
      const e = endConcentration(c)
      message = e
        ? tr({ en: 'Concentration lost: ', fr: 'Concentration perdue : ', es: 'Concentración perdida: ' }) +
          tr(effectName(e))
        : ''
    } else message = ''
    concSave = undefined
  }

  function hurt(x: number) {
    if (x <= 0) return
    const wasConcentrating = !!c.concentration
    const r = takeDamage(c.hp, x, max, { effects: c.activeEffects })
    const notes: string[] = []
    concSave = undefined
    if (c.hp.current <= 0 && c.concentration) {
      // Unconscious includes Incapacitated, which breaks Concentration and ends the effect (Rules Glossary p. 179, 191).
      endConcentration(c)
      notes.push(
        tr({
          en: 'Concentration broken (Unconscious)',
          fr: 'Concentration rompue (Inconscient)',
          es: 'Concentración rota (Inconsciente)',
        }),
      )
    } else if (wasConcentrating) {
      // Taking damage while concentrating: Constitution save, DC 10 or half the damage, whichever is higher, 30 at most
      // (p. 179). The player says whether it was passed; a failure ends the effect.
      concSave = concentrationDc(x)
    }
    if (r.dead) notes.push(tr({ en: 'Dead', fr: 'Mort', es: 'Muerto' }))
    message = notes.join(' · ')
    amount = undefined
  }
  function cure(x: number) {
    if (x <= 0) return
    heal(c.hp, x, max)
    message = ''
    amount = undefined
  }
  const step = (d: number) => (d < 0 ? hurt(-d) : cure(d))
  function temp(x: number) {
    if (x <= 0) return
    message = grantTempHp(c.hp, x)
      ? ''
      : tr({
          en: 'Temporary Hit Points don’t add up: the higher value is kept (SRD p. 19)',
          fr: 'Les PV temporaires ne se cumulent pas : la valeur la plus haute est conservée (SRD p. 19)',
          es: 'Los puntos de golpe temporales no se suman: se conserva el valor más alto (SRD p. 19)',
        })
    amount = undefined
  }
  function rollDeathSave() {
    const roll = Math.floor(Number(dieRoll) || 0)
    if (roll < 1 || roll > 20) return
    const r = deathSave(c.hp, roll, deathMod)
    message =
      r === 'alive'
        ? tr({
            en: 'Natural 20: back to 1 Hit Point',
            fr: 'Un 20 naturel : retour à 1 point de vie',
            es: '20 natural: vuelves a 1 punto de golpe',
          })
        : r === 'stable'
          ? tr({ en: 'Three successes: Stable', fr: 'Trois réussites : Stable', es: 'Tres éxitos: Estable' })
          : r === 'dead'
            ? tr({ en: 'Three failures: dead', fr: 'Trois échecs : mort', es: 'Tres fallos: muerto' })
            : ''
    dieRoll = undefined
  }
  /** Click a ✓ or ✗ pip to record a success or failure by hand (e.g. the GM adjudicates). */
  function setDeath(kind: 'successes' | 'failures', i: number) {
    const cur = c.hp.deathSaves[kind]
    c.hp.deathSaves[kind] = cur === i + 1 ? i : i + 1
    if (c.hp.deathSaves.successes >= 3) {
      c.hp.stable = true
      c.hp.deathSaves = { successes: 0, failures: 0 }
    }
  }
  function spendDie(classId: string, die: number) {
    const roll = Math.floor(Number(hitDieRoll) || 0)
    if (roll < 1 || roll > die) return
    spendHitDice(c, sheet, classId, [roll])
    hitDieRoll = undefined
  }
  function rest(kind: 'short' | 'long') {
    const ok = kind === 'short' ? shortRest(c, sheet) : longRest(c, sheet)
    message = ok ? tr(kind === 'short' ? UI.shortRest : UI.longRest) + ' ✓' : restReason
  }
</script>

<div class="hpbox" class:compact>
  <div class="title">{tr(UI.hp)}</div>
  <div class="now">
    <span class="current" class:low={st.kind === 'bloodied'} class:zero={hp.current <= 0}>{hp.current}</span>
    <span>/</span>
    <StatValue stat={() => view.sheet.hpMax} title={UI.hp} signed={false} />
    {#if hp.temp}<span class="temp">+{hp.temp} {tr({ en: 'temp', fr: 'temp.', es: 'temp.' })}</span>{/if}
  </div>
  <div
    class="buttons"
    role="group"
    aria-label={tr({ en: 'Damage and healing', fr: 'Dégâts et soins', es: 'Daño y curación' })}
  >
    {#each [-10, -5, -1] as d (d)}<button class="dmg" onclick={() => step(d)}>{d}</button>{/each}
    {#each [1, 5, 10] as d (d)}<button class="heal" onclick={() => step(d)}>+{d}</button>{/each}
  </div>
  <div class="amount">
    <input
      type="number"
      min="0"
      inputmode="numeric"
      bind:value={amount}
      placeholder="0"
      aria-label={tr({ en: 'Amount', fr: 'Montant', es: 'Cantidad' })}
    />
    <button class="dmg" disabled={!n} onclick={() => hurt(n)}>{tr(UI.damage)}</button>
    <button class="heal" disabled={!n} onclick={() => cure(n)}>{tr({ en: 'Heal', fr: 'Soins', es: 'Curar' })}</button>
    <button disabled={!n} onclick={() => temp(n)}>{tr({ en: 'Temp HP', fr: 'PV temp.', es: 'PG temp.' })}</button>
    <button disabled={hp.current >= max || st.kind === 'dead'} onclick={() => cure(max)}
      >{tr({ en: 'Full', fr: 'Max', es: 'Máx.' })}</button
    >
  </div>
  {#if st.text}<p class="state state-{st.kind}">{tr(st.text)}</p>{/if}
  {#if message}<p class="msg" role="status">{message}</p>{/if}
  {#if concSave !== undefined && c.concentration}
    <p class="msg conc" role="status">
      {tr({
        en: `Concentration on ${concName}: Constitution save DC ${concSave}`,
        fr: `Concentration sur ${concName} : JS de Constitution DD ${concSave}`,
        es: `Concentración en ${concName}: salvación de Constitución CD ${concSave}`,
      })}
      <button onclick={() => concResult(true)}>{tr({ en: 'Passed', fr: 'Réussi', es: 'Superada' })}</button>
      <button onclick={() => concResult(false)}>{tr({ en: 'Failed', fr: 'Raté', es: 'Fallada' })}</button>
    </p>
  {/if}

  {#if dying}
    <div class="death">
      <div class="title small">{tr(UI.deathSaves)}</div>
      <div class="pips">
        <span class="pipgroup" aria-label={tr({ en: 'Successes', fr: 'Réussites', es: 'Éxitos' })}>
          ✓
          {#each [0, 1, 2] as i (i)}
            <button
              class="pip ok"
              class:on={i < hp.deathSaves.successes}
              onclick={() => setDeath('successes', i)}
              aria-label={tr({ en: `Success ${i + 1}`, fr: `Réussite ${i + 1}`, es: `Éxito ${i + 1}` })}
            ></button>
          {/each}
        </span>
        <span class="pipgroup" aria-label={tr({ en: 'Failures', fr: 'Échecs', es: 'Fallos' })}>
          ✗
          {#each [0, 1, 2] as i (i)}
            <button
              class="pip ko"
              class:on={i < hp.deathSaves.failures}
              onclick={() => setDeath('failures', i)}
              aria-label={tr({ en: `Failure ${i + 1}`, fr: `Échec ${i + 1}`, es: `Fallo ${i + 1}` })}
            ></button>
          {/each}
        </span>
      </div>
      {#if !hp.stable}
        <div class="amount">
          <input
            type="number"
            min="1"
            max="20"
            inputmode="numeric"
            bind:value={dieRoll}
            placeholder="d20"
            aria-label={tr({ en: 'd20 roll', fr: 'Résultat du d20', es: 'Resultado del d20' })}
          />
          <button disabled={!dieRoll} onclick={rollDeathSave}
            >{tr({ en: 'Death save', fr: 'JS contre la mort', es: 'Salvación contra muerte' })}</button
          >
          {#if deathMod}<small>{fmt(deathMod)} {tr({ en: 'to the roll', fr: 'au jet', es: 'a la tirada' })}</small>{/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="dice">
    {#each sheet.hitDice as h (h.classId)}
      <div class="die">
        <span class="label">{tr(UI.hitDice)} d{h.die}</span>
        <strong>{h.total - h.spent} / {h.total}</strong>
        <input
          type="number"
          min="1"
          max={h.die}
          inputmode="numeric"
          bind:value={hitDieRoll}
          placeholder="d{h.die}"
          aria-label={tr({ en: `d${h.die} roll`, fr: `Résultat du d${h.die}`, es: `Resultado del d${h.die}` })}
        />
        <button
          disabled={h.spent >= h.total || !hitDieRoll || hp.current <= 0}
          title={tr({
            en: 'Spend one Hit Point Die during a Short Rest: the roll + Constitution modifier (SRD p. 187)',
            fr: 'Dépenser un dé de vie pendant un repos court : le jet + modificateur de Constitution (SRD p. 198 FR)',
            es: 'Gasta un dado de puntos de golpe durante un descanso corto: la tirada + modificador por Constitución (SRD p. 187)',
          })}
          onclick={() => spendDie(h.classId, h.die)}>{tr({ en: 'Spend', fr: 'Dépenser', es: 'Gastar' })}</button
        >
      </div>
    {/each}
  </div>

  <div class="rests">
    <button disabled={!restOk} title={restReason} onclick={() => rest('short')}>{tr(UI.shortRest)}</button>
    <button disabled={!restOk} title={restReason} onclick={() => rest('long')}>{tr(UI.longRest)}</button>
    <label class="chk" class:on={c.heroicInspiration}>
      <input type="checkbox" bind:checked={c.heroicInspiration} />
      {tr(UI.heroicInspiration)}
    </label>
  </div>
  {#if !compact}
    <p class="note">
      {tr({
        en: 'Damage uses Temporary Hit Points first; at 0 Hit Points, damage is a failed Death Saving Throw.',
        fr: 'Les dégâts entament d’abord les PV temporaires ; à 0 PV, des dégâts comptent comme un échec au JS contre la mort.',
        es: 'El daño consume primero los puntos de golpe temporales; a 0 puntos de golpe, el daño cuenta como una tirada de salvación contra muerte fallida.',
      })}
    </p>
  {/if}
</div>

<style>
  .hpbox {
    text-align: center;
    min-width: 14rem;
  }
  .title {
    font-family: var(--font-title);
    font-size: 1rem;
    letter-spacing: 0.06em;
    color: var(--ink);
  }
  .title.small {
    font-size: 0.85rem;
    color: var(--ink-soft);
    margin-bottom: 0.2rem;
  }
  .now {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: var(--font-num);
    font-size: 1.3em;
    color: var(--ink-soft);
    flex-wrap: wrap;
  }
  .current {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 1.6em;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .current.low {
    color: var(--warn);
  }
  .current.zero {
    color: var(--danger);
  }
  .temp {
    font-size: 0.75em;
    color: var(--arcane);
  }
  .buttons {
    display: grid;
    grid-template-columns: repeat(3, 2.9rem);
    gap: 0.3rem;
    justify-content: center;
    margin: 0.5rem 0;
  }
  .compact .buttons {
    grid-template-columns: repeat(6, 2.75rem);
  }
  button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 0.9rem;
    border: 1px solid var(--rule-strong);
    background: var(--box);
    color: var(--ink);
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button.dmg {
    color: var(--danger);
  }
  .amount {
    display: flex;
    gap: 0.3rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }
  .amount button {
    font-family: var(--font-body);
    font-weight: 600;
    padding: 0 0.5rem;
  }
  .amount small {
    color: var(--ink-soft);
  }
  input {
    width: 4.5rem;
    font: inherit;
    font-size: 1rem;
    min-height: 2.4rem;
    text-align: center;
    color: var(--ink);
    background: var(--box);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
  }
  .state {
    margin: 0.4rem 0 0;
    color: var(--danger);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .state-bloodied {
    color: var(--warn);
    font-weight: 400;
  }
  .state-stable {
    font-weight: 400;
  }
  .msg {
    margin: 0.3rem 0 0;
    color: var(--accent);
    font-size: 0.9rem;
  }
  .msg.conc button {
    margin-left: 0.3rem;
    min-height: 2rem;
  }
  .death {
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--rule);
  }
  .pips {
    display: flex;
    justify-content: center;
    gap: 1.2rem;
    margin-bottom: 0.4rem;
    font-family: var(--font-num);
  }
  .pipgroup {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .pip {
    width: 1.4rem;
    min-width: 1.4rem;
    height: 1.4rem;
    min-height: 1.4rem;
    padding: 0;
    border-radius: 50%;
    border: 1.5px solid var(--frame);
    background: transparent;
  }
  .pip.ok.on {
    background: var(--ink);
  }
  .pip.ko.on {
    background: var(--danger);
    border-color: var(--danger);
  }
  .dice {
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--rule);
  }
  .die {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.9rem;
  }
  .die .label {
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .die strong {
    font-family: var(--font-num);
  }
  .die input {
    width: 3.8rem;
  }
  .die button {
    font-family: var(--font-body);
    font-weight: 600;
    padding: 0 0.6rem;
  }
  .rests {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--rule);
  }
  .rests button {
    font-family: var(--font-body);
    font-weight: 600;
    padding: 0 0.7rem;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 2.75rem;
    padding: 0 0.7rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    cursor: pointer;
  }
  .chk.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chk input {
    width: 1.1rem;
    min-height: 0;
    accent-color: var(--accent);
  }
  .note {
    color: var(--ink-soft);
    font-size: 0.8rem;
    margin: 0.4rem 0 0;
  }
</style>
