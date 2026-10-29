<script lang="ts">
  // The stat block of a creature from another book, entered by the player (house rule #5, `model/customCreature.ts`):
  // a subclass's beast companion… Armor Class, Hit Points, its Proficiency Bonus and attack numbers are formulas that
  // follow the character ("13 + wis", "5 + rangerLevel*5", "pb + wis"); the rest is the player's own words.
  import type { AbilityId, Size } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import { SIZE_NAMES } from '../i18n/ui'
  import type { CustomCreature, CustomCreatureEntry } from '../model/character'
  import { formulaOk } from '../model/formula'
  import { tr } from '../state.svelte'

  let { cc }: { cc: CustomCreature } = $props()

  const SIZES: Size[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
  const KINDS: { id: CustomCreatureEntry['kind']; name: { en: string; fr: string; es: string } }[] = [
    { id: 'trait', name: { en: 'Trait', fr: 'Trait', es: 'Rasgo' } },
    { id: 'action', name: { en: 'Action', fr: 'Action', es: 'Acción' } },
    { id: 'bonus-action', name: { en: 'Bonus Action', fr: 'Action bonus', es: 'Acción adicional' } },
    { id: 'reaction', name: { en: 'Reaction', fr: 'Réaction', es: 'Reacción' } },
  ]
  function toggleSave(a: AbilityId) {
    const s = cc.saves ?? []
    cc.saves = s.includes(a) ? s.filter((x) => x !== a) : ABILITIES.filter((x) => x === a || s.includes(x))
  }
</script>

<div class="form">
  <p class="sub wide">
    {tr({
      en: 'Formulas follow your character: numbers, pb, level, an ability (its modifier: wis), a class level (rangerLevel), with *N or /N, added up: “13 + wis”, “5 + rangerLevel*5”. A field in red can’t be read.',
      fr: 'Les formules suivent votre personnage : nombres, pb, level, une caractéristique (son modificateur : wis), un niveau de classe (rangerLevel), avec *N ou /N, additionnés : « 13 + wis », « 5 + rangerLevel*5 ». Un champ en rouge est illisible.',
      es: 'Las fórmulas siguen a tu personaje: números, pb, level, una característica (su modificador: wis), un nivel de clase (rangerLevel), con *N o /N, sumados: «13 + wis», «5 + rangerLevel*5». Un campo en rojo no se puede leer.',
    })}
  </p>
  <label class="grow">{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={cc.name} /></label>
  <label>{tr({ en: 'Type', fr: 'Type', es: 'Tipo' })}<input type="text" bind:value={cc.type} /></label>
  <label
    >{tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}
    <select bind:value={cc.size}>
      {#each SIZES as z (z)}<option value={z}>{tr(SIZE_NAMES[z])}</option>{/each}
    </select>
  </label>
  <label class="grow"
    >{tr({ en: 'Book and page', fr: 'Livre et page', es: 'Libro y página' })}<input
      type="text"
      bind:value={cc.book}
    /></label
  >
  <label
    >{tr({ en: 'AC', fr: 'CA', es: 'CA' })}<input
      type="text"
      class:bad={!formulaOk(cc.ac)}
      bind:value={cc.ac}
      placeholder="13 + wis"
    /></label
  >
  <label
    >{tr({ en: 'Hit Points', fr: 'Points de vie', es: 'Puntos de golpe' })}<input
      type="text"
      class:bad={!formulaOk(cc.hp)}
      bind:value={cc.hp}
      placeholder="5 + rangerLevel*5"
    /></label
  >
  <label
    >{tr({ en: 'Its Proficiency Bonus', fr: 'Son bonus de maîtrise', es: 'Su bonificador por competencia' })}<input
      type="text"
      class:bad={!formulaOk(cc.pb)}
      bind:value={cc.pb}
      placeholder="pb"
    /></label
  >
  <label class="grow"
    >{tr({ en: 'Speed', fr: 'Vitesse', es: 'Velocidad' })}<input type="text" bind:value={cc.speed} /></label
  >
  <div class="wide abil">
    {#each ABILITIES as a (a)}
      <label class="lv"
        >{tr(ABILITY_SHORT[a])}<input type="number" min="1" max="30" bind:value={cc.abilities[a]} /></label
      >
    {/each}
  </div>
  <div class="wide">
    <span class="lab"
      >{tr({ en: 'Proficient saves', fr: 'Sauvegardes maîtrisées', es: 'Salvaciones con competencia' })}</span
    >
    {#each ABILITIES as a (a)}
      <label class="chip" class:on={cc.saves?.includes(a)}
        ><input type="checkbox" checked={cc.saves?.includes(a)} onchange={() => toggleSave(a)} />{tr(
          ABILITY_SHORT[a],
        )}</label
      >
    {/each}
  </div>
  <label class="grow"
    >{tr({ en: 'Senses', fr: 'Sens', es: 'Sentidos' })}<input type="text" bind:value={cc.senses} /></label
  >
  <label class="grow"
    >{tr({ en: 'Languages', fr: 'Langues', es: 'Idiomas' })}<input type="text" bind:value={cc.languages} /></label
  >

  {#each cc.entries as e, i (i)}
    <div class="entry wide">
      <div class="row">
        <select bind:value={e.kind} aria-label={tr({ en: 'Kind', fr: 'Type', es: 'Tipo' })}>
          {#each KINDS as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
        </select>
        <label class="grow"
          >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={e.name} /></label
        >
        <button class="ghost" onclick={() => (cc.entries = cc.entries.filter((_, j) => j !== i))}>✕</button>
      </div>
      {#if e.kind !== 'trait'}
        <div class="row">
          <label
            >{tr({ en: 'Attack bonus', fr: 'Bonus d’attaque', es: 'Bonificador de ataque' })}<input
              type="text"
              class:bad={!formulaOk(e.attack)}
              bind:value={e.attack}
              placeholder="pb + wis"
            /></label
          >
          <label class="lv"
            >{tr({ en: 'Damage dice', fr: 'Dés de dégâts', es: 'Dados de daño' })}<input
              type="text"
              bind:value={e.damageDice}
              placeholder="1d8"
            /></label
          >
          <label
            >{tr({ en: '+ damage', fr: '+ dégâts', es: '+ daño' })}<input
              type="text"
              class:bad={!formulaOk(e.damageBonus)}
              bind:value={e.damageBonus}
              placeholder="2 + wis"
            /></label
          >
          <label
            >{tr({ en: 'Damage type', fr: 'Type de dégâts', es: 'Tipo de daño' })}<input
              type="text"
              bind:value={e.damageType}
            /></label
          >
        </div>
      {/if}
      <label
        >{tr({
          en: 'What it does (your own words)',
          fr: 'Ce qu’il fait (vos propres mots)',
          es: 'Qué hace (tus propias palabras)',
        })}<textarea rows="2" bind:value={e.text}></textarea></label
      >
    </div>
  {/each}
  <div class="wide">
    <button onclick={() => cc.entries.push({ kind: 'action', name: '', text: '' })}
      >＋ {tr({ en: 'Trait or action', fr: 'Trait ou action', es: 'Rasgo o acción' })}</button
    >
  </div>
</div>

<style>
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.4rem 0;
  }
  .form label:not(.chip) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  .sub {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .wide {
    flex-basis: 100%;
  }
  .grow {
    flex: 1;
    min-width: 9rem;
  }
  .lv input {
    width: 4rem;
  }
  .abil {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
  }
  .lab {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85rem;
    margin-bottom: 0.2rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 0.4rem 0.3rem 0;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.2em 0.7em;
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    border-left: 2px solid var(--rule-strong);
    padding-left: 0.6rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.4rem 0.8rem;
  }
  textarea {
    width: 100%;
    font: inherit;
  }
  input.bad {
    border-color: var(--accent);
    outline: 1px solid var(--accent);
  }
</style>
