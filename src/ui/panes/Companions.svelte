<script lang="ts">
  // Companions pane: familiar (Find Familiar p. 130, Wild Companion p. 42, Pact of the Chain p. 74), steed (Find Steed
  // p. 130), the creatures summoned by a spell (ui/SummonBlock.svelte, moved from the Combat pane on 2026-10-29) and any
  // other creature at the character's side, each with its stat block and hit points. Druid Wild Shape is
  // at the top of the Spells pane (ui/WildShapeBlock.svelte).
  import { rules } from '../../data/rules'
  import type { CreatureDef } from '../../data/types'
  import {
    canHaveSteed,
    companionHpMax,
    crText,
    eligibleFamiliars,
    familiarSources,
    newCompanion,
    SRC_FIND_FAMILIAR,
    SRC_FIND_STEED,
  } from '../../engine/companions'
  import { UI } from '../../i18n/ui'
  import type { Companion } from '../../model/character'
  import { app, lang, tr, view } from '../../state.svelte'
  import CreatureBlock from '../CreatureBlock.svelte'
  import SummonBlock from '../SummonBlock.svelte'
  import { norm } from '../items'
  import { openPopup } from '../popupState.svelte'
  import WarningList from '../WarningList.svelte'
  import CustomCreatureForm from '../CustomCreatureForm.svelte'
  import { CUSTOM_CREATURE_ID, customCreatureDef, newCustomCreature } from '../../model/customCreature'
  import { formulaContext } from '../../model/formula'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const famSources = $derived(familiarSources(c, sheet))
  const familiars = $derived(c.companions.filter((x) => x.kind === 'familiar'))
  const steeds = $derived(c.companions.filter((x) => x.kind === 'steed'))
  const others = $derived(c.companions.filter((x) => x.kind !== 'familiar' && x.kind !== 'steed'))
  const warlock = $derived((sheet.classLevels.warlock ?? 0) >= 1)

  let otherQuery = $state('')
  let familiarForm = $state('owl')
  let familiarType = $state<Companion['creatureType']>('fey')
  let familiarName = $state('')
  let steedLevel = $state(2)
  let steedType = $state<Companion['creatureType']>('celestial')
  let steedName = $state('')

  const TYPES: { id: NonNullable<Companion['creatureType']>; name: { en: string; fr: string; es?: string } }[] = [
    { id: 'celestial', name: { en: 'Celestial', fr: 'Céleste', es: 'Celestial' } },
    { id: 'fey', name: { en: 'Fey', fr: 'Fée', es: 'Feérico' } },
    { id: 'fiend', name: { en: 'Fiend', fr: 'Fiélon', es: 'Infernal' } },
  ]
  const byName = (a: CreatureDef, b: CreatureDef) => tr(a.name).localeCompare(tr(b.name))
  const otherCandidates = $derived.by(() => {
    const q = norm(otherQuery)
    if (q.length < 2) return []
    return [...rules.creatures.values()]
      .filter((d) => norm(tr(d.name)).includes(q))
      .sort(byName)
      .slice(0, 25)
  })
  const familiarChoices = $derived(eligibleFamiliars(rules, warlock))

  function summonFamiliar() {
    const def = rules.creatures.get(familiarForm)
    if (!def) return
    c.companions.push(
      newCompanion(def, 'familiar', { creatureType: familiarType, name: familiarName.trim() || undefined }),
    )
    familiarName = ''
  }
  function summonSteed() {
    const def = rules.creatures.get('otherworldly-steed')
    if (!def) return
    c.companions.push(
      newCompanion(def, 'steed', {
        creatureType: steedType,
        spellLevel: steedLevel,
        name: steedName.trim() || undefined,
      }),
    )
    steedName = ''
  }
  function setSteedLevel(s: Companion, level: number) {
    const def = rules.creatures.get(s.creatureId)
    s.spellLevel = level
    const max = def ? companionHpMax(def, level) : undefined
    if (max !== undefined) {
      s.hp.max = max
      s.hp.current = Math.min(s.hp.current, max)
    }
  }
  function addOther(def: CreatureDef) {
    c.companions.push(newCompanion(def, def.tags.includes('beast') ? 'mount' : 'other'))
    otherQuery = ''
  }
  const remove = (uid: string) => (c.companions = c.companions.filter((x) => x.uid !== uid))

  // Creatures from another book (house rule #5): their stat block follows the character (formulas).
  const ctx = $derived(formulaContext(sheet))
  const defOf = (o: Companion): CreatureDef =>
    o.custom
      ? customCreatureDef(o.custom, ctx, `custom:${o.uid}`)
      : (rules.creatures.get(o.creatureId) ?? rules.creatures.get('rat')!)
  let editing = $state<string | null>(null)
  function addCustom() {
    const uid = Math.random().toString(36).slice(2, 10)
    c.companions.push({
      uid,
      kind: 'other',
      creatureId: CUSTOM_CREATURE_ID,
      custom: newCustomCreature(),
      hp: { current: 0, temp: 0, max: 0 },
    })
    editing = uid
  }
  // Their maximum Hit Points follow the formula (a level gained raises it; current Hit Points never exceed it).
  $effect(() => {
    for (const o of c.companions) {
      if (!o.custom) continue
      const max = customCreatureDef(o.custom, ctx).hp?.average
      if (max === undefined || max === o.hp.max) continue
      const fresh = o.hp.max === 0
      o.hp.max = max
      o.hp.current = fresh ? max : Math.min(o.hp.current, max)
    }
  })
