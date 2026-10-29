<script lang="ts">
  // Experience points and the bar to the next level (SRD 5.2.1 p. 23 "Character Advancement": rules.tables.xpByLevel,
  // index 0 = level 1). Same drawing as the 3.5 playboard's identity card: "XP current / next" line, a thin framed bar,
  // a red note when a level is available. The XP input lives here (the only place XP is edited).
  import { rules } from '../data/rules'
  import { UI } from '../i18n/ui'
  import { app, lang, tr, view } from '../state.svelte'
  import { locale } from './format'

  const c = $derived(app.character)
  const level = $derived(view.sheet.level)
  const table = rules.tables.xpByLevel
  /** XP needed for the current level and for the next one (none at the top of the table). */
  const prev = $derived(table[Math.min(table.length, Math.max(1, level)) - 1] ?? 0)
  const next = $derived(level >= 1 && level < table.length ? table[level] : undefined)
  const pct = $derived(
    next === undefined ? 100 : Math.max(0, Math.min(100, ((c.xp - prev) / Math.max(1, next - prev)) * 100)),
  )
  /** Level the XP total entitles to (the last threshold reached). */
  const xpLevel = $derived(Math.max(1, table.filter((x) => x <= c.xp).length))
  const fmtN = (n: number) => n.toLocaleString(locale(lang()))
</script>

<div class="xp">
  <div class="xp-line">
    <label class="total">
      <span class="tag">{tr({ en: 'Experience points', fr: 'Points d’expérience', es: 'Puntos de experiencia' })}</span>
      <span class="value">
        <input type="number" min="0" step="10" bind:value={c.xp} aria-label="XP" />
        <span class="of">/ {next === undefined ? '—' : fmtN(next)} XP</span>
      </span>
    </label>
    <p class="next">
      {tr(UI.level)} <strong>{level}</strong>
      {#if next !== undefined}
        · {tr({ en: 'next level at', fr: 'niveau suivant à', es: 'siguiente nivel a' })} <strong>{fmtN(next)}</strong>
        XP
        {#if c.xp < next}
          <span class="meta"
            >({tr({
              en: `${fmtN(next - c.xp)} to go`,
              fr: `encore ${fmtN(next - c.xp)}`,
              es: `faltan ${fmtN(next - c.xp)}`,
            })})</span
          >
        {/if}
      {:else}
        · {tr({ en: 'maximum level', fr: 'niveau maximum', es: 'nivel máximo' })}
      {/if}
    </p>
  </div>
  <div class="bar" role="meter" aria-valuenow={c.xp} aria-valuemin={prev} aria-valuemax={next ?? prev}>
    <div class="fill" style="width: {pct}%"></div>
  </div>
  {#if xpLevel > level}
    <p class="ready">
      {tr({
        en: `Level ${xpLevel} reached: add a level below.`,
        fr: `Niveau ${xpLevel} atteint : ajoutez un niveau ci-dessous.`,
        es: `Nivel ${xpLevel} alcanzado: añade un nivel abajo.`,
      })}
    </p>
  {:else if c.xp < prev}
    <p class="low">
      {tr({
        en: `XP below level ${level} (${fmtN(prev)} XP needed).`,
        fr: `XP inférieurs au niveau ${level} (${fmtN(prev)} XP nécessaires).`,
        es: `PX por debajo del nivel ${level} (se necesitan ${fmtN(prev)} PX).`,
      })}
    </p>
  {/if}
</div>

<style>
  .xp {
    margin: 0 0 1rem;
  }
  .xp-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 0.4rem 1.2rem;
  }
  .total {
    display: flex;
    flex-direction: column;
  }
  .tag {
    font-family: var(--font-title);
    font-size: 0.9rem;
    color: var(--ink-soft);
    letter-spacing: 0.04em;
  }
  .value {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  input {
    width: 7.5rem;
    min-height: 2.6rem;
    padding: 0 0.5rem;
    font: inherit;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 1.25rem;
    text-align: right;
  }
  .of {
    font-size: 1.05rem;
    color: var(--ink-soft);
  }
  .next {
    margin: 0;
    font-family: var(--font-title);
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.9em;
  }
  .bar {
    height: 0.55rem;
    margin-top: 0.45rem;
    border: 1px solid var(--frame);
    border-radius: 2px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--frame);
    transition: width 0.2s;
  }
  .ready {
    margin: 0.4rem 0 0;
    color: var(--accent);
    font-family: var(--font-title);
  }
  .low {
    margin: 0.4rem 0 0;
    color: var(--ink-soft);
    font-style: italic;
  }
</style>
