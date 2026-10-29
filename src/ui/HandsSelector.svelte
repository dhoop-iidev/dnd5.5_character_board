<script lang="ts">
  // Weapons and Shield in hand (Combat pane, top of the attacks), like the 3.5 playboard: the worn weapons and Shields,
  // ticked when in hand (`ItemInstance.equipped`), with the hands each one takes and the total out of two.
  // SRD 5.2.1 p. 177 "Attack" (equip or unequip one weapon as part of each attack), p. 92 "Donning and Doffing Armor"
  // (a Shield: Utilize action), p. 90 "Two-Handed" and "Versatile", p. 89 "Light", p. 90 "Nick". The rule check is in
  // engine/checks/equipment.ts ("hands"), the count in engine/hands.ts.
  import { rules } from '../data/rules'
  import type { I18n, WeaponProperty } from '../data/types'
  import { heldAsPair, twoHandedGrip, weaponHands } from '../engine/hands'
  import type { ItemInstance } from '../model/character'
  import { app, tr, view } from '../state.svelte'
  import { isShield, isWeapon, itemDef, itemName, openItem } from './items'
  import { openPopup } from './popupState.svelte'

  const c = $derived(app.character)
  const holdable = $derived(c.inventory.filter((i) => i.location === 'worn' && (isWeapon(i) || isShield(i))))
  const weaponDef = (i: ItemInstance) => {
    const d = itemDef(i)
    return d?.kind === 'weapon' ? d.def : undefined
  }
  const has = (i: ItemInstance, p: WeaponProperty) => !!weaponDef(i)?.properties.includes(p)
  /** Hands this item takes when in hand. */
  const hands = (i: ItemInstance) => {
    const d = weaponDef(i)
    return d ? weaponHands(d, c, i.uid) : 1
  }
  const inHand = $derived(holdable.filter((i) => i.equipped))
  const total = $derived(inHand.reduce((s, i) => s + hands(i), 0))
  const lightInHand = $derived(inHand.filter((i) => has(i, 'light')))
  // Nick only when the character can use that weapon's mastery (the attack line says so).
  const nick = $derived(
    lightInHand.some((i) =>
      view.sheet.attacks.some((a) => a.uid === i.uid && a.mastery.id === 'nick' && a.mastery.usable),
    ),
  )

  function toggle(i: ItemInstance) {
    i.equipped = !i.equipped
    if (!i.equipped) {
      delete i.twoHanded
      delete i.pair
    }
  }
  function setGrip(i: ItemInstance, two: boolean) {
    if (two) i.twoHanded = true
    else delete i.twoHanded
  }
  const prop = (id: string) => rules.weaponProperties.get(id)
  function propPopup(id: string) {
    const p = prop(id)
    if (p) openPopup({ title: p.name, html: p.text, source: p.source })
  }
  const handsLabel = (n: number): I18n =>
    n === 2 ? { en: '2 hands', fr: '2 mains', es: '2 manos' } : { en: '1 hand', fr: '1 main', es: '1 mano' }
  function rulesPopup() {
    const attack = rules.glossary.get('attack')
    openPopup({
      title: {
        en: 'Taking weapons and a Shield in hand',
        fr: 'Prendre armes et bouclier en main',
        es: 'Empuñar armas y un escudo',
      },
      lines: [
        {
          en: 'Equipping or unequipping one weapon is part of an attack you make with the Attack action (before or after the attack).',
          fr: 'S’équiper ou se déséquiper d’une arme fait partie d’une attaque effectuée dans le cadre de l’action Attaque (avant ou après l’attaque).',
          es: 'Equipar o desequipar un arma forma parte de un ataque que hagas con la acción de atacar (antes o después del ataque).',
        },
        {
          en: 'Donning or doffing a Shield takes the Utilize action (SRD 5.2.1 p. 92, “Donning and Doffing Armor” / FR p. 98).',
          fr: 'Revêtir ou ôter un bouclier demande l’action Utiliser (SRD 5.2.1 p. 92, « Revêtir et ôter une armure » / FR p. 98).',
          es: 'Ponerse o quitarse un escudo requiere la acción de utilizar (SRD 5.2.1 p. 92, «Ponerse y quitarse armadura» / FR p. 98).',
        },
        {
          en: 'Two-Handed: both hands to attack with it. Versatile: one or two hands, the bracketed damage with two hands (p. 90 / FR p. 95–96).',
          fr: 'Deux mains : les deux mains pour attaquer avec. Polyvalente : à une ou deux mains, les dégâts entre parenthèses à deux mains (p. 90 / FR p. 95–96).',
          es: 'A dos manos: ambas manos para atacar con ella. Versátil: una o dos manos, el daño entre paréntesis a dos manos (p. 90 / FR p. 95–96).',
        },
      ],
      html: attack?.text,
      source: attack?.source ?? { page: 177, frPage: 188, section: 'Rules Glossary > Attack [Action]' },
      noteKey: 'rule:hands',
    })
  }
</script>

