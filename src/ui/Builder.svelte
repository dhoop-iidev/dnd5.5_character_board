<script lang="ts">
  // Step-by-step creation and level up (user request 2026-10-30), in place of the tabs while it is open
  // (ui/builderState.svelte.ts). Creating: Class (with the level-1 skills and features) → Origin → Ability scores → Spells →
  // Weapon Mastery → Starting equipment → Summary, following the SRD "Character Creation" (SRD 5.2.1 p. 19–23, FR
  // p. 20–24). A level: that level's class, Hit Points, subclass, feat and choices → Spells → Weapon Mastery → Summary
  // (p. 23 "Gaining a Level"). The steps edit the live character with the sheet's own editors, and the step bar shows
  // what each one still needs (✓ or a count), from the rule checks (ui/creation.ts `stepOfWarning`). Never blocks: you
  // can leave at any time, the sheet's banner brings you back.
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import type { RuleWarning } from '../engine/checks/common'
  import { ABILITY_NAMES } from '../engine/sheet/common'
  import { UI } from '../i18n/ui'
  import { app, lang, tr, view } from '../state.svelte'
  import AbilityScores from './AbilityScores.svelte'
  import { builder, closeBuilder } from './builderState.svelte'
  import { applyKits, defaultIncreases, isStandardArray, stepOfWarning, suggestedArray, type StepId } from './creation'
  import LevelRow from './LevelRow.svelte'
  import OriginEditor from './OriginEditor.svelte'
  import Spells from './panes/Spells.svelte'
  import { progressionPlaces } from './progression'
  import { choicesFor, spellChoiceOwners } from './spellChoices'
  import StartingKits from './StartingKits.svelte'
  import { BACKGROUND_KITS, CLASS_KITS } from '../model/startingEquipment'
  import WarningList from './WarningList.svelte'
  import WeaponMasteryPicker from './WeaponMasteryPicker.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const i = $derived(Math.min(builder.index, c.levels.length - 1))
  const cls = $derived(view.rules.classes.get(c.levels[i]?.classId))
  const abilityList = (ids: AbilityId[], sep = ', ') => ids.map((a) => tr(ABILITY_NAMES[a])).join(sep)

  const hasSpells = $derived(
    !!(sheet.spellcasting.length || sheet.extraSpells.length || spellChoiceOwners(sheet).length),
  )
  const steps = $derived.by((): StepId[] => {
    const out: StepId[] = ['level']
    if (i === 0) out.push('origin', 'abilities')
    if (hasSpells) out.push('spells')
    if (sheet.masteryMax) out.push('combat')
    if (builder.create) out.push('equipment')
    out.push('summary')
    return out
  })
  const step = $derived(steps.includes(builder.step) ? builder.step : 'level')
  const at = $derived(steps.indexOf(step))

  const LABELS: Record<StepId, { en: string; fr: string; es: string }> = {
    level: { en: 'Class', fr: 'Classe', es: 'Clase' },
    origin: { en: 'Origin', fr: 'Origines', es: 'Origen' },
    abilities: { en: 'Ability scores', fr: 'Caractéristiques', es: 'Características' },
    spells: { en: 'Spells', fr: 'Sorts', es: 'Conjuros' },
    combat: { en: 'Weapon Mastery', fr: 'Bottes d’arme', es: 'Maestría con armas' },
    equipment: { en: 'Equipment', fr: 'Équipement', es: 'Equipo' },
    summary: { en: 'Summary', fr: 'Récapitulatif', es: 'Resumen' },
  }
  const label = (s: StepId) =>
    s === 'level' && i > 0 ? tr({ en: `Level ${i + 1}`, fr: `Niveau ${i + 1}`, es: `Nivel ${i + 1}` }) : tr(LABELS[s])

  /** The step that fixes each actionable warning of this level. */
  const stepOf = (w: RuleWarning) => stepOfWarning(w, c, sheet, rules, i)
  const todo = $derived(view.warnings.filter((w) => w.actionable && stepOf(w)))
  const count = (s: StepId) => todo.filter((w) => stepOf(w) === s).length

  const go = (s: StepId) => {
    builder.step = s
    window.scrollTo?.(0, 0)
  }

  // Creating: a new class starts again from its suggested array (if the scores are still a Standard Array), its
  // starting equipment option A, and none of the old class's skill, Weapon Mastery and spell picks.
  function onClass(classId: string) {
    if (!builder.create || i !== 0) return
    c.skillProficiencies = []
    c.weaponMastery = []
    c.spellcasting = {}
    if (isStandardArray(c.baseAbilities, rules)) c.baseAbilities = suggestedArray(classId, rules)
    defaultIncreases(c, rules)
    if (builder.kits?.classKit) {
      builder.kits.classKit = CLASS_KITS[classId]?.[0]?.letter ?? ''
      applyKits(c, builder.kits)
    }
  }
  function onBackground() {
    if (!builder.create || !builder.kits?.backgroundKit) return
    builder.kits.backgroundKit = BACKGROUND_KITS[c.background.backgroundId]?.[0]?.letter ?? ''
    applyKits(c, builder.kits)
  }

  const places = $derived(progressionPlaces(c, sheet, rules))
  /** Species trait and origin feat choices (Magic Initiate's spells are in the Spells step). */
  const originOwners = $derived(
    sheet.owners.filter((o) => choicesFor(o, 'rest').length && places.placeOf(o) === 'origin'),
  )

  function finish() {
    // A new character starts with all its Hit Points (SRD p. 22).
    if (builder.create) c.hp.current = Math.max(1, view.sheet.hpMax.total)
    closeBuilder()
  }
  const gpText = (n: number) => `${n} ${lang() === 'en' ? 'GP' : 'po'}`