</script>

<WarningList areas={['companions']} filter={(w) => !w.id.startsWith('wild-shape')} />

{#if famSources.length || familiars.length}
  <section class="box">
    <h3>{tr(UI.familiar)}</h3>
    <p class="hint">
      {tr({ en: 'Granted by', fr: 'Accordé par', es: 'Otorgado por' })} :
      {#each famSources as s, i (i)}
        {i ? ' · ' : ''}<button class="link" onclick={() => openPopup({ title: s.text, source: s.source })}
          >{tr(s.text)}</button
        >
      {/each}
    </p>
    {#each familiars as f (f.uid)}
      <CreatureBlock
        def={rules.creatures.get(f.creatureId) ?? rules.creatures.get('owl')!}
        companion={f}
        open={familiars.length === 1}
        onremove={() => remove(f.uid)}
      />
    {/each}
    {#if !familiars.length}
      <div class="summon">
        <select bind:value={familiarForm} aria-label={tr({ en: 'Form', fr: 'Forme', es: 'Forma' })}>
          {#each familiarChoices as d (d.id)}
            <option value={d.id}>{tr(d.name)}{d.tags.includes('beast') ? '' : ` (${tr(d.type)})`}</option>
          {/each}
        </select>
        <select
          bind:value={familiarType}
          aria-label={tr({ en: 'Creature type', fr: 'Type de créature', es: 'Tipo de criatura' })}
        >
          {#each TYPES as t (t.id)}<option value={t.id}>{tr(t.name)}</option>{/each}
        </select>
        <input type="text" bind:value={familiarName} placeholder={tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })} />
        <button onclick={summonFamiliar}>{tr({ en: 'Summon', fr: 'Invoquer', es: 'Invocar' })}</button>
      </div>
      <p class="hint">
        {tr({
          en: 'The familiar has the chosen form’s statistics but is a Celestial, Fey or Fiend; it can’t attack and rolls its own Initiative. Only one familiar at a time.',
          fr: 'Le familier a les statistiques de la forme choisie mais est un Céleste, une Fée ou un Fiélon ; il ne peut pas attaquer et joue sa propre Initiative. Un seul familier à la fois.',
          es: 'El familiar tiene el perfil de la forma elegida, pero es celestial, feérico o infernal; no puede atacar y tira su propia iniciativa. Solo un familiar a la vez.',
        })}
        <button
          class="link"
          onclick={() =>
            openPopup({
              title: { en: 'Find Familiar', fr: 'Trouver un familier', es: 'Encontrar familiar' },
              html: rules.spells.get('find-familiar')?.text,
              source: SRC_FIND_FAMILIAR,
            })}>ⓘ</button
        >
      </p>
    {/if}
  </section>
{/if}

{#if canHaveSteed(c) || steeds.length}
  <section class="box">
    <h3>{tr(UI.steed)}</h3>
    {#each steeds as s (s.uid)}
      <p class="row">
        <label
          >{tr({ en: 'Spell slot level', fr: 'Niveau d’emplacement', es: 'Nivel del espacio de conjuro' })}
          <select value={s.spellLevel ?? 2} onchange={(e) => setSteedLevel(s, parseInt(e.currentTarget.value, 10))}>
            {#each [2, 3, 4, 5, 6, 7, 8, 9] as l (l)}<option value={l}>{l}</option>{/each}
          </select>
        </label>
        <span class="meta"
          >{tr({
            en: 'AC 10 + 1 per spell level, HP 5 + 10 per spell level',
            fr: 'CA 10 + 1 par niveau du sort, PV 5 + 10 par niveau du sort',
            es: 'CA 10 + 1 por nivel del conjuro, PG 5 + 10 por nivel del conjuro',
          })}</span
        >
      </p>
      <CreatureBlock
        def={rules.creatures.get(s.creatureId) ?? rules.creatures.get('otherworldly-steed')!}
        companion={s}
        open={steeds.length === 1}
        onremove={() => remove(s.uid)}
      />
    {/each}
    {#if !steeds.length}
      <div class="summon">
        <label
          >{tr({ en: 'Spell slot level', fr: 'Niveau d’emplacement', es: 'Nivel del espacio de conjuro' })}
          <select bind:value={steedLevel}
            >{#each [2, 3, 4, 5, 6, 7, 8, 9] as l (l)}<option value={l}>{l}</option>{/each}</select
          >
        </label>
        <select
          bind:value={steedType}
          aria-label={tr({ en: 'Creature type', fr: 'Type de créature', es: 'Tipo de criatura' })}
        >
          {#each TYPES as t (t.id)}<option value={t.id}>{tr(t.name)}</option>{/each}
        </select>
        <input type="text" bind:value={steedName} placeholder={tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })} />
        <button onclick={summonSteed}>{tr({ en: 'Summon', fr: 'Invoquer', es: 'Invocar' })}</button>
      </div>
      <p class="hint">
        {tr({
          en: 'Otherworldly Steed stat block; it shares your Initiative and is a controlled mount.',
          fr: 'Profil de la Monture d’outremonde ; elle partage votre Initiative et est une monture contrôlée.',
          es: 'Perfil del corcel sobrenatural; comparte tu iniciativa y es una montura controlada.',
        })}
        <button
          class="link"
          onclick={() =>
            openPopup({
              title: { en: 'Find Steed', fr: 'Trouver une monture', es: 'Hallar corcel' },
              html: rules.spells.get('find-steed')?.text,
              source: SRC_FIND_STEED,
            })}>ⓘ</button
        >
      </p>
    {/if}
  </section>
{/if}

<!-- Creatures summoned or created by a spell (engine/summons.ts), only for a character with a summoning spell. -->
<div class="summons-wrap"><SummonBlock /></div>

<section class="box">
  <h3>{tr(UI.companions)}</h3>
  {#each others as o (o.uid)}
    <CreatureBlock def={defOf(o)} companion={o} open={editing === o.uid} onremove={() => remove(o.uid)} />
    {#if o.custom}
      <details class="edit" open={editing === o.uid}>
        <summary
          >{tr({ en: 'Edit its stat block', fr: 'Modifier son profil', es: 'Editar su perfil' })} ·
          {o.custom.name || '—'}</summary
        >
        <CustomCreatureForm cc={o.custom} />
      </details>
    {/if}
  {/each}
  <p class="row">
    <button onclick={addCustom}
      >＋ {tr({
        en: 'A creature from your book (subclass companion…)',
        fr: 'Une créature de votre livre (compagnon de sous-classe…)',
        es: 'Una criatura de tu libro (compañero de subclase…)',
      })}</button
    >
  </p>
  <input
    type="search"
    bind:value={otherQuery}
    placeholder={tr({
      en: 'Add a creature (mount, pet, summoned ally…)…',
      fr: 'Ajouter une créature (monture, animal, allié invoqué…)…',
      es: 'Añadir una criatura (montura, mascota, aliado invocado…)…',
    })}
  />
  {#if otherCandidates.length}
    <ul class="results">
      {#each otherCandidates as d (d.id)}
        <li>
          <button onclick={() => addOther(d)}
            >＋ {tr(d.name)} <span class="meta">{tr(d.type)} · {tr(UI.challenge)} {crText(d.cr)}</span></button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#if !others.length}
    <p class="hint">
      {tr({
        en: 'No other creature yet. Stat blocks come from the SRD 5.2.1 (Monsters); hit points are tracked here.',
        fr: 'Aucune autre créature. Les profils viennent du SRD 5.2.1 (chapitre Monstres) ; les points de vie sont suivis ici.',
        es: 'Aún no hay otras criaturas. Los perfiles vienen del SRD 5.2.1 (capítulo Monstruos); los puntos de golpe se siguen aquí.',
      })}
    </p>
  {/if}
</section>

<style>
  .edit {
    margin: -0.3rem 0 0.6rem;
    padding: 0.2rem 0.6rem;
    border-left: 2px solid var(--rule-strong);
  }
  .edit summary {
    cursor: pointer;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .box,
  .summons-wrap :global(.box) {
    margin-bottom: 1.25rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 0.5rem;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
    margin-left: 0.4em;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  input[type='search'],
  input[type='text'] {
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
  .summon {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }
  .summon select,
  .summon button {
    min-height: 2.75rem;
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