<div class="hands">
  <div class="head">
    <h4>
      {tr({ en: 'Weapons and Shield in hand', fr: 'Armes et bouclier en main', es: 'Armas y escudo en la mano' })}
    </h4>
    <span class="total" class:bad={total > 2}
      >{tr({ en: 'Hands', fr: 'Mains', es: 'Manos' })} <strong>{total} / 2</strong></span
    >
    <button class="info" onclick={rulesPopup} aria-label={tr({ en: 'Rules', fr: 'Règles', es: 'Reglas' })}>ⓘ</button>
  </div>
  {#if holdable.length}
    <ul>
      {#each holdable as i (i.uid)}
        {@const w = weaponDef(i)}
        <li class:on={i.equipped}>
          <label class="pick">
            <input type="checkbox" checked={!!i.equipped} onchange={() => toggle(i)} />
          </label>
          <button class="name" onclick={() => openItem(i)}>{tr(itemName(i))}</button>
          <span class="tag">{tr(handsLabel(hands(i)))}</span>
          {#if w && has(i, 'two-handed')}
            <button class="prop" onclick={() => propPopup('two-handed')}>{tr(prop('two-handed')?.name)}</button>
          {/if}
          {#if w && has(i, 'light')}
            <button class="prop" onclick={() => propPopup('light')}>{tr(prop('light')?.name)}</button>
            {#if i.equipped && i.quantity >= 2}
              <!-- Two of the stack, one in each hand (two Daggers): the Light extra attack with the other one. -->
              <span class="grip" role="group" aria-label={tr(prop('light')?.name)}>
                <button class:sel={!i.pair} onclick={() => delete i.pair}
                  >{tr({ en: 'one in hand', fr: 'une en main', es: 'una en la mano' })}</button
                ><button class:sel={!!i.pair} onclick={() => (i.pair = true)}
                  >{tr({ en: 'one in each hand', fr: 'une dans chaque main', es: 'una en cada mano' })}</button
                >
              </span>
            {/if}
          {/if}
          {#if w && has(i, 'versatile')}
            {#if i.equipped}
              <span class="grip" role="group" aria-label={tr(prop('versatile')?.name)}>
                <button class:sel={!twoHandedGrip(c, i.uid)} onclick={() => setGrip(i, false)}
                  >{tr({ en: 'one hand', fr: 'une main', es: 'una mano' })} {w.damage}</button
                ><button class:sel={twoHandedGrip(c, i.uid)} onclick={() => setGrip(i, true)}
                  >{tr({ en: 'two hands', fr: 'deux mains', es: 'dos manos' })} {w.versatile}</button
                >
              </span>
            {:else}
              <button class="prop" onclick={() => propPopup('versatile')}>{tr(prop('versatile')?.name)}</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="none">
      {tr({
        en: 'No worn weapon or Shield: put them in the “Worn” section of the Equipment pane.',
        fr: 'Aucune arme ni bouclier porté : placez-les dans la section « Porté » du volet Équipement.',
        es: 'Ningún arma ni escudo llevado: colócalos en la sección «Llevado» de la pestaña Equipo.',
      })}
    </p>
  {/if}
  {#if lightInHand.length + lightInHand.filter((i) => heldAsPair(c, i.uid)).length >= 2}
    <p class="hint">
      <button class="prop" onclick={() => propPopup('light')}>{tr(prop('light')?.name)}</button>
      {nick
        ? tr({
            en: 'extra attack with the other Light weapon as part of the Attack action (Nick), once per turn.',
            fr: 'attaque supplémentaire avec l’autre arme Légère dans le cadre de l’action Attaque (Coup double), une fois par tour.',
            es: 'ataque adicional con la otra arma Ligera como parte de la acción de atacar (Mellar), una vez por turno.',
          })
        : tr({
            en: 'extra attack with the other Light weapon as a Bonus Action, without your ability modifier to damage unless it is negative.',
            fr: 'attaque supplémentaire avec l’autre arme Légère par une action Bonus, sans modificateur de caractéristique aux dégâts s’il n’est pas négatif.',
            es: 'ataque adicional con la otra arma Ligera como acción adicional, sin tu modificador por característica al daño salvo que sea negativo.',
          })}
    </p>
  {/if}
</div>

<style>
  .hands {
    margin-bottom: 0.9rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule-strong);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  h4 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 400;
    flex: 1;
  }
  .total {
    font-family: var(--font-title);
    color: var(--ink-soft);
  }
  .total strong {
    font-family: var(--font-num);
    color: var(--ink);
    margin-left: 0.2em;
  }
  .total.bad,
  .total.bad strong {
    color: var(--danger);
  }
  ul {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
  }
  li {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 2.75rem;
  }
  li:not(.on) .name {
    color: var(--ink-soft);
  }
  .pick {
    display: inline-flex;
    align-items: center;
    min-width: 2rem;
    min-height: 2.75rem;
    justify-content: center;
  }
  .pick input {
    width: 1.2rem;
    height: 1.2rem;
    accent-color: var(--accent);
  }
  button {
    font: inherit;
  }
  .name {
    background: none;
    border: none;
    padding: 0;
    min-height: 2rem;
    font-weight: 700;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
  .name:hover {
    color: var(--accent);
  }
  .tag {
    font-family: var(--font-title);
    font-size: 0.8rem;
    color: var(--ink-soft);
    border: 1px solid var(--rule);
    border-radius: 1em;
    padding: 0 0.5em;
  }
  .prop {
    background: none;
    border: none;
    padding: 0;
    min-height: 2rem;
    font-size: 0.85em;
    color: var(--ink-soft);
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
  .grip {
    display: inline-flex;
  }
  .grip button {
    min-height: 2.2rem;
    padding: 0 0.6rem;
    font-size: 0.85em;
    border: 1px solid var(--rule-strong);
    background: transparent;
  }
  .grip button + button {
    border-left: none;
  }
  .grip button.sel {
    border-color: var(--frame);
    background: var(--paper-2);
    font-weight: 700;
  }
  .info {
    min-width: 2.4rem;
    min-height: 2.4rem;
    padding: 0;
    border-color: transparent;
    background: none;
    color: var(--ink-soft);
  }
  .none,
  .hint {
    margin: 0.4rem 0 0;
    font-size: 0.9em;
    color: var(--ink-soft);
  }
  .none {
    font-style: italic;
  }
</style>