</script>

<div class="builder">
  <div class="head">
    <h2>
      {builder.create
        ? tr({ en: 'Character creation', fr: 'Création du personnage', es: 'Creación del personaje' })
        : tr({ en: `Level ${i + 1}`, fr: `Niveau ${i + 1}`, es: `Nivel ${i + 1}` })}
    </h2>
    <button class="ghost" onclick={finish}
      >✕ {tr({ en: 'Back to the sheet', fr: 'Retour à la feuille', es: 'Volver a la hoja' })}</button
    >
  </div>

  <ol class="steps">
    {#each steps as s, k (s)}
      {@const n = s === 'summary' ? todo.length : count(s)}
      <li>
        <button class:on={s === step} onclick={() => go(s)} aria-current={s === step ? 'step' : undefined}>
          <span class="k">{k + 1}</span>
          <span class="name">{label(s)}</span>
          {#if s !== 'summary' && s !== 'equipment'}
            {#if n}<span class="todo">{n}</span>{:else}<span class="ok">✓</span>{/if}
          {/if}
        </button>
      </li>
    {/each}
  </ol>

  <section class="box step">
    <h3>{label(step)}</h3>
    {#if step === 'level'}
      {#if i === 0 && builder.create}
        <div class="who">
          <label
            >{tr({ en: 'Character', fr: 'Personnage', es: 'Personaje' })}<input bind:value={c.identity.name} /></label
          >
          <label>{tr({ en: 'Player', fr: 'Joueur', es: 'Jugador' })}<input bind:value={c.identity.player} /></label>
        </div>
      {/if}
      <LevelRow {i} onclass={onClass} />
      {#if cls && i === 0}
        <dl class="facts">
          <div>
            <dt>{tr({ en: 'Primary ability', fr: 'Caractéristique principale', es: 'Característica principal' })}</dt>
            <dd>{abilityList(cls.primaryAbility, ' · ')}</dd>
          </div>
          <div>
            <dt>{tr(UI.saves)}</dt>
            <dd>{abilityList(cls.saveProficiencies)}</dd>
          </div>
        </dl>
      {/if}
    {:else if step === 'origin'}
      <OriginEditor owners={originOwners} warnings={(w) => stepOf(w) === 'origin'} onbackground={onBackground} />
    {:else if step === 'abilities'}
      <AbilityScores />
      <WarningList filter={(w) => stepOf(w) === 'abilities'} compact />
    {:else if step === 'spells'}
      <Spells picking />
    {:else if step === 'combat'}
      <WeaponMasteryPicker />
      <WarningList filter={(w) => stepOf(w) === 'combat'} compact />
    {:else if step === 'equipment' && builder.kits}
      <StartingKits kits={builder.kits} />
    {:else}
      <p class="sum">
        {tr(UI.hpShort)} <b>{sheet.hpMax.total}</b> · {tr(UI.acShort)} <b>{sheet.ac.total}</b>
        {#if builder.create}· <b>{gpText(c.money.gp)}</b>{/if}
      </p>
      {#if todo.length}
        <p>
          {tr({
            en: `Still to choose (${todo.length}): you can finish now and come back with the banner on the sheet.`,
            fr: `Encore à choisir (${todo.length}) : vous pouvez terminer maintenant et revenir avec le bandeau de la feuille.`,
            es: `Aún por elegir (${todo.length}): puedes terminar ahora y volver con el aviso de la hoja.`,
          })}
        </p>
        <ul class="left">
          {#each steps.filter((s) => s !== 'summary' && count(s)) as s (s)}
            <li>
              <button class="link" onclick={() => go(s)}>{label(s)} ({count(s)}) →</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="done">
          ✓ {tr({
            en: 'Everything is chosen.',
            fr: 'Tout est choisi.',
            es: 'Todo está elegido.',
          })}
        </p>
      {/if}
      <WarningList filter={(w) => !w.actionable && !!stepOf(w)} compact />
    {/if}
  </section>

  <div class="nav">
    <button disabled={at <= 0} onclick={() => go(steps[at - 1])}
      >← {tr({ en: 'Previous', fr: 'Précédent', es: 'Anterior' })}</button
    >
    {#if step === 'summary'}
      <button class="primary" onclick={finish}
        >{tr({ en: 'Go to the sheet', fr: 'Aller à la feuille', es: 'Ir a la hoja' })} →</button
      >
    {:else}
      <button class="primary" onclick={() => go(steps[at + 1])}
        >{tr({ en: 'Next', fr: 'Suivant', es: 'Siguiente' })} →</button
      >
    {/if}
  </div>
</div>

<style>
  .builder {
    max-width: 56rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-family: var(--font-title);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .steps button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 0.7rem;
    font: inherit;
    background: var(--box);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    cursor: pointer;
  }
  .steps button.on {
    border-color: var(--frame);
    box-shadow: inset 0 -3px 0 var(--accent);
  }
  .k {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .name {
    font-family: var(--font-title);
  }
  .todo {
    min-width: 1.35rem;
    padding: 0 0.3em;
    border-radius: 1em;
    background: var(--accent);
    color: var(--paper);
    font-family: var(--font-num);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.35rem;
    text-align: center;
  }
  .ok {
    color: var(--ink-soft);
  }
  .step h3 {
    margin-top: 0;
  }
  .who {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.6rem 1rem;
    margin-bottom: 0.75rem;
  }
  .who label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-family: var(--font-title);
    font-size: 0.85em;
    color: var(--ink-soft);
  }
  .who input {
    min-height: 2.6rem;
    font: inherit;
    font-size: 1.05rem;
    color: var(--ink);
    padding: 0 0.5rem;
  }
  .facts {
    margin: 0.75rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.95em;
  }
  .facts div {
    display: flex;
    gap: 0.5rem;
  }
  .facts dt {
    font-family: var(--font-title);
    color: var(--ink-soft);
    flex: 0 0 11rem;
  }
  .facts dd {
    margin: 0;
  }
  .sum {
    font-family: var(--font-title);
  }
  .sum b {
    font-family: var(--font-num);
  }
  .left {
    padding-left: 1.2rem;
  }
  .link {
    min-height: 2.4rem;
    font: inherit;
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .done {
    color: var(--ink-soft);
  }
  .nav {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .nav button,
  .head button {
    min-height: 2.75rem;
    padding: 0 1.1rem;
    font: inherit;
    cursor: pointer;
  }
  .primary {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
  }
  @media (max-width: 30rem) {
    .steps .name {
      display: none;
    }
    .steps button.on .name {
      display: inline;
    }
    .facts dt {
      flex-basis: 7rem;
    }
  }
</style>
