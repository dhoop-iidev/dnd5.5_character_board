<script lang="ts">
  // Paper doll: the character's picture (built-in, uploaded or removed, `images.doll`) with what the 2024 rules care
  // about around it.
  // - Left: the three Attunement stars (Rules Glossary "Attunement", SRD p. 177: no more than three items) and the other
  //   worn items (rings, amulets, belts…: no limit).
  // - Right: the six worn kinds of which only one can be worn at a time (SRD p. 103 "Multiple Items of the Same Kind",
  //   FR p. 109): headwear, cloak, armor, bracers, gloves or gauntlets, footwear. The 2024 rules have no body slots.
  // Weapons and the Shield in hand are chosen in the Combat pane (they can change during a fight); armor is chosen here
  // (donning takes 1 to 10 minutes, p. 92).
  import { rules } from '../data/rules'
  import type { I18n } from '../data/types'
  import type { ItemInstance, WornKind } from '../model/character'
  import { app, tr, view } from '../state.svelte'
  import { imageToDataUrl } from './images'
  import {
    canAttune,
    canHold,
    isMagic,
    itemName,
    itemStats,
    newItem,
    catalogSummary,
    RARITY,
    norm,
    openItem,
    WORN_KINDS,
    wornKindOf,
  } from './items'
  import { openPopup } from './popupState.svelte'

  type Box =
    | { id: 'attune'; label: I18n; hint: I18n }
    | { id: 'other'; label: I18n; hint: I18n }
    | { id: 'kind'; kind: WornKind; label: I18n; hint: I18n }
  const ATTUNE: Box = {
    id: 'attune',
    label: { en: 'Attuned', fr: 'Harmonisé', es: 'Sintonizado' },
    hint: {
      en: 'Magic item requiring Attunement',
      fr: 'Objet magique à harmoniser',
      es: 'Objeto mágico que requiere sintonización',
    },
  }
  const OTHER: Box = {
    id: 'other',
    label: { en: 'Other worn items', fr: 'Autres objets portés', es: 'Otros objetos llevados' },
    hint: {
      en: 'Rings, amulets, belts, clothes… (no limit)',
      fr: 'Anneaux, amulettes, ceintures, vêtements… (sans limite)',
      es: 'Anillos, amuletos, cinturones, ropa… (sin límite)',
    },
  }
  const KINDS: Box[] = WORN_KINDS.map((k) => ({ id: 'kind', kind: k.id, label: k.name, hint: k.hint }))
  const ATTUNE_MAX = 3 // Rules Glossary "Attunement", SRD 5.2.1 p. 177

  const inventory = $derived(app.character.inventory)
  const worn = $derived(inventory.filter((i) => i.location === 'worn'))
  const ofKind = (k: WornKind) => worn.filter((i) => wornKindOf(i) === k)
  /** Attuned items still with the character (an attuned item in the backpack keeps counting; a stored one is away). */
  const attuned = $derived(inventory.filter((i) => i.attuned && i.location !== 'stored'))
  const attuneMax = $derived(ATTUNE_MAX + view.sheet.pool.parts('attunement.max').reduce((s, p) => s + p.value, 0))
  /** Worn items of no kind, other than the weapons and Shields (those are in hand or sheathed: Combat pane). */
  const others = $derived(worn.filter((i) => !canHold(i) && !wornKindOf(i)))

  // ---- picker for an empty spot
  let picking = $state<Box | null>(null)
  let query = $state('')
  function fits(box: Box, i: ItemInstance): boolean {
    switch (box.id) {
      case 'attune':
        return canAttune(i) && !i.attuned
      case 'other':
        return !canHold(i) && !wornKindOf(i) && i.location !== 'worn'
      case 'kind':
        return wornKindOf(i) === box.kind && i.location !== 'worn'
    }
  }
  const owned = $derived(picking ? inventory.filter((i) => fits(picking!, i)) : [])
  /** Catalog entries that fit a spot (the kind is inferred on a probe item, as for an owned one). */
  const probeKind = (kind: ItemInstance['kind'], refId: string) =>
    wornKindOf({ uid: '', kind, refId, quantity: 1, location: 'worn' })
  const catalogForBox = $derived.by(() => {
    if (!picking) return []
    const box = picking
    const q = norm(query)
    const match = (name: I18n) =>
      !q || norm(name.en).includes(q) || norm(name.fr).includes(q) || norm(name.es ?? '').includes(q)
    type Entry = { kind: ItemInstance['kind']; id: string; name: I18n; note?: I18n }
    const magic: Entry[] = [...rules.magicItems.values()].map((m) => ({
      kind: 'magic',
      id: m.id,
      name: m.name,
      // The item's one-line summary (custom/summaries-items.json), else its rarity.
      note: catalogSummary('magic', m.id) ?? RARITY[m.rarity],
    }))
    const gear: Entry[] = [...rules.gear.values()]
      .filter((g) => g.kind === 'gear')
      .map((g) => ({ kind: 'gear', id: g.id, name: g.name, note: g.cost?.text }))
    let list: Entry[] = []
    if (box.id === 'attune') list = magic.filter((m) => rules.magicItems.get(m.id)?.attunement)
    else if (box.id === 'kind') {
      const armor: Entry[] =
        box.kind === 'armor'
          ? [...rules.armor.values()]
              .filter((a) => a.category !== 'shield')
              .map((a) => ({ kind: 'armor', id: a.id, name: a.name, note: a.cost.text }))
          : []
      list = [...armor, ...magic, ...gear].filter((x) => probeKind(x.kind, x.id) === box.kind)
    } else
      list = [
        ...magic.filter((m) => {
          const d = rules.magicItems.get(m.id)!
          return ['wondrous', 'ring', 'rod'].includes(d.kind) && !probeKind('magic', m.id)
        }),
        ...gear.filter((g) => !probeKind('gear', g.id)),
      ]
    return list.filter((x) => match(x.name)).slice(0, 40)
  })

  /** Put an item on: worn, or attuned. */
  function place(box: Box, item: ItemInstance) {
    if (box.id === 'attune') {
      item.attuned = true
      if (item.location === 'stored') item.location = 'carried'
    } else item.location = 'worn'
    picking = null
  }
  function addAndPlace(box: Box, kind: ItemInstance['kind'], refId: string) {
    inventory.push(newItem(kind, refId, box.id === 'attune' ? 'carried' : 'worn'))
    place(box, inventory[inventory.length - 1])
  }
  /** Take off (into the backpack) or end the Attunement. */
  function takeOff(box: Box, item: ItemInstance) {
    if (box.id === 'attune') item.attuned = false
    else item.location = 'carried'
  }
  function open(box: Box, item: ItemInstance | undefined) {
    if (item) openItem(item)
    else {
      picking = box
      query = ''
    }
  }
  function ruleOf(id: string) {
    const g = rules.glossary.get(id)
    if (g) openPopup({ title: g.name, html: g.text, source: g.source })
  }
  function kindsRule() {
    openPopup({
      title: {
        en: 'Multiple Items of the Same Kind',
        fr: 'Plusieurs objets du même type',
        es: 'Varios objetos del mismo tipo',
      },
      html: {
        en: '<p>You can’t wear more than one of certain magic items. You can’t normally wear more than one pair of footwear, one pair of gloves or gauntlets, one pair of bracers, one suit of armor, one item of headwear, or one cloak. The GM might make exceptions.</p><p><strong>Paired Items.</strong> Items that come in pairs—such as boots, bracers, gauntlets, and gloves—impart their benefits only if both items of the pair are worn.</p>',
        fr: '<p>Il est impossible de porter plus d’un de certains objets magiques. Vous ne pouvez normalement pas porter plus d’une paire de chaussures, une paire de gants ou de gantelets, une paire de brassards, une armure, un couvre-chef et une cape. Le MJ peut consentir des exceptions.</p><p><strong>Objets appariés.</strong> Les objets fournis par paires, tels que les bottes, brassards, gantelets et gants, n’octroient leurs bénéfices que si les deux éléments de la paire sont portés.</p>',
        es: '<p>En el caso de determinados objetos mágicos, no puedes llevar más de uno del mismo tipo. Normalmente, no puedes llevar más de un par de zapatos, un par de guantes o guanteletes, un par de brazales, una armadura, un objeto que cubra la cabeza o una capa. Tu GM podría hacer excepciones.</p><p><strong>Objetos emparejados.</strong> Los objetos que vienen en pares, como las botas, los brazales, guanteletes y guantes, solo proporcionan sus beneficios si se visten los dos miembros del mismo par.</p>',
      },
      source: { page: 103, frPage: 109, section: 'Magic Items > Multiple Items of the Same Kind' },
    })
  }

  // Paper-doll picture: the built-in illustration unless the player changed or removed it (as the 3.5 playboard).
  const DEFAULT_DOLL = `${import.meta.env.BASE_URL}images/fenrir-knight.webp`
  const dollSrc = $derived(app.character.images?.doll === null ? null : (app.character.images?.doll ?? DEFAULT_DOLL))
  async function pickDoll(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    ;(app.character.images ??= {}).doll = await imageToDataUrl(file, 1200)
    input.value = ''
  }
  function setDoll(value: string | null | undefined) {
    const images = (app.character.images ??= {})
    if (value === undefined) delete images.doll
    else images.doll = value
  }

  const dollWarnings = $derived(
    view.warnings.filter(
      (w) => w.id === 'attunement' || w.id.startsWith('attune-copy-') || w.id.startsWith('worn-kind-'),
    ),
  )
