<script lang="ts">
  // Druid Wild Shape (SRD 5.2.1 p. 42 "Wild Shape", FR p. 44): uses, known Beast forms (Beast Shapes table), assume and
  // revert, and the in-play card of the assumed form. Shown at the top of the Spells pane (moved from the Companions
  // pane at the user's request, 2026-10-26).
  import { rules } from '../data/rules'
  import type { CreatureDef } from '../data/types'
  import {
    assumeForm,
    BEAST_SHAPES,
    crText,
    eligibleForms,
    revertForm,
    SRC_WILD_SHAPE,
    WILD_SHAPE_ID,
    wildShapeLimitsFor,
  } from '../engine/companions'
  import { UI } from '../i18n/ui'
  import { app, tr, view } from '../state.svelte'
  import { creatureI18nHtml } from './creatureHtml'
  import { norm } from './items'
  import { openPopup } from './popupState.svelte'
  import RuleText from './RuleText.svelte'
  import WarningList from './WarningList.svelte'
  import WildShapeView from './WildShapeView.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const lim = $derived(wildShapeLimitsFor(sheet))
  const wildUses = $derived(sheet.resources.find((r) => r.id === WILD_SHAPE_ID))
  const knownDefs = $derived(
    c.wildShape.known.map((id) => rules.creatures.get(id)).filter((x): x is CreatureDef => !!x),
  )
  const activeDef = $derived(c.wildShape.active ? rules.creatures.get(c.wildShape.active) : undefined)
  let formQuery = $state('')
  const byName = (a: CreatureDef, b: CreatureDef) => tr(a.name).localeCompare(tr(b.name))
  const formCandidates = $derived.by(() => {
    if (!lim) return []
    const q = norm(formQuery)
    return eligibleForms(rules, lim)
      .filter((d) => !c.wildShape.known.includes(d.id) && (!q || norm(tr(d.name)).includes(q)))
      .sort((a, b) => (a.cr ?? 0) - (b.cr ?? 0) || byName(a, b))
  })
  function addForm(id: string) {
    c.wildShape.known.push(id)
    formQuery = ''
  }
  function removeForm(id: string) {
    c.wildShape.known = c.wildShape.known.filter((x) => x !== id)
    if (c.wildShape.active === id) revertForm(c)
  }
  const formLines = (d: CreatureDef) => [
    {
      en: `CR ${crText(d.cr)} · ${d.speed.text.en}`,
      fr: `FP ${crText(d.cr)} · ${d.speed.text.fr}`,
      es: `VD ${crText(d.cr)} · ${d.speed.text.es ?? d.speed.text.en}`,
    },
  ]
</script>

