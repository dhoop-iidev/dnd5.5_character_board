<script lang="ts">
  // General pane, laid out like the 3.5 playboard: portrait and identity card on top; then two columns of the same height
  // (user request 2026-10-29): "In play", a little wider, with its blocks stacked (abilities with a red saving-throw
  // badge; AC (shield) and maximum Hit Points (heart), initiative, speed, Proficiency Bonus; passive scores, senses, spellcasting,
  // Heroic Inspiration), and the skills in one column beside it (one under the other on a narrow screen); page-wide
  // lists of species traits, class features and feats with a one-line summary; the story text beside the coat of arms, the personality notes; the
  // progression last. Build warnings are fixed in the progression (the level row or Origin block that sets the value):
  // the boxes above only link there. Lists are in English alphabetical order in every language (ui/order.ts), so nothing moves when
  // the language changes.
  import { tabOfWarning } from '../spellChoices'
  import { rules } from '../../data/rules'
  import { ABILITIES, type AbilityId, type I18n, type Source } from '../../data/types'
  import { UI } from '../../i18n/ui'
  import { app, lang, tr, view } from '../../state.svelte'
  import { fmt } from '../../engine/compute'
  import { ABILITY_NAMES, ABILITY_SHORT } from '../../engine/sheet/common'
  import { fmtFeet, isMetric } from '../format'
  import { openPopup } from '../popupState.svelte'
  import { summaryOf } from '../summary'
  import IdentityCard from '../IdentityCard.svelte'
  import Medallion from '../Medallion.svelte'
  import Portraits from '../Portraits.svelte'
  import StatValue from '../StatValue.svelte'
  import LevelEditor from '../LevelEditor.svelte'
  import { byEnglishName } from '../order'

  const sheet = $derived(view.sheet)
  const c = $derived(app.character)
  /** Build warnings of these areas, fixed in the progression (2026-10-28). */
  // Spell picks of feats and traits are made in the Spells tab, not in the progression.
  const toFix = (areas: string[]) =>
    view.warnings.filter(
      (w) => areas.includes(w.area) && w.severity !== 'info' && tabOfWarning(w, view.sheet) === 'general',
    ).length
  const goToProgression = () => document.getElementById('progression')?.scrollIntoView({ behavior: 'smooth' })
  const profMark = { none: '○', half: '◐', proficient: '●', expertise: '◉' } as const

  /** Distances from the engine are in feet: "30 ft" in English, "9 m" in French. */
  const dist = (ft: number) => (isMetric(lang()) ? fmtFeet(ft, lang()) : `${ft} ft`)
  const SPEED_KIND: Record<string, I18n> = {
    climb: { en: 'Climb Speed', fr: 'Vitesse d’escalade', es: 'Velocidad trepando' },
    swim: { en: 'Swim Speed', fr: 'Vitesse de nage', es: 'Velocidad nadando' },
    fly: { en: 'Fly Speed', fr: 'Vitesse de vol', es: 'Velocidad volando' },
  }

  const saveTitle = (a: AbilityId): I18n => ({
    en: `${ABILITY_NAMES[a].en} saving throw`,
    fr: `Jet de sauvegarde de ${ABILITY_NAMES[a].fr}`,
    es: `Tirada de salvación de ${ABILITY_NAMES[a].es ?? ABILITY_NAMES[a].en}`,
  })
  function openSave(a: AbilityId) {
    const title = saveTitle(a)
    openPopup({ title, stat: () => view.sheet.abilities[a].save, signed: true, noteKey: `stat:${title.en}` })
  }
  /** Feats in English alphabetical order (stable across languages). */
  const feats = $derived([...sheet.feats].sort((a, b) => byEnglishName(a.def, b.def)))
  /** Personality notes under the story (free text). */
  const PERSONALITY: {
    key: 'personalityTraits' | 'ideals' | 'bonds' | 'flaws' | 'appearance' | 'allies'
    label: I18n
  }[] = [
    {
      key: 'personalityTraits',
      label: { en: 'Personality Traits', fr: 'Traits de personnalité', es: 'Rasgos de personalidad' },
    },
    { key: 'ideals', label: { en: 'Ideals', fr: 'Idéaux', es: 'Ideales' } },
    { key: 'bonds', label: { en: 'Bonds', fr: 'Liens', es: 'Vínculos' } },
    { key: 'flaws', label: { en: 'Flaws', fr: 'Défauts', es: 'Defectos' } },
    { key: 'appearance', label: { en: 'Appearance', fr: 'Apparence', es: 'Apariencia' } },
    {
      key: 'allies',
      label: { en: 'Allies & Organizations', fr: 'Alliés et organisations', es: 'Aliados y organizaciones' },
    },
  ]

  const passives = $derived(
    (['perception', 'insight', 'investigation'] as const)
      .map((id) => sheet.skills.find((s) => s.id === id))
      .filter((s) => s !== undefined),
  )
  /** Darkvision range: the longest granted (species traits, features). */
  const darkvision = $derived(
    Math.max(
      0,
      ...sheet.pool.grants.filter((g) => g.grant.kind === 'darkvision').map((g) => Number(g.grant.value) || 0),
    ),
  )

  function rule(name: I18n, text: I18n | undefined, source: Source | undefined, noteKey: string, lines: I18n[] = []) {
    openPopup({ title: name, html: text, source, noteKey, lines })
  }
  const featFrom = (f: (typeof sheet.feats)[number]) =>
    f.from === 'background'
      ? tr(UI.background)
      : f.from === 'class'
        ? tr(UI.class)
        : f.from === 'species'
          ? tr(UI.species)
          : f.level !== undefined
            ? `${tr(UI.level)} ${f.level}`
            : ''
