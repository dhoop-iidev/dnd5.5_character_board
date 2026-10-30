<script lang="ts">
  // One level of the build, edited in the Builder (ui/Builder.svelte): class, Hit Point Die roll or fixed value,
  // subclass at class level 3, Fighting Style, feat at the Ability Score Improvement levels (SRD 5.2.1 p. 23 "Gaining a
  // Level"), the choices of the features, feats and options gained there, and at level 1 the class's skill
  // proficiencies. The level's build warnings are listed under it. Never blocks: illegal choices stay possible.
  import { choicesFor, isSpellChoiceWarning } from './spellChoices'
  import { rules } from '../data/rules'
  import type { AbilityId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { UI } from '../i18n/ui'
  import { ABILITY_SHORT } from '../engine/sheet/common'
  import type { RuleWarning } from '../engine/checks/common'
  import { app, tr, view } from '../state.svelte'
  import type { LevelEntry } from '../model/character'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import { progressionPlaces } from './progression'
  import WarningList from './WarningList.svelte'

  let { i, onclass }: { i: number; onclass?: (classId: string) => void } = $props()

  const c = $derived(app.character)
  const l = $derived(c.levels[i])
  const sheet = $derived(view.sheet)
  const classes = $derived([...view.rules.classes.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name))))
  const def = $derived(view.rules.classes.get(l.classId))
  const places = $derived(progressionPlaces(c, sheet, rules))
  const cl = $derived(places.classLevelAt(i))

  function setClass(id: string) {
    l.classId = id
    onclass?.(id)
  }
  const needsFeat = $derived(!!def && (def.asiLevels.includes(cl) || cl === 19))
  // Any feat you qualify for (SRD p. 87; each class's Ability Score Improvement); Epic Boons from level 19.
  const featChoices = $derived(
    [...view.rules.feats.values()]
      .filter((f) => f.category !== 'epic-boon' || cl === 19)
      .sort((a, b) => a.category.localeCompare(b.category) || tr(a.name).localeCompare(tr(b.name))),
  )
  function setFeat(entry: LevelEntry, id: string) {
    if (!id) {
      delete entry.feat
      return
    }
    entry.feat = { featId: id, abilities: {} }
  }
  function setInc(entry: LevelEntry, a: AbilityId, v: number) {
    if (!entry.feat) return
    entry.feat.abilities ??= {}
    if (v) entry.feat.abilities[a] = v
    else delete entry.feat.abilities[a]
  }
  const first = $derived(view.rules.classes.get(c.levels[0]?.classId))
  const skillList = $derived(
    first ? (first.skillChoices.from === 'any' ? [...rules.skills.keys()] : first.skillChoices.from) : [],
  )
  function toggleSkill(id: string) {
    const k = c.skillProficiencies.indexOf(id as never)
    if (k >= 0) c.skillProficiencies.splice(k, 1)
    else c.skillProficiencies.push(id as never)
  }
  /** Owners of this level that ask for a choice (the Fighting Style is picked in its own field; spell picks in the
   * Spells step). */
  const owners = $derived(
    sheet.owners.filter(
      (o) => choicesFor(o, 'rest').length && !o.id.endsWith(':fighting-style') && places.placeOf(o) === i,
    ),
  )
  const here = (w: RuleWarning) => !isSpellChoiceWarning(w, sheet) && places.placeOfWarning(w) === i
  const choicesHere = (w: RuleWarning) => here(w) && !!w.choiceId
  const othersHere = (w: RuleWarning) => here(w) && !w.choiceId
  /** Paladin and Ranger options in place of a Fighting Style feat: two cantrips (SRD p. 54, p. 58). */
  const WARRIOR_STYLES: Record<string, { classId: string; name: { en: string; fr: string; es: string } }> = {
    'blessed-warrior': {
      classId: 'paladin',
      name: {
        en: 'Blessed Warrior (two Cleric cantrips)',
        fr: 'Guerrier béni (deux sorts mineurs de Clerc)',
        es: 'Guerrero bendito (dos trucos de clérigo)',
      },
    },
    'druidic-warrior': {
      classId: 'ranger',
      name: {
        en: 'Druidic Warrior (two Druid cantrips)',
        fr: 'Guerrier druidique (deux sorts mineurs de Druide)',
        es: 'Guerrero druídico (dos trucos de druida)',
      },
    },
  }
</script>

