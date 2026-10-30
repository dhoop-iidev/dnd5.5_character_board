<script lang="ts">
  // Printable character sheet ("Generate the PDF"), laid out like the 2024 character sheet on A4 pages:
  // page 1 is what's used at the table (identity, Armor Class, hit points, Hit Point Dice, death saves, abilities with
  // their saving throws and skills, weapons and damage cantrips, class features, species traits, feats, training and
  // proficiencies); page 2 the spellcasting, equipment, Attunement, coins, character details and ruled notes. Names
  // only, no descriptions. Rendered only while printing (ui/print.svelte.ts); the browser's print dialog saves it as a
  // PDF. A sheet too long for two pages flows onto a third.
  import { alignmentName } from '../model/alignments'
  import { rules } from '../data/rules'
  import { ABILITIES, type AbilityId, type I18n, type SpellDef } from '../data/types'
  import { ABILITY_NAMES, ABILITY_SHORT } from '../engine/sheet/common'
  import type { AttackLine, Proficiency } from '../engine/sheet/types'
  import { SIZE_NAMES, UI } from '../i18n/ui'
  import { trainingRows } from './training'
  import type { Identity, ItemInstance, ItemLocation } from '../model/character'
  import { app, lang, tr, view } from '../state.svelte'
  import { fmtFeet, fmtWeight, isMetric, locale } from './format'
  import { itemName, itemWeight } from './items'

  const c = $derived(app.character)
  const s = $derived(view.sheet)
  const L = (en: string, fr: string, es?: string): I18n => (es === undefined ? { en, fr } : { en, fr, es })
  /** A modifier always signed (+0 included), with a true minus sign. */
  const sg = (n: number) => (n < 0 ? `−${-n}` : `+${n}`)
  const dist = (ft: number) => (isMetric(lang()) ? fmtFeet(ft, lang()) : `${ft} ft`)

  // Optional character-detail fields (added by a later schema; read defensively).
  type Details = Partial<Record<'personality' | 'ideals' | 'bonds' | 'flaws' | 'appearance' | 'allies', string>>
  const id = $derived((c.identity ?? {}) as Partial<Identity> & Details)

  const MARK: Record<Proficiency, string> = { none: '○', half: '◐', proficient: '●', expertise: '◉' }
  /** Abilities in the two columns of the 2024 sheet. */
  const ABILITY_COLS: AbilityId[][] = [
    ['str', 'dex', 'con'],
    ['int', 'wis', 'cha'],
  ]

  const classes = $derived(
    s.classOrder.map((cid) => {
      const sub = s.subclasses.get(cid)
      return `${tr(rules.classes.get(cid)?.name) || cid} ${s.classLevels[cid] ?? ''}${sub ? ` (${tr(sub.name)})` : ''}`
    }),
  )
  const size = $derived(c.speciesChoices?.size ?? s.species?.size?.[0] ?? '')
  const darkvision = $derived(
    Math.max(0, ...s.pool.grants.filter((g) => g.grant.kind === 'darkvision').map((g) => Number(g.grant.value) || 0)),
  )
  const SPEED_KIND: Record<string, I18n> = {
    climb: L('Climb', 'Escalade', 'Trepar'),
    swim: L('Swim', 'Nage', 'Nadar'),
    fly: L('Fly', 'Vol', 'Volar'),
  }

  /** A feature gained at several levels (or from two classes) is listed once. */
  const uniq = (names: string[]) => [...new Set(names.filter(Boolean))]
  const features = $derived(uniq(s.features.map((f) => tr(f.def.name))))
  const traits = $derived(uniq(s.traits.map((t) => tr(t.name))))
  const feats = $derived(s.feats.map((f) => tr(f.def.name)))

  // --- Training and proficiencies (ui/training.ts) ---
  const training = $derived(
    trainingRows(s, rules).map((r) => ({ label: r.label, text: r.items.map((x) => tr(x.name)).join(', ') })),
  )

  // --- Weapons and damage cantrips ---
  const attacks = $derived([...s.attacks, ...(s.unarmed ? [s.unarmed] : [])])
  const damageOf = (a: AttackLine) =>
    `${a.damage.dice}${a.damage.bonus.total ? sg(a.damage.bonus.total) : ''} ${tr(a.damage.type)}` +
    (a.damage.versatile ? ` (${a.damage.versatile})` : '')
  const attackNotes = (a: AttackLine) =>
    [
      a.range ? `${tr(a.range.normal)}/${tr(a.range.long)}` : '',
      a.critRange < 20
        ? tr(L(`crit ${a.critRange}–20`, `critique ${a.critRange}–20`, `crítico ${a.critRange}–20`))
        : '',
      a.properties.map((p) => tr(p)).join(', '),
      ...a.extraDamage.map((x) => `+${x.dice} ${tr(x.label)}`),
    ]
      .filter(Boolean)
      .join(' · ')

  const ABILITY_BY_EN: Record<string, AbilityId> = {
    Strength: 'str',
    Dexterity: 'dex',
    Constitution: 'con',
    Intelligence: 'int',
    Wisdom: 'wis',
    Charisma: 'cha',
  }
  const WORD_N: Record<string, number> = { two: 2, three: 3, four: 4 }
  /** A damage cantrip as an attack line, read from its SRD text: spell attack or saving throw, damage dice and type,
   * the Cantrip Upgrade dice at the character's level ("levels 5 (2d10), 11 (3d10)…", or Eldritch Blast's beams). */
  function cantripLine(sp: SpellDef, sc: (typeof s.spellcasting)[number]) {
    const text = sp.text.en
    const dmg = /(\d+d\d+)\s+([A-Z][a-z]+)\s+damage/.exec(text)
    if (!dmg) return undefined
    const save = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(text)
    const isAttack = /spell attack/.test(text)
    if (!isAttack && !save) return undefined
    let dice = dmg[1]
    let note = ''
    const up = sp.upcast?.en ?? ''
    for (const m of up.matchAll(/(\d+)\s*\((\d+d\d+)\)/g)) if (s.level >= Number(m[1])) dice = m[2]
    for (const m of up.matchAll(/(two|three|four) beams at level (\d+)/g))
      if (s.level >= Number(m[2]))
        note = tr(L(`${WORD_N[m[1]]} beams`, `${WORD_N[m[1]]} rayons`, `${WORD_N[m[1]]} rayos`))
    const typeKey = dmg[2].toLowerCase() as keyof typeof rules.damageTypeNames
    const ab = save ? ABILITY_BY_EN[save[1]] : undefined
    return {
      name: tr(sp.name),
      attack: isAttack
        ? sg(sc.attack.total)
        : `${tr(L('DC', 'DD', 'CD'))} ${sc.dc.total} ${ab ? tr(ABILITY_SHORT[ab]) : ''}`,
      damage: `${dice} ${tr(rules.damageTypeNames[typeKey]) || dmg[2]}`,
      notes: [tr(sp.range), note].filter(Boolean).join(' · '),
    }
  }
  const cantripAttacks = $derived(
    s.spellcasting.flatMap((sc) =>
      sc.cantrips
        .map((cid) => rules.spells.get(cid))
        .filter((sp): sp is SpellDef => !!sp)
        .map((sp) => cantripLine(sp, sc))
        .filter((x) => !!x),
    ),
  )

  // --- Spellcasting ---
  type SpellRow = { sp: SpellDef; always: boolean }
  function spellRows(sc: (typeof s.spellcasting)[number]): SpellRow[] {
    const seen = new Set<string>()
    const rows: SpellRow[] = []
    const add = (ids: string[], always: boolean) => {
      for (const sid of ids) {
        const sp = rules.spells.get(sid)
        if (!sp || seen.has(sid)) continue
        seen.add(sid)
        rows.push({ sp, always })
      }
    }
    add(sc.cantrips, false)
    add(sc.alwaysPrepared, true)
    add(sc.prepared, false)
    return rows.sort((a, b) => a.sp.level - b.sp.level || tr(a.sp.name).localeCompare(tr(b.sp.name)))
  }
  const extraRows = $derived(
    s.extraSpells.map((x) => ({
      name: tr(x.name),
      ability: x.ability,
      spells: x.spells.map((sid) => rules.spells.get(sid)).filter((sp): sp is SpellDef => !!sp),
    })),
  )
  const castingShort = (sp: SpellDef) =>
    sp.castingKind === 'action'
      ? tr(L('Action', 'Action', 'Acción'))
      : sp.castingKind === 'bonus-action'
        ? tr(L('Bonus A.', 'Action bonus', 'Acción ad.'))
        : sp.castingKind === 'reaction'
          ? tr(L('Reaction', 'Réaction', 'Reacción'))
          : tr(sp.castingTime)

  // --- Equipment ---
  const LOCATIONS: { id: ItemLocation; label: I18n }[] = [
    { id: 'worn', label: UI.worn },
    { id: 'carried', label: UI.carried },
    { id: 'stored', label: UI.stored },
  ]
  const weightOf = (it: ItemInstance) => {
    const w = itemWeight(it)
    return w && (w.lb || w.kg) ? fmtWeight({ lb: w.lb * it.quantity, kg: w.kg * it.quantity }, lang()) : ''
  }
  const attuneMax = $derived(3 + s.pool.parts('attunement.max').reduce((a, p) => a + p.value, 0))
  const attuned = $derived(c.inventory.filter((it) => it.attuned).map((it) => tr(itemName(it))))
  const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const
  const COIN_LABEL: Record<(typeof COINS)[number], I18n> = {
    cp: L('CP', 'PC', 'pc'),
    sp: L('SP', 'PA', 'pp'),
    ep: L('EP', 'PE', 'pe'),
    gp: L('GP', 'PO', 'po'),
    pp: L('PP', 'PP', 'ppt'),
  }

  const details = $derived(
    [
      { label: L('Appearance', 'Apparence', 'Apariencia'), text: id.appearance },
      { label: L('Personality', 'Personnalité', 'Personalidad'), text: id.personality },
      { label: L('Ideals', 'Idéaux', 'Ideales'), text: id.ideals },
      { label: L('Bonds', 'Liens', 'Vínculos'), text: id.bonds },
      { label: L('Flaws', 'Défauts', 'Defectos'), text: id.flaws },
      { label: L('Allies and organizations', 'Alliés et organisations', 'Aliados y organizaciones'), text: id.allies },
    ].filter((d) => d.text?.trim()),
  )
  const physical = $derived(
    [
      id.age ? `${tr(L('Age', 'Âge', 'Edad'))} ${id.age}` : '',
      id.height?.m
        ? `${tr(L('Height', 'Taille', 'Altura'))} ${isMetric(lang()) ? `${id.height.m} m` : `${Math.round((id.height.m / 0.3) * 10) / 10} ft`}`
        : '',
      id.weight?.kg
        ? `${tr(L('Weight', 'Poids', 'Peso'))} ${fmtWeight({ lb: id.weight.kg * 2, kg: id.weight.kg }, lang())}`
        : '',
    ]
      .filter(Boolean)
      .join(' · '),
  )
  const wildShapeForms = $derived((c.wildShape?.known ?? []).map((cid) => tr(rules.creatures.get(cid)?.name) || cid))
  const today = $derived(new Date().toLocaleDateString(lang() === 'en' ? 'en-GB' : locale(lang())))
  const boxes = (n: number) => '□'.repeat(Math.max(0, n))
