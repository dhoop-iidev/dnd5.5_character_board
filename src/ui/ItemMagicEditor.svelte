<script lang="ts">
  // The magic part of an inventory item, in its Equipment edit row: the variant (+1/+2/+3, giant type, scroll level), the
  // base weapon or armor of an SRD magic weapon or armor, the item's choices (damage type, dragon color, Ioun stone type:
  // stored per instance under `item:<uid>`, ui/ChoiceEditor.svelte), the spells it holds (a Spell Scroll's, a Ring of Spell
  // Storing's, a custom wand's) and the charges of a custom item. SRD 5.2.1 "Magic Items" (p. 206: charges, spells cast
  // from items).
  import { rules } from '../data/rules'
  import type { ItemInstance } from '../model/character'
  import type { Owner } from '../engine/sheet/types'
  import { magicEffectOf, magicItemOf } from '../engine/items'
  import { spellItemInfo } from '../engine/spellItems'
  import { tr } from '../state.svelte'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import { norm } from './items'
  import { RARITY } from './items'

  let { item }: { item: ItemInstance } = $props()

  const mdef = $derived(magicItemOf(item, rules))
  const effect = $derived(magicEffectOf(item, rules))
  const info = $derived(spellItemInfo(item, rules))
  /** A fake owner for ChoiceEditor: the choices of this instance are stored under `item:<uid>`. */
  const owner = $derived<Owner | undefined>(
    effect?.choices?.length && mdef
      ? {
          id: `item:${item.uid}`,
          kind: 'item',
          name: mdef.name,
          effect,
          eff: effect,
          modifiers: [],
          grants: [],
          choiceValues: {},
        }
      : undefined,
  )
  const bases = $derived(
    !item.magicItemId
      ? []
      : item.kind === 'weapon'
        ? [...rules.weapons.values()]
        : [...rules.armor.values()].filter(
            (a) => (a.category === 'shield') === (rules.armor.get(item.refId ?? '')?.category === 'shield'),
          ),
  )
  /** Any item can be given spells cast from it (SRD p. 206 "Spells Cast from Items": a sword that casts Light at will, a
   * ring usable once per dawn, a wand with charges); potions and oils confer an effect instead. */
  const holdsSpells = $derived(!info?.def?.consumable || !!info?.def?.scroll)
  /** The item has charges (SRD or set below), so a spell can cost charges. */
  const hasCharges = $derived(info?.maxCharges !== undefined || !!info?.chargesDice)
  type Usage = 'atWill' | 'perDay' | 'charges'
  const usageOf = (s: NonNullable<typeof item.spells>[number]): Usage =>
    s.perDay ? 'perDay' : s.atWill || !hasCharges ? 'atWill' : 'charges'
  function setUsage(s: NonNullable<typeof item.spells>[number], u: Usage) {
    delete s.perDay
    delete s.atWill
    if (u === 'perDay') s.perDay = 1
    else if (u === 'atWill') s.atWill = true
  }
  const num = (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value
    return v === '' ? undefined : Number(v)
  }
  /** Charges set by hand: an item without SRD charges. */
  const customCharges = $derived(info?.def?.charges === undefined)

  let spellQuery = $state('')
  const spellFound = $derived(
    spellQuery.trim().length < 2
      ? []
      : [...rules.spells.values()]
          .filter(
            (s) =>
              norm(s.name.en).includes(norm(spellQuery)) ||
              norm(s.name.fr).includes(norm(spellQuery)) ||
              norm(s.name.es ?? '').includes(norm(spellQuery)),
          )
          .slice(0, 12),
  )
  function addSpell(id: string) {
    item.spells = [...(item.spells ?? []), { spellId: id }]
    spellQuery = ''
  }
  function removeSpell(i: number) {
    item.spells = (item.spells ?? []).filter((_, k) => k !== i)
  }
  function setMax(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value
    item.maxCharges = v === '' ? undefined : Math.max(0, Math.floor(Number(v)))
    if (item.maxCharges !== undefined && item.charges === undefined) item.charges = item.maxCharges
  }
  function setRecharge(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value.trim()
    item.recharge = v || undefined
  }
</script>