<div class="fields">
  <label>
    {tr(UI.class)}
    <select value={l.classId} onchange={(e) => setClass(e.currentTarget.value)}>
      {#each classes as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
    </select>
  </label>
  <div class="field">
    <span>{tr(UI.hitDice)} (d{def?.hitDie})</span>
    {#if i === 0}
      <span class="fixed"
        >{def?.hitDie} ({tr({
          en: 'maximum at level 1',
          fr: 'maximum au niveau 1',
          es: 'máximo en el nivel 1',
        })})</span
      >
    {:else}
      <span class="hp">
        <label class="inline"
          ><input type="checkbox" bind:checked={l.hpFixed} />
          {tr({ en: 'fixed', fr: 'fixe', es: 'fijo' })} ({(def?.hitDie ?? 8) / 2 + 1})</label
        >
        {#if !l.hpFixed}<input
            class="roll"
            type="number"
            min="1"
            max={def?.hitDie}
            bind:value={l.hpRoll}
            aria-label={tr({ en: 'Roll', fr: 'Jet', es: 'Tirada' })}
          />{/if}
      </span>
    {/if}
  </div>
  {#if cl === 3 && def}
    <label>
      {tr(UI.subclass)}
      <select bind:value={l.subclassId}>
        <option value={undefined}>— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
        {#each def.subclasses as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
      </select>
    </label>
  {/if}
  {#if def && def.features.some((f) => f.id.endsWith(':fighting-style') && f.level === cl)}
    <label>
      {tr({ en: 'Fighting Style', fr: 'Style de combat', es: 'Estilo de combate' })}
      <select
        value={c.featureChoices[`${def.id}:fighting-style`] ?? ''}
        onchange={(e) => (c.featureChoices[`${def.id}:fighting-style`] = e.currentTarget.value)}
      >
        <option value="">— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
        {#each [...view.rules.feats.values()].filter((f) => f.category === 'fighting-style') as f (f.id)}<option
            value={f.id}>{tr(f.name)}</option
          >{/each}
        {#each Object.entries(WARRIOR_STYLES).filter(([, x]) => x.classId === def.id) as [id, x] (id)}<option value={id}
            >{tr(x.name)}</option
          >{/each}
      </select>
    </label>
  {/if}
</div>

{#if needsFeat}
  <h4>{tr({ en: 'Feat', fr: 'Don', es: 'Dote' })}</h4>
  <div class="feat">
    <select value={l.feat?.featId ?? ''} onchange={(e) => setFeat(l, e.currentTarget.value)}>
      <option value="">— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option>
      {#each featChoices as f (f.id)}<option value={f.id}>{tr(f.name)}</option>{/each}
    </select>
    {#if l.feat}
      <span class="inc">
        {#each ABILITIES as a (a)}
          <label class="inline"
            >{tr(ABILITY_SHORT[a])}<input
              type="number"
              min="0"
              max="2"
              value={l.feat.abilities?.[a] ?? 0}
              onchange={(e) => setInc(l, a, +e.currentTarget.value)}
            /></label
          >
        {/each}
      </span>
    {/if}
  </div>
{/if}

{#if owners.length}
  <h4>{tr({ en: 'Choices', fr: 'Choix', es: 'Elecciones' })}</h4>
  {#each owners as o (o.id)}
    <div class="owner"><span class="meta">{tr(o.name)}</span><ChoiceEditor owner={o} /></div>
  {/each}
{/if}

{#if i === 0 && first}
  <h4>
    {tr({
      en: `Skill proficiencies of the ${first.name.en} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
      fr: `Maîtrises de compétence ${/^[aeiouyéèh]/i.test(first.name.fr) ? 'de l’' : 'du '}${first.name.fr} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
      es: `Competencias en habilidades de ${first.name.es ?? first.name.en} (${c.skillProficiencies.length} / ${first.skillChoices.count})`,
    })}
  </h4>
  <div class="chips">
    {#each skillList as id (id)}
      {@const mine = c.skillProficiencies.includes(id as never)}
      <!-- Already proficient from the background, a species trait or a feat: a wasted pick. -->
      {@const taken =
        !mine && ['proficient', 'expertise'].includes(sheet.skills.find((s) => s.id === id)?.proficiency ?? '')}
      <label
        class="chip"
        class:on={mine}
        class:taken
        title={taken ? tr({ en: 'Already proficient', fr: 'Déjà maîtrisée', es: 'Ya tienes competencia' }) : ''}
        ><input type="checkbox" checked={mine || taken} disabled={taken} onchange={() => toggleSkill(id)} />{tr(
          rules.skills.get(id)?.name,
        )}</label
      >
    {/each}
  </div>
{/if}

<WarningList filter={choicesHere} compact />
<WarningList filter={othersHere} compact />

<style>
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
  }
  .fields > label,
  .field {
    display: flex;
    flex-direction: column;
    font-size: 0.85em;
    font-family: var(--font-title);
    color: var(--ink-soft);
  }
  .fields select,
  .fixed,
  .hp {
    font-family: var(--font-body);
    font-size: 1.05rem;
    color: var(--ink);
  }
  .fixed,
  .hp {
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  select,
  input {
    min-height: 2.4rem;
    font: inherit;
    padding: 0 0.4rem;
    max-width: 100%;
  }
  .roll,
  .inc input {
    width: 3.6rem;
  }
  .meta {
    display: block;
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-right: 0.5rem;
    font-size: 0.9em;
  }
  .feat {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    align-items: center;
  }
  h4 {
    font-family: var(--font-title);
    font-weight: 400;
    margin: 0.9rem 0 0.35rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.2em 0.7em;
    min-height: 2.4rem;
    cursor: pointer;
    background: var(--box);
  }
  .chip.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .chip input {
    min-height: 0;
  }
  /* Already proficient from elsewhere. */
  .chip.taken {
    opacity: 0.55;
  }
  .owner {
    margin: 0.3rem 0;
    padding-left: 0.6rem;
    border-left: 2px solid var(--rule);
  }
</style>
