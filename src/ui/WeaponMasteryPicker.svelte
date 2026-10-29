<script lang="ts">
  // Weapon Mastery picks, in the Combat pane's Attacks box (user request 2026-10-28): they are not tied to a level, since
  // they can change after every Long Rest (Barbarian p. 29 and Fighter p. 48: one of them; Paladin p. 54, Ranger p. 59,
  // Rogue p. 62: any). Folded once the count is reached; weapons the character is proficient with come first.
  import { rules } from '../data/rules'
  import { weaponProficient } from '../engine/sheet/attacks'
  import { app, tr, view } from '../state.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const max = $derived(sheet.masteryMax)
  const proficient = (id: string) => {
    const w = rules.weapons.get(id)
    return !!w && weaponProficient({ ...sheet, char: c, rules }, w)
  }
  const weapons = $derived(
    [...rules.weapons.values()].sort(
      (a, b) => Number(proficient(b.id)) - Number(proficient(a.id)) || tr(a.name).localeCompare(tr(b.name)),
    ),
  )
  function toggle(id: string) {
    const i = c.weaponMastery.indexOf(id)
    if (i >= 0) c.weaponMastery.splice(i, 1)
    else c.weaponMastery.push(id)
  }
</script>

{#if max}
  <details class="mastery" open={c.weaponMastery.length !== max}>
    <summary
      >{tr({ en: 'Weapon Mastery', fr: 'Bottes d’arme', es: 'Maestría con armas' })} ({c.weaponMastery.length} / {max})</summary
    >
    <p class="hint">
      {tr({
        en: 'After a Long Rest you can change these weapons (Barbarian and Fighter: one of them).',
        fr: 'Après un repos long, vous pouvez changer ces armes (Barbare et Guerrier : une seule).',
        es: 'Tras un descanso largo puedes cambiar estas armas (bárbaro y guerrero: solo una).',
      })}
    </p>
    <div class="chips">
      {#each weapons as w (w.id)}
        <label class="chip" class:on={c.weaponMastery.includes(w.id)} class:off={!proficient(w.id)}
          ><input type="checkbox" checked={c.weaponMastery.includes(w.id)} onchange={() => toggle(w.id)} />{tr(
            w.name,
          )}</label
        >
      {/each}
    </div>
  </details>
{/if}

<style>
  .mastery {
    margin: 0.6rem 0 0.3rem;
  }
  summary {
    cursor: pointer;
    font-family: var(--font-title);
    color: var(--accent);
  }
  .hint {
    color: var(--ink-soft);
    font-size: 0.85rem;
    margin: 0.3rem 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 999px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .chip.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chip.off {
    opacity: 0.6;
  }
  .chip input {
    margin: 0;
  }
</style>