</script>

<div class="print-sheet" lang={lang()}>
  <!-- ============================== page 1: at the table ============================== -->
  <div class="page">
    <header>
      <h1>{id.name}</h1>
      {#if id.title}<span class="sub">{id.title}</span>{/if}
    </header>
    <div class="ident">
      <div class="f w2"><span>{tr(L('Background', 'Historique', 'Trasfondo'))}</span>{tr(s.background?.name)}</div>
      <div class="f w2"><span>{tr(L('Species', 'Espèce', 'Especie'))}</span>{tr(s.species?.name)}</div>
      <div class="f"><span>{tr(L('Level', 'Niveau', 'Nivel'))}</span>{s.level}</div>
      <div class="f"><span>XP</span>{c.xp ?? 0}</div>
      <div class="f w4">
        <span>{tr(L('Class and subclass', 'Classe et sous-classe', 'Clase y subclase'))}</span>{classes.join(' / ')}
      </div>
      <div class="f">
        <span>{tr(L('Alignment', 'Alignement', 'Alineamiento'))}</span>{tr(alignmentName(id.alignment))}
      </div>
      <div class="f"><span>{tr(L('Player', 'Joueur', 'Jugador'))}</span>{id.player}</div>
    </div>

    <!-- top band: Armor Class, hit points (current and temporary left blank), Hit Point Dice, death saves -->
    <div class="band">
      <div class="cell shield">
        <span>{tr(UI.acShort)}</span><b class="xl">{s.ac.total}</b>
        <small>{s.armor ? tr(s.armor.def.name) : ''}{s.shield ? ` + ${tr(s.shield.def.name)}` : ''}</small>
      </div>
      <div class="cell hp">
        <span>{tr(UI.hp)}</span>
        <div class="hp3">
          <div><b>{s.hpMax.total}</b><small>{tr(L('Max', 'Max', 'Máx.'))}</small></div>
          <div><b></b><small>{tr(L('Current', 'Actuels', 'Actuales'))}</small></div>
          <div><b></b><small>{tr(L('Temp', 'Temp.', 'Temp.'))}</small></div>
        </div>
      </div>
      <div class="cell">
        <span>{tr(UI.hitDice)}</span>
        {#each s.hitDice as h (h.classId)}
          <div class="hd">
            <b>{h.total}d{h.die}</b> <small>{tr(L('spent', 'dépensés', 'gastados'))}</small>
            {boxes(h.total)}
          </div>
        {/each}
      </div>
      <div class="cell">
        <span>{tr(UI.deathSaves)}</span>
        <div class="ds"><small>{tr(L('Successes', 'Réussites', 'Éxitos'))}</small> ○ ○ ○</div>
        <div class="ds"><small>{tr(L('Failures', 'Échecs', 'Fallos'))}</small> ○ ○ ○</div>
      </div>
    </div>

    <div class="cols p1">
      <!-- left: numbers, abilities with saves and skills, training -->
      <div>
        <div class="minis">
          <div class="cell">
            <span>{tr(L('Prof. Bonus', 'Bonus de maîtrise', 'Bonif. competencia'))}</span><b>{sg(s.pb)}</b>
          </div>
          <div class="cell"><span>{tr(UI.initiative)}</span><b>{sg(s.initiative.total)}</b></div>
          <div class="cell"><span>{tr(UI.speed)}</span><b class="sm">{dist(s.speed.total)}</b></div>
          <div class="cell">
            <span>{tr(L('Size', 'Taille', 'Tamaño'))}</span><b class="sm">{tr(SIZE_NAMES[size]) || size}</b>
          </div>
          <div class="cell"><span>{tr(UI.passivePerception)}</span><b>{s.passivePerception}</b></div>
          <div class="cell insp">
            <span>{tr(UI.heroicInspiration)}</span><b>{c.heroicInspiration ? '■' : '□'}</b>
          </div>
        </div>
        {#if darkvision || s.otherSpeeds.length}
          <p class="line">
            {[
              darkvision
                ? `${tr(L('Darkvision', 'Vision dans le noir', 'Visión en la oscuridad'))} ${dist(darkvision)}`
                : '',
              ...s.otherSpeeds.map((o) => `${tr(SPEED_KIND[o.kind])} ${dist(o.ft)}`),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        {/if}

        <div class="abilities">
          {#each ABILITY_COLS as col, ci (ci)}
            <div>
              {#each col as a (a)}
                {@const ab = s.abilities[a]}
                <div class="ability">
                  <div class="ahead">
                    <div class="aname">{tr(ABILITY_NAMES[a])}</div>
                    <div class="amod">{sg(ab.mod)}</div>
                    <div class="ascore">{ab.score.total}</div>
                  </div>
                  <div class="srow save">
                    <span class="mk">{ab.saveProficient ? '●' : '○'}</span>
                    <span class="sn">{tr(L('Saving Throw', 'Jet de sauvegarde', 'Tirada de salvación'))}</span>
                    <b>{sg(ab.save.total)}</b>
                  </div>
                  {#each s.skills.filter((k) => k.ability === a) as k (k.id)}
                    <div class="srow">
                      <span class="mk">{MARK[k.proficiency]}</span>
                      <span class="sn">{tr(k.name)}</span>
                      <b>{sg(k.total.total)}</b>
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          {/each}
        </div>
        <p class="legend">
          ● {tr(UI.proficient)} · ◉ {tr(UI.expertise)} · ◐ {tr(UI.halfProficiency)}
        </p>

        <div class="tag">
          {tr(L('Equipment training and proficiencies', 'Formation et maîtrises', 'Entrenamiento y competencias'))}
        </div>
        <dl class="training">
          {#each training as t, i (i)}
            <dt>{tr(t.label)}</dt>
            <dd>{t.text || '—'}</dd>
          {/each}
        </dl>
      </div>

      <!-- right: attacks, features, traits, feats -->
      <div>
        <div class="tag">
          {tr(L('Weapons and damage cantrips', 'Armes et sorts mineurs de dégâts', 'Armas y trucos de daño'))}
        </div>
        <table class="grid attacks">
          <thead>
            <tr>
              <th class="l">{tr(L('Name', 'Nom', 'Nombre'))}</th>
              <th>{tr(L('Atk / DC', 'Att. / DD', 'Atq. / CD'))}</th>
              <th class="l">{tr(L('Damage and type', 'Dégâts et type', 'Daño y tipo'))}</th>
              <th class="l">{tr(UI.mastery)}</th>
              <th class="l">{tr(L('Notes', 'Notes', 'Notas'))}</th>
            </tr>
          </thead>
          <tbody>
            {#each attacks as a (a.uid)}
              <tr>
                <td class="l b">{tr(a.name)}</td>
                <td class="b">{sg(a.attack.total)}</td>
                <td class="l">{damageOf(a)}</td>
                <td class="l">{a.mastery.id ? `${tr(a.mastery.name)}${a.mastery.usable ? ' ✓' : ''}` : ''}</td>
                <td class="l small">{attackNotes(a)}</td>
              </tr>
            {/each}
            {#each cantripAttacks as x (x.name)}
              <tr>
                <td class="l b">{x.name}</td>
                <td class="b">{x.attack}</td>
                <td class="l">{x.damage}</td>
                <td class="l"></td>
                <td class="l small">{x.notes}</td>
              </tr>
            {/each}
            {#each [0, 1] as i (i)}<tr class="blank"><td></td><td></td><td></td><td></td><td></td></tr>{/each}
          </tbody>
        </table>
        <p class="legend">
          {s.attacksPerAction > 1 ? `${s.attacksPerAction} ${tr(UI.extraAttack)} · ` : ''}✓ {tr(
            L('mastery property usable', 'botte d’arme utilisable', 'propiedad de maestría utilizable'),
          )}
        </p>

        <div class="tag">{tr(UI.features)}</div>
        <ul class="names">
          {#each features as f, i (i)}<li>{f}</li>{:else}<li>—</li>{/each}
        </ul>
        <div class="tag">{tr(UI.traits)}{s.species ? ` — ${tr(s.species.name)}` : ''}</div>
        <ul class="names">
          {#each traits as t, i (i)}<li>{t}</li>{:else}<li>—</li>{/each}
        </ul>
        <div class="tag">{tr(UI.feats)}</div>
        <ul class="names">
          {#each feats as f, i (i)}<li>{f}</li>{:else}<li>—</li>{/each}
        </ul>
      </div>
    </div>
  </div>

  <!-- ============================== page 2: spells, equipment, details ============================== -->
  <div class="page">
    {#if s.spellcasting.length || extraRows.length}
      <div class="tag">{tr(L('Spellcasting', 'Incantation', 'Lanzamiento de conjuros'))}</div>
      {#each s.spellcasting as sc (sc.classId)}
        <div class="casting">
          <b>{tr(sc.className)}</b>
          <span>{tr(L('Ability', 'Caractéristique', 'Característica'))} <b>{tr(ABILITY_NAMES[sc.ability])}</b></span>
          <span>{tr(L('Modifier', 'Modificateur', 'Modificador'))} <b>{sg(sc.mod)}</b></span>
          <span>{tr(UI.spellSaveDc)} <b>{sc.dc.total}</b></span>
          <span
            >{tr(L('Spell attack bonus', 'Bonus d’attaque des sorts', 'Bonificador de ataque de conjuros'))}
            <b>{sg(sc.attack.total)}</b></span
          >
        </div>
      {/each}
      {#if s.slots.some((n) => n > 0) || s.pact}
        <div class="slots">
          {#each s.slots as n, i (i)}
            {#if n}<div class="slot"><span>{tr(L('Level', 'Niveau', 'Nivel'))} {i + 1}</span>{boxes(n)}</div>{/if}
          {/each}
          {#if s.pact}
            <div class="slot">
              <span>{tr(UI.pactSlots)} ({tr(L('level', 'niveau', 'nivel'))} {s.pact.level})</span>{boxes(s.pact.slots)}
            </div>
          {/if}
        </div>
      {/if}

      {#each s.spellcasting as sc (sc.classId)}
        {@const rows = spellRows(sc)}
        {#if rows.length}
          <div class="spells" class:two={rows.length > 16}>
            <div class="srowh">
              <span>{tr(L('Lvl', 'Niv.', 'Niv.'))}</span>
              <span class="l"
                >{tr(UI.cantrips)} / {tr(UI.prepared)}{s.spellcasting.length > 1 ? ` — ${tr(sc.className)}` : ''}</span
              >
              <span>{tr(L('Casting time', 'Temps d’incant.', 'Tiempo de lanz.'))}</span>
              <span>{tr(UI.range)}</span>
              <span>C R M</span>
            </div>
            {#each rows as r (r.sp.id)}
              <div class="spell">
                <span class="c">{r.sp.level || '—'}</span>
                <span class="l">{tr(r.sp.name)}{r.always ? ' ◆' : ''}</span>
                <span>{castingShort(r.sp)}</span>
                <span>{tr(r.sp.range)}</span>
                <span class="crm"
                  >{r.sp.concentration ? 'C' : '·'} {r.sp.ritual ? 'R' : '·'} {r.sp.components.m ? 'M' : '·'}</span
                >
              </div>
            {/each}
          </div>
        {/if}
        {#if sc.spellbook?.length}
          <p class="line">
            <b>{tr(UI.spellbook)}</b>
            {sc.spellbook
              .map((sid) => rules.spells.get(sid))
              .filter((sp): sp is SpellDef => !!sp)
              .sort((a, b) => a.level - b.level || tr(a.name).localeCompare(tr(b.name)))
              .map((sp) => `${tr(sp.name)} (${sp.level})`)
              .join(', ')}
          </p>
        {/if}
      {/each}
      {#each extraRows as x (x.name)}
        {#if x.spells.length}
          <p class="line">
            <b>{x.name}</b>{x.ability ? ` (${tr(ABILITY_SHORT[x.ability])})` : ''}
            {x.spells.map((sp) => `${tr(sp.name)}${sp.level ? ` (${sp.level})` : ''}`).join(', ')}
          </p>
        {/if}
      {/each}
      <p class="legend">
        ◆ {tr(L('always prepared', 'toujours préparé', 'siempre preparado'))} · C {tr(UI.concentration)} · R {tr(
          UI.ritual,
        )} · M {tr(L('Material component', 'composante matérielle', 'componente material'))}
      </p>
    {/if}

    {#if wildShapeForms.length}
      <div class="tag">{tr(UI.wildShape)} — {tr(UI.knownForms)}</div>
      <p class="line">{wildShapeForms.join(', ')}</p>
    {/if}

    <div class="cols three">
      {#each LOCATIONS as loc (loc.id)}
        {@const items = (c.inventory ?? []).filter((it) => it.location === loc.id)}
        <div>
          <div class="tag">{tr(loc.label)}</div>
          <table class="grid items">
            <tbody>
              {#each items as it (it.uid)}
                <tr>
                  <td class="l"
                    >{it.quantity > 1 ? `${it.quantity} × ` : ''}{tr(itemName(it))}{it.attuned ? ' ✦' : ''}</td
                  >
                  <td class="num">{loc.id === 'stored' ? '' : weightOf(it)}</td>
                </tr>
              {:else}
                <tr><td class="l">—</td><td></td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    </div>

    <div class="cols three">
      <div>
        <div class="tag">{tr(UI.attunement)}</div>
        <ol class="attune">
          {#each Array(attuneMax) as _, i (i)}<li>{attuned[i] ?? ''}</li>{/each}
        </ol>
      </div>
      <div>
        <div class="tag">{tr(UI.money)}</div>
        <div class="coins">
          {#each COINS as k (k)}<div class="cell">
              <span>{tr(COIN_LABEL[k])}</span><b class="sm">{c.money?.[k] ?? 0}</b>
            </div>{/each}
        </div>
        {#if c.valuables?.trim()}<p class="line">{c.valuables}</p>{/if}
      </div>
      <div>
        <div class="tag">{tr(UI.capacity)}</div>
        <p class="line">
          {tr(UI.load)} <b>{fmtWeight(s.carry.load, lang())}</b> / {fmtWeight(s.carry.capacity, lang())}<br />
          {tr(L('Drag, lift, push', 'Traîner, soulever, pousser', 'Arrastrar, levantar, empujar'))}
          {fmtWeight(s.carry.dragLiftPush, lang())}
        </p>
      </div>
    </div>

    {#if details.length || physical || id.background?.trim()}
      <div class="tag">{tr(L('Character details', 'Détails du personnage', 'Detalles del personaje'))}</div>
      <div class="details">
        {#if physical}<p><b>{tr(L('Appearance', 'Apparence', 'Apariencia'))}</b> {physical}</p>{/if}
        {#each details as d, i (i)}<p><b>{tr(d.label)}</b> {d.text}</p>{/each}
        {#if id.background?.trim()}<p class="story">
            <b>{tr(L('Story', 'Histoire', 'Historia'))}</b>
            {id.background}
          </p>{/if}
      </div>
    {/if}

    <div class="tag">{tr(L('Notes', 'Notes', 'Notas'))}</div>
    <div class="notes">
      <!-- Ruled lines: an SVG pattern pinned inside the box (backgrounds don't always print, extra elements add pages). -->
      <svg aria-hidden="true">
        <defs>
          <pattern id="ruled" width="8" height="21" patternUnits="userSpaceOnUse"
            ><line x1="0" y1="20.5" x2="8" y2="20.5" stroke="#aaa" stroke-width="0.7" /></pattern
          >
        </defs>
        <rect width="100%" height="100%" fill="url(#ruled)" />
      </svg>
    </div>
    <footer>{id.name} · {tr(UI.appTitle)} · {today}</footer>
  </div>
</div>

<style>
  /* Screen: never shown. Print: only this sheet, black on white, A4 pages. */
  .print-sheet {
    display: none;
  }
  @media print {
    /* No page margin: the sheet draws its own (the padding of .page), so it keeps them whatever the print dialog's
       "Margins" setting is. The rest of the app is hidden while printing. */
    @page {
      size: A4;
      margin: 0;
    }
    :global(html),
    :global(body) {
      background: #fff !important;
      color: #000 !important;
    }
    :global(#app > :not(.print-sheet)) {
      display: none !important;
    }
    .print-sheet {
      display: block;
      color: #000;
      background: #fff;
      font-family: var(--font-body);
      font-size: 8.5pt;
      line-height: 1.2;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
  /* One A4 page each, margins included as padding; the notes area fills what page 2 leaves. Slightly under 297 mm so
     rounding never spills onto an extra page. */
  .page {
    box-sizing: border-box;
    min-height: 296mm;
    padding: 13mm 13mm 11mm;
    display: flex;
    flex-direction: column;
  }
  .page + .page {
    break-before: page;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 10pt;
    border-bottom: 2.5pt solid #000;
    padding-bottom: 2pt;
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20pt;
    line-height: 1.1;
  }
  .sub {
    font-style: italic;
    font-size: 10pt;
  }
  /* Identity: write-in fields with a small caption under a rule, like the official sheet. */
  .ident {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 3pt 8pt;
    margin: 4pt 0 6pt;
  }
  .f {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    border-bottom: 0.75pt solid #000;
    font-weight: 600;
    min-height: 19pt;
  }
  .f span {
    font-size: 6pt;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .f.w2 {
    grid-column: span 2;
  }
  .f.w4 {
    grid-column: span 4;
  }
  /* Section tags: black, white small caps (the app's panel tags). */
  .tag {
    background: #000;
    color: #fff;
    font-family: var(--font-title);
    font-variant: small-caps;
    font-size: 9pt;
    letter-spacing: 0.05em;
    padding: 1pt 5pt;
    margin: 6pt 0 3pt;
    break-after: avoid;
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10pt;
  }
  .cols.p1 {
    grid-template-columns: 0.95fr 1.25fr;
  }
  .cols.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .cell {
    border: 0.75pt solid #000;
    padding: 1pt 4pt 2pt;
    display: flex;
    flex-direction: column;
    min-height: 24pt;
  }
  .cell > span {
    font-size: 6pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .cell b {
    font-size: 12pt;
  }
  .cell b.sm {
    font-size: 9.5pt;
  }
  .cell small {
    font-size: 6.5pt;
  }
  .band {
    display: grid;
    grid-template-columns: 0.7fr 1.5fr 1.2fr 1fr;
    gap: 4pt;
  }
  .band .cell {
    min-height: 40pt;
  }
  .shield {
    align-items: center;
    border-width: 1.5pt;
    border-radius: 0 0 40% 40% / 0 0 20% 20%;
  }
  .xl {
    font-size: 20pt !important;
    line-height: 1;
  }
  .hp3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    flex: 1;
  }
  .hp3 div {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    border-bottom: 0.75pt solid #000;
    margin: 0 3pt;
  }
  .hp3 b {
    font-size: 14pt;
    min-height: 16pt;
  }
  .hd,
  .ds {
    font-size: 9pt;
    letter-spacing: 0.08em;
  }
  .hd small,
  .ds small {
    letter-spacing: 0;
    display: inline-block;
    min-width: 34pt;
  }
  .minis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3pt;
    margin-top: 6pt;
  }
  .minis .cell {
    align-items: center;
    text-align: center;
    min-height: 22pt;
  }
  .abilities {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4pt;
    margin-top: 5pt;
  }
  .ability {
    border: 0.75pt solid #000;
    margin-bottom: 4pt;
    break-inside: avoid;
  }
  .ahead {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 4pt;
    background: #e6e6e6;
    border-bottom: 0.75pt solid #000;
    padding: 1pt 4pt;
  }
  .aname {
    font-family: var(--font-title);
    font-variant: small-caps;
    font-size: 9pt;
  }
  .amod {
    font-size: 12pt;
    font-weight: 700;
  }
  .ascore {
    border: 0.75pt solid #000;
    border-radius: 50%;
    min-width: 13pt;
    text-align: center;
    font-size: 7.5pt;
    background: #fff;
  }
  .srow {
    display: grid;
    grid-template-columns: 8pt 1fr auto;
    gap: 2pt;
    padding: 0.3pt 4pt;
    font-size: 7.8pt;
  }
  .srow.save {
    border-bottom: 0.5pt solid #000;
    font-weight: 600;
  }
  .mk {
    font-size: 7pt;
  }
  .line {
    margin: 2pt 0;
    font-size: 8pt;
  }
  .legend {
    margin: 1pt 0 2pt;
    font-size: 6.8pt;
  }
  .training {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1pt 5pt;
    margin: 0;
    font-size: 7.8pt;
  }
  .training dt {
    font-weight: 700;
  }
  .training dd {
    margin: 0;
    border-bottom: 0.5pt solid #bbb;
  }
  .grid {
    width: 100%;
    border-collapse: collapse;
  }
  .grid th,
  .grid td {
    border: 0.75pt solid #000;
    padding: 1pt 3pt;
    text-align: center;
    vertical-align: top;
  }
  .grid thead th {
    font-size: 6pt;
    font-weight: 400;
    text-transform: uppercase;
    border: none;
    padding-bottom: 0;
  }
  .grid .l {
    text-align: left;
  }
  .grid .b {
    font-weight: 700;
  }
  .grid .small {
    font-size: 6.8pt;
  }
  .attacks td {
    font-size: 7.8pt;
  }
  .attacks tr.blank td {
    height: 11pt;
  }
  .names {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 2;
    column-gap: 10pt;
    font-size: 8pt;
  }
  .names li {
    break-inside: avoid;
    border-bottom: 0.5pt solid #bbb;
    padding: 0.6pt 0;
  }
  /* Page 2: spellcasting. */
  .casting {
    display: flex;
    flex-wrap: wrap;
    gap: 2pt 12pt;
    align-items: baseline;
    border-bottom: 0.5pt solid #000;
    padding: 1pt 0;
  }
  .casting span {
    font-size: 7.5pt;
  }
  .slots {
    display: flex;
    flex-wrap: wrap;
    gap: 3pt 10pt;
    margin: 3pt 0;
    font-size: 10pt;
    letter-spacing: 0.06em;
  }
  .slot span {
    font-size: 6.5pt;
    letter-spacing: 0;
    text-transform: uppercase;
    margin-right: 3pt;
  }
  .spells {
    margin-top: 3pt;
    font-size: 7.6pt;
  }
  .spells.two {
    columns: 2;
    column-gap: 10pt;
  }
  .srowh,
  .spell {
    display: grid;
    grid-template-columns: 14pt 1fr 46pt 50pt 26pt;
    gap: 3pt;
    break-inside: avoid;
    padding: 0.5pt 0;
  }
  .srowh {
    font-size: 5.8pt;
    text-transform: uppercase;
    border-bottom: 0.75pt solid #000;
  }
  .spell {
    border-bottom: 0.5pt solid #bbb;
  }
  .spell span,
  .srowh span {
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .spell .l,
  .srowh .l {
    text-align: left;
  }
  .crm {
    font-family: monospace;
    font-size: 7pt;
  }
  /* Equipment and the boxes under it. */
  .items td {
    border-left: none;
    border-right: none;
    font-size: 7.8pt;
  }
  .num {
    text-align: right !important;
    white-space: nowrap;
    width: 1%;
  }
  .attune {
    margin: 0;
    padding-left: 12pt;
  }
  .attune li {
    border-bottom: 0.75pt solid #000;
    min-height: 12pt;
    font-size: 8pt;
  }
  .coins {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 2pt;
  }
  .coins .cell {
    align-items: center;
    min-height: 22pt;
    padding: 1pt;
  }
  .details {
    font-size: 7.8pt;
  }
  .details p {
    margin: 1pt 0;
  }
  .details .story {
    white-space: pre-line;
    display: -webkit-box;
    -webkit-line-clamp: 12;
    line-clamp: 12;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .notes {
    flex: 1 1 0px; /* fills what's left of the page, never more (the ruled lines are clipped) */
    border: 0.75pt solid #000;
    min-height: 80pt;
    position: relative;
    overflow: hidden;
  }
  .notes svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  footer {
    margin-top: 4pt;
    font-size: 7pt;
    text-align: right;
  }
</style>
