<script lang="ts">
  // Equipment pane: the paper doll first (Attunement, worn kinds, other worn items, picture), then one table per
  // location (worn / carried / stored) with magic items marked ✦, then money (coins and a free-text line of gems and jewelry), carrying capacity and adding items (SRD
  // or custom). Weapons and the Shield in hand are chosen in the Combat pane; the table only shows their state.
  import { rules } from '../../data/rules'
  import type { I18n } from '../../data/types'
  import type { ItemInstance, ItemLocation } from '../../model/character'
  import { SRC } from '../../engine/sheet/common'
  import { UI } from '../../i18n/ui'
  import { app, lang, tr, view } from '../../state.svelte'
  import { fmtWeight } from '../format'
  import {
    canAttune,
    canHold,
    catalog,
    fmtGp,
    isMagic,
    isShield,
    WORN_KINDS,
    wornKindOf,
    itemCostGp,
    itemName,
    itemStats,
    itemWeight,
    newItem,
    catalogSummary,
    itemEffectLine,
    norm,
    openItem,
  } from '../items'
  import { effectStatus } from '../itemEffects'
  import ItemMagicEditor from '../ItemMagicEditor.svelte'
  import { openPopup } from '../popupState.svelte'
  import CustomItemForm from '../CustomItemForm.svelte'
  import EquipmentDoll from '../EquipmentDoll.svelte'
  import WarningList from '../WarningList.svelte'

  const c = $derived(app.character)
  const carry = $derived(view.sheet.carry)

  const LOCATIONS: { id: ItemLocation; label: I18n }[] = [
    // SRD 5.2.1 "Weapons": drawing a weapon is part of the attack; a backpack item takes a Utilize action to get.
    { id: 'worn', label: { en: 'Worn (on the body)', fr: 'Porté (sur soi)', es: 'Llevado (encima)' } },
    { id: 'carried', label: { en: 'Carried (backpack)', fr: 'Transporté (sac à dos)', es: 'Transportado (mochila)' } },
    {
      id: 'stored',
      label: { en: 'Stored (not carried)', fr: 'Entreposé (non transporté)', es: 'Guardado (no transportado)' },
    },
  ]

  /** Item whose edit form is open (uid). */
  let editing = $state<string | null>(null)
  const kindLabel = (item: ItemInstance) => {
    const k = wornKindOf(item)
    return k ? WORN_KINDS.find((x) => x.id === k)!.name : undefined
  }

  // ---- search in the SRD catalog
  let query = $state('')
  const all = catalog()
  const found = $derived(
    query.trim().length < 2
      ? []
      : all
          .filter(
            (x) =>
              norm(x.name.en).includes(norm(query)) ||
              norm(x.name.fr).includes(norm(query)) ||
              norm(x.name.es ?? '').includes(norm(query)),
          )
          .slice(0, 30),
  )
  function add(kind: ItemInstance['kind'], refId: string) {
    // A new weapon or Shield goes on the body, ready to be taken in hand; anything else into the backpack (ui/items.ts
    // `newItem`: an SRD magic weapon or armor on its base item, charges full).
    c.inventory.push(newItem(kind, refId))
    query = ''
  }
  function remove(uid: string) {
    c.inventory = c.inventory.filter((i) => i.uid !== uid)
  }
  function setQty(item: ItemInstance, delta: number) {
    item.quantity = Math.max(0, item.quantity + delta)
    if (item.quantity === 0) remove(item.uid)
  }
  /** Leaving the body also leaves the hands; a stored item can't stay attuned (Rules Glossary "Attunement"). */
  function moved(item: ItemInstance) {
    if (item.location !== 'worn') item.equipped = false
    if (item.location === 'stored') item.attuned = false
  }
  const times = (w: { lb: number; kg: number }, n: number) => ({ lb: w.lb * n, kg: w.kg * n })

  // ---- coins (SRD 5.2.1 "Coins": 1 PP = 10 GP, 1 EP = 5 SP, 1 GP = 10 SP = 100 CP)
  const COINS = [
    { key: 'pp', en: 'PP', fr: 'pp', es: 'ppt', gp: 10 },
    { key: 'gp', en: 'GP', fr: 'po', es: 'po', gp: 1 },
    { key: 'ep', en: 'EP', fr: 'pe', es: 'pe', gp: 0.5 },
    { key: 'sp', en: 'SP', fr: 'pa', es: 'pp', gp: 0.1 },
    { key: 'cp', en: 'CP', fr: 'pc', es: 'pc', gp: 0.01 },
  ] as const
  const totalGp = $derived(COINS.reduce((s, k) => s + (c.money[k.key] || 0) * k.gp, 0))
  const wealthGp = $derived(c.inventory.reduce((s, i) => s + (itemCostGp(i) ?? 0) * i.quantity, 0))

  // ---- load
  const pct = $derived(carry.capacity.lb ? Math.min(100, (carry.load.lb / carry.capacity.lb) * 100) : 0)
  function capacityPopup() {
    const str = view.sheet.abilities.str.score.total
    openPopup({
      title: { en: 'Carrying capacity', fr: 'Capacité de charge', es: 'Capacidad de carga' },
      lines: [
        {
          en: `Strength ${str} × 15 = ${fmtWeight(carry.capacity, 'en')} (Small or Medium; Tiny × 7.5, Large or Powerful Build × 30).`,
          fr: `Force ${str} × 15 = ${fmtWeight(carry.capacity, 'fr')} (taille P ou M ; TP × 7,5, taille G ou Carrure puissante × 30).`,
          es: `Fuerza ${str} × 15 = ${fmtWeight(carry.capacity, 'es')} (Pequeño o Mediano; Diminuto × 7,5, Grande o Constitución poderosa × 30).`,
        },
        {
          en: `Drag, lift or push: up to ${fmtWeight(carry.dragLiftPush, 'en')}; beyond what you can carry, Speed 5 feet at most.`,
          fr: `Tirer, soulever ou pousser : jusqu’à ${fmtWeight(carry.dragLiftPush, 'fr')} ; au-delà de ce que vous pouvez porter, Vitesse de 1,5 m au plus.`,
          es: `Arrastrar, levantar o empujar: hasta ${fmtWeight(carry.dragLiftPush, 'es')}; por encima de lo que puedes cargar, velocidad de 1,5 m como máximo.`,
        },
        {
          en: `Carried now: ${fmtWeight(carry.load, 'en')} (worn and backpack; stored items don't count).`,
          fr: `Porté actuellement : ${fmtWeight(carry.load, 'fr')} (sur soi et dans le sac ; les objets entreposés ne comptent pas).`,
          es: `Transportado ahora: ${fmtWeight(carry.load, 'es')} (encima y en la mochila; los objetos guardados no cuentan).`,
        },
      ],
      html: rules.glossary.get('carrying-capacity')?.text,
      source: SRC.carrying,
    })
  }
  function coinsPopup() {
    openPopup({
      title: { en: 'Coins', fr: 'Pièces', es: 'Monedas' },
      lines: [
        {
          en: '1 PP = 10 GP · 1 GP = 10 SP = 100 CP · 1 EP = 5 SP.',
          fr: '1 pp = 10 po · 1 po = 10 pa = 100 pc · 1 pe = 5 pa.',
          es: '1 ppt = 10 po · 1 po = 10 pp = 100 pc · 1 pe = 5 pp.',
        },
        {
          en: `Total ${fmtGp(totalGp, 'en')}.`,
          fr: `Total ${fmtGp(totalGp, 'fr')}.`,
          es: `Total ${fmtGp(totalGp, 'es')}.`,
        },
      ],
      source: { page: 89, frPage: 95, section: 'Equipment > Coins' },
    })
  }