</script>

{#snippet spot(
  box: Box,
  item: ItemInstance | undefined,
  side: 'left' | 'right',
  label: I18n = box.label,
  star = false,
  over = false,
)}
  <div class="slot {side}" class:filled={!!item} class:over>
    <button class="frame" onclick={() => open(box, item)}>
      <span class="name">
        {#if item && (star || isMagic(item))}<span class="arcane">✦</span>{/if}
        {item ? tr(itemName(item)) : star ? '✦' : '—'}
      </span>
      {#if item && itemStats(item)}<small>{tr(itemStats(item))}</small>{/if}
    </button>
    <div class="label">
      <strong>{tr(label)}</strong>
      <small>{tr(box.hint)}</small>
    </div>
    {#if item}
      <button
        class="off"
        onclick={() => takeOff(box, item)}
        title={box.id === 'attune'
          ? tr({ en: 'End the Attunement', fr: 'Rompre l’harmonisation', es: 'Terminar la sintonización' })
          : tr({ en: 'Take off (into the backpack)', fr: 'Retirer (dans le sac)', es: 'Quitarse (a la mochila)' })}
        >⤓</button
      >
    {/if}
  </div>
{/snippet}

<section class="box doll">
  <h3>{tr({ en: 'On the body', fr: 'Sur soi', es: 'Encima' })}</h3>
  <div class="layout">
    <div class="side">
      {#each Array.from({ length: Math.max(attuneMax, attuned.length) }, (_, k) => k) as k (k)}
        {@render spot(
          ATTUNE,
          attuned[k],
          'left',
          {
            en: `Attuned ${k + 1} / ${attuneMax}`,
            fr: `Harmonisé ${k + 1} / ${attuneMax}`,
            es: `Sintonizado ${k + 1} / ${attuneMax}`,
          },
          true,
          k >= attuneMax,
        )}
      {/each}
      <button class="rule" onclick={() => ruleOf('attunement')}
        >{tr({ en: 'Attunement', fr: 'Harmonisation', es: 'Sintonización' })} : {attuned.length} / {attuneMax}</button
      >
      <div class="list">
        <strong>{tr(OTHER.label)}</strong>
        <small>{tr(OTHER.hint)}</small>
        <ul>
          {#each others as item (item.uid)}
            <li>
              {#if isMagic(item)}<span class="arcane">✦</span>{/if}
              <button class="link" onclick={() => openItem(item)}
                >{tr(itemName(item))}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</button
              >
              <button
                class="mini"
                onclick={() => takeOff(OTHER, item)}
                title={tr({
                  en: 'Take off (into the backpack)',
                  fr: 'Retirer (dans le sac)',
                  es: 'Quitarse (a la mochila)',
                })}>⤓</button
              >
            </li>
          {/each}
          <li>
            <button class="add" onclick={() => open(OTHER, undefined)}
              >＋ {tr({ en: 'Put on', fr: 'Revêtir', es: 'Ponerse' })}</button
            >
          </li>
        </ul>
      </div>
    </div>

    <div class="figure">
      {#if dollSrc}
        <img
          class="knight"
          src={dollSrc}
          alt={tr({
            en: 'The character and their equipment',
            fr: 'Le personnage et son équipement',
            es: 'El personaje y su equipo',
          })}
        />
      {:else}
        <!-- Placeholder silhouette -->
        <svg class="silhouette" viewBox="0 0 100 200" aria-hidden="true">
          <ellipse cx="50" cy="22" rx="13" ry="16" fill="none" stroke="currentColor" stroke-width="2" />
          <path
            d="M28 52 C28 42 72 42 72 52 L78 110 L68 112 L64 70 L62 120 L66 192 L54 192 L50 128 L46 192 L34 192 L38 120 L36 70 L32 112 L22 110 Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
      <div class="doll-actions">
        <label class="doll-btn">
          {dollSrc
            ? tr({ en: 'Change picture', fr: 'Changer l’image', es: 'Cambiar la imagen' })
            : tr({ en: 'Add a picture', fr: 'Ajouter une image', es: 'Añadir una imagen' })}
          <input type="file" accept="image/*" onchange={pickDoll} hidden />
        </label>
        {#if dollSrc}
          <button class="doll-btn" onclick={() => setDoll(null)}
            >{tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}</button
          >
        {/if}
        {#if app.character.images?.doll !== undefined}
          <button class="doll-btn" onclick={() => setDoll(undefined)}
            >{tr({ en: 'Default picture', fr: 'Image par défaut', es: 'Imagen predeterminada' })}</button
          >
        {/if}
      </div>
    </div>

    <div class="side">
      {#each KINDS as box (box.id === 'kind' ? box.kind : box.id)}
        {#if box.id === 'kind'}
          {@const items = ofKind(box.kind)}
          {@render spot(box, items[0], 'right')}
          {#each items.slice(1) as extra (extra.uid)}
            {@render spot(
              box,
              extra,
              'right',
              { en: 'Same kind: only one', fr: 'Même type : un seul', es: 'Mismo tipo: solo uno' },
              false,
              true,
            )}
          {/each}
        {/if}
      {/each}
      <button class="rule" onclick={kindsRule}
        >{tr({
          en: 'One of each kind at a time',
          fr: 'Un seul objet de chaque type',
          es: 'Uno de cada tipo a la vez',
        })}</button
      >
    </div>
  </div>
  {#each dollWarnings as w (w.id)}<p class="warn">⛔ {tr(w.message)}</p>{/each}
</section>

{#if picking}
  <div class="picker" role="dialog" aria-modal="true">
    <div class="sheet box">
      <h3>{tr(picking.label)}</h3>
      {#if owned.length}
        <p class="sub">{tr({ en: 'From your inventory', fr: 'Dans votre inventaire', es: 'De tu inventario' })}</p>
        <ul>
          {#each owned as item (item.uid)}
            <li>
              <button onclick={() => place(picking!, item)}>
                ⤒ {tr(itemName(item))}
                <small
                  >{tr(
                    item.location === 'worn'
                      ? { en: 'worn', fr: 'porté', es: 'llevado' }
                      : item.location === 'carried'
                        ? { en: 'backpack', fr: 'sac', es: 'mochila' }
                        : { en: 'stored', fr: 'entreposé', es: 'guardado' },
                  )}</small
                >
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="sub">{tr({ en: 'Add from the SRD', fr: 'Ajouter depuis le SRD', es: 'Añadir desde el SRD' })}</p>
      <input type="search" bind:value={query} placeholder={tr({ en: 'Search…', fr: 'Chercher…', es: 'Buscar…' })} />
      <ul class="catalog">
        {#each catalogForBox as m (m.kind + m.id)}
          <li>
            <button onclick={() => addAndPlace(picking!, m.kind, m.id)}
              >＋ {tr(m.name)}
              {#if m.note}<small>{tr(m.note)}</small>{/if}</button
            >
          </li>
        {:else}
          <li><small>{tr({ en: 'Nothing matches.', fr: 'Aucun résultat.', es: 'Ningún resultado.' })}</small></li>
        {/each}
      </ul>
      <p class="sub hint">
        {tr({
          en: 'A homebrew item: create it under “Add an item” below, with its worn kind.',
          fr: 'Un objet maison : créez-le dans « Ajouter un objet » plus bas, avec son type porté.',
          es: 'Un objeto casero: créalo en «Añadir un objeto» más abajo, con su tipo llevado.',
        })}
      </p>
      <button class="close" onclick={() => (picking = null)}>{tr({ en: 'Close', fr: 'Fermer', es: 'Cerrar' })}</button>
    </div>
  </div>
{/if}

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) minmax(0, 1.4fr) minmax(10rem, 1fr);
    gap: 1.25rem;
    align-items: center;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .slot {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 0.35rem;
    align-items: center;
  }
  /* Short leader line toward the character, like the official sheet. */
  .slot::after {
    content: '';
    position: absolute;
    top: 1.375rem;
    width: 1.25rem;
    height: 1.5px;
    background: var(--frame);
  }
  .left::after {
    right: -1.25rem;
  }
  .right::after {
    left: -1.25rem;
  }
  .label {
    grid-column: 1 / -1;
    line-height: 1.15;
    padding-left: 0.1rem;
  }
  .frame {
    grid-column: 1;
    min-height: 2.75rem;
    padding: 0.3rem 0.7rem;
    text-align: left;
    font: inherit;
    color: var(--ink-soft);
    background: var(--box);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    cursor: pointer;
  }
  .frame:hover {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .filled .frame {
    color: var(--ink);
    border: 1.5px solid var(--frame);
    font-weight: 600;
  }
  .over .frame {
    border-color: var(--danger);
  }
  .over .label strong {
    color: var(--danger);
  }
  .frame small {
    display: block;
    font-weight: 400;
    font-size: 0.78rem;
    color: var(--ink-soft);
  }
  .name {
    display: block;
  }
  .label strong,
  .list > strong {
    font-family: var(--font-title);
    font-weight: 400;
    letter-spacing: 0.05em;
    color: var(--ink);
    font-size: 1.1rem;
  }
  .label small,
  .list > small {
    display: block;
    font-size: 0.78rem;
    color: var(--ink-soft);
  }
  .off {
    grid-column: 2;
    grid-row: 1;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
  }
  .off:hover {
    border-color: var(--frame);
  }
  .rule {
    align-self: flex-start;
    font: inherit;
    font-size: 0.9rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--ink-soft);
    cursor: pointer;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
    min-height: 2rem;
  }
  .rule:hover {
    color: var(--accent);
  }
  .list ul {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 2.5rem;
    border-bottom: 1px solid var(--rule);
  }
  .link {
    flex: 1;
    font: inherit;
    background: none;
    border: none;
    padding: 0.2em 0;
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
  .mini {
    min-width: 2.5rem;
    min-height: 2.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
  }
  .add {
    font: inherit;
    font-size: 0.9rem;
    min-height: 2.5rem;
    padding: 0 0.6rem;
    border: 1px dashed var(--rule-strong);
    border-radius: 3px;
    background: none;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .add:hover {
    color: var(--ink);
    border-color: var(--frame);
  }
  .warn {
    color: var(--danger);
    margin: 0.5rem 0 0;
  }
  .figure {
    display: grid;
    place-items: center;
    gap: 0.5rem;
  }
  .knight {
    width: 100%;
    max-height: 38rem;
    object-fit: contain;
  }
  .silhouette {
    width: 45%;
    max-height: 32rem;
    color: var(--rule-strong);
  }
  .doll-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
  }
  .doll-btn {
    font: inherit;
    font-size: 0.9rem;
    min-height: 2.5rem;
    padding: 0 0.7rem;
    display: inline-grid;
    place-items: center;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
  }
  .doll-btn:hover {
    border-color: var(--frame);
  }
  .picker {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background: rgb(20 17 14 / 0.45);
    padding: 1rem;
  }
  .sheet {
    width: min(32rem, 100%);
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: var(--shadow-pop);
  }
  .sub {
    margin: 0.6rem 0 0.3rem;
    font-family: var(--font-title);
    letter-spacing: 0.05em;
    color: var(--ink-soft);
  }
  .sub.hint {
    font-family: var(--font-body);
    letter-spacing: 0;
    font-size: 0.85rem;
  }
  .picker ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .picker li button,
  .close {
    width: 100%;
    min-height: 2.75rem;
    text-align: left;
    font: inherit;
    background: none;
    border: none;
    border-bottom: 1px solid var(--rule);
    color: var(--ink);
    cursor: pointer;
  }
  .picker li button:hover {
    background: var(--paper-2);
  }
  .picker small {
    color: var(--ink-soft);
    font-style: italic;
  }
  .picker input {
    width: 100%;
    font: inherit;
    min-height: 2.75rem;
    padding: 0 0.6rem;
    background: var(--box);
    color: var(--ink);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
  }
  .close {
    margin-top: 0.8rem;
    text-align: center;
    border: 1.5px solid var(--frame);
    border-radius: 4px;
  }
  /* Tablet portrait / phone: character on top, spots in two columns below. */
  @media (max-width: 52rem) {
    .layout {
      grid-template-columns: 1fr 1fr;
    }
    .figure {
      grid-column: 1 / -1;
      order: -1;
    }
    .knight {
      max-height: 24rem;
    }
    .slot::after {
      display: none;
    }
  }
  @media (max-width: 30rem) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
