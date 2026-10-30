<script lang="ts">
  // The Builder's ability scores step (SRD 5.2.1 p. 21, FR p. 22): base scores by Standard Array, Point Cost (27
  // points, 8–15) or Random Generation (4d6, the three highest), then the background's +2 / +1 or +1 / +1 / +1 among its
  // three abilities, no score above 20. Edits the live character (`baseAbilities`, `background.abilities`).
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_NAMES, ABILITY_SHORT } from '../engine/sheet/common'
  import { backgroundDef } from '../model/customBackground'
  import { app, tr } from '../state.svelte'
  import { defaultIncreases, isStandardArray, suggestedArray } from './creation'

  type Method = 'standard' | 'points' | 'rolled'
  const c = $derived(app.character)
  const base = $derived(c.baseAbilities)
  const bg = $derived(backgroundDef(c.background, rules))
  const STANDARD: number[] = rules.tables.standardArray
  const COST = rules.tables.pointCost as unknown as Record<string, number>
  const BUDGET = 27
  const spentOf = (b: Record<AbilityId, number>) => ABILITIES.reduce((s, a) => s + (COST[String(b[a])] ?? 99), 0)
  const spent = $derived(spentOf(base))
  const fitsPoints = (b: Record<AbilityId, number>) =>
    ABILITIES.every((a) => b[a] >= 8 && b[a] <= 15) && spentOf(b) <= BUDGET
  const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
  const mod = (score: number) => Math.floor((score - 10) / 2)

  // The method the scores look like when the step opens.
  let method = $state<Method>(
    isStandardArray(app.character.baseAbilities, rules)
      ? 'standard'
      : fitsPoints(app.character.baseAbilities)
        ? 'points'
        : 'rolled',
  )
  let rolls = $state<number[]>([])

  /** Standard Array: picking a value swaps it with the ability that had it, so each value stays used once. */
  function assignStandard(a: AbilityId, v: number) {
    const other = ABILITIES.find((b) => b !== a && base[b] === v)
    if (other) base[other] = base[a]
    base[a] = v
  }
  /** Point Cost: 8 to 15, 27 points (p. 21 table). */
  function step(a: AbilityId, d: number) {
    const v = base[a] + d
    if (v < 8 || v > 15) return
    if (d > 0 && spent - COST[String(base[a])] + COST[String(v)] > BUDGET) return
    base[a] = v
  }
  function setMethod(m: Method) {
    method = m
    if ((m === 'standard' && !isStandardArray(base, rules)) || (m === 'points' && !fitsPoints(base))) {
      c.baseAbilities = suggestedArray(c.levels[0].classId, rules)
      defaultIncreases(c, rules)
    }
  }
  /** Random Generation: 4d6, the three highest, six times; placed in the order of the class's suggested array. */
  function roll() {
    const one = () => {
      const d = [1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x)
      return d[0] + d[1] + d[2]
    }
    rolls = [1, 2, 3, 4, 5, 6].map(one).sort((x, y) => y - x)
    const s = suggestedArray(c.levels[0].classId, rules)
    const order = [...ABILITIES].sort((x, y) => s[y] - s[x])
    order.forEach((a, i) => (base[a] = rolls[i]))
    defaultIncreases(c, rules)
  }
  function setBase(a: AbilityId, v: number) {
    if (Number.isFinite(v)) base[a] = Math.round(v)
  }

  // Background increases.
  const inc = $derived(c.background.abilities)
  const incMode = $derived(Object.values(inc).filter(Boolean).length === 3 ? '1-1-1' : '2-1')
  const plus2 = $derived((Object.keys(inc) as AbilityId[]).find((a) => inc[a] === 2))
  const plus1 = $derived((Object.keys(inc) as AbilityId[]).find((a) => inc[a] === 1))
  function setMode(m: '2-1' | '1-1-1') {
    if (m === '1-1-1') c.background.abilities = Object.fromEntries((bg?.abilities ?? []).map((a) => [a, 1]))
    else defaultIncreases(c, rules)
  }
  function setTwo(p2: AbilityId, p1: AbilityId | undefined) {
    const one = p1 && p1 !== p2 ? p1 : bg?.abilities.find((a) => a !== p2)
    c.background.abilities = { [p2]: 2, ...(one ? { [one]: 1 } : {}) }
  }
  const finalScore = (a: AbilityId) => (base[a] ?? 0) + (inc[a] ?? 0)
  const over20 = $derived(ABILITIES.some((a) => finalScore(a) > 20))
</script>

<div class="seg" role="group">
  <button class:on={method === 'standard'} onclick={() => setMethod('standard')}
    >{tr({ en: 'Standard Array', fr: 'Valeurs standard', es: 'Conjunto estándar' })}</button
  >
  <button class:on={method === 'points'} onclick={() => setMethod('points')}
    >{tr({ en: 'Point Cost', fr: 'Acquisition par points', es: 'Coste en puntos' })}</button
  >
  <button class:on={method === 'rolled'} onclick={() => setMethod('rolled')}
    >{tr({ en: 'Random Generation', fr: 'Génération aléatoire', es: 'Generación aleatoria' })}</button
  >
