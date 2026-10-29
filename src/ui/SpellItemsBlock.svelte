<script lang="ts">
  // Items that cast spells or have charges (Combat pane): wands, staffs, rods, rings, Spell Scrolls, potions, any item that
  // lets you cast a spell from it. Each spell shows its level, its cost in charges and its save DC and attack bonus (the
  // item's own numbers, the Spell Scroll table, or yours); "Cast" spends the charges, marks a once-per-dawn property or uses
  // up a scroll or a potion; "Dawn" regains the charges. Rules: engine/spellItems.ts (SRD 5.2.1 "Spells Cast from Items"
  // and "Charges" p. 206, "Spell Scroll" p. 244).
  import { rules } from '../data/rules'
  import type { I18n } from '../data/types'
  import type { ItemInstance } from '../model/character'
  import { fmt } from '../engine/stacking'
  import {
    canCast,
    castFromItem,
    castLevels,
    chargeCost,
    chargesLeft,
    itemSpellNumbers,
    rechargeItem,
    spellItemInfo,
    SRC_ITEM_SPELLS,
    unusableReason,
    wielderNumbers,
    type ItemSpell,
    type SpellItemInfo,
  } from '../engine/spellItems'
  import { app, tr, view } from '../state.svelte'
  import { itemName, openItem } from './items'
  import { openPopup } from './popupState.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const wielder = $derived(wielderNumbers(sheet))
  const entries = $derived(
    (c.inventory ?? [])
      .filter((i) => i.location !== 'stored' && i.quantity > 0)
      .map((item) => ({ item, info: spellItemInfo(item, rules) }))
      .filter((x): x is { item: ItemInstance; info: SpellItemInfo } => !!x.info),
  )

  /** Level picked for a spell with several possible levels, by '<uid>:<index>'. */
  let levels = $state<Record<string, number>>({})
  /** Last dawn's result, by uid. */
  let regained = $state<Record<string, number>>({})

  const spellName = (id: string): I18n => rules.spells.get(id)?.name ?? { en: id, fr: id, es: id }
  function spellPopup(id: string) {
    const sp = rules.spells.get(id)
    if (sp) openPopup({ title: sp.name, html: sp.text, source: sp.source, noteKey: `spell:${id}` })
  }
  function levelOf(item: ItemInstance, s: ItemSpell, i: number): number {
    const all = castLevels(s, rules, item)
    const v = levels[`${item.uid}:${i}`]
    return all.includes(v) ? v : all[0]
  }
  const levelText = (l: number): I18n =>
    l === 0
      ? { en: 'cantrip', fr: 'sort mineur', es: 'truco' }
      : { en: `level ${l}`, fr: `niveau ${l}`, es: `nivel ${l}` }
  function numbersText(item: ItemInstance, info: SpellItemInfo, s: ItemSpell, l: number): string {
    const n = itemSpellNumbers(s, info, l, wielder)
    if (n.from === 'original')
      return tr({
        en: 'DC and attack of the caster who stored it',
        fr: 'DD et attaque du lanceur qui l’a stocké',
        es: 'CD y ataque del lanzador que lo almacenó',
      })
    const parts: string[] = []
    if (n.dc !== undefined) parts.push(`${tr({ en: 'DC', fr: 'DD', es: 'CD' })} ${n.dc}`)
    if (n.attack !== undefined) parts.push(`${tr({ en: 'attack', fr: 'attaque', es: 'ataque' })} ${fmt(n.attack)}`)
    const from: Record<string, I18n> = {
      item: { en: 'the item’s', fr: 'de l’objet', es: 'del objeto' },
      scroll: { en: 'Spell Scroll table', fr: 'table du parchemin', es: 'tabla del pergamino de conjuro' },
      wielder: { en: 'yours', fr: 'les vôtres', es: 'los tuyos' },
      original: { en: '', fr: '', es: '' },
    }
    return parts.length ? `${parts.join(', ')} (${tr(from[n.from])})` : ''
  }
  function costText(item: ItemInstance, info: SpellItemInfo, s: ItemSpell, l: number): string {
    const cost = chargeCost(s, l, rules)
    if (cost > 0)
      return tr({
        en: `${cost} charge${cost > 1 ? 's' : ''}`,
        fr: `${cost} charge${cost > 1 ? 's' : ''}`,
        es: `${cost} carga${cost > 1 ? 's' : ''}`,
      })
    if (s.atWill) return tr({ en: 'at will', fr: 'à volonté', es: 'a voluntad' })
    if (s.perDay) {
      const used = (item.usedToday ?? []).filter((x) => x === s.spellId).length
      return tr({
        en: `${s.perDay - used} / ${s.perDay} per dawn`,
        fr: `${s.perDay - used} / ${s.perDay} par aube`,
        es: `${s.perDay - used} / ${s.perDay} por amanecer`,
      })
    }
    if (info.consumable) return tr({ en: 'used up', fr: 'consommé', es: 'agotado' })
    return ''
  }
  function setCharges(item: ItemInstance, info: SpellItemInfo, delta: number) {
    const left = chargesLeft(item, info) ?? 0
    const max = info.maxCharges ?? Infinity
    item.charges = Math.max(0, Math.min(max, left + delta))
  }
  function dawn(item: ItemInstance, info: SpellItemInfo) {
    regained[item.uid] = rechargeItem(item, info)
  }
  function source() {
    openPopup({
      title: {
        en: 'Spells cast from items',
        fr: 'Sorts lancés depuis un objet',
        es: 'Conjuros lanzados desde objetos',
      },
      html: {
        en: '<p>A spell cast from an item is cast at its lowest level, uses no spell slot and needs no components unless the item says otherwise. An item may use your spell save DC and attack bonus; without a spellcasting ability, your modifier is +0 and your Proficiency Bonus applies. A Spell Scroll has its own save DC and attack bonus by spell level.</p>',
        fr: '<p>Un sort lancé depuis un objet l’est à son niveau le plus bas, sans emplacement de sort ni composantes sauf indication contraire. Un objet peut utiliser votre DD de sauvegarde et votre bonus d’attaque des sorts ; sans caractéristique d’incantation, votre modificateur est de +0 et votre bonus de maîtrise s’applique. Un parchemin magique a ses propres DD et bonus d’attaque selon le niveau du sort.</p>',
        es: '<p>Un conjuro lanzado desde un objeto se lanza a su nivel más bajo, no gasta espacio de conjuro y no necesita componentes salvo que el objeto diga lo contrario. Un objeto puede usar tu CD de salvación y tu bonificador de ataque de conjuros; sin aptitud mágica, tu modificador es +0 y se aplica tu bonificador por competencia. Un pergamino de conjuro tiene su propia CD de salvación y bonificador de ataque según el nivel del conjuro.</p>',
      },
      source: SRC_ITEM_SPELLS,
    })
  }