</script>

{#snippet fixLink(areas: string[])}
  {@const n = toFix(areas)}
  {#if n}
    <button class="fix-link" onclick={goToProgression}
      >⚠ {tr({
        en: `${n} to fix in Progression ↓`,
        fr: `${n} à corriger dans la progression ↓`,
        es: `${n} por corregir en la progresión ↓`,
      })}</button
    >
  {/if}
{/snippet}

<!-- Top: portrait and identity. -->
<section class="top">
  <div class="portrait"><Portraits kinds={['face']} /></div>
  <div class="ident"><IdentityCard /></div>
</section>

<!-- Every number used in play (its blocks stacked) beside the skills, two columns of the same height. -->
<div class="play">
  <section class="box stats-band">
    <h3>{tr({ en: 'In play', fr: 'En jeu', es: 'En juego' })}</h3>
    <div class="band">
      <div class="block col">
        <div class="abilities">
          {#each ABILITIES as a (a)}
            {@const ab = sheet.abilities[a]}
            <Medallion label={tr(ABILITY_SHORT[a])} sub={String(ab.score.total)} size="sm">
              <button
                class="stat"
                onclick={() =>
                  openPopup({
                    title: ABILITY_NAMES[a],
                    stat: () => view.sheet.abilities[a].score,
                    signed: false,
                    lines: [
                      {
                        en: `Modifier ${fmt(view.sheet.abilities[a].mod)}`,
                        fr: `Modificateur ${fmt(view.sheet.abilities[a].mod)}`,
                        es: `Modificador ${fmt(view.sheet.abilities[a].mod)}`,
                      },
                    ],
                    noteKey: `stat:${ABILITY_NAMES[a].en}`,
                  })}>{fmt(ab.mod)}</button
              >
              {#snippet badge()}
                <button
                  class="save-badge"
                  class:prof={ab.saveProficient}
                  title={`${tr(saveTitle(a))}${ab.saveProficient ? ` (${tr(UI.proficient)})` : ''}`}
                  aria-label={tr(saveTitle(a))}
                  onclick={() => openSave(a)}
                  >{fmt(ab.save.total)}{#if ab.save.parts.some((p) => p.condition)}<sup>*</sup>{/if}</button
                >
              {/snippet}
            </Medallion>
          {/each}
        </div>
        <p class="hint">
          {tr({
            en: 'Ring: modifier; under it: score. In red: saving throw (filled ● = proficient).',
            fr: 'Anneau : modificateur ; dessous : valeur. En rouge : jet de sauvegarde (plein ● = maîtrise).',
            es: 'Anillo: modificador; debajo: puntuación. En rojo: tirada de salvación (● lleno = competencia).',
          })}
        </p>
      </div>

      <div class="block col defense">
        <!-- Armor Class in a shield and maximum Hit Points in a heart (user request 2026-10-29); current Hit Points,
             damage, healing and rests are in the Combat pane. -->
        <div class="row">
          <Medallion label={tr(UI.acShort)} size="lg" shape="shield">
            <StatValue stat={() => view.sheet.ac} title={UI.ac} signed={false} />
          </Medallion>
          <Medallion label={tr({ en: 'Max HP', fr: 'PV max', es: 'PG máx.' })} size="lg" shape="heart">
            <StatValue stat={() => view.sheet.hpMax} title={UI.hp} signed={false} />
          </Medallion>
        </div>
        <div class="row">
          <Medallion label={tr(UI.initiative)} size="sm">
            <StatValue stat={() => view.sheet.initiative} title={UI.initiative} />
          </Medallion>
          <Medallion label={tr(UI.speed)} size="sm">
            <button
              class="stat speed"
              onclick={() =>
                openPopup({ title: UI.speed, stat: () => view.sheet.speed, signed: false, noteKey: 'stat:Speed' })}
              >{dist(sheet.speed.total)}</button
            >
          </Medallion>
          <Medallion label={tr({ en: 'Prof.', fr: 'Maîtrise', es: 'Comp.' })} size="sm">
            <span class="plain" title={tr(UI.pb)}>+{sheet.pb}</span>
          </Medallion>
        </div>
      </div>

      <div class="block col vitals">
        <dl class="cells">
          {#each passives as s (s.id)}
            <dt>
              {tr({ en: `Passive ${s.name.en}`, fr: `${s.name.fr} passive`, es: `${s.name.es ?? s.name.en} pasiva` })}
            </dt>
            <dd>{s.passive}</dd>
          {/each}
          {#if darkvision}
            <dt>{tr({ en: 'Darkvision', fr: 'Vision dans le noir', es: 'Visión en la oscuridad' })}</dt>
            <dd>{dist(darkvision)}</dd>
          {/if}
          {#each sheet.otherSpeeds as s (s.kind)}
            <dt>{tr(SPEED_KIND[s.kind])}</dt>
            <dd>{dist(s.ft)}</dd>
          {/each}
          {#each sheet.spellcasting as sc (sc.classId)}
            <dt>
              {tr(UI.spellSaveDc)}{sheet.spellcasting.length > 1 ? ` (${tr(sc.className)})` : ''}
            </dt>
            <dd>
              <StatValue
                stat={() => view.sheet.spellcasting.find((x) => x.classId === sc.classId)!.dc}
                title={UI.spellSaveDc}
                signed={false}
              />
            </dd>
            <dt>
              {tr(UI.spellAttack)}{sheet.spellcasting.length > 1 ? ` (${tr(sc.className)})` : ''}
            </dt>
            <dd>
              <StatValue
                stat={() => view.sheet.spellcasting.find((x) => x.classId === sc.classId)!.attack}
                title={UI.spellAttack}
              />
            </dd>
          {/each}
        </dl>
        <label class="cell chk" class:on={c.heroicInspiration}>
          <input type="checkbox" bind:checked={c.heroicInspiration} />
          <span>{tr(UI.heroicInspiration)}</span>
        </label>
        {#if c.exhaustion > 0}
          <div class="cell bad">
            <span class="tag">{tr(UI.exhaustion)}</span>
            <span class="val"
              >{c.exhaustion} · {fmt(sheet.exhaustionPenalty)}
              {tr({ en: 'd20 Tests', fr: 'tests d20', es: 'pruebas con d20' })}</span
            >
          </div>
        {/if}
      </div>
    </div>
    {@render fixLink(['abilities'])}
  </section>

  <section class="box skills-box">
    <h3>{tr(UI.skills)}</h3>
    <ul class="skills">
      {#each sheet.skills as s (s.id)}
        <li class:prof={s.proficiency !== 'none'}>
          <span
            class="mark"
            title={tr(
              s.proficiency === 'expertise'
                ? UI.expertise
                : s.proficiency === 'proficient'
                  ? UI.proficient
                  : s.proficiency === 'half'
                    ? UI.halfProficiency
                    : { en: 'No proficiency', fr: 'Pas de maîtrise', es: 'Sin competencia' },
            )}>{profMark[s.proficiency]}</span
          >
          <span class="sk">{tr(s.name)} <small class="abil">{tr(ABILITY_SHORT[s.ability])}</small></span>
          <StatValue stat={() => view.sheet.skills.find((x) => x.id === s.id)!.total} title={s.name} />
        </li>
      {/each}
    </ul>
    <p class="hint wide-hint">● {tr(UI.proficient)} · ◉ {tr(UI.expertise)} · ◐ {tr(UI.halfProficiency)}</p>
    {@render fixLink(['skills'])}
  </section>
</div>

<div class="grid">
  <section class="box">
    <h3>{tr(UI.traits)}{sheet.species ? ` — ${tr(sheet.species.name)}` : ''}</h3>
    <ul class="list">
      {#each sheet.traits as t (t.id)}
        {@const sum = tr(summaryOf(`trait:${t.id}`, t.text))}
        <li>
          <button class="link" onclick={() => rule(t.name, t.text, t.source, `trait:${t.id}`)}>{tr(t.name)}</button>
          {#if sum}<span class="sum">{sum}</span>{/if}
        </li>
      {:else}
        <li><small>—</small></li>
      {/each}
    </ul>
  </section>

  <section class="box">
    <h3>{tr(UI.features)}</h3>
    <ul class="list">
      {#each sheet.features as f (f.def.id)}
        {@const sum = tr(summaryOf(`feature:${f.def.id}`, f.def.text))}
        <li>
          <button class="link" onclick={() => rule(f.def.name, f.def.text, f.def.source, `feature:${f.def.id}`)}
            >{tr(f.def.name)}</button
          >
          <small
            >{tr(rules.classes.get(f.classId)?.name)}
            {f.def.level}{#if f.def.subclass}
              · {tr(sheet.subclasses.get(f.classId)?.name)}{/if}</small
          >
          {#if sum}<span class="sum">{sum}</span>{/if}
        </li>
      {:else}
        <li><small>—</small></li>
      {/each}
    </ul>
  </section>

  <section class="box">
    <h3>{tr(UI.feats)}</h3>
    <ul class="list">
      {#each feats as f, i (f.def.id + i)}
        {@const sum = tr(summaryOf(`feat:${f.def.id}`, f.def.text))}
        <li>
          <button
            class="link"
            onclick={() => rule(f.def.name, f.def.text, f.def.source, `feat:${f.def.id}`, [f.def.categoryText])}
            >{tr(f.def.name)}</button
          >
          <small>{featFrom(f)}</small>
          {#if sum}<span class="sum">{sum}</span>{/if}
        </li>
      {:else}
        <li><small>—</small></li>
      {/each}
    </ul>
    {@render fixLink(['feats'])}
  </section>

  <section class="box">
    <h3>{tr({ en: 'Story', fr: 'Histoire', es: 'Historia' })}</h3>
    <div class="background">
      <div class="arms"><Portraits kinds={['coatOfArms']} /></div>
      <textarea
        bind:value={c.identity.background}
        rows="10"
        lang={lang()}
        placeholder={tr({
          en: 'Where the character comes from, what shaped them, what they are after…',
          fr: 'D’où vient le personnage, ce qui l’a forgé, ce qu’il recherche…',
          es: 'De dónde viene el personaje, qué lo forjó, qué busca…',
        })}
        aria-label={tr({ en: 'Story', fr: 'Histoire', es: 'Historia' })}></textarea>
    </div>
  </section>

  <section class="box">
    <h3>{tr({ en: 'Personality', fr: 'Personnalité', es: 'Personalidad' })}</h3>
    <div class="personality">
      {#each PERSONALITY as p (p.key)}
        <label class="note-field">
          <span class="tag">{tr(p.label)}</span>
          <textarea bind:value={c.identity[p.key]} rows="3" lang={lang()}></textarea>
        </label>
      {/each}
    </div>
  </section>

  <section class="box">
    <h3 id="progression">{tr({ en: 'Progression', fr: 'Progression', es: 'Progresión' })}</h3>
    <LevelEditor />
  </section>
</div>

<style>
  .fix-link {
    margin-top: 0.6rem;
    padding: 0.3em 0.7em;
    min-height: 2.2rem;
    border: none;
    border-left: 3px solid var(--danger);
    background: var(--paper-2);
    color: var(--ink);
    font: inherit;
    font-size: 0.92em;
    cursor: pointer;
  }
  .fix-link:hover {
    background: var(--box);
  }
  .top {
    display: grid;
    grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
    margin-bottom: 1.25rem;
  }
  .ident :global(.identity) {
    margin: 0;
  }
  @media (max-width: 52rem) {
    .top {
      grid-template-columns: 1fr;
    }
    .portrait {
      width: min(100%, 16rem);
      justify-self: center;
    }
  }
  /* In play | skills: the two boxes stretch to the same height; In play takes a little more width. */
  .play {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    align-items: stretch;
    gap: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .stats-band,
  .skills-box {
    display: flex;
    flex-direction: column;
  }
  /* The band: its three blocks (abilities; defense and hit points; small values and Heroic Inspiration) stacked and
     spread over the height of the skills beside it. */
  .band {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1.25rem;
  }
  .band > .block + .block {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
  }
  .block {
    min-width: 0;
  }
  .abilities {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.4rem 0.9rem;
    justify-content: center;
  }
  .abilities :global(.medallion) {
    margin-bottom: 0.3rem;
  }
  /* Saving throw badge on each ability medallion: red ring, filled when proficient. */
  .save-badge {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: var(--box);
    color: var(--accent);
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums lining-nums;
    line-height: 1;
    cursor: pointer;
  }
  .save-badge.prof {
    background: var(--accent);
    color: var(--on-frame);
  }
  .save-badge:hover {
    border-color: var(--accent-dark);
  }
  .save-badge:focus-visible {
    outline: 2px solid var(--frame);
    outline-offset: 2px;
  }
  .save-badge sup {
    font-size: 0.6em;
  }
  .hint {
    margin: 0.2rem auto 0;
    max-width: 19rem;
    font-size: 0.8rem;
    color: var(--ink-soft);
    text-align: center;
  }
  .wide-hint {
    max-width: none;
    text-align: left;
  }
  .defense {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  /* Values drawn in a medallion that aren't StatValue buttons (ability modifier, speed, PB): the Medallion styles
     every `.stat` inside its ring. */
  .stat {
    font: inherit;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
  }
  .stat.speed {
    font-size: calc(var(--d) * 0.24) !important;
  }
  .plain {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: calc(var(--d) * 0.32);
  }
  .vitals {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .tag {
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
    letter-spacing: 0.04em;
  }
  .cell {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.6rem;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 0.2rem;
  }
  .val {
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .chk {
    justify-content: flex-start;
    align-items: center;
    min-height: 2.75rem;
    cursor: pointer;
    font-family: var(--font-title);
  }
  .chk input {
    width: 1.15rem;
    height: 1.15rem;
    accent-color: var(--accent);
  }
  .chk.on {
    color: var(--accent);
  }
  .cell.bad,
  .cell.bad .tag {
    color: var(--danger);
  }
  /* Small values: label left, value right. */
  .cells {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-content: start;
    gap: 0 0.75rem;
    margin: 0;
  }
  .cells dt {
    font-family: var(--font-title);
    font-size: 0.92rem;
    color: var(--ink-soft);
    align-self: stretch;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--rule);
    padding: 0.15rem 0;
  }
  .cells dd {
    margin: 0;
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    border-bottom: 1px solid var(--rule);
    padding: 0.15rem 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 2.2rem;
  }
  .cells dd :global(.stat) {
    min-height: 2.2rem;
  }
  @media (max-width: 60rem) {
    .play {
      grid-template-columns: minmax(0, 1fr);
    }
    .skills {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    }
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
  /* Skills: one column beside In play, its rows spread over the box height; several columns when stacked. */
  .skills {
    flex: 1;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: space-between;
    column-gap: 1.75rem;
  }
  .skills li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 1px solid var(--rule);
  }
  .skills li :global(.stat) {
    min-height: 2.3rem;
  }
  .skills .sk {
    flex: 1;
  }
  .skills li:not(.prof) .sk {
    color: var(--ink-soft);
  }
  .mark {
    width: 1.2rem;
    color: var(--accent);
  }
  .abil {
    color: var(--ink-soft);
    font-family: var(--font-title);
    letter-spacing: 0.04em;
    font-size: 0.82em;
  }
  /* Page-wide lists: name, small meta, one-line summary; two or three columns on a wide screen, one on a phone. */
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    column-gap: 1.75rem;
  }
  .list li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2em 0.6em;
    align-items: baseline;
    border-bottom: 1px solid var(--rule);
  }
  .list small {
    color: var(--ink-soft);
    font-size: 0.82em;
  }
  .list .sum {
    flex-basis: 100%;
    color: var(--ink-soft);
    font-size: 0.88em;
    line-height: 1.3;
    padding-bottom: 0.25em;
    /* Two lines at most; the popup has the full text. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0.25em 0;
    min-height: 2.5rem;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.22em;
  }
  .link:hover {
    color: var(--accent);
    text-decoration-color: currentColor;
  }
  .background {
    display: grid;
    grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }
  .background textarea {
    width: 100%;
    min-height: 16rem;
    box-sizing: border-box;
    padding: 0.6rem 0.7rem;
    font: inherit;
    line-height: 1.5;
    resize: vertical;
  }
  /* Personality notes: a compact two-column grid of small text areas. */
  .personality {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    gap: 0.75rem 1.25rem;
  }
  .note-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .note-field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.45rem 0.6rem;
    font: inherit;
    line-height: 1.4;
    resize: vertical;
  }
  @media (max-width: 40rem) {
    .background {
      grid-template-columns: 1fr;
    }
    .arms {
      width: min(100%, 13rem);
      justify-self: center;
    }
  }
</style>