{#if lim}
  <section class="box">
    <h3>{tr(UI.wildShape)}</h3>
    <WarningList areas={['companions']} filter={(w) => w.id.startsWith('wild-shape')} />
    <p class="row">
      <RuleText
        name={UI.wildShape}
        text={sheet.owners.find((o) => o.id === WILD_SHAPE_ID)?.text}
        source={SRC_WILD_SHAPE}
        noteKey="feature:{WILD_SHAPE_ID}"
      />
      {#if wildUses}
        <span class="uses">
          {#each Array(wildUses.max) as _, i (i)}
            <button
              class="pip"
              class:spent={i < wildUses.spent}
              onclick={() => (c.resources[WILD_SHAPE_ID] = i < wildUses.spent ? i : i + 1)}
              aria-label={`${i + 1}`}
            ></button>
          {/each}
          <span class="meta"
            >{wildUses.max - wildUses.spent} / {wildUses.max} · {tr(UI.longRest)} ({tr({
              en: 'one back per Short Rest',
              fr: 'une récupérée par repos court',
              es: 'recuperas uno por descanso corto',
            })})</span
          >
        </span>
      {/if}
    </p>

    {#if activeDef}
      <div class="active">
        <p class="banner">
          <strong
            >{tr({ en: 'Shape-shifted', fr: 'Métamorphosé(e)', es: 'Transformado' })} : {tr(activeDef.name)}</strong
          >
          · {tr({
            en: `${lim.hours} hour${lim.hours > 1 ? 's' : ''}`,
            fr: `${lim.hours} heure${lim.hours > 1 ? 's' : ''}`,
            es: `${lim.hours} hora${lim.hours > 1 ? 's' : ''}`,
          })}
          · {tr(UI.tempHp)}
          {lim.tempHp}
          <button class="opt" onclick={() => revertForm(c)}
            >{tr({
              en: 'Revert (Bonus Action)',
              fr: 'Reprendre sa forme (action bonus)',
              es: 'Recuperar tu forma (acción adicional)',
            })}</button
          >
        </p>
        <p class="hint">
          {tr({
            en: 'You keep your creature type, Hit Points and Hit Point Dice, Intelligence, Wisdom and Charisma, class features, languages, feats, and your skill and saving-throw proficiencies with your Proficiency Bonus (use the stat block’s modifier when higher). No spellcasting; Concentration continues. (SRD p. 42–43) The Temporary Hit Points are ordinary ones: they stay when you revert, until depleted or a Long Rest (p. 18; rulings-classes.md C1).',
            fr: 'Vous conservez votre type de créature, vos points de vie et dés de vie, Intelligence, Sagesse et Charisme, vos aptitudes de classe, langues, dons, et vos maîtrises de compétences et de jets de sauvegarde avec votre bonus de maîtrise (utilisez le modificateur du profil s’il est plus élevé). Pas de sorts ; la Concentration se poursuit. (SRD p. 44 FR) Les PV temporaires sont des PV temporaires ordinaires : ils restent quand vous reprenez votre forme, jusqu’à épuisement ou un repos long (p. 19 FR).',
            es: 'Conservas tu tipo de criatura, tus puntos de golpe y dados de puntos de golpe, Inteligencia, Sabiduría y Carisma, rasgos de clase, idiomas, dotes y tus competencias en habilidades y tiradas de salvación con tu bonificador por competencia (usa el modificador del perfil si es mayor). No puedes lanzar conjuros; la concentración continúa. (SRD p. 42–43) Los puntos de golpe temporales son normales: se mantienen al recuperar tu forma, hasta agotarse o hasta un descanso largo (p. 18; rulings-classes.md C1).',
          })}
        </p>
        <WildShapeView def={activeDef} />
      </div>
    {/if}

    <h4>
      {tr(UI.knownForms)}
      <span class="meta"
        >{c.wildShape.known.length} / {lim.known} · {tr({ en: 'max CR', fr: 'FP max', es: 'VD máx.' })}
        {crText(lim.maxCr)}{lim.fly
          ? ''
          : tr({ en: ', no Fly Speed', fr: ', sans vol', es: ', sin velocidad volando' })}{lim.changedBy
          ? ` · ${lim.changedBy.map((n) => tr(n)).join(', ')}`
          : ''}</span
      >
    </h4>
    <ul class="list">
      {#each knownDefs as d (d.id)}
        <li>
          <RuleText
            name={d.name}
            text={creatureI18nHtml(d)}
            source={d.source}
            noteKey="creature:{d.id}"
            lines={formLines(d)}
          />
          <span class="meta">{tr(UI.challenge)} {crText(d.cr)} · {tr(d.speed.text)}</span>
          <button
            class="opt"
            disabled={!wildUses || wildUses.spent >= wildUses.max || c.wildShape.active === d.id}
            onclick={() => assumeForm(c, sheet, d.id)}
            >{tr({
              en: 'Assume (Bonus Action)',
              fr: 'Adopter (action bonus)',
              es: 'Adoptar (acción adicional)',
            })}</button
          >
          <button
            class="del"
            onclick={() => removeForm(d.id)}
            aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
          >
        </li>
      {/each}
    </ul>
    <input
      type="search"
      bind:value={formQuery}
      placeholder={tr({
        en: 'Learn a Beast form…',
        fr: 'Apprendre une forme de Bête…',
        es: 'Aprender una forma de bestia…',
      })}
    />
    {#if formQuery.length >= 1}
      <ul class="results">
        {#each formCandidates.slice(0, 25) as d (d.id)}
          <li>
            <button onclick={() => addForm(d.id)}
              >＋ {tr(d.name)} <span class="meta">{tr(UI.challenge)} {crText(d.cr)} · {tr(d.speed.text)}</span></button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <table class="shapes">
      <caption
        ><button
          class="link"
          onclick={() =>
            openPopup({
              title: { en: 'Beast Shapes', fr: 'Formes de Bête', es: 'Formas de bestia' },
              html: sheet.owners.find((o) => o.id === WILD_SHAPE_ID)?.text,
              source: SRC_WILD_SHAPE,
            })}>{tr({ en: 'Beast Shapes', fr: 'Formes de Bête', es: 'Formas de bestia' })}</button
        ></caption
      >
      <thead
        ><tr
          ><th>{tr({ en: 'Druid level', fr: 'Niveau de Druide', es: 'Nivel de druida' })}</th><th
            >{tr(UI.knownForms)}</th
          ><th>{tr({ en: 'Max CR', fr: 'FP max', es: 'VD máx.' })}</th><th
            >{tr({ en: 'Fly Speed', fr: 'Vitesse de vol', es: 'Velocidad volando' })}</th
          ></tr
        ></thead
      >
      <tbody>
        {#each BEAST_SHAPES as r (r.level)}
          <tr class:now={lim.known === r.known}
            ><td>{r.level}</td><td>{r.known}</td><td>{crText(r.maxCr)}</td><td
              >{r.fly ? tr({ en: 'Yes', fr: 'Oui', es: 'Sí' }) : tr({ en: 'No', fr: 'Non', es: 'No' })}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  .box {
    margin-bottom: 1.25rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 0.5rem;
  }
  .uses {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .pip {
    width: 1.3rem;
    min-height: 1.3rem;
    height: 1.3rem;
    padding: 0;
    border-radius: 50%;
    border: 1.5px solid var(--frame);
    background: var(--accent);
  }
  .pip.spent {
    background: transparent;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
    margin-left: 0.4em;
  }
  h4 {
    font-family: var(--font-title);
    font-weight: 400;
    margin: 1rem 0 0.4rem;
  }
  .list,
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .list li .opt {
    margin-left: auto;
  }
  .opt {
    min-height: 2.2rem;
    padding: 0 0.6rem;
    font-size: 0.9em;
  }
  .del {
    color: var(--danger);
    border-color: transparent;
    background: transparent;
    min-width: 2.4rem;
    min-height: 2.4rem;
  }
  input[type='search'] {
    min-height: 2.75rem;
    padding: 0 0.7rem;
    font: inherit;
  }
  input[type='search'] {
    width: 100%;
    margin-top: 0.75rem;
  }
  .results button {
    width: 100%;
    text-align: left;
    min-height: 2.5rem;
    font: inherit;
    border-color: transparent;
    background: none;
  }
  .active {
    margin: 0.5rem 0 1rem;
  }
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.8rem;
    border-left: 3px solid var(--accent);
    background: var(--paper-2);
  }
  .shapes {
    margin-top: 1rem;
    font-size: 0.92em;
  }
  .shapes caption {
    text-align: left;
    font-family: var(--font-title);
    padding-bottom: 0.3rem;
  }
  .shapes tr.now td {
    font-weight: 700;
  }
  .hint {
    font-size: 0.9em;
    color: var(--ink-soft);
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
</style>
