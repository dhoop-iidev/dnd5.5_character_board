<script lang="ts">
  // Spells pane: Druid Wild Shape first (ui/WildShapeBlock.svelte), then per spellcasting class the save DC, spell
  // attack, prepared spells and cantrips (N / max); the shared spell slots (SRD 5.2.1 p. 104 "Preparing Spells", p. 25
  // multiclass slots), Pact Magic slots; the Wizard spellbook level by level (p. 78). Each spell is one line
  // (ui/SpellRow.svelte): summary, Metamagic ✦, Cast / Cast ✓ (slot spent, timed effect in the turn bar).
  import { rules } from '../../data/rules'
  import type { SpellDef } from '../../data/types'
  import { spellbookLevels, wizardList } from '../../engine/spellbook'
  import { UI } from '../../i18n/ui'
  import { ABILITY_NAMES } from '../../engine/sheet/common'
  import type { SpellcastingState } from '../../model/character'
  import type { ExtraSpells, Owner } from '../../engine/sheet/types'
  import { app, tr, view } from '../../state.svelte'
  import { castLog } from '../castLog.svelte'
  import ChoiceEditor from '../ChoiceEditor.svelte'
  import { isSpellChoiceWarning, spellChoiceOwners } from '../spellChoices'
  import SpellPicker from '../SpellPicker.svelte'
  import { byEnglishName } from '../order'
  import RuleText from '../RuleText.svelte'
  import SpellbookLevel from '../SpellbookLevel.svelte'
  import SpellRow from '../SpellRow.svelte'
  import StatValue from '../StatValue.svelte'
  import WarningList from '../WarningList.svelte'
  import WildShapeBlock from '../WildShapeBlock.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  // Spells granted by feats and traits are prepared whatever the class: they don't count (SRD Magic Initiate p. 87, lineages p. 84–86).
  const free = $derived(new Set(sheet.extraSpells.flatMap((x) => x.spells)))
  /** Spells from feats, traits and features, with the owner whose spell picks are made here (Magic Initiate…). */
  const otherSpells = $derived.by(() => {
    const out: (ExtraSpells & { owner?: Owner })[] = sheet.extraSpells.map((x) => ({ ...x }))
    for (const o of spellChoiceOwners(sheet)) {
      const x = out.find((e) => e.ownerId === o.id)
      // The spellcasting ability the player picked (Magic Initiate: Intelligence, Wisdom or Charisma).
      const ability = o.choiceValues.ability?.[0] as ExtraSpells['ability']
      if (x) Object.assign(x, { owner: o, ...(ability && !x.ability ? { ability } : {}) })
      else out.push({ ownerId: o.id, name: o.name, spells: [], source: o.source, owner: o, ability })
    }
    return out
  })

  /** A class's chosen spells, created on the first change (event handlers only: writing state while rendering throws). */
  function castState(classId: string): SpellcastingState {
    return (c.spellcasting[classId] ??= { prepared: [], cantrips: [] })
  }
  const NONE: SpellcastingState = { prepared: [], cantrips: [] }
  /** A class's chosen spells for display (a new character has none yet). */
  const readState = (classId: string): SpellcastingState => c.spellcasting[classId] ?? NONE
  /** Spell definitions sorted by level then English name (same order in every language, ui/order.ts). */
  const defs = (ids: string[]): SpellDef[] =>
    ids
      .map((id) => rules.spells.get(id))
      .filter((x): x is SpellDef => !!x)
      .sort((a, b) => a.level - b.level || byEnglishName(a, b))
  function listOf(classId: string): SpellDef[] {
    const def = view.rules.classes.get(classId)
    const ids = new Set<string>()
    const list = view.sheet.spellcasting.find((s) => s.classId === classId)?.list ?? classId
    for (const lv of view.rules.classes.get(list)?.spellList ?? []) for (const id of lv.spells) ids.add(id)
    for (const sub of def?.subclasses ?? []) for (const lv of sub.spells ?? []) for (const id of lv.spells) ids.add(id)
    return [...ids].map((id) => rules.spells.get(id)!).filter(Boolean)
  }
  function candidates(classId: string, cantrip: boolean, book?: string[]): SpellDef[] {
    const st = readState(classId)
    const taken = new Set([...st.prepared, ...st.cantrips])
    // A Wizard prepares level 1+ spells from the spellbook (p. 78 "Prepared Spells of Level 1+").
    return listOf(classId)
      .filter(
        (s) => (cantrip ? s.level === 0 : s.level > 0) && !taken.has(s.id) && (cantrip || !book || book.includes(s.id)),
      )
      .sort((a, b) => a.level - b.level || tr(a.name).localeCompare(tr(b.name)))
  }
  function add(classId: string, s: SpellDef) {
    const st = castState(classId)
    if (s.level === 0) st.cantrips.push(s.id)
    else st.prepared.push(s.id)
  }
  function removeSpell(classId: string, id: string) {
    const st = castState(classId)
    st.prepared = st.prepared.filter((x) => x !== id)
    st.cantrips = st.cantrips.filter((x) => x !== id)
  }

  // ---- Wizard spellbook (p. 78)
  const bookLevels = $derived(spellbookLevels(c, rules))
  const wizList = wizardList(rules)
  /** Spells copied into the book ("Expanding and Replacing a Spellbook", p. 78) that can be added: Wizard spells of a
   * level the Wizard can prepare, not already in the book. */
  function copyOptions(book: string[], maxLevel: number) {
    const out: { level: number; spells: SpellDef[] }[] = []
    for (let l = 1; l <= maxLevel; l++) {
      const list = [...wizList.entries()]
        .filter(([id, sl]) => sl === l && !book.includes(id))
        .map(([id]) => rules.spells.get(id))
        .filter((x): x is SpellDef => !!x)
        .sort((a, b) => tr(a.name).localeCompare(tr(b.name)))
      if (list.length) out.push({ level: l, spells: list })
    }
    return out
  }
  function copySpell(id: string) {
    if (!id) return
    const st = castState('wizard')
    st.spellbook = [...(st.spellbook ?? []), id]
  }
  function uncopy(id: string) {
    const st = castState('wizard')
    st.spellbook = (st.spellbook ?? []).filter((x) => x !== id)
  }
