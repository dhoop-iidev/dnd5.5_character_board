<script lang="ts">
  // Custom subclasses (house rule #5, `model/customSubclasses.ts`): subclasses from other books entered by the player in
  // their own words, with the book and page. Each feature: class level, name, summary, and optionally what the sheet
  // uses (uses per rest, the part of the turn it takes, a list of named options, modifiers). Always-prepared spells by
  // class level. A subclass can be exported to a file and imported into another character. It then appears in the
  // subclass menu of the progression at class level 3.
  import { rules } from '../data/rules'
  import type { AbilityId, DamageType, I18n, RestKind } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_NAMES } from '../engine/sheet/common'
  import type { CustomSubclass, CustomSubclassFeature } from '../model/character'
  import {
    newCustomFeature,
    newCustomSubclass,
    parseSteps,
    readSubclassFile,
    stepsText,
    subclassFile,
  } from '../model/customSubclasses'
  import { app, tr } from '../state.svelte'
  import ModifierEditor from './ModifierEditor.svelte'
  import { formulaOk } from '../model/formula'

  const c = $derived(app.character)
  let open = $state<string | null>(null)
  let message = $state('')
  let fileInput: HTMLInputElement | undefined = $state()

  const classes = $derived([...rules.classes.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name))))
  const className = (id: string) => tr(rules.classes.get(id)?.name) || id
  const spellsByName = $derived(
    [...rules.spells.values()].filter((s) => s.level > 0).sort((a, b) => tr(a.name).localeCompare(tr(b.name))),
  )

  const usedAt = (id: string) => c.levels.map((l, i) => (l.subclassId === id ? i + 1 : 0)).filter((x) => x > 0)

  function add() {
    c.customSubclasses ??= []
    const sub = newCustomSubclass(c.levels[0]?.classId ?? 'fighter', c.customSubclasses)
    c.customSubclasses.push(sub)
    open = sub.id
  }
  function remove(sub: CustomSubclass) {
    c.customSubclasses = (c.customSubclasses ?? []).filter((s) => s.id !== sub.id)
    if (open === sub.id) open = null
  }
  function exportSub(sub: CustomSubclass) {
    const blob = new Blob([JSON.stringify(subclassFile($state.snapshot(sub) as CustomSubclass), null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(sub.name || sub.id).replace(/[^\p{L}\p{N}]+/gu, '_')}.subclass.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function importSub(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      c.customSubclasses ??= []
      const sub = readSubclassFile(JSON.parse(await file.text()), c.customSubclasses)
      c.customSubclasses.push(sub)
      open = sub.id
      message = ''
    } catch (err) {
      message =
        tr({ en: 'Import failed: ', fr: 'Échec de l’import : ', es: 'Error al importar: ' }) + (err as Error).message
    } finally {
      if (fileInput) fileInput.value = ''
    }
  }

  // --- Uses: a number, PB, an ability modifier (min 1) or the class level ---
  type CountKind = '' | 'n' | 'pb' | 'level' | AbilityId
  function countKind(f: CustomSubclassFeature, sub: CustomSubclass): CountKind {
    const n = f.uses?.count
    if (n === undefined || n === '') return ''
    if (typeof n === 'number') return 'n'
    if (n === 'pb') return 'pb'
    if (n === `${sub.classId}Level`) return 'level'
    return (ABILITIES as readonly string[]).includes(n) ? (n as AbilityId) : ''
  }
  function setCountKind(f: CustomSubclassFeature, sub: CustomSubclass, k: CountKind) {
    if (!k) {
      delete f.uses
      return
    }
    const count = k === 'n' ? 1 : k === 'level' ? `${sub.classId}Level` : k
    f.uses = { count, per: f.uses?.per ?? 'long', ...(f.uses?.byLevel ? { byLevel: f.uses.byLevel } : {}) }
  }
  function setActivation(f: CustomSubclassFeature, k: string) {
    if (!k) delete f.activation
    else
      f.activation = {
        kind: k as NonNullable<CustomSubclassFeature['activation']>['kind'],
        trigger: f.activation?.trigger,
      }
  }
  function setOptions(f: CustomSubclassFeature, text: string) {
    const options = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!options.length) delete f.choice
    else f.choice = { name: f.choice?.name ?? '', count: f.choice?.count ?? 1, byLevel: f.choice?.byLevel, options }
  }

  // --- Spells: always prepared from a class level ---
  function addSpellLevel(sub: CustomSubclass) {
    sub.spells ??= []
    const last = sub.spells.at(-1)?.level ?? 1
    sub.spells.push({ level: Math.min(20, last + 2), spells: [] })
  }
  function addSpell(row: { spells: string[] }, name: string) {
    const s = spellsByName.find((x) => tr(x.name).toLowerCase() === name.trim().toLowerCase())
    if (s && !row.spells.includes(s.id)) row.spells.push(s.id)
  }

  const RESTS: RestKind[] = ['short', 'long']
  /** Wild Shape changes (Druid subclasses), as formulas: "druidLevel/3", "druidLevel*3", "13 + wis". */
  const WILD_FIELDS: { key: 'maxCr' | 'tempHp' | 'acMin'; name: I18n; example: string }[] = [
    {
      key: 'maxCr',
      name: { en: 'Wild Shape: max CR', fr: 'Forme sauvage : FP max', es: 'Forma salvaje: VD máx.' },
      example: 'druidLevel/3',
    },
    {
      key: 'tempHp',
      name: {
        en: 'Wild Shape: Temporary HP',
        fr: 'Forme sauvage : PV temporaires',
        es: 'Forma salvaje: PG temporales',
      },
      example: 'druidLevel*3',
    },
    {
      key: 'acMin',
      name: { en: 'Wild Shape: AC at least', fr: 'Forme sauvage : CA au moins', es: 'Forma salvaje: CA al menos' },
      example: '13 + wis',
    },
  ]
  const baseWeapons = $derived([...rules.weapons.values()].sort((a, b) => tr(a.name).localeCompare(tr(b.name))))
  const DAMAGE_TYPES = Object.entries(rules.damageTypeNames) as [DamageType, I18n][]

  // --- Spellcasting given by the subclass (Eldritch Knight, Arcane Trickster…): every number from the player's book ---
  const spellLists = $derived(
    [...rules.classes.values()]
      .filter((cl) => cl.spellList?.length)
      .sort((a, b) => tr(a.name).localeCompare(tr(b.name))),
  )
  function toggleSpellcasting(sub: CustomSubclass, on: boolean) {
    if (!on) delete sub.spellcasting
    else sub.spellcasting = { ability: 'int', list: 'wizard', change: 'level', cantrips: {}, prepared: {}, slots: {} }
  }
  /** "3: 2 / 7: 4 2" ⇄ { "3": [2], "7": [4, 2] }: one line per class level, the slots of each spell level. */
  const slotsText = (t: Record<string, number[]>) =>
    Object.entries(t)
      .sort((a, b) => +a[0] - +b[0])
      .map(([k, v]) => `${k}: ${v.join(' ')}`)
      .join('\n')
  function parseSlots(s: string): Record<string, number[]> {
    const out: Record<string, number[]> = {}
    for (const line of s.split('\n')) {
      const m = line.match(/^\s*(\d+)\s*:\s*([\d\s]+)$/)
      if (m) out[m[1]] = m[2].trim().split(/\s+/).map(Number)
    }
    return out
  }
  function setMulticlass(sub: CustomSubclass, v: string) {
    const sc = sub.spellcasting!
    if (!v) delete sc.multiclass
    else sc.multiclass = { divisor: sc.multiclass?.divisor ?? 3, round: v as 'up' | 'down' }
  }
  const KINDS = [
    { id: 'action', name: { en: 'Action', fr: 'Action', es: 'Acción' } },
    { id: 'bonus-action', name: { en: 'Bonus Action', fr: 'Action bonus', es: 'Acción adicional' } },
    { id: 'reaction', name: { en: 'Reaction', fr: 'Réaction', es: 'Reacción' } },
    { id: 'free', name: { en: 'No action (free)', fr: 'Sans action (libre)', es: 'Sin acción (libre)' } },
  ]
</script>

<h4>{tr({ en: 'Custom subclasses', fr: 'Sous-classes personnalisées', es: 'Subclases personalizadas' })}</h4>
<p class="sub">
  {tr({
    en: 'Subclasses from other books (house rule #5), in your own words with the book and page. They then appear in the subclass menu at class level 3. Export one to reuse it for another character.',
    fr: 'Sous-classes d’autres livres (règle maison n° 5), dans vos propres mots, avec le livre et la page. Elles apparaissent ensuite dans le menu de sous-classe au niveau de classe 3. Exportez-en une pour la réutiliser avec un autre personnage.',
    es: 'Subclases de otros libros (regla de la casa n.º 5), con tus propias palabras, el libro y la página. Después aparecen en el menú de subclase en el nivel de clase 3. Exporta una para reutilizarla con otro personaje.',
  })}
</p>

{#each c.customSubclasses ?? [] as sub (sub.id)}
  {@const used = usedAt(sub.id)}
  <div class="item">
    <div class="head">
      <button class="name" onclick={() => (open = open === sub.id ? null : sub.id)} aria-expanded={open === sub.id}
        >{open === sub.id ? '▾' : '▸'}
        {sub.name || tr({ en: '(unnamed)', fr: '(sans nom)', es: '(sin nombre)' })}</button
      >
      <span class="meta">{className(sub.classId)}{sub.book ? ` · ${sub.book}` : ''}</span>
      <button class="ghost" onclick={() => exportSub(sub)}
        >{tr({ en: 'Export', fr: 'Exporter', es: 'Exportar' })}</button
      >
      <button
        class="ghost"
        disabled={used.length > 0}
        title={used.length
          ? `${tr({ en: 'Taken at level', fr: 'Prise au niveau', es: 'Elegida en el nivel' })} ${used.join(', ')}`
          : tr({ en: 'Delete', fr: 'Supprimer', es: 'Eliminar' })}
        onclick={() => remove(sub)}>✕</button
      >
    </div>
    {#if open === sub.id}
      <div class="form">
        <label class="grow"
          >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={sub.name} /></label
        >
        <label
          >{tr({ en: 'Class', fr: 'Classe', es: 'Clase' })}
          <select bind:value={sub.classId} disabled={used.length > 0}>
            {#each classes as cl (cl.id)}<option value={cl.id}>{tr(cl.name)}</option>{/each}
          </select>
        </label>
        <label class="grow"
          >{tr({ en: 'Book and page', fr: 'Livre et page', es: 'Libro y página' })}<input
            type="text"
            bind:value={sub.book}
            placeholder={tr({
              en: 'Player’s Handbook (2024) p. …',
              fr: 'Manuel des joueurs (2024) p. …',
              es: 'Manual del jugador (2024) p. …',
            })}
          /></label
        >
        <label class="wide"
          >{tr({
            en: 'Description (your own words)',
            fr: 'Description (vos propres mots)',
            es: 'Descripción (tus propias palabras)',
          })}<textarea rows="2" bind:value={sub.text}></textarea></label
        >

        <h5 class="wide">{tr({ en: 'Features', fr: 'Aptitudes', es: 'Rasgos' })}</h5>
        {#each [...sub.features].sort((a, b) => a.level - b.level) as f (f.id)}
          <div class="feature wide">
            <div class="row">
              <label class="lv"
                >{tr({ en: 'Level', fr: 'Niveau', es: 'Nivel' })}<input
                  type="number"
                  min="1"
                  max="20"
                  bind:value={f.level}
                /></label
              >
              <label class="grow"
                >{tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}<input type="text" bind:value={f.name} /></label
              >
              <button
                class="ghost"
                title={tr({ en: 'Remove the feature', fr: 'Retirer l’aptitude', es: 'Quitar el rasgo' })}
                onclick={() => (sub.features = sub.features.filter((x) => x.id !== f.id))}>✕</button
              >
            </div>
            <label
              >{tr({
                en: 'What it does (your own summary)',
                fr: 'Ce qu’elle fait (votre propre résumé)',
                es: 'Qué hace (tu propio resumen)',
              })}<textarea rows="3" bind:value={f.text}></textarea></label
            >
            <div class="row">
              <label
                >{tr({ en: 'Uses', fr: 'Utilisations', es: 'Usos' })}
                <select
                  value={countKind(f, sub)}
                  onchange={(e) => setCountKind(f, sub, e.currentTarget.value as CountKind)}
                >
                  <option value="">—</option>
                  <option value="n">{tr({ en: 'Number', fr: 'Nombre', es: 'Número' })}</option>
                  <option value="pb"
                    >{tr({
                      en: 'Proficiency Bonus',
                      fr: 'Bonus de maîtrise',
                      es: 'Bonificador por competencia',
                    })}</option
                  >
                  <option value="level"
                    >{tr({ en: 'Class level', fr: 'Niveau de classe', es: 'Nivel de clase' })}</option
                  >
                  {#each ABILITIES as a (a)}<option value={a}
                      >{tr({ en: 'Modifier', fr: 'Modificateur', es: 'Modificador' })} {tr(ABILITY_NAMES[a])}</option
                    >{/each}
                </select>
              </label>
              {#if f.uses}
                {#if typeof f.uses.count === 'number'}
                  <label class="lv"
                    >{tr({ en: 'Number', fr: 'Nombre', es: 'Número' })}<input
                      type="number"
                      min="1"
                      bind:value={f.uses.count}
                    /></label
                  >
                {/if}
                <label
                  >{tr({ en: 'Back on', fr: 'Récupérées après', es: 'Se recuperan tras' })}
                  <select bind:value={f.uses.per}>
                    {#each RESTS as r (r)}<option value={r}
                        >{r === 'short'
                          ? tr({ en: 'Short Rest', fr: 'Repos court', es: 'Descanso corto' })
                          : tr({ en: 'Long Rest', fr: 'Repos long', es: 'Descanso largo' })}</option
                      >{/each}
                  </select>
                </label>
                <label
                  >{tr({
                    en: 'More at class level (7:5, 15:6)',
                    fr: 'Davantage au niveau de classe (7:5, 15:6)',
                    es: 'Más en nivel de clase (7:5, 15:6)',
                  })}<input
                    type="text"
                    value={stepsText(f.uses.byLevel)}
                    onchange={(e) => (f.uses!.byLevel = parseSteps(e.currentTarget.value))}
                  /></label
                >
              {/if}
            </div>
            <div class="row">
              <label
                >{tr({ en: 'Takes', fr: 'Demande', es: 'Requiere' })}
                <select value={f.activation?.kind ?? ''} onchange={(e) => setActivation(f, e.currentTarget.value)}>
                  <option value="">—</option>
                  {#each KINDS as k (k.id)}<option value={k.id}>{tr(k.name)}</option>{/each}
                </select>
              </label>
              {#if f.activation}
                <label class="grow"
                  >{tr({
                    en: 'Trigger or reminder',
                    fr: 'Déclencheur ou rappel',
                    es: 'Desencadenante o recordatorio',
                  })}<input type="text" bind:value={f.activation.trigger} /></label
                >
              {/if}
            </div>
            <div class="row">
              <label class="grow"
                >{tr({
                  en: 'Options to choose from, one per line (maneuvers…)',
                  fr: 'Options au choix, une par ligne (manœuvres…)',
                  es: 'Opciones a elegir, una por línea (maniobras…)',
                })}<textarea
                  rows="2"
                  value={(f.choice?.options ?? []).join('\n')}
                  onchange={(e) => setOptions(f, e.currentTarget.value)}></textarea></label
              >
              {#if f.choice}
                <label
                  >{tr({ en: 'Name of the choice', fr: 'Nom du choix', es: 'Nombre de la elección' })}<input
                    type="text"
                    bind:value={f.choice.name}
                  /></label
                >
                <label class="lv"
                  >{tr({ en: 'How many', fr: 'Combien', es: 'Cuántas' })}<input
                    type="number"
                    min="1"
                    bind:value={f.choice.count}
                  /></label
                >
                <label
                  >{tr({
                    en: 'More at class level (7:5)',
                    fr: 'Davantage au niveau de classe (7:5)',
                    es: 'Más en nivel de clase (7:5)',
                  })}<input
                    type="text"
                    value={stepsText(f.choice.byLevel)}
                    onchange={(e) => (f.choice!.byLevel = parseSteps(e.currentTarget.value))}
                  /></label
                >
              {/if}
            </div>
            {#if sub.classId === 'druid'}
              <div class="row">
                {#each WILD_FIELDS as wf (wf.key)}
                  {@const v = f.wildShape?.[wf.key] ?? ''}
                  <label
                    >{tr(wf.name)}<input
                      type="text"
                      class:bad={!formulaOk(v)}
                      value={v}
                      placeholder={wf.example}
                      onchange={(e) => (
                        (f.wildShape ??= {}),
                        (f.wildShape[wf.key] = e.currentTarget.value.trim() || undefined)
                      )}
                    /></label
                  >
                {/each}
              </div>
            {/if}
            <label class="chip"
              ><input
                type="checkbox"
                checked={!!f.weapon}
                onchange={(e) =>
                  e.currentTarget.checked
                    ? (f.weapon = { name: f.name, base: 'dagger', proficient: true })
                    : delete f.weapon}
              />{tr({
                en: 'It creates a weapon (listed with your attacks)',
                fr: 'Elle crée une arme (listée avec vos attaques)',
                es: 'Crea un arma (aparece con tus ataques)',
              })}</label
            >
            {#if f.weapon}
              {@const fw = f.weapon}
              <div class="row">
                <label class="grow"
                  >{tr({ en: 'Weapon name', fr: 'Nom de l’arme', es: 'Nombre del arma' })}<input
                    type="text"
                    bind:value={fw.name}
                  /></label
                >
                <label
                  >{tr({
                    en: 'Like (kind, properties)',
                    fr: 'Comme (type, propriétés)',
                    es: 'Como (tipo, propiedades)',
                  })}
                  <select bind:value={fw.base}>
                    {#each baseWeapons as w (w.id)}<option value={w.id}>{tr(w.name)}</option>{/each}
                  </select>
                </label>
                <label class="lv"
                  >{tr({ en: 'Damage', fr: 'Dégâts', es: 'Daño' })}<input
                    type="text"
                    bind:value={fw.damage}
                    placeholder={rules.weapons.get(fw.base)?.damage ?? ''}
                  /></label
                >
                <label
                  >{tr({ en: 'Damage type', fr: 'Type de dégâts', es: 'Tipo de daño' })}
                  <select bind:value={fw.damageType}>
                    <option value={undefined}>—</option>
                    {#each DAMAGE_TYPES as [id, n] (id)}<option value={id}>{tr(n)}</option>{/each}
                  </select>
                </label>
                <label class="lv"
                  >{tr({ en: 'Range (ft)', fr: 'Portée (pieds)', es: 'Alcance (pies)' })}<input
                    type="number"
                    min="0"
                    value={fw.rangeFt?.normal ?? ''}
                    onchange={(e) =>
                      (fw.rangeFt = +e.currentTarget.value
                        ? { normal: +e.currentTarget.value, long: fw.rangeFt?.long ?? +e.currentTarget.value }
                        : undefined)}
                  /></label
                >
                {#if fw.rangeFt}
                  <label class="lv"
                    >{tr({ en: 'Long (ft)', fr: 'Longue (pieds)', es: 'Largo (pies)' })}<input
                      type="number"
                      min="0"
                      bind:value={fw.rangeFt.long}
                    /></label
                  >
                {/if}
              </div>
              <div class="row">
                <label class="chip"
                  ><input type="checkbox" bind:checked={fw.proficient} />{tr({
                    en: 'You are proficient with it',
                    fr: 'Vous la maîtrisez',
                    es: 'Tienes competencia con ella',
                  })}</label
                >
                <label class="chip"
                  ><input type="checkbox" bind:checked={fw.mastery} />{tr({
                    en: 'You can use its mastery property',
                    fr: 'Vous pouvez utiliser sa botte d’arme',
                    es: 'Puedes usar su propiedad de maestría',
                  })}</label
                >
              </div>
            {/if}
            <span class="lab"
              >{tr({
                en: 'Numbers the sheet applies (optional)',
                fr: 'Valeurs appliquées par la feuille (facultatif)',
                es: 'Valores que aplica la hoja (opcional)',
              })}</span
            >
            <ModifierEditor bind:mods={() => f.modifiers ?? [], (v) => (f.modifiers = v)} />
          </div>
        {/each}
        <div class="wide">
          <button onclick={() => sub.features.push(newCustomFeature(sub))}
            >＋ {tr({ en: 'Add a feature', fr: 'Ajouter une aptitude', es: 'Añadir un rasgo' })}</button
          >
        </div>

        <h5 class="wide">{tr({ en: 'Spellcasting', fr: 'Incantation', es: 'Lanzamiento de conjuros' })}</h5>
        <label class="chip wide"
          ><input
            type="checkbox"
            checked={!!sub.spellcasting}
            onchange={(e) => toggleSpellcasting(sub, e.currentTarget.checked)}
          />{tr({
            en: 'This subclass gives its class spellcasting (fill in the numbers from your book)',
            fr: 'Cette sous-classe donne l’incantation à sa classe (reportez les valeurs de votre livre)',
            es: 'Esta subclase da lanzamiento de conjuros a su clase (copia los valores de tu libro)',
          })}</label
        >
        {#if sub.spellcasting}
          {@const sc = sub.spellcasting}
          <div class="row wide">
            <label
              >{tr({ en: 'Ability', fr: 'Caractéristique', es: 'Característica' })}
              <select bind:value={sc.ability}>
                {#each ABILITIES as a (a)}<option value={a}>{tr(ABILITY_NAMES[a])}</option>{/each}
              </select>
            </label>
            <label
              >{tr({ en: 'Spell list', fr: 'Liste de sorts', es: 'Lista de conjuros' })}
              <select bind:value={sc.list}>
                {#each spellLists as cl (cl.id)}<option value={cl.id}>{tr(cl.name)}</option>{/each}
              </select>
            </label>
            <label
              >{tr({
                en: 'Change a prepared spell',
                fr: 'Changer un sort préparé',
                es: 'Cambiar un conjuro preparado',
              })}
              <select bind:value={sc.change}>
                <option value="level"
                  >{tr({ en: 'One per level gained', fr: 'Un par niveau gagné', es: 'Uno por nivel ganado' })}</option
                >
                <option value="long-rest"
                  >{tr({ en: 'After a Long Rest', fr: 'Après un repos long', es: 'Tras un descanso largo' })}</option
                >
              </select>
            </label>
          </div>
          <div class="row wide">
            <label
              >{tr({
                en: 'Cantrips by class level (3:2, 10:3)',
                fr: 'Sorts mineurs par niveau de classe (3:2, 10:3)',
                es: 'Trucos por nivel de clase (3:2, 10:3)',
              })}<input
                type="text"
                value={stepsText(sc.cantrips)}
                onchange={(e) => (sc.cantrips = parseSteps(e.currentTarget.value) ?? {})}
              /></label
            >
            <label class="grow"
              >{tr({
                en: 'Prepared spells by class level (3:3, 4:4…)',
                fr: 'Sorts préparés par niveau de classe (3:3, 4:4…)',
                es: 'Conjuros preparados por nivel de clase (3:3, 4:4…)',
              })}<input
                type="text"
                value={stepsText(sc.prepared)}
                onchange={(e) => (sc.prepared = parseSteps(e.currentTarget.value) ?? {})}
              /></label
            >
          </div>
          <div class="row wide">
            <label class="grow"
              >{tr({
                en: 'Spell slots: one line per class level where they change, the slots of level 1, 2, 3… (e.g. “7: 4 2”)',
                fr: 'Emplacements de sorts : une ligne par niveau de classe où ils changent, les emplacements de niveau 1, 2, 3… (ex. « 7: 4 2 »)',
                es: 'Espacios de conjuro: una línea por nivel de clase en que cambian, los espacios de nivel 1, 2, 3… (p. ej. «7: 4 2»)',
              })}<textarea
                rows="4"
                value={slotsText(sc.slots)}
                onchange={(e) => (sc.slots = parseSlots(e.currentTarget.value))}></textarea></label
            >
          </div>
          <div class="row wide">
            <label
              >{tr({
                en: 'With other spellcasting classes, its levels count as',
                fr: 'Avec d’autres classes d’incantation, ses niveaux comptent pour',
                es: 'Con otras clases lanzadoras, sus niveles cuentan como',
              })}
              <select value={sc.multiclass?.round ?? ''} onchange={(e) => setMulticlass(sub, e.currentTarget.value)}>
                <option value="">— {tr({ en: 'not entered', fr: 'non renseigné', es: 'sin indicar' })}</option>
                <option value="down"
                  >{tr({
                    en: 'class level ÷ N, rounded down',
                    fr: 'niveau de classe ÷ N, arrondi à l’inférieur',
                    es: 'nivel de clase ÷ N, redondeado hacia abajo',
                  })}</option
                >
                <option value="up"
                  >{tr({
                    en: 'class level ÷ N, rounded up',
                    fr: 'niveau de classe ÷ N, arrondi au supérieur',
                    es: 'nivel de clase ÷ N, redondeado hacia arriba',
                  })}</option
                >
              </select>
            </label>
            {#if sc.multiclass}
              <label class="lv">N<input type="number" min="1" max="4" bind:value={sc.multiclass.divisor} /></label>
            {/if}
          </div>
        {/if}

        <h5 class="wide">
          {tr({
            en: 'Always-prepared spells (spellcasting classes)',
            fr: 'Sorts toujours préparés (classes de lanceurs de sorts)',
            es: 'Conjuros siempre preparados (clases lanzadoras de conjuros)',
          })}
        </h5>
        {#each sub.spells ?? [] as row, ri (ri)}
          <div class="row wide">
            <label class="lv"
              >{tr({ en: 'Class level', fr: 'Niveau de classe', es: 'Nivel de clase' })}<input
                type="number"
                min="1"
                max="20"
                bind:value={row.level}
              /></label
            >
            <span class="spells">
              {#each row.spells as id (id)}
                <span class="chip"
                  >{tr(rules.spells.get(id)?.name) || id}<button
                    class="x"
                    aria-label="✕"
                    onclick={() => (row.spells = row.spells.filter((x) => x !== id))}>✕</button
                  ></span
                >
              {/each}
              <input
                type="text"
                list="custom-subclass-spells"
                placeholder={tr({ en: 'Add a spell…', fr: 'Ajouter un sort…', es: 'Añadir un conjuro…' })}
                onchange={(e) => {
                  addSpell(row, e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
              />
            </span>
            <button class="ghost" onclick={() => (sub.spells = sub.spells!.filter((_, j) => j !== ri))}>✕</button>
          </div>
        {/each}
        <div class="wide">
          <button onclick={() => addSpellLevel(sub)}
            >＋ {tr({
              en: 'Add a spell level',
              fr: 'Ajouter un palier de sorts',
              es: 'Añadir un nivel de conjuros',
            })}</button
          >
        </div>
      </div>
    {/if}
  </div>
{/each}

<datalist id="custom-subclass-spells">
  {#each spellsByName as s (s.id)}<option value={tr(s.name)}></option>{/each}
</datalist>

<div class="bar">
  <button onclick={add}
    >＋ {tr({
      en: 'New custom subclass',
      fr: 'Nouvelle sous-classe personnalisée',
      es: 'Nueva subclase personalizada',
    })}</button
  >
  <button class="ghost" onclick={() => fileInput?.click()}
    >{tr({
      en: 'Import a subclass file',
      fr: 'Importer un fichier de sous-classe',
      es: 'Importar un archivo de subclase',
    })}</button
  >
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={importSub} />
</div>
{#if message}<p class="msg">{message}</p>{/if}

<style>
  .sub {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .item {
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  .name {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-title);
    cursor: pointer;
    text-align: left;
  }
  .meta {
    flex: 1;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.4rem 0 0.4rem 1rem;
  }
  .form label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  h5 {
    margin: 0.5rem 0 0;
    font-family: var(--font-title);
  }
  .wide {
    flex-basis: 100%;
  }
  .grow {
    flex: 1;
    min-width: 10rem;
  }
  .feature {
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
  .lv input {
    width: 4rem;
  }
  .lab {
    font-family: var(--font-title);
    font-size: 0.85rem;
  }
  textarea {
    width: 100%;
    font: inherit;
  }
  .spells {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  input.bad {
    border-color: var(--accent);
    outline: 1px solid var(--accent);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--rule-strong);
    border-radius: 1em;
    padding: 0.1em 0.6em;
  }
  .x {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--ink-soft);
  }
  .bar {
    display: flex;
    gap: 0.6rem;
    margin: 0.4rem 0;
  }
  .msg {
    color: var(--accent);
  }
</style>
