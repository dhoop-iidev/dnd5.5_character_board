<script lang="ts">
  // Round medallion (ability scores, AC, saves…): a ringed value with a small-caps label.
  import type { Snippet } from 'svelte'

  let {
    label,
    sub,
    size = 'md',
    children,
    badge,
  }: { label: string; sub?: string; size?: 'sm' | 'md' | 'lg'; children: Snippet; badge?: Snippet } = $props()
</script>

<div class="medallion {size}">
  <div class="ring">{@render children()}</div>
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
