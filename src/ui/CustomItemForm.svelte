<script lang="ts">
  // Create or edit an item that isn't (exactly) in the SRD, as the 3.5 playboard does:
  // - an object (campaign loot, heirloom, homebrew wondrous item): name, weight, price, description, magic, requires
  //   Attunement, worn kind (one of each at a time, SRD p. 103), and bonuses while worn;
  // - a weapon: a base SRD weapon (proficiency, damage, properties, mastery) with overrides (name, magic bonus, attack and
  //   damage bonuses, damage dice and type, extra damage dice, properties, mastery) and bonuses while in hand;
  // - armor or a Shield: a base SRD armor with a magic bonus to the AC (as "Armor, +1, +2, or +3", p. 210).
  // Editing an SRD item (a Cloak of Protection, whose bonuses the data doesn't encode) adds overrides to it the same way.
  import { rules } from '../data/rules'
  import type { DamageType, I18n, MasteryProperty, ModifierSpec, WeaponProperty } from '../data/types'
  import type { CustomItem, ItemInstance, ItemLocation, WornKind } from '../model/character'
  import { wornKindOf } from '../engine/items'
  import { app, lang, tr, trIn } from '../state.svelte'
  import { isMetric } from './format'
  import { itemDef, itemName, newUid, WORN_KINDS } from './items'
  import ModifierEditor from './ModifierEditor.svelte'

  type Mode = 'object' | 'weapon' | 'armor'
  /** `oncreated`: a new item was added (the pane opens its editor, where spells cast from the item are added). */
  let { item, onclose, oncreated }: { item?: ItemInstance; onclose?: () => void; oncreated?: (uid: string) => void } =
    $props()

  // ---- initial values (from the item when editing; the parent re-creates the form for another item)
  // svelte-ignore state_referenced_locally
  const c0: CustomItem = item?.custom ? $state.snapshot(item.custom) : {}
  // svelte-ignore state_referenced_locally
  const editing = item
  const modeOf = (i: ItemInstance): Mode => (i.kind === 'weapon' ? 'weapon' : i.kind === 'armor' ? 'armor' : 'object')
  /** Editing an SRD gear or magic item: its base stays; only overrides are stored. */
  const srdBase = !!editing && (editing.kind === 'gear' || editing.kind === 'magic')
  const fromLb = (lb: number | undefined) => (lb === undefined ? '' : isMetric(lang()) ? lb / 2 : lb)
  const textOf = (n: I18n | undefined) => (n ? trIn(n, lang()) : '')

  let mode = $state<Mode | ''>(editing ? modeOf(editing) : '')
  let name = $state(textOf(c0.name))
  let text = $state(textOf(c0.text))
  let weight = $state<number | ''>(fromLb(c0.weightLb))
  let cost = $state<number | ''>(c0.costGp ?? '')
  let location = $state<ItemLocation>('carried')
  let magic = $state(!!c0.magic)
  let attunement = $state(!!c0.attunement)
  let wornKind = $state<WornKind | 'none' | ''>(c0.wornKind ?? '')
  let magicBonus = $state(c0.magicBonus ?? 0)
  let mods = $state<ModifierSpec[]>(c0.modifiers ?? [])
  // weapon
  let weaponId = $state(editing?.kind === 'weapon' ? (editing.refId ?? 'longsword') : 'longsword')
  let attackBonus = $state(c0.attackBonus ?? 0)
  let damageBonus = $state(c0.damageBonus ?? 0)
  let damage = $state(c0.damage ?? '')
  let damageType = $state<DamageType | ''>(c0.damageType ?? '')
  let properties = $state<WeaponProperty[] | null>(c0.properties ?? null)
  let mastery = $state<MasteryProperty | ''>(c0.mastery ?? '')
  let extra = $state<{ dice: string; type?: DamageType }[]>(c0.extraDamage ?? [])
  // armor
  let armorId = $state(editing?.kind === 'armor' ? (editing.refId ?? 'chain-mail') : 'chain-mail')

  const baseWeapons = [...rules.weapons.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name)))
  const baseArmor = [...rules.armor.values()]
  const weapon = $derived(rules.weapons.get(weaponId))
  const armor = $derived(rules.armor.get(armorId))
  const shield = $derived(armor?.category === 'shield')
  const PROPS = [...rules.weaponProperties.values()].filter((p) => p.kind === 'property')
  const MASTERIES = [...rules.weaponProperties.values()].filter((p) => p.kind === 'mastery')
  const DAMAGE_TYPES = Object.entries(rules.damageTypeNames) as [DamageType, I18n][]
  const propList = $derived(properties ?? weapon?.properties ?? [])
  function toggleProp(p: WeaponProperty) {
    const cur = [...propList]
    properties = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
  }
  // What the worn kind would be without an override (shown as "automatic: …").
  const inferred = $derived.by(() => {
    if (mode !== 'object') return undefined
    const n = name.trim()
    const nm = n ? { en: n, fr: n, es: n } : editing?.custom?.name
    const probe: ItemInstance = editing
      ? { ...editing, custom: { ...(editing.custom ?? {}), name: nm, wornKind: undefined } }
      : { uid: '', kind: 'custom', quantity: 1, location: 'worn', custom: { name: nm } }
    return wornKindOf(probe, rules)
  })
  const kindName = (k: WornKind | undefined) =>
    k
      ? tr(WORN_KINDS.find((x) => x.id === k)!.name)
      : tr({ en: 'other worn item', fr: 'autre objet porté', es: 'otro objeto llevado' })

  // Weight typed in the current language's unit (kg in French, lb in English); stored in lb like the SRD data.
  const toLb = (w: number) => (isMetric(lang()) ? w * 2 : w)
  const num = (v: number | '' | null | undefined) => (v === '' || v === null || v === undefined ? undefined : Number(v))

  function reset() {
    if (onclose) return onclose()
    mode = ''
    name = ''
    text = ''
    weight = ''
    cost = ''
    magic = false
    attunement = false
    wornKind = ''
    magicBonus = 0
    mods = []
    attackBonus = 0
    damageBonus = 0
    damage = ''
    damageType = ''
    properties = null
    mastery = ''
    extra = []
    location = 'carried'
  }

  /** The `custom` record from the form, without empty fields. */
  function buildCustom(): CustomItem {
    const n = name.trim()
    const t = text.trim()
    const w = num(weight)
    const out: CustomItem = {}
    if (n) out.name = { en: n, fr: n, es: n }
    if (t) out.text = { en: t, fr: t, es: t }
    if (w !== undefined) out.weightLb = toLb(w)
    if (num(cost) !== undefined) out.costGp = num(cost)
    if (attunement) out.attunement = true
    if (mods.length) out.modifiers = $state.snapshot(mods).map((m) => ({ ...m, value: Number(m.value) || 0 }))
    if (mode === 'object') {
      if (magic) out.magic = true
      if (wornKind) out.wornKind = wornKind
    }
    if ((mode === 'weapon' || mode === 'armor') && Number(magicBonus)) out.magicBonus = Number(magicBonus)
    if (mode === 'weapon' && weapon) {
      if (Number(attackBonus)) out.attackBonus = Number(attackBonus)
      if (Number(damageBonus)) out.damageBonus = Number(damageBonus)
      if (damage.trim() && damage.trim() !== weapon.damage) out.damage = damage.trim()
      if (damageType && damageType !== weapon.damageType) out.damageType = damageType
      if (properties && [...properties].sort().join() !== [...weapon.properties].sort().join())
        out.properties = [...properties]
      if (mastery && mastery !== weapon.mastery) out.mastery = mastery
      const ex = $state.snapshot(extra).filter((x) => x.dice.trim())
      if (ex.length) out.extraDamage = ex.map((x) => ({ dice: x.dice.trim(), ...(x.type ? { type: x.type } : {}) }))
    }
    return out
  }

  const canSave = $derived(
    mode === 'object' ? !!name.trim() || srdBase : mode === 'weapon' ? !!weapon : mode === 'armor' ? !!armor : false,
  )

  function save() {
    if (!canSave) return
    const custom = buildCustom()
    const has = Object.keys(custom).length > 0
    if (editing) {
      // Edit in place (the item is a reactive proxy of the inventory).
      if (mode === 'weapon') editing.refId = weaponId
      if (mode === 'armor') editing.refId = armorId
      if (has) editing.custom = custom
      else delete editing.custom
      if (!srdBase && !custom.attunement) editing.attuned = false
      return reset()
    }
    const inv = app.character.inventory
    const uid = newUid()
    if (mode === 'object')
      inv.push({
        uid,
        kind: 'custom',
        quantity: 1,
        location: wornKind && wornKind !== 'none' ? 'worn' : location,
        custom,
      })
    // A new weapon goes on the body (sheathed, ready to be taken in hand in the Combat pane).
    if (mode === 'weapon')
      inv.push({
        uid,
        kind: 'weapon',
        refId: weaponId,
        quantity: 1,
        location: 'worn',
        ...(has ? { custom } : {}),
      })
    if (mode === 'armor')
      inv.push({ uid, kind: 'armor', refId: armorId, quantity: 1, location, ...(has ? { custom } : {}) })
    reset()
    oncreated?.(uid)
  }

  const placeholderName = $derived(
    editing && srdBase
      ? tr(itemDef(editing)?.def.name)
      : mode === 'weapon'
        ? tr(weapon?.name)
        : mode === 'armor'
          ? tr(armor?.name)
          : '',
  )
  const baseWeight = $derived(
    mode === 'weapon'
      ? weapon?.weight
      : mode === 'armor'
        ? armor?.weight
        : editing
          ? itemDef(editing)?.def.weight
          : undefined,
  )
