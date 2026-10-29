<script lang="ts">
  // Medallion (ability scores, AC, saves…): a ringed value with a small-caps label; `shape` draws a shield (Armor Class)
  // or a heart (Hit Points) instead of the ring.
  import type { Snippet } from 'svelte'

  let {
    label,
    sub,
    size = 'md',
    children,
    badge,
    shape = 'ring',
  }: {
    label: string
    sub?: string
    size?: 'sm' | 'md' | 'lg'
    children: Snippet
    badge?: Snippet
    shape?: 'ring' | 'shield' | 'heart'
  } = $props()

  // Outlines in a 100 × 100 box; the inner hairline is the same path scaled down, like the ring's inner ring.
  const PATHS = {
    shield: 'M50 4 L92 15 V45 C92 71 75 87 50 96 C25 87 8 71 8 45 V15 Z',
    heart:
      'M50 93 C22 72 4 55 4 33 C4 17 16 6 30 6 C40 6 46 12 50 20 C54 12 60 6 70 6 C84 6 96 17 96 33 C96 55 78 72 50 93 Z',
  }
</script>

<div class="medallion {size}">
  <div class="ring" class:shape={shape !== 'ring'} class:heart={shape === 'heart'}>
    {#if shape !== 'ring'}
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path class="outer" d={PATHS[shape]} />
        <path class="inner" d={PATHS[shape]} transform="translate(50 50) scale(0.88) translate(-50 -50)" />
      </svg>
    {/if}
    {@render children()}
  </div>
  {#if badge}<div class="badge">{@render badge()}</div>{/if}
  <div class="label">{label}</div>
  {#if sub !== undefined}<div class="sub">{sub}</div>{/if}
</div>

<style>
  /* A plain ring with a hairline inner ring (seal-like), small-caps label under it. */
  .medallion {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: max(var(--d), 4.5rem);
    --d: 5.2rem;
  }
  .sm {
    --d: 4.4rem;
  }
  .lg {
    --d: 6.6rem;
  }
  .ring {
    width: var(--d);
    height: var(--d);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--box);
    border: 2px solid var(--frame);
    box-shadow:
      inset 0 0 0 3px var(--box),
      inset 0 0 0 4px var(--rule-strong);
    font-family: var(--font-num);
  }
  /* Small badge at the ring's top-right (the ability's saving throw in the General pane), outside the ring so the ring's
     value styles don't apply to it. */
  .badge {
    position: absolute;
    top: -0.35rem;
    left: calc(50% + var(--d) / 2 - 1.35rem);
    z-index: 1;
  }
  .lg .ring {
    border-width: 2.5px;
  }
  /* Shield or heart: the outline is an SVG behind the value. */
  .ring.shape {
    position: relative;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .ring.shape svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .ring.shape .outer {
    fill: var(--box);
    stroke: var(--frame);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  .ring.shape .inner {
    fill: none;
    stroke: var(--rule-strong);
    stroke-width: 1;
  }
  .ring.shape > :global(*:not(svg)) {
    position: relative;
  }
  /* The value's hover disc stays inside the outline. */
  .ring.shape :global(.stat) {
    width: calc(var(--d) * 0.62);
    height: calc(var(--d) * 0.62);
  }
  /* The heart's body is above its middle. */
  .ring.heart > :global(*:not(svg)) {
    margin-top: -0.6rem;
  }
  /* Values inside the ring: StatValue buttons fill the disc. */
  .ring :global(.stat) {
    width: calc(var(--d) - 0.75rem);
    height: calc(var(--d) - 0.75rem);
    min-width: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    font-family: var(--font-num);
    font-size: calc(var(--d) * 0.32);
    line-height: 1;
  }
  .ring :global(.stat:hover) {
    background: var(--paper-2);
  }
  .label {
    margin-top: 0.4rem;
    font-family: var(--font-title);
    font-size: 1.15rem;
    line-height: 1.1;
    letter-spacing: 0.04em;
    /* The font's lowercase glyphs are small caps: lowercase everything for even labels (FOR, Contact…). */
    text-transform: lowercase;
    white-space: nowrap;
    color: var(--ink);
  }
  .sub {
    margin-top: 0.1rem;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
</style>
