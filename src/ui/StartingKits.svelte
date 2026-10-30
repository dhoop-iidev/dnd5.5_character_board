<script lang="ts">
  // The Builder's starting equipment step (SRD 5.2.1 p. 20, FR p. 21): the class's and the background's options (A, B
  // or C). Picking one replaces the inventory and the coins (ui/creation.ts `applyKits`), so it is shown only while
  // creating the character.
  import { rules } from '../data/rules'
  import { backgroundDef } from '../model/customBackground'
  import { BACKGROUND_KITS, CLASS_KITS, type KitItem, type KitOption } from '../model/startingEquipment'
  import { app, lang, tr } from '../state.svelte'
  import { applyKits, type Kits } from './creation'

  let { kits }: { kits: Kits } = $props()

  const c = $derived(app.character)
  const classId = $derived(c.levels[0].classId)
  const cls = $derived(rules.classes.get(classId))
  const bg = $derived(backgroundDef(c.background, rules))
  const classKits = $derived(CLASS_KITS[classId] ?? [])
  const bgKits = $derived(BACKGROUND_KITS[c.background.backgroundId] ?? [])
  const chooser = $derived(classKits.find((o) => o.letter === kits.classKit)?.items.find((k) => k.choose))

  function itemLabel(k: KitItem, id = k.id): string {
    const def =
      k.kind === 'weapon'
        ? rules.weapons.get(id ?? '')
        : k.kind === 'armor'
          ? rules.armor.get(id ?? '')
          : k.kind === 'gear'
            ? rules.gear.get(id ?? '')
            : undefined
    const n = tr(k.name ?? def?.name) || k.text
    return (k.qty ?? 1) > 1 ? `${k.qty} × ${n}` : n
  }
  const gpText = (n: number) => `${n} ${lang() === 'en' ? 'GP' : 'po'}`
  const optionText = (o: KitOption) =>
    [...o.items.map((k) => (k.choose ? itemLabel(k, kits.picks[k.text] ?? k.id) : itemLabel(k))), gpText(o.gp)].join(
      ', ',
    )
  function set(patch: Partial<Kits>) {
    Object.assign(kits, patch)
    applyKits(c, kits)
  }
</script>

<div class="kit" role="radiogroup" aria-label={tr(cls?.name)}>
  <span class="lab">{tr(cls?.name)}</span>
  {#each classKits as o (o.letter)}
    <label class="opt" class:on={kits.classKit === o.letter}>
      <input
        type="radio"
        name="class-kit"
        value={o.letter}
        checked={kits.classKit === o.letter}
        onchange={() => set({ classKit: o.letter })}
      />
      <b>{o.letter}</b>
      <span>{optionText(o)}</span>
    </label>
  {/each}
  {#if chooser}
    <label class="pick"
      >{tr({
        en: 'Artisan’s Tools or Musical Instrument',
        fr: 'Outils d’artisan ou instrument de musique',
        es: 'Herramientas de artesano o instrumento musical',
      })}
      <select
        value={kits.picks[chooser.text] ?? chooser.id}
        onchange={(e) => set({ picks: { ...kits.picks, [chooser.text]: e.currentTarget.value } })}
      >
        {#each chooser.choose ?? [] as id (id)}<option value={id}>{tr(rules.gear.get(id)?.name)}</option>{/each}
      </select>
    </label>
  {/if}
</div>
<div class="kit" role="radiogroup" aria-label={tr(bg?.name)}>
  <span class="lab">{tr(bg?.name)}</span>
  {#each bgKits as o (o.letter)}
    <label class="opt" class:on={kits.backgroundKit === o.letter}>
      <input
        type="radio"
        name="bg-kit"
        value={o.letter}
        checked={kits.backgroundKit === o.letter}
        onchange={() => set({ backgroundKit: o.letter })}
      />
      <b>{o.letter}</b>
      <span>{optionText(o)}</span>
    </label>
  {/each}
</div>
<p class="hint">
  {tr({
    en: 'Picking an option replaces the inventory and the coins. Armor, Shield and weapons are worn, one weapon (and the Shield) in hand; the rest goes in the backpack. Coins can be spent on equipment right away (SRD p. 20).',
    fr: 'Choisir une option remplace l’inventaire et les pièces. Armure, bouclier et armes sont portés, une arme (et le bouclier) en main ; le reste va dans le sac. Les pièces peuvent aussitôt se dépenser en équipement (SRD p. 21).',
    es: 'Elegir una opción sustituye el inventario y las monedas. La armadura, el escudo y las armas se llevan puestos, un arma (y el escudo) en la mano; el resto va a la mochila. Las monedas pueden gastarse en equipo de inmediato (SRD p. 22).',
  })}
</p>

<style>
  .kit {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }
  .lab {
    font-family: var(--font-title);
  }
  .opt {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    cursor: pointer;
  }
  .opt.on {
    border-color: var(--frame);
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .opt b {
    font-family: var(--font-num);
  }
  .opt input {
    margin: 0;
    accent-color: var(--accent);
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-left: 1.5rem;
    font-family: var(--font-title);
  }
  .pick select {
    min-height: 2.75rem;
    font: inherit;
  }
  .hint {
    font-size: 0.92em;
    color: var(--ink-soft);
    margin: 0;
  }
</style>