</script>

{#if !mode}
  <div class="starts">
    <button onclick={() => (mode = 'object')}
      >＋ {tr({ en: 'Custom object', fr: 'Objet personnalisé', es: 'Objeto personalizado' })}</button
    >
    <button onclick={() => (mode = 'weapon')}
      >＋ {tr({ en: 'Custom weapon', fr: 'Arme personnalisée', es: 'Arma personalizada' })}</button
    >
    <button onclick={() => (mode = 'armor')}
      >＋ {tr({
        en: 'Custom armor or Shield',
        fr: 'Armure ou bouclier personnalisé',
        es: 'Armadura o escudo personalizado',
      })}</button
    >
  </div>
{:else}
  <div class="form">
    {#if editing}
      <p class="wide title">
        {tr({ en: 'Edit', fr: 'Modifier', es: 'Editar' })} : <strong>{tr(itemName(editing))}</strong>
      </p>
    {/if}
    {#if mode === 'weapon'}
      <label class="wide">
        {tr({
          en: 'Base weapon (proficiency, damage, properties, mastery)',
          fr: 'Arme de base (maîtrise, dégâts, propriétés, botte d’arme)',
          es: 'Arma base (competencia, daño, propiedades, maestría)',
        })}
        <select bind:value={weaponId} onchange={() => (properties = null)}>
          {#each baseWeapons as w (w.id)}
            <option value={w.id}>{tr(w.name)}{w.damage ? ` — ${w.damage}` : ''}</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if mode === 'armor'}
      <label class="wide">
        {tr({ en: 'Base armor or Shield', fr: 'Armure ou bouclier de base', es: 'Armadura o escudo base' })}
        <select bind:value={armorId}>
          {#each baseArmor as a (a.id)}
            <option value={a.id}
              >{tr(a.name)} — {a.category === 'shield'
                ? `+${a.bonus ?? 2}`
                : `${tr({ en: 'AC', fr: 'CA', es: 'CA' })} ${a.baseAc}`}</option
            >
          {/each}
        </select>
      </label>
    {/if}

    <label class="wide"
      >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input bind:value={name} placeholder={placeholderName} /></label
    >

    {#if mode === 'weapon' || mode === 'armor'}
      <label>
        {tr({ en: 'Magic bonus', fr: 'Bonus magique', es: 'Bonificador mágico' })}
        <select bind:value={magicBonus}>
          <option value={0}>—</option>
          {#each [1, 2, 3] as n (n)}<option value={n}>+{n}</option>{/each}
        </select>
      </label>
    {/if}
    {#if mode === 'weapon'}
      <label
        >{tr({ en: 'Other attack bonus', fr: 'Autre bonus d’attaque', es: 'Otro bonificador de ataque' })}<input
          type="number"
          bind:value={attackBonus}
        /></label
      >
      <label
        >{tr({ en: 'Other damage bonus', fr: 'Autre bonus aux dégâts', es: 'Otro bonificador al daño' })}<input
          type="number"
          bind:value={damageBonus}
        /></label
      >
      <label
        >{tr({
          en: 'Damage dice (blank = base)',
          fr: 'Dés de dégâts (vide = arme de base)',
          es: 'Dados de daño (vacío = arma base)',
        })}<input bind:value={damage} placeholder={weapon?.damage ?? ''} /></label
      >
      <label>
        {tr({ en: 'Damage type', fr: 'Type de dégâts', es: 'Tipo de daño' })}
        <select bind:value={damageType}>
          <option value="">{tr({ en: 'base weapon', fr: 'arme de base', es: 'arma base' })}</option>
          {#each DAMAGE_TYPES as [id, n] (id)}<option value={id}>{tr(n)}</option>{/each}
        </select>
      </label>
      <label>
        {tr({ en: 'Mastery property', fr: 'Botte d’arme', es: 'Propiedad de maestría' })}
        <select bind:value={mastery}>
          <option value="">{tr({ en: 'base weapon', fr: 'arme de base', es: 'arma base' })}</option>
          {#each MASTERIES as m (m.id)}<option value={m.id}>{tr(m.name)}</option>{/each}
        </select>
      </label>
      <div class="wide group">
        <span class="lbl">{tr({ en: 'Properties', fr: 'Propriétés', es: 'Propiedades' })}</span>
        <div class="checks">
          {#each PROPS as p (p.id)}
            <label class="check"
              ><input
                type="checkbox"
                checked={propList.includes(p.id as WeaponProperty)}
                onchange={() => toggleProp(p.id as WeaponProperty)}
              />{tr(p.name)}</label
            >
          {/each}
        </div>
      </div>
      <div class="wide group">
        <span class="lbl"
          >{tr({
            en: 'Extra damage on a hit',
            fr: 'Dégâts supplémentaires en cas de réussite',
            es: 'Daño adicional al impactar',
          })}</span
        >
        {#each extra as x, i (i)}
          <div class="row">
            <input bind:value={x.dice} placeholder="1d6" aria-label={tr({ en: 'Dice', fr: 'Dés', es: 'Dados' })} />
            <select
              bind:value={x.type}
              aria-label={tr({ en: 'Damage type', fr: 'Type de dégâts', es: 'Tipo de daño' })}
            >
              <option value={undefined}>—</option>
              {#each DAMAGE_TYPES as [id, n] (id)}<option value={id}>{tr(n)}</option>{/each}
            </select>
            <button onclick={() => extra.splice(i, 1)} aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}
              >✕</button
            >
          </div>
        {/each}
        <button onclick={() => extra.push({ dice: '' })}
          >＋ {tr({ en: 'Add dice', fr: 'Ajouter des dés', es: 'Añadir dados' })}</button
        >
      </div>
    {/if}

    <label
      >{tr({ en: 'Weight', fr: 'Poids', es: 'Peso' })} ({isMetric(lang()) ? 'kg' : 'lb'})<input
        type="number"
        min="0"
        step="0.1"
        bind:value={weight}
        placeholder={baseWeight ? String(isMetric(lang()) ? baseWeight.kg : baseWeight.lb) : '0'}
      /></label
    >
    <label
      >{tr({ en: 'Price (GP)', fr: 'Prix (po)', es: 'Precio (po)' })}<input
        type="number"
        min="0"
        bind:value={cost}
        placeholder={mode === 'weapon'
          ? String(weapon?.cost.gp ?? '')
          : mode === 'armor'
            ? String(armor?.cost.gp ?? '')
            : '0'}
      /></label
    >
    {#if !editing && mode !== 'weapon'}
      <label>
        {tr({ en: 'Where', fr: 'Où', es: 'Dónde' })}
        <select bind:value={location}>
          <option value="worn">{tr({ en: 'Worn (on the body)', fr: 'Porté (sur soi)', es: 'Llevado (encima)' })}</option
          >
          <option value="carried"
            >{tr({ en: 'Carried (backpack)', fr: 'Transporté (sac à dos)', es: 'Transportado (mochila)' })}</option
          >
          <option value="stored"
            >{tr({
              en: 'Stored (not carried)',
              fr: 'Entreposé (non transporté)',
              es: 'Guardado (no transportado)',
            })}</option
          >
        </select>
      </label>
    {/if}
    {#if mode === 'object'}
      <label>
        {tr({
          en: 'Worn kind (one at a time)',
          fr: 'Type porté (un seul à la fois)',
          es: 'Tipo llevado (uno a la vez)',
        })}
        <select bind:value={wornKind}>
          <option value="">{tr({ en: 'automatic', fr: 'automatique', es: 'automático' })} : {kindName(inferred)}</option
          >
          {#each WORN_KINDS as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
          <option value="none"
            >{tr({
              en: 'other worn item (no limit)',
              fr: 'autre objet porté (sans limite)',
              es: 'otro objeto llevado (sin límite)',
            })}</option
          >
        </select>
      </label>
      {#if !srdBase}
        <label class="check"
          ><input type="checkbox" bind:checked={magic} />{tr({
            en: 'Magic item',
            fr: 'Objet magique',
            es: 'Objeto mágico',
          })}</label
        >
      {/if}
    {/if}
    {#if !srdBase}
      <label class="check"
        ><input type="checkbox" bind:checked={attunement} />{tr({
          en: 'Requires Attunement',
          fr: 'Harmonisation requise',
          es: 'Requiere sintonización',
        })}</label
      >
    {/if}

    <label class="wide"
      >{tr({ en: 'Description', fr: 'Description', es: 'Descripción' })}<textarea rows="3" bind:value={text}
      ></textarea></label
    >

    <div class="wide group">
      <span class="lbl"
        >{mode === 'weapon' || (mode === 'armor' && shield)
          ? tr({
              en: 'Bonuses while in hand (optional)',
              fr: 'Bonus quand il est en main (facultatif)',
              es: 'Bonificadores al empuñarlo (opcional)',
            })
          : tr({
              en: 'Bonuses while worn (optional)',
              fr: 'Bonus quand il est porté (facultatif)',
              es: 'Bonificadores al llevarlo (opcional)',
            })}</span
      >
      <ModifierEditor bind:mods />
      <p class="note">
        {tr({
          en: 'They apply while the item is worn (a weapon or Shield: in hand, chosen in the Combat pane), and only once attuned when it requires Attunement. Bonuses with the same name don’t stack.',
          fr: 'Ils s’appliquent tant que l’objet est porté (une arme ou un bouclier : en main, choisi dans le volet Combat), et seulement une fois harmonisé s’il requiert l’harmonisation. Des bonus de même nom ne se cumulent pas.',
          es: 'Se aplican mientras llevas el objeto (un arma o escudo: en la mano, elegido en la pestaña Combate), y solo una vez sintonizado si requiere sintonización. Los bonificadores con el mismo nombre no se acumulan.',
        })}
      </p>
    </div>

    <div class="wide actions">
      <button class="primary" onclick={save} disabled={!canSave}
        >{editing
          ? tr({ en: 'Save', fr: 'Enregistrer', es: 'Guardar' })
          : tr({ en: 'Create', fr: 'Créer', es: 'Crear' })}</button
      >
      <button onclick={reset}>{tr({ en: 'Cancel', fr: 'Annuler', es: 'Cancelar' })}</button>
    </div>
  </div>
{/if}

<style>
  button {
    font: inherit;
    min-height: 2.6rem;
    padding: 0 0.8rem;
  }
  .starts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .title {
    margin: 0;
  }
  .note {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .primary {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
  }
  .form {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.6rem 0.9rem;
    margin-top: 0.8rem;
    padding-top: 0.8rem;
    border-top: 1px solid var(--rule);
  }
  .wide {
    grid-column: 1 / -1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  label.check {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.5rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--ink);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }
  .lbl {
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .row input {
    width: 6rem;
  }
  input,
  select,
  textarea {
    font: inherit;
    font-family: var(--font-body);
    font-size: 1rem;
    min-height: 2.5rem;
    padding: 0 0.5rem;
  }
  input[type='checkbox'] {
    min-height: auto;
  }
  textarea {
    padding: 0.5rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
