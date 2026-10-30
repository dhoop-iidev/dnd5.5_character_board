<script lang="ts">
  // The Builder's Origin step (ui/Builder.svelte): species and size, background, languages (SRD 5.2.1 p. 20), then the
  // choices of the species traits and origin feats (lineage, Skillful…; Magic Initiate's spells are in the Spells step).
  // Changing the background gives its own Origin feat and its default ability increases (ui/creation.ts); changing the
  // species clears its trait choices. The ability scores have their own step (ui/AbilityScores.svelte).
  // The custom background (house rule #3) shows its picks under the select.
  import { languageName, languageOf, STARTING_LANGUAGES } from '../model/languages'
  import { rules } from '../data/rules'
  import type { RuleWarning } from '../engine/checks/common'
  import type { Owner } from '../engine/sheet/types'
  import { SIZE_NAMES, UI } from '../i18n/ui'
  import { featListOf } from '../model/newCharacter'
  import { backgroundDef, CUSTOM_BACKGROUND } from '../model/customBackground'
  import CustomBackgroundEditor from './CustomBackgroundEditor.svelte'
  import { app, tr, view } from '../state.svelte'
  import ChoiceEditor from './ChoiceEditor.svelte'
  import LanguagePicker from './LanguagePicker.svelte'
  import ToolChoicePicker from './ToolChoicePicker.svelte'
  import { toolChoicesOf } from '../model/toolChoices'
  import { defaultIncreases } from './creation'
  import WarningList from './WarningList.svelte'

  let {
    owners,
    warnings,
    onbackground,
  }: { owners: Owner[]; warnings: (w: RuleWarning) => boolean; onbackground?: () => void } = $props()

  const c = $derived(app.character)
  const sp = $derived(view.rules.species.get(c.speciesId))
  const bg = $derived(backgroundDef(c.background, rules))
  const byName = <T extends { name: { en: string } }>(list: T[]) =>
    [...list].sort((a, b) => tr(a.name as never).localeCompare(tr(b.name as never)))
  const speciesList = $derived(byName([...view.rules.species.values()]))
  const backgroundList = $derived(byName([...rules.backgrounds.values()]))

  function setSpecies(id: string) {
    const old = c.speciesId
    c.speciesId = id
    const def = view.rules.species.get(id)
    c.speciesChoices = def && def.size.length > 1 ? { size: def.size.includes('medium') ? 'medium' : def.size[0] } : {}
    // The old species' trait choices and trait feats (Human Versatile) no longer apply.
    for (const k of Object.keys(c.featureChoices)) if (k.startsWith(`${old}:`)) delete c.featureChoices[k]
    for (const k of Object.keys(c.extraFeats)) if (k.startsWith(`${old}:`)) delete c.extraFeats[k]
  }
  function setBackground(id: string) {
    if (id === CUSTOM_BACKGROUND) {
      c.background = {
        backgroundId: id,
        abilities: {},
        feat: { featId: '' },
        custom: { abilities: [], skills: [], tool: '' },
      }
      onbackground?.()
      return
    }
    const def = rules.backgrounds.get(id)
    const list = featListOf(def?.featText?.en, rules)
    c.background = {
      backgroundId: id,
      abilities: {},
      feat: { featId: def?.feat ?? '', ...(list ? { choices: { list } } : {}) },
    }
    defaultIncreases(c, rules)
    onbackground?.()
  }
  /** Known languages as stored: table ids ('elvish'), or text for a language from another book. */
  const langs = $derived(c.identity.languages ?? [])
  const keyOf = (l: string) => languageOf(l)?.id ?? l.trim().toLowerCase()
  /** Languages known from elsewhere (Thieves' Cant, Druidic, a feature's pick): greyed in the chips. */
  const othersList = $derived.by(() => {
    const own = new Set(langs.map(keyOf))
    return view.sheet.proficiencies.languages.filter((l) => !own.has(keyOf(l)))
  })
  const others = $derived(new Set(othersList.map(keyOf)))
  const othersText = $derived(othersList.map((l) => tr(languageName(l))).join(', '))
</script>

<div class="origin">
  <div class="fields">
    <label>
      {tr(UI.species)}
      <select value={c.speciesId} onchange={(e) => setSpecies(e.currentTarget.value)}>
        {#each speciesList as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
      </select>
    </label>
    {#if sp && sp.size.length > 1}
      <label>
        {tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}
        <select bind:value={c.speciesChoices.size}>
          {#if !c.speciesChoices.size}<option value={undefined}
              >— {tr({ en: 'choose', fr: 'choisir', es: 'elegir' })} —</option
            >{/if}
          {#each sp.size as z (z)}<option value={z}>{SIZE_NAMES[z] ? tr(SIZE_NAMES[z]) : z}</option>{/each}
        </select>
      </label>
    {/if}
    <label>
      {tr(UI.background)}
      <select value={c.background.backgroundId} onchange={(e) => setBackground(e.currentTarget.value)}>
        {#each backgroundList as b (b.id)}<option value={b.id}>{tr(b.name)}</option>{/each}
        <option value={CUSTOM_BACKGROUND}
          >{tr({ en: 'Custom background', fr: 'Historique personnalisé', es: 'Trasfondo personalizado' })}</option
        >
      </select>
    </label>
  </div>
  {#if c.background.backgroundId === CUSTOM_BACKGROUND && c.background.custom}
    <CustomBackgroundEditor
      custom={c.background.custom}
      featId={c.background.feat.featId}
      onfeat={(id) => (c.background.feat = { featId: id })}
    />
  {/if}

  <!-- Languages (p. 20): Common plus two from the Standard Languages table; rare ones on the DM's say-so. -->
  <p class="sub">
    {tr({
      en: `Languages (${langs.length} / ${STARTING_LANGUAGES}): Common plus two of your choice; your class or species may add more.`,
      fr: `Langues (${langs.length} / ${STARTING_LANGUAGES}) : le commun et deux langues de votre choix ; classe ou espèce peuvent en ajouter.`,
      es: `Idiomas (${langs.length} / ${STARTING_LANGUAGES}): común y dos a tu elección; tu clase o especie pueden añadir más.`,
    })}
  </p>
  <LanguagePicker values={c.identity.languages ?? []} onchange={(v) => (c.identity.languages = v)} known={others} />
  {#if othersText}
    <p class="sub">
      {tr({
        en: 'Also known (class, species):',
        fr: 'Également connues (classe, espèce) :',
        es: 'También conocidos (clase, especie):',
      })}
      {othersText}
    </p>
  {/if}

  {#each toolChoicesOf(c, rules).filter((t) => t.place === 'origin') as t (t.key)}
    <ToolChoicePicker choice={t} />
  {/each}

  {#each owners as o (o.id)}
    <div class="owner"><span class="meta">{tr(o.name)}</span><ChoiceEditor owner={o} /></div>
  {/each}

  <WarningList filter={warnings} compact />
</div>

<style>
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  .fields label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  .sub {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .owner {
    margin-top: 0.5rem;
  }
  .fields select {
    min-height: 2.4rem;
    font: inherit;
    font-size: 1rem;
  }
  .meta {
    display: block;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