</script>

{#if entries.length}
  <section class="box wide items">
    <h3>
      {tr({
        en: 'Items with spells and charges',
        fr: 'Objets à sorts et à charges',
        es: 'Objetos con conjuros y cargas',
      })}
      <button class="link rule" onclick={source}>{tr({ en: 'Rule', fr: 'Règle', es: 'Regla' })}</button>
    </h3>
    <ul class="list">
      {#each entries as { item, info } (item.uid)}
        {@const why = unusableReason(item, rules)}
        {@const left = chargesLeft(item, info)}
        <li class:off={!!why}>
          <div class="head">
            <span class="arcane">✦</span>
            <button class="link" onclick={() => openItem(item)}>{tr(itemName(item))}</button>
            {#if item.quantity > 1}<small>× {item.quantity}</small>{/if}
            {#if why}<small class="why">{tr(why)}</small>{/if}
          </div>
          {#if info.maxCharges !== undefined || left !== undefined}
            <div class="charges">
              {tr({ en: 'Charges', fr: 'Charges', es: 'Cargas' })} :
              <button onclick={() => setCharges(item, info, -1)} aria-label="−1">−</button>
              <strong>{left ?? 0}</strong>{#if info.maxCharges !== undefined}&nbsp;/ {info.maxCharges}{/if}
              <button onclick={() => setCharges(item, info, 1)} aria-label="+1">+</button>
            </div>
          {/if}
          {#if info.recharge || info.spells.some((s) => s.perDay)}
            <div class="charges">
              <button
                onclick={() => dawn(item, info)}
                title={info.recharge
                  ? tr({
                      en: `Regains ${info.recharge === 'all' ? 'all its' : info.recharge} charges at ${info.rechargeAt}`,
                      fr: `Récupère ${info.recharge === 'all' ? 'toutes ses' : info.recharge} charges ${info.rechargeAt === 'dawn' ? 'à l’aube' : 'au crépuscule'}`,
                      es: `Recupera ${info.recharge === 'all' ? 'todas sus' : info.recharge} cargas ${info.rechargeAt === 'dawn' ? 'al amanecer' : 'al anochecer'}`,
                    })
                  : undefined}
                >{info.rechargeAt === 'dawn'
                  ? tr({ en: '☀ Dawn', fr: '☀ Aube', es: '☀ Amanecer' })
                  : tr({ en: '☾ Dusk', fr: '☾ Crépuscule', es: '☾ Anochecer' })}{info.recharge
                  ? ` (${info.recharge})`
                  : ''}</button
              >
              {#if regained[item.uid] !== undefined}<small
                  >{tr({
                    en: `+${regained[item.uid]} charges`,
                    fr: `+${regained[item.uid]} charges`,
                    es: `+${regained[item.uid]} cargas`,
                  })}</small
                >{/if}
            </div>
          {/if}
          {#if info.variantNote}<p class="note">{tr(info.variantNote)}</p>{/if}
          {#if info.note}<p class="note">{tr(info.note)}</p>{/if}
          {#if info.spells.length}
            <ul class="spells">
              {#each info.spells as s, i (i)}
                {@const all = castLevels(s, rules, item)}
                {@const l = levelOf(item, s, i)}
                <li>
                  <button class="link" onclick={() => spellPopup(s.spellId)}>{tr(spellName(s.spellId))}</button>
                  {#if all.length > 1}
                    <select
                      value={l}
                      onchange={(e) =>
                        (levels[`${item.uid}:${i}`] = Number((e.currentTarget as HTMLSelectElement).value))}
                      aria-label={tr({ en: 'Level', fr: 'Niveau', es: 'Nivel' })}
                    >
                      {#each all as x (x)}<option value={x}>{tr(levelText(x))}</option>{/each}
                    </select>
                  {:else}
                    <small>{tr(levelText(l))}</small>
                  {/if}
                  <small>{costText(item, info, s, l)}</small>
                  <small>{numbersText(item, info, s, l)}</small>
                  {#if s.note}<small>{tr(s.note)}</small>{/if}
                  <button
                    class="main"
                    disabled={!canCast(item, info, s, l, rules)}
                    onclick={() => castFromItem(item, info, s, l, rules)}
                    >{tr({ en: 'Cast', fr: 'Lancer', es: 'Lanzar' })}</button
                  >
                </li>
              {/each}
            </ul>
          {:else if info.consumable}
            <button class="main" disabled={!!why || item.quantity < 1} onclick={() => (item.quantity -= 1)}
              >{tr({ en: 'Use (−1)', fr: 'Utiliser (−1)', es: 'Usar (−1)' })}</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .items {
    margin-bottom: 1.25rem;
  }
  h3 .rule {
    font-size: 0.8rem;
    margin-left: 0.6rem;
    font-weight: normal;
  }
  .list,
  .spells {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
    gap: 0.8rem;
  }
  .list > li {
    border: 1px solid var(--rule);
    padding: 0.6rem 0.8rem;
  }
  .list > li.off {
    opacity: 0.6;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
  }
  .arcane {
    color: var(--arcane);
  }
  .why {
    font-style: italic;
    color: var(--accent);
  }
  .charges {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .spells li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.6rem;
    padding: 0.35rem 0;
    border-top: 1px solid var(--rule);
    margin-top: 0.35rem;
  }
  .spells small {
    color: var(--ink-soft);
  }
  .spells .main {
    margin-left: auto;
  }
  button {
    font: inherit;
    min-height: 2.6rem;
    min-width: 2.6rem;
  }
  button.main {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
    padding: 0 1rem;
  }
  button.main:disabled {
    opacity: 0.4;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    min-width: 0;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-underline-offset: 0.2em;
  }
  .link:hover {
    color: var(--accent);
  }
</style>