{#if true}
  <div class="magic">
    {#if mdef?.variants?.length}
      <label
        >{tr({ en: 'Variant', fr: 'Variante', es: 'Variante' })}
        <select
          value={item.variant ?? 0}
          onchange={(e) => (item.variant = Number((e.currentTarget as HTMLSelectElement).value))}
        >
          {#each mdef.variants as v, i (i)}
            <option value={i}
              >{tr(v.name)} ({tr(RARITY[v.rarity] ?? { en: v.rarity, fr: v.rarity, es: v.rarity })})</option
            >
          {/each}
        </select>
      </label>
    {/if}
    {#if bases.length}
      <label
        >{item.kind === 'weapon'
          ? tr({ en: 'Base weapon', fr: 'Arme de base', es: 'Arma base' })
          : tr({ en: 'Base armor', fr: 'Armure de base', es: 'Armadura base' })}
        <select bind:value={item.refId}>
          {#each bases as b (b.id)}<option value={b.id}>{tr(b.name)}</option>{/each}
        </select>
      </label>
    {/if}
    {#if owner}
      <div class="wide">
        {#key owner.id}<ChoiceEditor {owner} />{/key}
      </div>
    {/if}
    {#if effect?.textOnly}
      <p class="wide note">
        {tr({ en: 'Not computed', fr: 'Non calculé', es: 'No calculado' })} : {tr(effect.textOnly)}
      </p>
    {/if}
    {#if holdsSpells}
      <div class="wide">
        <span class="tag"
          >{tr({
            en: 'Spells cast from this item',
            fr: 'Sorts lancés depuis cet objet',
            es: 'Conjuros lanzados desde este objeto',
          })}</span
        >
        <ul class="spells">
          {#each item.spells ?? [] as s, i (i)}
            <li>
              {tr(rules.spells.get(s.spellId)?.name ?? { en: s.spellId, fr: s.spellId, es: s.spellId })}
              {#if !info?.def?.scroll}
                <select
                  value={usageOf(s)}
                  onchange={(e) => setUsage(s, (e.currentTarget as HTMLSelectElement).value as Usage)}
                  aria-label={tr({ en: 'Usage', fr: 'Utilisation', es: 'Uso' })}
                >
                  <option value="atWill">{tr({ en: 'at will', fr: 'à volonté', es: 'a voluntad' })}</option>
                  <option value="perDay">{tr({ en: 'per dawn', fr: 'par aube', es: 'por amanecer' })}</option>
                  {#if hasCharges}<option value="charges">{tr({ en: 'charges', fr: 'charges', es: 'cargas' })}</option
                    >{/if}
                </select>
                {#if s.perDay}
                  <label class="inline"
                    >×<input type="number" min="1" value={s.perDay} onchange={(e) => (s.perDay = num(e) || 1)} /></label
                  >
                {:else if usageOf(s) === 'charges'}
                  <label class="inline"
                    >{tr({ en: 'cost', fr: 'coût', es: 'coste' })}
                    <input
                      type="number"
                      min="0"
                      value={s.chargeCost ?? 1}
                      onchange={(e) => (s.chargeCost = num(e))}
                    /></label
                  >
                {/if}
                <label class="inline"
                  >{tr({ en: 'level', fr: 'niveau', es: 'nivel' })}
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={s.level ?? ''}
                    onchange={(e) => (s.level = num(e))}
                  /></label
                >
                <label
                  class="inline"
                  title={tr({
                    en: 'Save DC fixed by the item; empty = yours',
                    fr: 'DD fixé par l’objet ; vide = le vôtre',
                    es: 'CD fijada por el objeto; vacío = la tuya',
                  })}
                  >{tr({ en: 'DC', fr: 'DD', es: 'CD' })}
                  <input type="number" min="1" value={s.dc ?? ''} onchange={(e) => (s.dc = num(e))} /></label
                >
              {/if}
              <button onclick={() => removeSpell(i)} aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}
                >✕</button
              >
            </li>
          {/each}
        </ul>
        <input
          type="search"
          bind:value={spellQuery}
          placeholder={tr({ en: 'Add a spell…', fr: 'Ajouter un sort…', es: 'Añadir un conjuro…' })}
        />
        {#if spellFound.length}
          <ul class="found">
            {#each spellFound as s (s.id)}
              <li><button onclick={() => addSpell(s.id)}>＋ {tr(s.name)}</button></li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    {#if customCharges && !info?.def?.consumable}
      <label
        >{tr({ en: 'Maximum charges', fr: 'Charges maximum', es: 'Cargas máximas' })}
        <input type="number" min="0" value={item.maxCharges ?? ''} onchange={setMax} />
      </label>
      <label
        >{tr({ en: 'Regained at dawn', fr: 'Récupérées à l’aube', es: 'Recuperadas al amanecer' })}
        <input
          type="text"
          placeholder="1d6 + 1"
          value={item.recharge ?? ''}
          onchange={setRecharge}
          title={tr({
            en: 'Dice, a number, or “all”',
            fr: 'Dés, un nombre, ou « all » (toutes)',
            es: 'Dados, un número o «all» (todas)',
          })}
        />
      </label>
    {/if}
  </div>
{/if}

<style>
  .magic {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.6rem 0.9rem;
    padding-bottom: 0.8rem;
    margin-bottom: 0.4rem;
    border-bottom: 1px solid var(--rule);
  }
  .wide {
    grid-column: 1 / -1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
  }
  label.inline {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.6rem;
  }
  label.inline input {
    width: 3.5rem;
  }
  select,
  input {
    font: inherit;
    min-height: 2.4rem;
  }
  .tag {
    font-variant: small-caps;
    font-weight: 600;
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  ul {
    list-style: none;
    margin: 0.3rem 0;
    padding: 0;
  }
  .spells li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0;
  }
  button {
    font: inherit;
    min-height: 2.4rem;
    min-width: 2.4rem;
  }
  .found li button {
    width: 100%;
    text-align: left;
  }
</style>