</script>

<WildShapeBlock />

{#if castLog.message}
  <p class="castmsg" role="status">
    {tr(castLog.message)}
    <button
      class="x"
      onclick={() => (castLog.message = undefined)}
      aria-label={tr({ en: 'Close', fr: 'Fermer', es: 'Cerrar' })}>✕</button
    >
  </p>
{/if}

{#if sheet.slots.length || sheet.pact}
  <section class="box">
    <h3>{tr(UI.spellSlots)}</h3>
    <div class="slots">
      {#each sheet.slots as n, i (i)}
        {#if n}
          <div class="slot">
            <span class="lvl">{i + 1}</span>
            <span class="pips">
              {#each Array(n) as _, k (k)}
                <button
                  class="pip"
                  class:spent={k < (c.slotsUsed[i] ?? 0)}
                  onclick={() => (c.slotsUsed[i] = k < (c.slotsUsed[i] ?? 0) ? k : k + 1)}
                  aria-label={`${tr(UI.spellSlots)} ${i + 1}`}
                ></button>
              {/each}
            </span>
            <span class="meta">{n - (c.slotsUsed[i] ?? 0)} / {n}</span>
          </div>
        {/if}
      {/each}
      {#if sheet.pact}
        <div class="slot">
          <span class="lvl">{tr(UI.pactSlots)} ({sheet.pact.level})</span>
          <span class="pips">
            {#each Array(sheet.pact.slots) as _, k (k)}
              <button
                class="pip"
                class:spent={k < c.pactUsed}
                onclick={() => (c.pactUsed = k < c.pactUsed ? k : k + 1)}
                aria-label="pact slot"
              ></button>
            {/each}
          </span>
        </div>
      {/if}
    </div>
    <p class="hint">
      {tr({
        en: 'Slots are shared between your Spellcasting classes (SRD p. 25); Pact Magic slots are separate and return on a Short Rest.',
        fr: 'Les emplacements sont partagés entre vos classes dotées de Sorts (SRD p. 25) ; ceux de Magie du pacte sont à part et reviennent après un repos court.',
        es: 'Los espacios se comparten entre tus clases con Lanzamiento de conjuros (SRD p. 25); los de Magia del pacto van aparte y se recuperan con un descanso corto.',
      })}
    </p>
  </section>
{/if}

{#each sheet.spellcasting as sc (sc.classId)}
  {@const st = readState(sc.classId)}
  {@const pactFirst = sc.kind === 'pact'}
  {@const counted = st.prepared.filter((id) => !sc.alwaysPrepared.includes(id) && !free.has(id)).length}
  <section class="box">
    <h3>{tr(sc.className)} · {tr({ en: 'Spellcasting', fr: 'Sorts', es: 'Lanzamiento de conjuros' })}</h3>
    <div class="head">
      <div>
        <span class="tag">{tr(UI.spellSaveDc)}</span><StatValue
          stat={() => sc.dc}
          title={{
            en: `${sc.className.en}: spell save DC`,
            fr: `${sc.className.fr} : DD de sauvegarde`,
            es: `${sc.className.es ?? sc.className.en}: CD de salvación`,
          }}
          signed={false}
          big
        />
      </div>
      <div>
        <span class="tag">{tr(UI.spellAttack)}</span><StatValue
          stat={() => sc.attack}
          title={{
            en: `${sc.className.en}: spell attack`,
            fr: `${sc.className.fr} : attaque de sort`,
            es: `${sc.className.es ?? sc.className.en}: ataque de conjuro`,
          }}
          big
        />
      </div>
      <div>
        <span class="tag">{tr(UI.cantrips)}</span><span class="big num">{st.cantrips.length} / {sc.cantripsMax}</span>
      </div>
      <div>
        <span class="tag">{tr(UI.prepared)}</span><span class="big num">{counted} / {sc.preparedMax}</span>
      </div>
      {#if sc.spellbook}
        <div>
          <span class="tag">{tr(UI.spellbook)}</span><span class="big num">{sc.spellbook.length}</span>
        </div>
      {/if}
      <div>
        <span class="tag">{tr({ en: 'Max spell level', fr: 'Niveau de sort max', es: 'Nivel de conjuro máx.' })}</span
        ><span class="big num">{sc.maxSpellLevel}</span>
      </div>
    </div>
    {#if sc.spellChoice}
      <p class="row">
        <span class="meta">{tr(sc.spellChoice.name)} :</span>
        <select
          value={sc.spellChoice.value}
          onchange={(e) => (c.featureChoices[sc.spellChoice!.key] = e.currentTarget.value)}
        >
          {#each sc.spellChoice.options as o (o.id)}<option value={o.id}>{tr(o.name) || o.id}</option>{/each}
        </select>
        <span class="meta"
          >{tr({
            en: 'chosen on each Long Rest',
            fr: 'choisi à chaque repos long',
            es: 'elegido en cada descanso largo',
          })}</span
        >
      </p>
    {/if}
    {#if sc.alwaysPrepared.length}
      <h4>
        {tr({ en: 'Always prepared', fr: 'Toujours préparés', es: 'Siempre preparados' })}
        <span class="meta">{tr({ en: 'not counted', fr: 'non comptés', es: 'no contados' })}</span>
      </h4>
      <ul class="spells">
        {#each defs(sc.alwaysPrepared) as s (s.id)}
          <SpellRow {s} classId={sc.classId} {pactFirst} />
        {/each}
      </ul>
    {/if}
    <h4>{tr(UI.cantrips)} <span class="meta">{st.cantrips.length} / {sc.cantripsMax}</span></h4>
    <ul class="spells">
      {#each defs(st.cantrips) as s (s.id)}
        <SpellRow {s} classId={sc.classId} onremove={() => removeSpell(sc.classId, s.id)} />
      {/each}
    </ul>
    {#if st.cantrips.length < sc.cantripsMax}
      <SpellPicker
        options={candidates(sc.classId, true)}
        onpick={(x) => add(sc.classId, x)}
        keepOpen={sc.cantripsMax - st.cantrips.length > 1}
        label={tr({ en: 'Add a cantrip', fr: 'Ajouter un sort mineur', es: 'Añadir un truco' })}
      />
    {/if}
    <h4>{tr(UI.prepared)} <span class="meta">{counted} / {sc.preparedMax}</span></h4>
    <ul class="spells">
      {#each defs(st.prepared) as s (s.id)}
        <SpellRow {s} classId={sc.classId} {pactFirst} onremove={() => removeSpell(sc.classId, s.id)} />
      {/each}
    </ul>
    {#if counted < sc.preparedMax}
      <SpellPicker
        options={candidates(sc.classId, false, sc.spellbook).filter((x) => x.level <= sc.maxSpellLevel)}
        onpick={(x) => add(sc.classId, x)}
        keepOpen={sc.preparedMax - counted > 1}
        label={sc.spellbook
          ? tr({
              en: 'Prepare a spell from the spellbook',
              fr: 'Préparer un sort du grimoire',
              es: 'Preparar un conjuro del libro de conjuros',
            })
          : tr({ en: 'Prepare a spell', fr: 'Préparer un sort', es: 'Preparar un conjuro' })}
      />
    {/if}
    {#if sc.spellbook}
      {@const copied = defs(st.spellbook ?? []).filter((s) => !bookLevels.some((l) => l.learned.includes(s.id)))}
      {@const copyable = copyOptions(sc.spellbook, sc.maxSpellLevel)}
      <h4>
        {tr(UI.spellbook)}
        <span class="meta"
          >{tr({
            en: 'six level 1 spells, then two per Wizard level',
            fr: 'six sorts du 1er niveau, puis deux par niveau de Magicien',
            es: 'seis conjuros de nivel 1, luego dos por nivel de mago',
          })}</span
        >
      </h4>
      <ul class="book">
        {#each bookLevels as lv (lv.index)}
          <SpellbookLevel {lv} book={sc.spellbook} list={wizList} />
        {/each}
      </ul>
      <h4>
        {tr({ en: 'Copied into the book', fr: 'Copiés dans le grimoire', es: 'Copiados en el libro' })}
        <span class="meta"
          >{tr({
            en: 'found Wizard spells: 2 hours and 50 GP per spell level',
            fr: 'sorts de Magicien trouvés : 2 heures et 50 po par niveau de sort',
            es: 'conjuros de mago encontrados: 2 horas y 50 po por nivel de conjuro',
          })}</span
        >
      </h4>
      <ul class="chips">
        {#each copied as s (s.id)}
          <li class="school-row school-{s.school}">
            <RuleText name={s.name} text={s.text} source={s.source} noteKey="spell:{s.id}" />
            <small>{s.level}</small>
            <button
              class="x"
              onclick={() => uncopy(s.id)}
              aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
            >
          </li>
        {/each}
        {#if copyable.length}
          <li class="add">
            <select
              value=""
              onchange={(e) => copySpell(e.currentTarget.value)}
              aria-label={tr({
                en: 'Copy a spell into the book',
                fr: 'Copier un sort dans le grimoire',
                es: 'Copiar un conjuro en el libro',
              })}
            >
              <option value="">＋ {tr({ en: 'copy a spell', fr: 'copier un sort', es: 'copiar un conjuro' })}</option>
              {#each copyable as g (g.level)}
                <optgroup label={`${tr({ en: 'Level', fr: 'Niveau', es: 'Nivel' })} ${g.level}`}>
                  {#each g.spells as sp (sp.id)}<option value={sp.id}>{tr(sp.name)}</option>{/each}
                </optgroup>
              {/each}
            </select>
          </li>
        {/if}
      </ul>
    {/if}
    <WarningList areas={['spells']} />
  </section>
{/each}

{#if otherSpells.length}
  <section class="box">
    <h3>
      {tr({
        en: 'Spells from feats, traits and features',
        fr: 'Sorts de dons, de traits et d’aptitudes',
        es: 'Conjuros de dotes, atributos y rasgos',
      })}
    </h3>
    {#each otherSpells as x (x.ownerId)}
      {@const missing = view.warnings.some(
        (w) => isSpellChoiceWarning(w, sheet) && w.id.startsWith(`choice-${x.ownerId}`),
      )}
      <h4>
        <!-- The source is shown in the popup opened by the name (no SRD links in the main UI). -->
        <RuleText name={x.name} source={x.source} noteKey="spells:{x.ownerId}" />{x.ability
          ? ` · ${tr({ en: 'ability', fr: 'caractéristique', es: 'característica' })} ${tr(ABILITY_NAMES[x.ability])}`
          : ''}
      </h4>
      <ul class="spells">
        {#each defs(x.spells) as s (s.id)}
          <SpellRow {s} />
        {/each}
      </ul>
      {#if x.owner}
        <!-- Setting up the spells (Magic Initiate: list, ability, cantrips, level 1 spell): open while incomplete. -->
        <details class="setup" open={missing}>
          <summary
            >{missing
              ? tr({ en: 'Choose the spells', fr: 'Choisir les sorts', es: 'Elegir los conjuros' })
              : tr({ en: 'Change the spells', fr: 'Changer les sorts', es: 'Cambiar los conjuros' })}</summary
          >
          <ChoiceEditor owner={x.owner} where="spells" />
          <WarningList
            filter={(w) => isSpellChoiceWarning(w, sheet) && w.id.startsWith(`choice-${x.ownerId}`)}
            compact
          />
        </details>
      {/if}
    {/each}
  </section>
{/if}

<style>
  .box {
    margin-bottom: 1.25rem;
  }
  .slots {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .slot {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .lvl {
    font-family: var(--font-num);
    font-weight: 700;
    min-width: 1.5rem;
  }
  .pips {
    display: inline-flex;
    gap: 0.25rem;
  }
  .pip {
    width: 1.4rem;
    height: 1.4rem;
    min-height: 1.4rem;
    padding: 0;
    border-radius: 50%;
    border: 1.5px solid var(--frame);
    background: var(--arcane);
  }
  .pip.spent {
    background: transparent;
  }
  .head {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.6rem;
    text-align: center;
  }
  .tag {
    display: block;
    font-family: var(--font-title);
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
  .big {
    font-size: 1.5em;
  }
  .num {
    font-family: var(--font-num);
    font-weight: 700;
  }
  h4 {
    font-family: var(--font-title);
    font-weight: 400;
    margin: 1rem 0 0.4rem;
  }
  .spells {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
  }
  .hint {
    font-size: 0.9em;
    color: var(--ink-soft);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0.6rem 0 0;
  }
  .row select {
    min-height: 2.4rem;
    font: inherit;
  }
  .castmsg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    border-left: 3px solid var(--accent);
    background: var(--paper-2);
  }
  .book,
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.25rem;
  }
  .chips li:not(.add) {
    padding: 0.1rem 0.3rem 0.1rem 0.6rem;
    border-radius: 2px;
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .chips select {
    min-height: 2.2rem;
    max-width: 100%;
  }
  .x {
    background: none;
    border: none;
    color: var(--ink-soft);
    min-width: 2rem;
    min-height: 2rem;
    margin-left: auto;
  }
  .chips .x {
    margin-left: 0;
  }
</style>