</script>

<div class="grid">
  <EquipmentDoll />

  {#each LOCATIONS as loc (loc.id)}
    {@const items = c.inventory.filter((i) => i.location === loc.id)}
    {#if items.length}
      <section class="box">
        <h3>{tr(loc.label)}</h3>
        <table>
          <thead>
            <tr>
              <th>{tr({ en: 'Item', fr: 'Objet', es: 'Objeto' })}</th>
              <th class="num">{tr({ en: 'Qty', fr: 'Qté', es: 'Cant.' })}</th>
              <th class="num">{tr({ en: 'Weight', fr: 'Poids', es: 'Peso' })}</th>
              <th class="num">{tr({ en: 'Price', fr: 'Prix', es: 'Precio' })}</th>
              <th>{tr({ en: 'Where', fr: 'Où', es: 'Dónde' })}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.uid)}
              {@const w = itemWeight(item)}
              {@const cost = itemCostGp(item)}
              {@const stats = itemStats(item)}
              {@const effect = itemEffectLine(item)}
              <tr class:magic={isMagic(item)}>
                <td>
                  {#if isMagic(item)}<span
                      class="arcane"
                      title={tr({ en: 'Magic item', fr: 'Objet magique', es: 'Objeto mágico' })}>✦</span
                    >{/if}
                  <button class="link" onclick={() => openItem(item)}>{tr(itemName(item))}</button>
                  {#if stats}<small>{tr(stats)}</small>{/if}
                  {#if effect && (effect.en || effect.fr)}
                    {@const st = effectStatus(item)}
                    <small class="effect" class:inactive={!st.active} title={st.reason ? tr(st.reason) : undefined}
                      >{tr(effect)}{#if !st.active}
                        ({tr(st.reason ?? { en: 'inactive', fr: 'inactif', es: 'inactivo' })}){/if}</small
                    >
                  {/if}
                  {#if loc.id === 'worn' && kindLabel(item)}<small class="state">{tr(kindLabel(item))}</small>{/if}
                  {#if item.equipped && loc.id === 'worn'}
                    <small
                      class="state"
                      title={tr({
                        en: 'Chosen in the Combat pane',
                        fr: 'Choisi dans le volet Combat',
                        es: 'Elegido en la pestaña Combate',
                      })}>{tr({ en: 'in hand', fr: 'en main', es: 'en la mano' })}</small
                    >
                  {:else if canHold(item) && loc.id === 'worn'}
                    <small class="state"
                      >{tr(
                        isShield(item)
                          ? { en: 'slung', fr: 'en bandoulière', es: 'colgado' }
                          : { en: 'sheathed', fr: 'au fourreau', es: 'envainado' },
                      )}</small
                    >
                  {/if}
                  {#if item.attuned}<small class="state attuned"
                      >{tr({ en: 'attuned', fr: 'harmonisé', es: 'sintonizado' })}</small
                    >{/if}
                </td>
                <td class="num qty">
                  <button onclick={() => setQty(item, -1)} aria-label="−1">−</button>
                  {item.quantity}
                  <button onclick={() => setQty(item, 1)} aria-label="+1">+</button>
                </td>
                <td class="num">{w ? fmtWeight(times(w, item.quantity), lang()) : '—'}</td>
                <td class="num">{cost !== undefined ? fmtGp(cost, lang()) : '—'}</td>
                <td>
                  <select
                    bind:value={item.location}
                    onchange={() => moved(item)}
                    aria-label={tr({ en: 'Location', fr: 'Emplacement', es: 'Ubicación' })}
                  >
                    {#each LOCATIONS as l (l.id)}<option value={l.id}>{tr(l.label)}</option>{/each}
                  </select>
                </td>
                <td class="actions">
                  {#if loc.id !== 'stored' && canAttune(item)}
                    <label class="chk"
                      ><input type="checkbox" bind:checked={item.attuned} />{tr({
                        en: 'Attuned',
                        fr: 'Harmonisé',
                        es: 'Sintonizado',
                      })}</label
                    >
                  {/if}
                  <button
                    class="edit"
                    class:on={editing === item.uid}
                    onclick={() => (editing = editing === item.uid ? null : item.uid)}
                    title={tr({
                      en: 'Edit (name, bonuses, worn kind…)',
                      fr: 'Modifier (nom, bonus, type porté…)',
                      es: 'Editar (nombre, bonificadores, tipo llevado…)',
                    })}
                    aria-label={tr({ en: 'Edit', fr: 'Modifier', es: 'Editar' })}>✎</button
                  >
                  <button
                    class="del"
                    onclick={() => remove(item.uid)}
                    aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
                  >
                </td>
              </tr>
              {#if editing === item.uid}
                <tr class="editor">
                  <td colspan="6">
                    {#key item.uid}<ItemMagicEditor {item} /><CustomItemForm
                        {item}
                        onclose={() => (editing = null)}
                      />{/key}
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </section>
    {/if}
  {/each}

  <section class="box">
    <h3>{tr(UI.money)}</h3>
    <div class="money">
      {#each COINS as k (k.key)}
        <label>{tr({ en: k.en, fr: k.fr, es: k.es })}<input type="number" min="0" bind:value={c.money[k.key]} /></label>
      {/each}
      <button class="link total" onclick={coinsPopup}>= {fmtGp(totalGp, lang())}</button>
    </div>
    <label class="valuables">
      <span
        >{tr({
          en: 'Gems, jewelry, art objects…',
          fr: 'Gemmes, bijoux, objets d’art…',
          es: 'Gemas, joyas, objetos de arte…',
        })}</span
      >
      <textarea
        rows="3"
        lang={lang()}
        bind:value={c.valuables}
        placeholder={tr({
          en: 'e.g. 2 pearls (100 GP each), a gold ring set with a ruby…',
          fr: 'ex. 2 perles (100 po chacune), une bague en or sertie d’un rubis…',
          es: 'p. ej., 2 perlas (100 po cada una), un anillo de oro con un rubí…',
        })}></textarea>
      <small
        >{tr({
          en: 'Weightless here: not counted in the load.',
          fr: 'Sans poids ici : non comptés dans la charge.',
          es: 'Sin peso aquí: no cuentan en la carga.',
        })}</small
      >
    </label>
    <p class="total">
      {tr({ en: 'Value of the items', fr: 'Valeur des objets', es: 'Valor de los objetos' })} : {fmtGp(
        wealthGp,
        lang(),
      )}
    </p>
  </section>

  <section class="box">
    <h3>{tr({ en: 'Load', fr: 'Charge', es: 'Carga' })}</h3>
    <div class="load">
      <strong>{fmtWeight(carry.load, lang())}</strong>
      <span class="band" class:over={carry.encumbered}>
        {carry.encumbered
          ? tr({ en: 'over capacity', fr: 'au-delà de la capacité', es: 'por encima de la capacidad' })
          : tr({ en: 'carried', fr: 'portés', es: 'transportados' })}
      </span>
      <button class="link limits" onclick={capacityPopup}>
        {tr({ en: 'Carrying capacity', fr: 'Capacité de charge', es: 'Capacidad de carga' })}
        {fmtWeight(carry.capacity, lang())} ·
        {tr({ en: 'drag, lift or push', fr: 'tirer, soulever ou pousser', es: 'arrastrar, levantar o empujar' })}
        {fmtWeight(carry.dragLiftPush, lang())}
      </button>
    </div>
    <div class="bar" role="meter" aria-valuenow={carry.load.lb} aria-valuemin={0} aria-valuemax={carry.capacity.lb}>
      <div class="fill" class:over={carry.encumbered} style="width: {pct}%"></div>
    </div>
    <WarningList areas={['inventory']} />
  </section>

  <section class="box">
    <h3>{tr({ en: 'Add an item', fr: 'Ajouter un objet', es: 'Añadir un objeto' })}</h3>
    <input
      type="search"
      bind:value={query}
      placeholder={tr({
        en: 'Search weapons, armor, gear, magic items…',
        fr: 'Chercher armes, armures, équipement, objets magiques…',
        es: 'Buscar armas, armaduras, equipo, objetos mágicos…',
      })}
    />
    {#if found.length}
      <ul class="results">
        {#each found as f (f.kind + f.id)}
          {@const sum = catalogSummary(f.kind, f.id)}
          <li>
            <button onclick={() => add(f.kind, f.id)}
              >＋ {tr(f.name)} <small>{tr(f.group)}</small>{#if sum}<small class="sum">{tr(sum)}</small>{/if}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <CustomItemForm oncreated={(uid) => (editing = uid)} />
  </section>
</div>

<style>
  .grid {
    display: grid;
    gap: 1.25rem;
  }
  tr.magic td:first-child {
    box-shadow: inset 3px 0 0 var(--arcane);
  }
  .arcane {
    margin-right: 0.2rem;
  }
  td {
    vertical-align: middle;
  }
  td small {
    display: block;
    color: var(--ink-soft);
    font-size: 0.8em;
  }
  td small.state {
    display: inline-block;
    margin-right: 0.6em;
    font-style: italic;
  }
  td small.attuned {
    color: var(--arcane);
  }
  td small.effect {
    color: var(--ink);
  }
  td small.effect.inactive {
    color: var(--ink-soft);
    font-style: italic;
  }
  .results small.sum {
    display: block;
    color: var(--ink-soft);
    font-size: 0.8em;
  }
  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0.25em 0;
    min-height: 2.75rem;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-underline-offset: 0.22em;
  }
  .link:hover {
    color: var(--accent);
  }
  .qty button,
  .results button {
    font: inherit;
    min-height: 2.75rem;
    min-width: 2.75rem;
    padding: 0 0.6rem;
  }
  .results button:hover,
  .qty button:hover {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  select {
    min-height: 2.75rem;
    padding: 0 0.4rem;
    max-width: 11rem;
  }
  .actions {
    white-space: nowrap;
    text-align: right;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.9em;
    margin-right: 0.5rem;
    min-height: 2.75rem;
  }
  .edit {
    border-color: transparent;
    background: transparent;
    color: var(--ink-soft);
    min-width: 2.75rem;
    min-height: 2.75rem;
  }
  .edit.on,
  .edit:hover {
    border-color: var(--rule-strong);
    color: var(--ink);
  }
  tr.editor td {
    padding-top: 0;
  }
  .del {
    color: var(--danger);
    border-color: transparent;
    background: transparent;
    min-width: 2.75rem;
    min-height: 2.75rem;
  }
  .money {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: flex-end;
  }
  .money label {
    display: flex;
    flex-direction: column;
    font-family: var(--font-title);
  }
  .money input {
    width: 6.5rem;
    min-height: 2.5rem;
    padding: 0 0.5rem;
  }
  .money .total {
    font-family: var(--font-num);
    font-size: 1.1em;
    min-height: 2.5rem;
  }
  .valuables {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.8rem;
  }
  .valuables > span {
    font-family: var(--font-title);
  }
  .valuables textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.45rem 0.6rem;
    font: inherit;
    line-height: 1.4;
    resize: vertical;
  }
  .valuables small {
    color: var(--ink-soft);
  }
  p.total {
    margin: 0.6rem 0 0;
    font-size: 0.9em;
    color: var(--ink-soft);
  }
  .load {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: baseline;
  }
  .load strong {
    font-family: var(--font-num);
    font-size: 1.5em;
  }
  .band {
    font-family: var(--font-title);
    letter-spacing: 0.06em;
    font-size: 1.1em;
  }
  .band.over {
    color: var(--danger);
  }
  .limits {
    color: var(--ink-soft);
    font-size: 0.9em;
    min-height: 2rem;
  }
  .bar {
    position: relative;
    height: 0.6rem;
    margin: 0.6rem 0;
    border: 1px solid var(--frame);
    background: var(--box);
    border-radius: 1px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--ink);
  }
  .fill.over {
    background: var(--danger);
  }
  input[type='search'] {
    width: 100%;
    min-height: 2.75rem;
    padding: 0 0.7rem;
    margin-bottom: 0.5rem;
  }
  .results {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .results small {
    color: var(--ink-soft);
    font-style: italic;
  }
  @media (max-width: 40rem) {
    .box table thead {
      display: none;
    }
    .box table tr {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem 0.6rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--rule);
    }
    .box td {
      border: none;
      padding: 0.1em 0.2em;
    }
    .box td:first-child {
      flex-basis: 100%;
    }
  }
</style>