</div>
<p class="hint">
  {#if method === 'standard'}
    15, 14, 13, 12, 10, 8 · {tr({
      en: 'pick a value to swap it with the ability that has it.',
      fr: 'choisissez une valeur pour l’échanger avec la caractéristique qui l’a.',
      es: 'elige un valor para intercambiarlo con la característica que lo tiene.',
    })}
  {:else if method === 'points'}
    {tr({ en: 'Points spent', fr: 'Points dépensés', es: 'Puntos gastados' })} :
    <strong class:bad={spent > BUDGET}>{spent} / {BUDGET}</strong> · 8–15
  {:else}
    {tr({
      en: '4d6, keep the three highest, six times; or type your own scores.',
      fr: '4d6, on garde les trois meilleurs, six fois ; ou saisissez vos valeurs.',
      es: '4d6, se suman los tres más altos, seis veces; o escribe tus puntuaciones.',
    })}
    <button class="small" onclick={roll}>{tr({ en: 'Roll', fr: 'Lancer', es: 'Tirar' })}</button>
    {#if rolls.length}<span class="rolls">{rolls.join(', ')}</span>{/if}
  {/if}
</p>
<div class="scores">
  {#each ABILITIES as a (a)}
    <div class="score">
      <span class="ab" title={tr(ABILITY_NAMES[a])}>{tr(ABILITY_SHORT[a])}</span>
      {#if method === 'standard'}
        <select
          value={base[a]}
          aria-label={tr(ABILITY_NAMES[a])}
          onchange={(e) => assignStandard(a, +e.currentTarget.value)}
        >
          {#each STANDARD as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      {:else if method === 'points'}
        <span class="stepper">
          <button onclick={() => step(a, -1)} disabled={base[a] <= 8} aria-label="−">−</button>
          <span class="v">{base[a]}</span>
          <button onclick={() => step(a, 1)} disabled={base[a] >= 15} aria-label="+">+</button>
        </span>
      {:else}
        <input
          type="number"
          min="3"
          max="18"
          inputmode="numeric"
          value={base[a]}
          aria-label={tr(ABILITY_NAMES[a])}
          onchange={(e) => setBase(a, +e.currentTarget.value)}
        />
      {/if}
      <span class="inc" class:on={!!inc[a]}>{inc[a] ? `+${inc[a]}` : ''}</span>
      <span class="final" class:bad={finalScore(a) > 20}
        >{finalScore(a)} <small>({signed(mod(finalScore(a)))})</small></span
      >
    </div>
  {/each}
</div>
{#if bg && bg.abilities.length >= 3}
  <div class="incs">
    <span class="lab"
      >{tr({ en: 'Background increases', fr: 'Augmentations de l’historique', es: 'Aumentos del trasfondo' })} · {tr(
        bg.name,
      )}</span
    >
    <div class="seg" role="group">
      <button class:on={incMode === '2-1'} onclick={() => setMode('2-1')}>+2 / +1</button>
      <button class:on={incMode === '1-1-1'} onclick={() => setMode('1-1-1')}>+1 / +1 / +1</button>
    </div>
    {#if incMode === '2-1'}
      <label class="inline"
        >+2
        <select value={plus2 ?? ''} onchange={(e) => setTwo(e.currentTarget.value as AbilityId, plus1)}>
          {#if !plus2}<option value="">—</option>{/if}
          {#each bg.abilities as x (x)}<option value={x}>{tr(ABILITY_NAMES[x])}</option>{/each}
        </select>
      </label>
      <label class="inline"
        >+1
        <select
          value={plus1 ?? ''}
          onchange={(e) => plus2 && setTwo(plus2, e.currentTarget.value as AbilityId)}
          disabled={!plus2}
        >
          {#if !plus1}<option value="">—</option>{/if}
          {#each bg.abilities.filter((x) => x !== plus2) as x (x)}<option value={x}>{tr(ABILITY_NAMES[x])}</option
            >{/each}
        </select>
      </label>
    {/if}
  </div>
{/if}
{#if over20}
  <p class="msg">
    {tr({
      en: 'None of these increases can raise a score above 20.',
      fr: 'Aucune de ces augmentations ne peut porter une valeur au-delà de 20.',
      es: 'Ninguno de estos aumentos puede subir una puntuación por encima de 20.',
    })}
  </p>
{/if}

<style>
  .seg {
    display: flex;
    flex-wrap: wrap;
  }
  .seg button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
  }
  .seg button.on {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  .scores {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.4rem 1rem;
    margin: 0.5rem 0;
  }
  .score {
    display: grid;
    grid-template-columns: 2.6rem minmax(0, 6.5rem) 2rem 1fr;
    align-items: center;
    gap: 0.4rem;
  }
  .ab {
    font-family: var(--font-title);
    font-size: 1.05em;
  }
  .score select,
  .score input {
    width: 100%;
    min-height: 2.75rem;
    font: inherit;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stepper button {
    min-width: 2.2rem;
    min-height: 2.5rem;
  }
  .stepper .v,
  .final {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .inc {
    color: var(--ink-soft);
    font-family: var(--font-num);
  }
  .inc.on {
    color: var(--accent);
  }
  .final small {
    font-weight: 400;
    color: var(--ink-soft);
  }
  .incs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .lab {
    font-family: var(--font-title);
    width: 100%;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-title);
  }
  .inline select {
    min-height: 2.75rem;
    font: inherit;
  }
  .small {
    font-size: 0.9em;
    min-height: 2.2rem;
    margin-left: 0.5em;
  }
  .rolls {
    font-family: var(--font-num);
    margin-left: 0.5em;
  }
  .hint {
    font-size: 0.92em;
    color: var(--ink-soft);
    margin: 0.4rem 0;
  }
  .msg,
  .bad {
    color: var(--danger);
  }
</style>
