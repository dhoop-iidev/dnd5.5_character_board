<script lang="ts">
  // The druid's in-play card while shape-shifted: only what the player uses, the form's values in black, the player's
  // own kept values in the accent colour (SRD 5.2.1 p. 42–43 "Rules While Shape-Shifted").
  import { rules } from '../data/rules'
  import type { CreatureDef, I18n } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import { fmt, wildShapeView, type WsValue } from '../engine/wildShapeView'
  import { app, tr, view } from '../state.svelte'
  import { creatureI18nHtml } from './creatureHtml'
  import { openPopup } from './popupState.svelte'

  let { def }: { def: CreatureDef } = $props()
  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const v = $derived(wildShapeView(c, sheet, def, rules))
  const cls = (x: WsValue) => (x.from === 'you' ? 'you' : x.from === 'merged' ? 'merged' : 'beast')
  const FROM: Record<WsValue['from'], I18n> = {
    beast: { en: 'from the form’s stat block', fr: 'du profil de la forme', es: 'del perfil de la forma' },
    you: { en: 'your own value, kept', fr: 'votre propre valeur, conservée', es: 'tu propio valor, conservado' },
    merged: {
      en: 'the form’s ability with your bonuses',
      fr: 'la caractéristique de la forme avec vos bonus',
      es: 'la característica de la forma con tus bonificadores',
    },
  }
  function explain(title: I18n, x: WsValue) {
    openPopup({
      title,
      lines: [FROM[x.from], ...(x.note ? [x.note] : [])],
      source: { page: 42, frPage: 44, section: 'Classes > Druid > Level 2: Wild Shape > Rules While Shape-Shifted' },
    })
  }
  const statBlock = () =>
    openPopup({ title: def.name, html: creatureI18nHtml(def), source: def.source, noteKey: `creature:${def.id}` })
</script>

