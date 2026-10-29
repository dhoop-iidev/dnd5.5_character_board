<script lang="ts">
  // Welcome screen: import a character JSON, or create a level-1 character in five short steps following the SRD
  // "Character Creation" (SRD 5.2.1 p. 19–23, FR p. 20–24, ES p. 21–25): name, class, origin (background, species),
  // ability scores (Standard Array, Point Cost or Random Generation, then the background's +2/+1 or +1/+1/+1, max 20;
  // p. 21), starting equipment (class and background options, p. 20). The rest (skills, Weapon Mastery, spells, feat
  // and trait options, languages) is chosen in the sheet, where the rule checks list what is still to choose.
  import { rules } from '../data/rules'
  import type { AbilityId, I18n } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { SIZE_NAMES, UI } from '../i18n/ui'
  import { migrate } from '../model/migrate'
  import { newCharacter, type NewCharacterInput } from '../model/newCharacter'
  import { BACKGROUND_KITS, CLASS_KITS, type KitItem, type KitOption } from '../model/startingEquipment'
  import { app, lang, openCharacter, tr } from '../state.svelte'
  import { ABILITY_NAMES, ABILITY_SHORT } from '../engine/sheet/common'
  import { compute } from '../engine/compute'
  import { fmtDistance } from './format'
  import type { CustomBackground } from '../model/character'
  import { backgroundDef, CUSTOM_BACKGROUND } from '../model/customBackground'
  import CustomBackgroundEditor from './CustomBackgroundEditor.svelte'

  let fileInput: HTMLInputElement | undefined = $state()
  let message = $state('')

  async function importJson(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      openCharacter(migrate(JSON.parse(await file.text())))
    } catch (err) {
      message =
        tr({ en: 'Import failed: ', fr: "Échec de l'import : ", es: 'Error al importar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  const sorted = <T extends { name: I18n }>(m: Map<string, T>) =>
    [...m.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name)))
  const names = (ids: string[], m: Map<string, { name: I18n }>) => ids.map((id) => tr(m.get(id)?.name) || id).join(', ')
  const abilityList = (ids: AbilityId[], sep = ', ') => ids.map((a) => tr(ABILITY_NAMES[a])).join(sep)
  const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
  const mod = (score: number) => Math.floor((score - 10) / 2)

  // --- 1. Name ---
  let name = $state('')
  let player = $state('')

  // --- 2. Class (SRD p. 19) ---
  let classId = $state('fighter')
  const cls = $derived(rules.classes.get(classId))

  // --- 3. Origin: background and species (p. 19–20) ---
  let backgroundId = $state('soldier')
  let speciesId = $state('human')
  /** Custom background (house rule #3): the player's abilities, skills, tool and Origin feat. */
  let customBg = $state<CustomBackground>({ name: '', abilities: [], skills: [], tool: '' })
  let customFeat = $state('')
  const bg = $derived(
    backgroundDef({ backgroundId, abilities: {}, feat: { featId: customFeat }, custom: customBg }, rules),
  )
  const sp = $derived(rules.species.get(speciesId))
  let size = $state('medium')
  /** The species trait asking for a lineage or ancestry (an option choice without its own id: Elven Lineage, Draconic
   * Ancestry…). Optional here: left empty, the sheet's rule checks ask for it. */
  const lineage = $derived.by(() => {
    for (const t of sp?.traits ?? []) {
      const c = rules.effects.get(t.id)?.choices?.find((x) => x.kind === 'option' && !x.id && x.options)
      if (c) return { ownerId: t.id, name: c.name ?? t.name, options: Object.entries(c.options!) }
    }
    return undefined
  })
  let lineageValue = $state('')

  // --- 4. Ability scores (p. 21) ---
  type Method = 'standard' | 'points' | 'rolled'
  const STANDARD: number[] = rules.tables.standardArray
  const COST = rules.tables.pointCost as unknown as Record<string, number>
  const BUDGET = 27
  const suggested = (): Record<AbilityId, number> => ({
    ...(rules.tables.standardArrayByClass[classId] ?? rules.tables.standardArrayByClass.fighter),
  })
  let method = $state<Method>('standard')
  let base = $state<Record<AbilityId, number>>({ ...rules.tables.standardArrayByClass.fighter })
  let rolls = $state<number[]>([])
  const spent = $derived(ABILITIES.reduce((s, a) => s + (COST[String(base[a])] ?? 99), 0))

  /** Standard Array: picking a value swaps it with the ability that had it, so each value stays used once. */
  function assignStandard(a: AbilityId, v: number) {
    const other = ABILITIES.find((b) => b !== a && base[b] === v)
    if (other) base[other] = base[a]
    base[a] = v
    defaultIncreases()
  }
  /** Point Cost: 8 to 15, 27 points (p. 21 table). */
  function step(a: AbilityId, d: number) {
    const v = base[a] + d
    if (v < 8 || v > 15) return
    if (d > 0 && spent - COST[String(base[a])] + COST[String(v)] > BUDGET) return
    base[a] = v
  }
  function setMethod(m: Method) {
    method = m
    const fitsPoints = ABILITIES.every((a) => base[a] >= 8 && base[a] <= 15) && spent <= BUDGET
    const isStandard =
      ABILITIES.map((a) => base[a])
        .sort((x, y) => y - x)
        .join() === STANDARD.join()
    if ((m === 'standard' && !isStandard) || (m === 'points' && !fitsPoints)) base = suggested()
    defaultIncreases()
  }
  /** Random Generation: 4d6, the three highest, six times; placed in the order of the class's suggested array. */
  function roll() {
    const one = () => {
      const d = [1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x)
      return d[0] + d[1] + d[2]
    }
    rolls = [1, 2, 3, 4, 5, 6].map(one).sort((x, y) => y - x)
    const s = suggested()
    const order = [...ABILITIES].sort((x, y) => s[y] - s[x])
    order.forEach((a, i) => (base[a] = rolls[i]))
    defaultIncreases()
  }

  // Background increases: +2 / +1 or +1 / +1 / +1 among its three abilities, no score above 20 (p. 21).
  let incMode = $state<'2-1' | '1-1-1'>('2-1')
  let plus2 = $state<AbilityId>('str')
  let plus1 = $state<AbilityId>('con')
  /** +2 to the class's primary ability when the background has it (else the best score), +1 to the next best. */
  function defaultIncreases() {
    const prim = new Set(cls?.primaryAbility ?? [])
    const order = [...(bg?.abilities ?? [])].sort(
      (x, y) => Number(prim.has(y)) - Number(prim.has(x)) || base[y] - base[x],
    )
    if (order.length < 2) return
    plus2 = order[0]
    plus1 = order[1]
  }
  defaultIncreases()
  function setPlus2(a: AbilityId) {
    if (a === plus1) plus1 = plus2
    plus2 = a
  }
  const increases = $derived.by((): Partial<Record<AbilityId, number>> => {
    if (incMode === '1-1-1') return Object.fromEntries((bg?.abilities ?? []).map((a) => [a, 1]))
    return { [plus2]: 2, [plus1]: 1 }
  })
  const finalScore = (a: AbilityId) => base[a] + (increases[a] ?? 0)
  const over20 = $derived(ABILITIES.some((a) => finalScore(a) > 20))

  // --- 5. Starting equipment (p. 20) ---
  let classKit = $state('A')
  let bgKit = $state('A')
  let picks = $state<Record<string, string>>({})
  const classKits = $derived(CLASS_KITS[classId] ?? [])
  const bgKits = $derived(BACKGROUND_KITS[backgroundId] ?? [])
  const chooser = $derived(classKits.find((o) => o.letter === classKit)?.items.find((k) => k.choose))

  function itemLabel(k: KitItem, id = k.id): string {
    const def =
      k.kind === 'weapon'
        ? rules.weapons.get(id ?? '')
        : k.kind === 'armor'
          ? rules.armor.get(id ?? '')
          : k.kind === 'gear'
            ? rules.gear.get(id ?? '')
            : undefined
    const n = tr(k.name ?? def?.name) || k.text
    return (k.qty ?? 1) > 1 ? `${k.qty} × ${n}` : n
  }
  const gpText = (n: number) => `${n} ${lang() === 'en' ? 'GP' : 'po'}`
  const optionText = (o: KitOption) =>
    [...o.items.map((k) => (k.choose ? itemLabel(k, picks[k.text] ?? k.id) : itemLabel(k))), gpText(o.gp)].join(', ')

  // A new class or background: its suggested array, option A, default increases.
  function onClass() {
    if (method !== 'rolled') base = suggested()
    classKit = 'A'
    defaultIncreases()
  }
  function onBackground() {
    bgKit = (BACKGROUND_KITS[backgroundId] ?? [])[0]?.letter ?? ''
    // Custom background: the three best base scores to start with (the class's primary ability first).
    if (backgroundId === CUSTOM_BACKGROUND && !customBg.abilities.length) {
      const prim = new Set(cls?.primaryAbility ?? [])
      customBg.abilities = [...ABILITIES]
        .sort((x, y) => Number(prim.has(y)) - Number(prim.has(x)) || base[y] - base[x])
        .slice(0, 3)
    }
    defaultIncreases()
  }
  // The custom background's abilities changed: the increases must stay among them.
  $effect(() => {
    const list = bg?.abilities ?? []
    if (list.length >= 2 && (!list.includes(plus2) || !list.includes(plus1))) defaultIncreases()
  })
  function onSpecies() {
    size = sp?.size.includes('medium') ? 'medium' : (sp?.size[0] ?? '')
    lineageValue = ''
  }

  function input(): NewCharacterInput {
    return {
      name: name.trim() || tr({ en: 'Unnamed', fr: 'Sans nom', es: 'Sin nombre' }),
      player: player.trim(),
      speciesId,
      backgroundId,
      classId,
      abilities: { ...base },
      backgroundAbilities: { ...increases },
      ...(backgroundId === CUSTOM_BACKGROUND ? { customBackground: $state.snapshot(customBg), customFeat } : {}),
      speciesChoices: sp && sp.size.length > 1 && size ? { size } : {},
      featureChoices: lineage && lineageValue ? { [lineage.ownerId]: lineageValue } : {},
      classKit,
      backgroundKit: bgKit,
      kitPicks: { ...picks },
      lang: app.character.settings.lang,
    }
  }
  /** What the sheet will show: Hit Points, Armor Class, coins. */
  const preview = $derived.by(() => {
    try {
      const c = newCharacter(input(), rules)
      const s = compute(c, rules)
      return { hp: s.hpMax.total, ac: s.ac.total, gp: c.money.gp }
    } catch {
      return undefined
    }
  })

  function create() {
    openCharacter(newCharacter(input(), rules))
  }
</script>

<div class="welcome">
  <h1>{tr(UI.appTitle)}</h1>
  <p class="sub">
    {tr({
      en: '2024 rules (SRD 5.2.1). Your character stays in this browser; export it as a file to move it.',
      fr: 'Règles 2024 (SRD 5.2.1). Votre personnage reste dans ce navigateur ; exportez-le en fichier pour le déplacer.',
      es: 'Reglas de 2024 (SRD 5.2.1). Tu personaje se queda en este navegador; expórtalo como archivo para moverlo.',
    })}
  </p>
  <div class="lang" role="group" aria-label="Language">
    <button class:on={app.character.settings.lang === 'en'} onclick={() => (app.character.settings.lang = 'en')}
      >EN</button
    >
    <button class:on={app.character.settings.lang === 'fr'} onclick={() => (app.character.settings.lang = 'fr')}
      >FR</button
    >
    <button class:on={app.character.settings.lang === 'es'} onclick={() => (app.character.settings.lang = 'es')}
      >ES</button
    >
  </div>

  <section class="box">
    <h3>{tr({ en: 'Import a character', fr: 'Importer un personnage', es: 'Importar un personaje' })}</h3>
    <button class="primary" onclick={() => fileInput?.click()}
      >⭱ {tr({ en: 'Open a JSON file', fr: 'Ouvrir un fichier JSON', es: 'Abrir un archivo JSON' })}</button
    >
    <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={importJson} hidden />
    {#if message}<p class="msg">{message}</p>{/if}
  </section>

  <section class="box">
    <h3>
      {tr({
        en: 'Create a level 1 character',
        fr: 'Créer un personnage de niveau 1',
        es: 'Crear un personaje de nivel 1',
      })}
    </h3>
    <p class="hint">
      {tr({
        en: 'Only what is needed to start (SRD 5.2.1 p. 19–23). Skills, Weapon Mastery, spells, feat and trait options and languages are chosen in the sheet: its rule checks list what is still to choose.',
        fr: 'Seulement l’indispensable pour commencer (SRD 5.2.1 p. 20–24). Compétences, bottes d’arme, sorts, options des dons et des traits et langues se choisissent dans la feuille : ses vérifications des règles indiquent ce qui reste à choisir.',
        es: 'Solo lo necesario para empezar (SRD 5.2.1 p. 21–25). Habilidades, maestría con armas, conjuros, opciones de dotes y atributos e idiomas se eligen en la hoja: sus comprobaciones de reglas indican lo que falta por elegir.',
      })}
    </p>

    <!-- 1. Name -->
    <fieldset>
      <legend><span class="n">1</span>{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}</legend>
      <div class="grid2">
        <label>{tr({ en: 'Character', fr: 'Personnage', es: 'Personaje' })}<input bind:value={name} /></label>
        <label>{tr({ en: 'Player', fr: 'Joueur', es: 'Jugador' })}<input bind:value={player} /></label>
      </div>
    </fieldset>

    <!-- 2. Class -->
    <fieldset>
      <legend><span class="n">2</span>{tr(UI.class)}</legend>
      <div class="grid2">
        <label
          >{tr(UI.class)}
          <select bind:value={classId} onchange={onClass}>
            {#each sorted(rules.classes) as c (c.id)}<option value={c.id}>{tr(c.name)}</option>{/each}
          </select>
        </label>
        {#if cls}
          <dl class="facts">
            <div>
              <dt>{tr(UI.hitDice)}</dt>
              <dd>d{cls.hitDie}</dd>
            </div>
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
      </div>
    </fieldset>

    <!-- 3. Origin -->
    <fieldset>
      <legend><span class="n">3</span>{tr({ en: 'Origin', fr: 'Origines', es: 'Origen' })}</legend>
      <div class="grid2">
        <div class="col">
          <label
            >{tr(UI.background)}
            <select bind:value={backgroundId} onchange={onBackground}>
              {#each sorted(rules.backgrounds) as b (b.id)}<option value={b.id}>{tr(b.name)}</option>{/each}
              <option value={CUSTOM_BACKGROUND}
                >{tr({ en: 'Custom background', fr: 'Historique personnalisé', es: 'Trasfondo personalizado' })}</option
              >
            </select>
          </label>
          {#if backgroundId === CUSTOM_BACKGROUND}
            <CustomBackgroundEditor custom={customBg} featId={customFeat} onfeat={(id) => (customFeat = id)} />
          {:else if bg}
            <dl class="facts">
              <div>
                <dt>{tr(UI.abilities)}</dt>
                <dd>{abilityList(bg.abilities)}</dd>
              </div>
              <div>
                <dt>{tr({ en: 'Origin feat', fr: 'Don d’origine', es: 'Dote de origen' })}</dt>
                <dd>{tr(bg.featText).replace(/\s*\((see|cf\.|consulta)[^)]*\)/, '')}</dd>
              </div>
              <div>
                <dt>{tr(UI.skills)}</dt>
                <dd>{names(bg.skills, rules.skills)}</dd>
              </div>
              <div>
                <dt>{tr({ en: 'Tool', fr: 'Outil', es: 'Herramienta' })}</dt>
                <dd>{tr(bg.tool)}</dd>
              </div>
            </dl>
          {/if}
        </div>
        <div class="col">
          <label
            >{tr(UI.species)}
            <select bind:value={speciesId} onchange={onSpecies}>
              {#each sorted(rules.species) as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
            </select>
          </label>
          {#if sp}
            <dl class="facts">
              <div>
                <dt>{tr(UI.speed)}</dt>
                <dd>{fmtDistance(sp.speed, lang())}</dd>
              </div>
              {#if sp.size.length === 1}
                <div>
                  <dt>{tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}</dt>
                  <dd>{tr(SIZE_NAMES[sp.size[0]])}</dd>
                </div>
              {/if}
            </dl>
            {#if sp.size.length > 1}
              <label
                >{tr({ en: 'Size', fr: 'Taille', es: 'Tamaño' })}
                <select bind:value={size}>
                  {#each sp.size as s (s)}<option value={s}>{tr(SIZE_NAMES[s])}</option>{/each}
                </select>
              </label>
            {/if}
            {#if lineage}
              <label
                >{tr(lineage.name)}
                <select bind:value={lineageValue}>
                  <option value="">— {tr({ en: 'later', fr: 'plus tard', es: 'más tarde' })} —</option>
                  {#each lineage.options as [id, o] (id)}<option value={id}>{tr(o.name)}</option>{/each}
                </select>
              </label>
            {/if}
          {/if}
        </div>
      </div>
    </fieldset>

    <!-- 4. Ability scores -->
    <fieldset>
      <legend><span class="n">4</span>{tr(UI.abilities)}</legend>
      <div class="seg" role="group">
        <button class:on={method === 'standard'} onclick={() => setMethod('standard')}
          >{tr({ en: 'Standard Array', fr: 'Valeurs standard', es: 'Conjunto estándar' })}</button
        >
        <button class:on={method === 'points'} onclick={() => setMethod('points')}
          >{tr({ en: 'Point Cost', fr: 'Acquisition par points', es: 'Coste en puntos' })}</button
        >
        <button class:on={method === 'rolled'} onclick={() => setMethod('rolled')}
          >{tr({ en: 'Random Generation', fr: 'Génération aléatoire', es: 'Generación aleatoria' })}</button
        >
      </div>
      <p class="hint">
        {#if method === 'standard'}
          15, 14, 13, 12, 10, 8 · {tr({
            en: 'placed as the class suggests; pick a value to swap it.',
            fr: 'répartis comme la classe le suggère ; choisissez une valeur pour l’échanger.',
            es: 'repartidos como sugiere la clase; elige un valor para intercambiarlo.',
          })}
        {:else if method === 'points'}
          {tr({ en: 'Points spent', fr: 'Points dépensés', es: 'Puntos gastados' })} :
          <strong class:bad={spent > BUDGET}>{spent} / {BUDGET}</strong> · 8–15
        {:else}
          {tr({
            en: '4d6, keep the three highest, six times; or type your own scores.',
            fr: '4d6, on garde les trois meilleurs, six fois ; ou saisissez vos valeurs.',
            es: '4d6, se suman los tres más altos, seis veces; o escribe tus puntuaciones.',
          })}
          <button class="small" onclick={roll}>{tr({ en: 'Roll', fr: 'Lancer', es: 'Tirar' })}</button>
          {#if rolls.length}<span class="rolls">{rolls.join(', ')}</span>{/if}
        {/if}
      </p>
      <div class="scores">
        {#each ABILITIES as a (a)}
          <div class="score">
            <span class="ab" title={tr(ABILITY_NAMES[a])}>{tr(ABILITY_SHORT[a])}</span>
            {#if method === 'standard'}
              <select
                value={base[a]}
                aria-label={tr(ABILITY_NAMES[a])}
                onchange={(e) => assignStandard(a, +e.currentTarget.value)}
              >
                {#each STANDARD as v (v)}<option value={v}>{v}</option>{/each}
              </select>
            {:else if method === 'points'}
              <span class="stepper">
                <button onclick={() => step(a, -1)} disabled={base[a] <= 8} aria-label="−">−</button>
                <span class="v">{base[a]}</span>
                <button onclick={() => step(a, 1)} disabled={base[a] >= 15} aria-label="+">+</button>
              </span>
            {:else}
              <input type="number" min="3" max="18" bind:value={base[a]} aria-label={tr(ABILITY_NAMES[a])} />
            {/if}
            <span class="inc" class:on={!!increases[a]}>{increases[a] ? `+${increases[a]}` : ''}</span>
            <span class="final" class:bad={finalScore(a) > 20}
              >{finalScore(a)} <small>({signed(mod(finalScore(a)))})</small></span
            >
          </div>
        {/each}
      </div>
      {#if bg && bg.abilities.length >= 3}
        <div class="incs">
          <span class="lab"
            >{tr({ en: 'Background increases', fr: 'Augmentations de l’historique', es: 'Aumentos del trasfondo' })} · {tr(
              bg.name,
            )}</span
          >
          <div class="seg" role="group">
            <button class:on={incMode === '2-1'} onclick={() => (incMode = '2-1')}>+2 / +1</button>
            <button class:on={incMode === '1-1-1'} onclick={() => (incMode = '1-1-1')}>+1 / +1 / +1</button>
          </div>
          {#if incMode === '2-1'}
            <label class="inline"
              >+2
              <select value={plus2} onchange={(e) => setPlus2(e.currentTarget.value as AbilityId)}>
                {#each bg.abilities as x (x)}<option value={x}>{tr(ABILITY_NAMES[x])}</option>{/each}
              </select>
            </label>
            <label class="inline"
              >+1
              <select bind:value={plus1}>
                {#each bg.abilities.filter((x) => x !== plus2) as x (x)}<option value={x}>{tr(ABILITY_NAMES[x])}</option
                  >{/each}
              </select>
            </label>
          {/if}
        </div>
      {/if}
      {#if over20}
        <p class="msg">
          {tr({
            en: 'None of these increases can raise a score above 20.',
            fr: 'Aucune de ces augmentations ne peut porter une valeur au-delà de 20.',
            es: 'Ninguno de estos aumentos puede subir una puntuación por encima de 20.',
          })}
        </p>
      {/if}
    </fieldset>

    <!-- 5. Starting equipment -->
    <fieldset>
      <legend
        ><span class="n">5</span>{tr({
          en: 'Starting equipment',
          fr: 'Équipement de départ',
          es: 'Equipo inicial',
        })}</legend
      >
      <div class="kit" role="radiogroup" aria-label={tr(cls?.name)}>
        <span class="lab">{tr(cls?.name)}</span>
        {#each classKits as o (o.letter)}
          <label class="opt" class:on={classKit === o.letter}>
            <input type="radio" name="class-kit" value={o.letter} bind:group={classKit} />
            <b>{o.letter}</b>
            <span>{optionText(o)}</span>
          </label>
        {/each}
        {#if chooser}
          <label class="pick"
            >{tr({
              en: 'Artisan’s Tools or Musical Instrument',
              fr: 'Outils d’artisan ou instrument de musique',
              es: 'Herramientas de artesano o instrumento musical',
            })}
            <select
              value={picks[chooser.text] ?? chooser.id}
              onchange={(e) => (picks[chooser.text] = e.currentTarget.value)}
            >
              {#each chooser.choose ?? [] as id (id)}<option value={id}>{tr(rules.gear.get(id)?.name)}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
      <div class="kit" role="radiogroup" aria-label={tr(bg?.name)}>
        <span class="lab">{tr(bg?.name)}</span>
        {#each bgKits as o (o.letter)}
          <label class="opt" class:on={bgKit === o.letter}>
            <input type="radio" name="bg-kit" value={o.letter} bind:group={bgKit} />
            <b>{o.letter}</b>
            <span>{optionText(o)}</span>
          </label>
        {/each}
      </div>
      <p class="hint">
        {tr({
          en: 'Armor, Shield and weapons are worn, one weapon (and the Shield) in hand; the rest goes in the backpack. Coins can be spent on equipment right away (SRD p. 20).',
          fr: 'Armure, bouclier et armes sont portés, une arme (et le bouclier) en main ; le reste va dans le sac. Les pièces peuvent aussitôt se dépenser en équipement (SRD p. 21).',
          es: 'La armadura, el escudo y las armas se llevan puestos, un arma (y el escudo) en la mano; el resto va a la mochila. Las monedas pueden gastarse en equipo de inmediato (SRD p. 22).',
        })}
      </p>
    </fieldset>

    <div class="go">
      {#if preview}
        <p class="sum">
          {tr(UI.hpShort)} <b>{preview.hp}</b> · {tr(UI.acShort)} <b>{preview.ac}</b> · <b>{gpText(preview.gp)}</b>
        </p>
      {/if}
      <button class="primary" onclick={create}>{tr({ en: 'Create', fr: 'Créer', es: 'Crear' })}</button>
    </div>
  </section>
</div>

<style>
  .welcome {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  h1 {
    font-family: var(--font-display);
    text-align: center;
    margin: 0;
  }
  .sub {
    text-align: center;
    color: var(--ink-soft);
    margin: 0;
  }
  .lang,
  .seg {
    display: flex;
    justify-content: center;
  }
  .seg {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .lang button,
  .seg button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
  }
  .lang button {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .lang button.on,
  .seg button.on {
    background: var(--frame);
    border-color: var(--frame);
    color: var(--on-frame);
  }
  fieldset {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 0;
    padding: 0.75rem 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  legend {
    font-family: var(--font-title);
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    padding: 0 0.4rem 0 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .n {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-frame);
    font-family: var(--font-num);
    font-size: 0.9rem;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.75rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-family: var(--font-title);
  }
  label.inline {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }
  input:not([type='radio']),
  select {
    min-height: 2.75rem;
    padding: 0 0.6rem;
    font: inherit;
    min-width: 0;
  }
  .facts {
    margin: 0;
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
    flex: 0 0 8.5rem;
  }
  .facts dd {
    margin: 0;
    min-width: 0;
  }
  .scores {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.4rem 1rem;
  }
  .score {
    display: grid;
    grid-template-columns: 2.6rem minmax(0, 6.5rem) 2rem 1fr;
    align-items: center;
    gap: 0.4rem;
  }
  .ab {
    font-family: var(--font-title);
    font-size: 1.05em;
  }
  .score select,
  .score input {
    width: 100%;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stepper button {
    min-width: 2.2rem;
    min-height: 2.5rem;
  }
  .stepper .v,
  .final {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .inc {
    color: var(--ink-soft);
    font-family: var(--font-num);
  }
  .inc.on {
    color: var(--accent);
  }
  .final small {
    font-weight: 400;
    color: var(--ink-soft);
  }
  .incs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .lab {
    font-family: var(--font-title);
    width: 100%;
  }
  .kit {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .opt {
    flex-direction: row;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    font-family: var(--font-body);
    cursor: pointer;
  }
  .opt.on {
    border-color: var(--frame);
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .opt b {
    font-family: var(--font-num);
  }
  .opt input {
    margin: 0;
    accent-color: var(--accent);
  }
  .pick {
    margin-left: 1.5rem;
  }
  .go {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    border-top: 1.5px solid var(--frame);
    padding-top: 0.75rem;
  }
  .sum {
    margin: 0;
    font-family: var(--font-title);
  }
  .sum b {
    font-family: var(--font-num);
  }
  .primary {
    min-height: 2.75rem;
    padding: 0 1.25rem;
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
    font: inherit;
  }
  .small {
    font-size: 0.9em;
    min-height: 2.2rem;
    margin-left: 0.5em;
  }
  .rolls {
    font-family: var(--font-num);
    margin-left: 0.5em;
  }
  .hint {
    font-size: 0.92em;
    color: var(--ink-soft);
    margin: 0;
  }
  .msg,
  .bad {
    color: var(--danger);
  }
  @media (max-width: 30rem) {
    .facts dt {
      flex-basis: 6.5rem;
    }
  }
</style>