<div class="ws">
  <div class="top">
    <div class="cell">
      <span class="tag">{tr({ en: 'Hit Points', fr: 'Points de vie', es: 'Puntos de golpe' })}</span>
      <span class="big you">{v.hp.current}{v.hp.temp ? ` (+${v.hp.temp})` : ''} / {v.hp.max}</span>
    </div>
    <div class="cell">
      <span class="tag">{tr({ en: 'AC', fr: 'CA', es: 'CA' })}</span>
      <button
        class="big {cls(v.ac)}"
        onclick={() => explain({ en: 'Armor Class', fr: 'Classe d’armure', es: 'Clase de armadura' }, v.ac)}
        >{v.ac.value}</button
      >
    </div>
    <div class="cell">
      <span class="tag">{tr({ en: 'Initiative', fr: 'Initiative', es: 'Iniciativa' })}</span>
      <button
        class="big {cls(v.initiative)}"
        onclick={() => explain({ en: 'Initiative', fr: 'Initiative', es: 'Iniciativa' }, v.initiative)}
        >{fmt(v.initiative.value)}</button
      >
    </div>
    <div class="cell">
      <span class="tag">{tr({ en: 'Speed', fr: 'Vitesse', es: 'Velocidad' })}</span>
      <span class="big beast small">{tr(v.speed)}</span>
    </div>
    <div class="cell">
      <span class="tag"
        >{tr({ en: 'Proficiency Bonus', fr: 'Bonus de maîtrise', es: 'Bonificador por competencia' })}</span
      >
      <span class="big you">{fmt(v.pb)}</span>
    </div>
    <div class="cell">
      <span class="tag">{tr({ en: 'Passive Perception', fr: 'Perception passive', es: 'Percepción pasiva' })}</span>
      <span class="big merged">{v.passivePerception}</span>
    </div>
  </div>

  <table class="abil">
    <thead
      ><tr
        ><th></th>{#each ABILITIES as a (a)}<th>{tr(ABILITY_SHORT[a])}</th>{/each}</tr
      ></thead
    >
    <tbody>
      <tr
        ><th>{tr({ en: 'Score', fr: 'Valeur', es: 'Puntuación' })}</th>{#each ABILITIES as a (a)}<td
            class={cls(v.abilities[a].score)}>{v.abilities[a].score.value}</td
          >{/each}</tr
      >
      <tr
        ><th>{tr({ en: 'Mod', fr: 'Mod', es: 'Mod' })}</th>{#each ABILITIES as a (a)}<td class={cls(v.abilities[a].mod)}
            >{fmt(v.abilities[a].mod.value)}</td
          >{/each}</tr
      >
      <tr
        ><th>{tr({ en: 'Save', fr: 'JS', es: 'Salvación' })}</th>{#each ABILITIES as a (a)}<td
            ><button
              class={cls(v.abilities[a].save)}
              onclick={() =>
                explain(
                  {
                    en: `${a.toUpperCase()} saving throw`,
                    fr: `Jet de sauvegarde ${a.toUpperCase()}`,
                    es: `Tirada de salvación de ${a.toUpperCase()}`,
                  },
                  v.abilities[a].save,
                )}>{fmt(v.abilities[a].save.value)}{v.abilities[a].saveProficient ? ' ●' : ''}</button
            ></td
          >{/each}</tr
      >
    </tbody>
  </table>

  <details class="skills">
    <summary>{tr({ en: 'Skills', fr: 'Compétences', es: 'Habilidades' })}</summary>
    <ul>
      {#each v.skills as s (s.id)}
        <li>
          <button class={cls(s.total)} onclick={() => explain(s.name, s.total)}
            >{tr(s.name)} {fmt(s.total.value)}{s.proficient ? ' ●' : ''}</button
          >
        </li>
      {/each}
    </ul>
  </details>

  <div class="actions">
    {#each [...(def.traits ?? []), ...(def.actions ?? []), ...(def.bonusActions ?? []), ...(def.reactions ?? [])] as e, i (i)}
      <p><strong>{tr(e.name)}.</strong> {@html tr(e.text)}</p>
    {/each}
    <p class="meta">
      <strong>{tr({ en: 'Senses', fr: 'Sens', es: 'Sentidos' })}</strong>
      {tr(v.senses)} · <strong>{tr({ en: 'Languages', fr: 'Langues', es: 'Idiomas' })}</strong>
      <span class="you">{tr(v.languages)}</span>
    </p>
    {#if def.resistances}<p class="meta">
        <strong>{tr({ en: 'Resistances', fr: 'Résistances', es: 'Resistencias' })}</strong>
        {tr(def.resistances)}
      </p>{/if}
    {#if def.immunities}<p class="meta">
        <strong>{tr({ en: 'Immunities', fr: 'Immunités', es: 'Inmunidades' })}</strong>
        {tr(def.immunities)}
      </p>{/if}
  </div>

  <p class="legend">
    <span class="you">■</span>
    {tr({ en: 'your own value, kept', fr: 'votre valeur, conservée', es: 'tu propio valor, conservado' })} ·
    <span class="merged">■</span>
    {tr({
      en: 'the form’s ability with your bonuses',
      fr: 'caractéristique de la forme + vos bonus',
      es: 'la característica de la forma con tus bonificadores',
    })} ·
    <span class="beast">■</span>
    {tr({ en: 'the form’s stat block', fr: 'profil de la forme', es: 'perfil de la forma' })} ·
    <button class="link" onclick={statBlock}
      >{tr({ en: 'full stat block', fr: 'profil complet', es: 'perfil completo' })}</button
    >
  </p>
  <ul class="retained">
    {#each v.retained as r, i (i)}<li>{tr(r)}</li>{/each}
  </ul>
</div>

<style>
  .ws {
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.6rem 0.8rem;
    background: var(--paper);
  }
  .top {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.6rem;
    text-align: center;
  }
  .tag {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .big {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 1.6rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .big.small {
    font-size: 1.05rem;
  }
  .you {
    color: var(--accent);
  }
  .merged {
    color: var(--ink);
    text-decoration: underline dotted var(--accent);
    text-underline-offset: 0.2em;
  }
  .beast {
    color: var(--ink);
  }
  .abil {
    width: 100%;
    margin: 0.8rem 0 0.4rem;
    font-family: var(--font-num);
    text-align: center;
  }
  .abil th {
    font-family: var(--font-title);
    font-weight: 400;
    color: var(--ink-soft);
  }
  .abil td button {
    font: inherit;
    font-weight: 700;
    background: none;
    border: none;
    padding: 0.1em 0.3em;
    cursor: pointer;
  }
  .skills summary {
    cursor: pointer;
    font-family: var(--font-title);
    min-height: 2.2rem;
    display: flex;
    align-items: center;
  }
  .skills ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.1rem 0.6rem;
  }
  .skills li button {
    font: inherit;
    background: none;
    border: none;
    padding: 0.15em 0;
    cursor: pointer;
    text-align: left;
  }
  .actions p {
    margin: 0.3rem 0;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.9em;
  }
  .legend {
    font-size: 0.85em;
    color: var(--ink-soft);
    margin: 0.6rem 0 0.2rem;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    color: var(--ink);
    text-decoration: underline dotted var(--rule-strong);
    cursor: pointer;
  }
  .retained {
    margin: 0.2rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.85em;
    color: var(--ink-soft);
  }
</style>
