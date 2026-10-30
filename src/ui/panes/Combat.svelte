<script lang="ts">
  // Combat pane, laid out like the 3.5 playboard: "Your turn" first (ui/TurnBox.svelte, with the turn bar inside), then "At a glance" (hit points on the left, then a 2 × 2 grid: defense and
  // offense on top, saving throws and movement below, values on a shared 4-column grid), the attacks
  // (weapons and Shield in hand on top, ui/HandsSelector.svelte), the resources full width (one row each with a
  // one-line description), the situational switches, then one full-width block with the active effects, conditions,
  // Exhaustion, resistances and immunities (2026-10-29); spell items last. Summoned creatures are in the Companions pane.
  import { rules } from '../../data/rules'
  import type { I18n } from '../../data/types'
  import { UI } from '../../i18n/ui'
  import { endConcentration, INCAPACITATING } from '../../engine/casting'
  import { twoHandedGrip } from '../../engine/hands'
  import { fmt, rollState } from '../../engine/stacking'
  import type { ActiveEffect } from '../../model/character'
  import { app, lang, tr, view } from '../../state.svelte'
  import { fmtFeet, fmtWeight, isMetric } from '../format'
  import { newUid } from '../items'
  import HandsSelector from '../HandsSelector.svelte'
  import HitPoints from '../HitPoints.svelte'
  import RuleText from '../RuleText.svelte'
  import StatValue from '../StatValue.svelte'
  import SpellItemsBlock from '../SpellItemsBlock.svelte'
  import ItemEffectRows from '../ItemEffectRows.svelte'
  import { byEnglishName } from '../order'
  import { effectName } from '../TurnBar.svelte'
  import TurnBox from '../TurnBox.svelte'
  import WarningList from '../WarningList.svelte'
  import WeaponMasteryPicker from '../WeaponMasteryPicker.svelte'
  import { openPopup } from '../popupState.svelte'
  import { summaryOf } from '../summary'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const resistances = $derived(
    sheet.pool.grants.filter((g) => g.grant.kind === 'resistance' || g.grant.kind === 'immunity'),
  )
  const toggles = $derived(sheet.pool.toggles)
  const against = $derived({
    adv: sheet.pool.advantage('attacks-against'),
    dis: sheet.pool.disadvantage('attacks-against'),
  })
  const rollMark = (s: ReturnType<typeof rollState>) => (s === 'advantage' ? ' ▲' : s === 'disadvantage' ? ' ▼' : '')
  const SPEED_KIND: Record<string, I18n> = {
    climb: { en: 'Climb', fr: 'Escalade', es: 'Trepar' },
    swim: { en: 'Swim', fr: 'Nage', es: 'Nadar' },
    fly: { en: 'Fly', fr: 'Vol', es: 'Volar' },
  }
  const speedText = (ft: number) => (isMetric(lang()) ? fmtFeet(ft, lang()) : `${ft} ft`)
  const conditionList = [...rules.conditions.values()].sort(byEnglishName)

  // ---- resources: one row each, with a one-line description (custom/summaries.json, else the first SRD sentence)
  const ownerOf = (id: string) => sheet.owners.find((o) => o.id === id)
  // Owner ids already hold colons ('cleric:channel-divinity'), so every summary prefix is tried; the first SRD sentence
  // is only the last resort.
  function lineOf(id: string): I18n {
    const keys = ['resource', 'feature', 'trait', 'feat', 'invocation', 'metamagic'].map((k) => `${k}:${id}`)
    for (const k of keys) {
      const s = rules.summaries.get(k)
      if (s) return s
    }
    return summaryOf(keys[1], ownerOf(id)?.text)
  }
  /** A feature value's label cut to its name ("Divine Spark: d8s + …" → "Divine Spark"; "Careful Spell: creatures
   * protected (…)" → "creatures protected" under Careful Spell); empty when that is still a sentence. The full label is
   * the tooltip and the popup title. */
  function shortLabel(v: (typeof sheet.featureValues)[number]): string {
    const parts = tr(v.label)
      .split(/\s*\(/)[0]
      .split(/\s*:\s*/)
    const short = (parts[0].toLowerCase() === tr(v.owner).toLowerCase() ? (parts[1] ?? '') : parts[0]).trim()
    return short.length > 40 ? '' : short
  }
  const rechargeOf = (r: (typeof sheet.resources)[number]): I18n => {
    const base = r.per === 'short' ? UI.shortRest : UI.longRest
    if (!r.shortRestRegain || r.per === 'short') return base
    return {
      en: `${base.en} · ${r.shortRestRegain} on a ${UI.shortRest.en}`,
      fr: `${base.fr} · ${r.shortRestRegain} au ${UI.shortRest.fr.toLowerCase()}`,
      es: `${base.es ?? base.en} · ${r.shortRestRegain} en un ${(UI.shortRest.es ?? UI.shortRest.en).toLowerCase()}`,
    }
  }

  let conditionMessage = $state('')
  function toggleCondition(id: string) {
    const i = c.conditions.indexOf(id)
    conditionMessage = ''
    if (i >= 0) c.conditions.splice(i, 1)
    else {
      c.conditions.push(id)
      // Incapacitated (or a condition that includes it) ends Concentration (Rules Glossary "Concentration" p. 179).
      if (INCAPACITATING.includes(id) && c.concentration) {
        const e = endConcentration(c)
        if (e)
          conditionMessage =
            tr({ en: 'Concentration ended: ', fr: 'Concentration terminée : ', es: 'Concentración terminada: ' }) +
            tr(effectName(e))
      }
    }
  }

  // ---- active effects (spells, features, items, custom): toggled, timed in rounds, one under Concentration
  const TARGETS: { id: string; label: I18n }[] = [
    { id: 'attack.all', label: { en: 'Attack rolls', fr: 'Jets d’attaque', es: 'Tiradas de ataque' } },
    { id: 'damage.all', label: { en: 'Damage', fr: 'Dégâts', es: 'Daño' } },
    { id: 'ac', label: { en: 'AC', fr: 'CA', es: 'CA' } },
    {
      id: 'save.all',
      label: { en: 'All saving throws', fr: 'Tous les jets de sauvegarde', es: 'Todas las tiradas de salvación' },
    },
    {
      id: 'check.all',
      label: {
        en: 'All ability checks',
        fr: 'Tous les tests de caractéristique',
        es: 'Todas las pruebas de característica',
      },
    },
    { id: 'd20', label: { en: 'All D20 Tests', fr: 'Tous les tests d20', es: 'Todas las pruebas con d20' } },
    { id: 'initiative', label: { en: 'Initiative', fr: 'Initiative', es: 'Iniciativa' } },
    { id: 'speed', label: { en: 'Speed (ft)', fr: 'Vitesse (pieds)', es: 'Velocidad (pies)' } },
    { id: 'hp.max', label: { en: 'Hit Point maximum', fr: 'Maximum de points de vie', es: 'Puntos de golpe máximos' } },
    {
      id: 'spell.dc',
      label: { en: 'Spell save DC', fr: 'DD de sauvegarde des sorts', es: 'CD de salvación de conjuros' },
    },
    ...(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => ({
      id: `ability.${a}`,
      label: {
        en: `${a.toUpperCase()} score`,
        fr: `Valeur de ${a.toUpperCase()}`,
        es: `Puntuación de ${a.toUpperCase()}`,
      },
    })),
  ]
  const targetLabel = (id: string) => tr(TARGETS.find((t) => t.id === id)?.label) || id
  let custom = $state({ name: '', target: 'attack.all', value: 1, rounds: '', concentration: false })
  function addCustom() {
    const name = custom.name.trim()
    if (!name) return
    const rounds = Math.floor(Number(custom.rounds))
    const e: ActiveEffect = {
      uid: newUid(),
      kind: 'custom',
      name: { en: name, fr: name, es: name },
      enabled: true,
      concentration: custom.concentration,
      modifiers: custom.value ? [{ target: custom.target, value: Number(custom.value) }] : [],
    }
    if (rounds > 0) e.rounds = rounds
    c.activeEffects.push(e)
    if (custom.concentration) concentrateOn(e)
    custom = { name: '', target: 'attack.all', value: 1, rounds: '', concentration: false }
  }
  /** Set or clear an effect's remaining rounds (blank = no set duration). */
  function setRounds(e: ActiveEffect, v: string) {
    const n = Math.floor(Number(v))
    if (v === '' || !(n > 0)) delete e.rounds
    else e.rounds = n
  }
  /** Concentrate on this effect: the one concentrated on before ends (Rules Glossary "Concentration", p. 180). */
  function concentrateOn(e: ActiveEffect) {
    if (c.concentration === e.uid) {
      c.concentration = undefined
      return
    }
    const prev = c.activeEffects.find((x) => x.uid === c.concentration)
    if (prev && prev.uid !== e.uid && prev.concentration)
      c.activeEffects = c.activeEffects.filter((x) => x.uid !== prev.uid)
    c.concentration = e.uid
  }
  function removeEffect(uid: string) {
    c.activeEffects = c.activeEffects.filter((e) => e.uid !== uid)
    if (c.concentration === uid) c.concentration = undefined
  }
  function effectPopup(e: ActiveEffect) {
    const spell = e.refId ? rules.spells.get(e.refId) : undefined
    const cond = e.refId ? rules.conditions.get(e.refId) : undefined
    const def = spell ?? cond
    openPopup({
      title: effectName(e),
      html: def?.text,
      source: def?.source,
      summary: spell ? spell.duration : undefined,
      lines: (e.modifiers ?? []).map((m) => ({
        en: `${fmt(m.value)} ${targetLabel(m.target)}`,
        fr: `${fmt(m.value)} ${targetLabel(m.target)}`,
        es: `${fmt(m.value)} ${targetLabel(m.target)}`,
      })),
      noteKey: `effect:${e.refId ?? e.uid}`,
    })
  }
</script>

<!-- What a turn holds and what this character can do with it (ui/TurnBox.svelte). -->
<TurnBox />

<!-- Quick reference: hit points, then the combat numbers in a 2 × 2 grid: defense and offense, saves and movement. -->
<section class="box summary">
  <h3>{tr({ en: 'At a glance', fr: 'En un coup d’œil', es: 'De un vistazo' })}</h3>
  <div class="glance">
    <HitPoints compact />
    <div class="groups">
      <div class="group">
        <h4>{tr({ en: 'Defense', fr: 'Défense', es: 'Defensa' })}</h4>
        <div class="cells">
          <div class="cell">
            <span>{tr(UI.acShort)}</span><StatValue stat={() => view.sheet.ac} title={UI.ac} signed={false} />
          </div>
          <div class="cell">
            <span>{tr(UI.passivePerception)}</span><strong class="plain">{sheet.passivePerception}</strong>
          </div>
          <div class="cell">
            <span>{tr(UI.pb)}</span><strong class="plain">+{sheet.pb}</strong>
          </div>
          <div class="cell">
            <span>{tr(UI.exhaustion)}</span><strong class="plain" class:bad={c.exhaustion > 0}>{c.exhaustion}</strong>
          </div>
        </div>
        {#if sheet.acOptions.length > 1}
          <p class="why opts">
            {tr(UI.ac)} :
            {#each sheet.acOptions as o (o.id)}
              <button
                class="opt"
                class:on={sheet.ac.parts[0]?.sourceId === `ac:${o.id}`}
                disabled={!o.available}
                title={o.reason ? tr(o.reason) : ''}
                onclick={() => (c.acChoice = o.id)}>{tr(o.label)} {o.stat.total}</button
              >
            {/each}
          </p>
        {/if}
        {#if against.adv.length || against.dis.length}
          <p class="why">
            {tr({
              en: 'Attack rolls against you',
              fr: 'Jets d’attaque contre vous',
              es: 'Tiradas de ataque contra ti',
            })} :
            {#each against.adv as a, i (i)}<span class="mark">▲ {tr(a)}</span>{/each}
            {#each against.dis as d, i (i)}<span class="mark">▼ {tr(d)}</span>{/each}
          </p>
        {/if}
      </div>
      <div class="group">
        <h4>{tr({ en: 'Offense', fr: 'Attaque', es: 'Ataque' })}</h4>
        <div class="cells">
          <div class="cell">
            <span>{tr(UI.initiative)}{rollMark(rollState(sheet.initiative))}</span><StatValue
              stat={() => view.sheet.initiative}
              title={UI.initiative}
            />
          </div>
          <div class="cell">
            <span>{tr({ en: 'Attacks / action', fr: 'Attaques / action', es: 'Ataques / acción' })}</span><strong
              class="plain">{sheet.attacksPerAction}</strong
            >
          </div>
          {#each sheet.spellcasting as sc, i (sc.classId)}
            <div class="cell">
              <span>{tr(UI.spellSaveDc)}{sheet.spellcasting.length > 1 ? ` (${tr(sc.className)})` : ''}</span><StatValue
                stat={() => view.sheet.spellcasting[i].dc}
                title={{
                  en: `${UI.spellSaveDc.en} (${sc.className.en})`,
                  fr: `${UI.spellSaveDc.fr} (${sc.className.fr})`,
                  es: `${UI.spellSaveDc.es ?? UI.spellSaveDc.en} (${sc.className.es ?? sc.className.en})`,
                }}
                signed={false}
              />
            </div>
            <div class="cell">
              <span>{tr(UI.spellAttack)}</span><StatValue
                stat={() => view.sheet.spellcasting[i].attack}
                title={{
                  en: `${UI.spellAttack.en} (${sc.className.en})`,
                  fr: `${UI.spellAttack.fr} (${sc.className.fr})`,
                  es: `${UI.spellAttack.es ?? UI.spellAttack.en} (${sc.className.es ?? sc.className.en})`,
                }}
              />
            </div>
          {/each}
        </div>
      </div>
      <div class="group">
        <h4>{tr(UI.saves)}</h4>
        <div class="cells six">
          {#each Object.values(sheet.abilities) as ab (ab.id)}
            <div class="cell">
              <span>{ab.id.toUpperCase()}{ab.saveProficient ? ' ●' : ''}{rollMark(rollState(ab.save))}</span><StatValue
                stat={() => view.sheet.abilities[ab.id].save}
                title={{
                  en: `${ab.id.toUpperCase()} saving throw`,
                  fr: `Jet de sauvegarde ${ab.id.toUpperCase()}`,
                  es: `Tirada de salvación de ${ab.id.toUpperCase()}`,
                }}
              />
            </div>
          {/each}
        </div>
        <p class="why">
          ● {tr({ en: 'proficient', fr: 'maîtrisé', es: 'con competencia' })} · ▲ {tr(UI.advantage)} · ▼ {tr(
            UI.disadvantage,
          )}
        </p>
      </div>
      <div class="group">
        <h4>{tr({ en: 'Movement and load', fr: 'Déplacement et charge', es: 'Movimiento y carga' })}</h4>
        <div class="cells">
          <div class="cell">
            <span>{tr(UI.speed)}</span><StatValue
              stat={() => view.sheet.speed}
              title={UI.speed}
              signed={false}
              suffix={isMetric(lang()) ? ` (${fmtFeet(sheet.speed.total, lang())})` : ' ft'}
            />
          </div>
          {#each sheet.otherSpeeds as s (s.kind)}
            <div class="cell" title={s.from.map((f) => tr(f)).join(', ')}>
              <span>{tr(SPEED_KIND[s.kind])}</span><strong class="plain">{speedText(s.ft)}</strong>
            </div>
          {/each}
          <div class="cell">
            <span>{tr(UI.load)}</span><strong class="plain" class:bad={sheet.carry.encumbered}
              >{fmtWeight(sheet.carry.load, lang())}</strong
            >
          </div>
        </div>
        <p class="why">
          {tr(UI.capacity)} : {fmtWeight(sheet.carry.capacity, lang())}{sheet.carry.encumbered
            ? ` · ${tr({ en: 'over capacity', fr: 'au-delà de la capacité', es: 'por encima de la capacidad' })}`
            : ''}
        </p>
      </div>
    </div>
  </div>
</section>

<div class="grid">
  <!-- In play first: the attacks; then resources and switches, effects, conditions; resistances last. -->
  <section class="box wide">
    <h3>{tr(UI.attacks)} <span class="meta">{sheet.attacksPerAction} {tr(UI.extraAttack)}</span></h3>
    <HandsSelector />
    <table>
      <thead
        ><tr
          ><th>{tr({ en: 'Weapon', fr: 'Arme', es: 'Arma' })}</th><th class="num">{tr(UI.attack)}</th><th
            >{tr(UI.damage)}</th
          ><th>{tr(UI.properties)}</th><th>{tr(UI.mastery)}</th></tr
        ></thead
      >
      <tbody>
        {#each [...sheet.attacks, ...(sheet.unarmed ? [sheet.unarmed] : [])] as a (a.uid)}
          <tr>
            <td>
              <strong class="wname">{tr(a.name)}{rollMark(rollState(a.attack))}</strong>
              {#if a.critRange < 20}<span class="meta"
                  >· {tr({
                    en: `crit ${a.critRange}–20`,
                    fr: `critique ${a.critRange}–20`,
                    es: `crítico ${a.critRange}–20`,
                  })}</span
                >{/if}
              {#each a.notes as n, i (i)}<span class="meta">· {tr(n)}</span>{/each}
            </td>
            <td class="num"
              ><StatValue
                stat={() => a.attack}
                title={{
                  en: `${a.name.en}: attack roll`,
                  fr: `${a.name.fr} : jet d’attaque`,
                  es: `${a.name.es ?? a.name.en}: tirada de ataque`,
                }}
              /></td
            >
            <td
              ><span class="dice"
                >{a.damage.versatile && twoHandedGrip(c, a.uid)
                  ? a.damage.versatile
                  : `${a.damage.dice}${a.damage.versatile ? ` (${a.damage.versatile})` : ''}`}</span
              >
              <StatValue
                stat={() => a.damage.bonus}
                title={{
                  en: `${a.name.en}: damage`,
                  fr: `${a.name.fr} : dégâts`,
                  es: `${a.name.es ?? a.name.en}: daño`,
                }}
              />
              {tr(a.damage.type)}
              {#if a.range}<span class="meta">{tr(a.range.normal)} / {tr(a.range.long)}</span>{/if}
              {#each a.extraDamage as x, i (i)}<span class="meta extra" title={x.condition ? tr(x.condition) : ''}
                  >+ {x.dice} {tr(x.label)}{x.condition ? ' *' : ''}</span
                >{/each}</td
            >
            <td class="props">{a.properties.map((p) => tr(p)).join(', ')}</td>
            <td>
              {#if a.mastery.id}
                {@const def = rules.weaponProperties.get(a.mastery.id)}
                <button
                  class="opt"
                  class:on={a.mastery.usable}
                  onclick={() => openPopup({ title: a.mastery.name, html: def?.text, source: def?.source })}
                  >{tr(a.mastery.name)}{a.mastery.usable ? ' ✓' : ''}</button
                >
              {/if}
            </td>
          </tr>
        {:else}
          <tr
            ><td colspan="5" class="none"
              >{tr({
                en: 'No weapon in hand: tick one above.',
                fr: 'Aucune arme en main : cochez-en une ci-dessus.',
                es: 'Ningún arma en la mano: marca una arriba.',
              })}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
    {#if [...sheet.attacks, ...(sheet.unarmed ? [sheet.unarmed] : [])].some( (a) => a.extraDamage.some((x) => x.condition) )}
      <p class="hint">
        * {tr({
          en: 'situational: hover or tap the line for the condition',
          fr: 'situationnel : survolez la ligne pour la condition',
          es: 'situacional: pasa el cursor o toca la línea para ver la condición',
        })}
      </p>
    {/if}
    <WeaponMasteryPicker />
    <WarningList areas={['combat']} />
  </section>

  <section class="box wide">
    <h3>{tr(UI.resources)}</h3>
    <ul class="res">
      {#each sheet.resources as r (r.id)}
        <li>
          <span class="rname"
            ><RuleText name={r.name} text={ownerOf(r.id)?.text} source={r.source} noteKey="resource:{r.id}" /></span
          >
          <span class="uses">
            {#each Array(r.max) as _, i (i)}
              <button
                class="pip"
                class:spent={i < r.spent}
                onclick={() => (c.resources[r.id] = i < r.spent ? i : i + 1)}
                aria-label={`${i + 1}`}
              ></button>
            {/each}
            <span class="count">{r.max - r.spent} / {r.max}</span>
          </span>
          <span class="recharge">{tr(rechargeOf(r))}</span>
          <span class="desc">{tr(lineOf(r.id))}</span>
        </li>
      {:else}
        <li class="none">{tr({ en: 'None', fr: 'Aucune', es: 'Ninguna' })}</li>
      {/each}
    </ul>
    {#if sheet.featureValues.length}
      <h4>{tr({ en: 'Feature values', fr: 'Valeurs des aptitudes', es: 'Valores de los rasgos' })}</h4>
      <ul class="res">
        {#each sheet.featureValues as v (`${v.ownerId}|${v.id}`)}
          <li>
            <span class="rname"
              ><RuleText
                name={v.owner}
                text={ownerOf(v.ownerId)?.text}
                source={v.source}
                noteKey="feature:{v.ownerId}"
              /></span
            >
            <span class="uses" title={tr(v.label)}>
              {#if shortLabel(v)}<span class="meta first">{shortLabel(v)} :</span>{/if}
              {#if v.dice}<span class="num">{v.dice}{v.stat.total ? ' + ' : ''}</span>{/if}
              {#if v.stat.total || !v.dice}<StatValue stat={() => v.stat} title={v.label} signed={false} />{/if}
            </span>
            <span class="recharge"></span>
            <span class="desc">{tr(lineOf(v.ownerId))}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Situational switches (Rage, conditional bonuses), when the character has any. -->
  {#if toggles.length}
    <section class="box wide">
      <h3>{tr({ en: 'Situational switches', fr: 'Situations', es: 'Situaciones' })}</h3>
      <div class="chips">
        {#each toggles as t (t.key)}
          <label class="chip" class:on={!!c.toggles[t.key]}
            ><input
              type="checkbox"
              checked={!!c.toggles[t.key]}
              onchange={(e) => (c.toggles[t.key] = e.currentTarget.checked)}
            />{tr(t.label)}</label
          >
        {/each}
      </div>
    </section>
  {/if}

  <!-- What is affecting the character now, in one full-width block (user request 2026-10-29): active effects on the
       left; conditions, Exhaustion, resistances and immunities on the right. -->
  <section class="box wide state">
    <h3>
      {tr({
        en: 'Effects, conditions and resistances',
        fr: 'Effets, états et résistances',
        es: 'Efectos, estados y resistencias',
      })}
    </h3>
    <div class="state-grid">
      <div class="sub">
        <h4>{tr(UI.effects)}</h4>
        <ul class="effects">
          {#each c.activeEffects as e (e.uid)}
            <li class:off={!e.enabled}>
              <input type="checkbox" bind:checked={e.enabled} aria-label={tr(effectName(e))} />
              <button class="link" onclick={() => effectPopup(e)}>{tr(effectName(e))}</button>
              {#if e.modifiers?.length}<small
                  >{e.modifiers.map((m) => `${fmt(m.value)} ${targetLabel(m.target)}`).join(', ')}</small
                >{/if}
              {#if e.tempHp}<small>{e.tempHp} {tr({ en: 'temp HP', fr: 'PV temp.', es: 'PG temp.' })}</small>{/if}
              <button
                class="conc"
                class:on={c.concentration === e.uid}
                title={tr(UI.concentration)}
                aria-pressed={c.concentration === e.uid}
                onclick={() => concentrateOn(e)}>◎</button
              >
              <span
                class="rounds"
                title={tr({
                  en: 'Rounds left (blank = no set duration)',
                  fr: 'Rounds restants (vide = pas de durée fixée)',
                  es: 'Asaltos restantes (vacío = sin duración fija)',
                })}
              >
                {#if e.rounds !== undefined}<button aria-label="−1" onclick={() => setRounds(e, String(e.rounds! - 1))}
                    >−</button
                  >{/if}
                <input
                  type="number"
                  min="1"
                  inputmode="numeric"
                  placeholder="∞"
                  value={e.rounds ?? ''}
                  onchange={(ev) => setRounds(e, ev.currentTarget.value)}
                  aria-label={tr({ en: 'Rounds left', fr: 'Rounds restants', es: 'Asaltos restantes' })}
                />
                <small>{tr({ en: 'rd', fr: 'rd', es: 'as.' })}</small>
              </span>
              <button
                class="del"
                onclick={() => removeEffect(e.uid)}
                aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
              >
            </li>
          {:else}
            <li class="none">{tr({ en: 'None', fr: 'Aucun', es: 'Ninguno' })}</li>
          {/each}
        </ul>
        <!-- Active magic item effects, read-only (ui/ItemEffectRows.svelte). -->
        <ItemEffectRows />
        <details>
          <summary
            >{tr({
              en: 'Custom effect (spell, bonus, penalty…)',
              fr: 'Effet personnalisé (sort, bonus, malus…)',
              es: 'Efecto personalizado (conjuro, bonificador, penalizador…)',
            })}</summary
          >
          <div class="custom">
            <input placeholder={tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })} bind:value={custom.name} />
            <input
              type="number"
              bind:value={custom.value}
              aria-label={tr({ en: 'Value', fr: 'Valeur', es: 'Valor' })}
            />
            <select
              bind:value={custom.target}
              aria-label={tr({ en: 'Applies to', fr: 'S’applique à', es: 'Se aplica a' })}
            >
              {#each TARGETS as tg (tg.id)}<option value={tg.id}>{tr(tg.label)}</option>{/each}
            </select>
            <input
              type="number"
              min="1"
              inputmode="numeric"
              placeholder="∞"
              bind:value={custom.rounds}
              aria-label={tr({ en: 'Rounds', fr: 'Rounds', es: 'Asaltos' })}
            />
            <small>{tr({ en: 'rd', fr: 'rd', es: 'as.' })}</small>
            <label class="chk"
              ><input type="checkbox" bind:checked={custom.concentration} />{tr(UI.concentration)}</label
            >
            <button onclick={addCustom} disabled={!custom.name.trim()}>＋</button>
          </div>
          <p class="hint">
            {tr({
              en: 'Effects with the same name don’t combine: the best one applies. Effects timed in rounds count down in the turn bar.',
              fr: 'Les effets de même nom ne se cumulent pas : le meilleur s’applique. Les effets chronométrés en rounds décomptent dans la barre de tour.',
              es: 'Los efectos con el mismo nombre no se combinan: se aplica el mejor. Los efectos con duración en asaltos descuentan en la barra de turno.',
            })}
          </p>
        </details>
      </div>
      <div class="sub">
        <h4>{tr(UI.conditions)}</h4>
        <div class="chips">
          {#each conditionList as cond (cond.id)}
            <label class="chip" class:on={c.conditions.includes(cond.id)}>
              <input
                type="checkbox"
                checked={c.conditions.includes(cond.id)}
                onchange={() => toggleCondition(cond.id)}
              />
              <RuleText name={cond.name} text={cond.text} source={cond.source} noteKey="condition:{cond.id}" />
            </label>
          {/each}
        </div>
        {#if conditionMessage}<p class="hint" role="status">{conditionMessage}</p>{/if}
        <p class="exh">
          {tr(UI.exhaustion)} :
          <button onclick={() => (c.exhaustion = Math.max(0, c.exhaustion - 1))} aria-label="−1">−</button>
          <strong>{c.exhaustion}</strong>
          <button onclick={() => (c.exhaustion = Math.min(6, c.exhaustion + 1))} aria-label="+1">+</button>
          {#if c.exhaustion}<span class="meta"
              >{fmt(sheet.exhaustionPenalty)}
              {tr({ en: 'on D20 Tests', fr: 'aux tests d20', es: 'en las pruebas con d20' })}, {fmt(-5 * c.exhaustion)} ft
              {tr(UI.speed)}{c.exhaustion >= 6
                ? ` · ${tr({ en: 'level 6: dead', fr: 'niveau 6 : mort', es: 'nivel 6: muerto' })}`
                : ''}</span
            >{/if}
        </p>
        <h4>
          {tr({ en: 'Resistances and immunities', fr: 'Résistances et immunités', es: 'Resistencias e inmunidades' })}
        </h4>
        {#if resistances.length}
          <ul class="list">
            {#each resistances as r, i (i)}
              <li>
                <span
                  >{r.grant.kind === 'immunity'
                    ? tr({ en: 'Immunity', fr: 'Immunité', es: 'Inmunidad' })
                    : tr({ en: 'Resistance', fr: 'Résistance', es: 'Resistencia' })} :
                  <strong
                    >{tr(rules.damageTypeNames[r.grant.on as keyof typeof rules.damageTypeNames]) ||
                      tr(rules.conditions.get(r.grant.on ?? '')?.name) ||
                      r.grant.on}</strong
                  ></span
                >
                <span class="meta">{tr(r.owner.name)}{r.grant.condition ? ` (${tr(r.grant.condition)})` : ''}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="hint">{tr({ en: 'None', fr: 'Aucune', es: 'Ninguna' })}</p>
        {/if}
      </div>
    </div>
  </section>

  <!-- Wands, staffs, scrolls, potions and other items that cast spells or have charges (engine/spellItems.ts). -->
  <SpellItemsBlock />
</div>

<style>
  .summary {
    margin-bottom: 1.25rem;
  }
  /* Hit points on the left, the four groups in a 2 × 2 grid; stacked on a phone. */
  .glance {
    display: grid;
    grid-template-columns: minmax(16rem, auto) 1fr;
    gap: 1rem 1.5rem;
    align-items: start;
  }
  /* Two columns of groups (defense | offense, saves | movement); the cells sit on a shared 4-column grid so the values
     line up from one row to the next. */
  .groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.5rem;
    align-content: start;
  }
  .group h4 {
    margin: 0 0 0.4rem;
    font-family: var(--font-title);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: var(--accent);
    border-bottom: 1px solid var(--rule);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem 0.5rem;
    align-items: start;
  }
  .cells.six {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  @media (max-width: 64rem) {
    .groups {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 40rem) {
    .glance {
      grid-template-columns: 1fr;
    }
    .cells.six {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
  }
  /* Labels may wrap on two lines; a fixed height keeps the values aligned. */
  .cell > span {
    font-family: var(--font-title);
    font-size: 0.8rem;
    line-height: 1.1;
    min-height: 2.2em;
    display: flex;
    align-items: flex-end;
    text-align: center;
    color: var(--ink-soft);
  }
  /* Values without a breakdown popup, boxed like the others. */
  .cell .plain {
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums lining-nums;
    min-height: 2.75rem;
    min-width: 2.75rem;
    padding: 0 0.4rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--rule);
    border-radius: 4px;
    text-align: center;
  }
  .cell .plain.bad {
    color: var(--danger);
    border-color: var(--danger);
  }
  .why {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-soft);
  }
  .why.opts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
  .mark {
    margin-left: 0.5em;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    grid-auto-flow: row dense;
    gap: 1.25rem;
    align-items: start;
  }
  .wide {
    grid-column: 1 / -1;
  }
  /* Effects | conditions and resistances, side by side (stacked on a phone). */
  .state-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem 2rem;
    align-items: start;
  }
  .sub h4 {
    margin: 0 0 0.4rem;
    font-family: var(--font-title);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: var(--accent);
    border-bottom: 1px solid var(--rule);
  }
  .sub h4:not(:first-child) {
    margin-top: 1rem;
  }
  @media (max-width: 52rem) {
    .state-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* Resources: name | uses | recharge | one-line description; on a phone the description goes under. */
  .res {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .res li {
    display: grid;
    grid-template-columns: minmax(9rem, 14rem) minmax(8rem, auto) minmax(6rem, 10rem) minmax(0, 1fr);
    align-items: center;
    gap: 0.3rem 1rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .res li.none {
    display: block;
  }
  .rname {
    font-weight: 700;
  }
  .count {
    font-family: var(--font-num);
    font-weight: 700;
    margin-left: 0.3em;
  }
  .recharge {
    font-family: var(--font-title);
    font-size: 0.85em;
    color: var(--ink-soft);
  }
  .desc {
    font-size: 0.9em;
    color: var(--ink-soft);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta.first {
    margin-left: 0;
  }
  @media (max-width: 48rem) {
    .res li {
      grid-template-columns: 1fr auto;
    }
    .recharge {
      text-align: right;
    }
    .desc {
      grid-column: 1 / -1;
      white-space: normal;
    }
  }
  button {
    min-height: 2.75rem;
    padding: 0 0.8rem;
    font: inherit;
  }
  button:hover:not(:disabled) {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .num {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .wname {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .dice {
    font-family: var(--font-num);
    font-weight: 700;
  }
  h4 {
    font-family: var(--font-title);
    font-weight: 400;
    margin: 0.9rem 0 0.4rem;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
    font-family: var(--font-title);
    margin-left: 0.4em;
  }
  .props {
    font-size: 0.9em;
  }
  .extra {
    display: block;
    margin-left: 0;
  }
  .none {
    font-style: italic;
    color: var(--ink-soft);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .uses {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .pip {
    width: 1.3rem;
    min-width: 1.3rem;
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
    padding: 0.1em 0.7em;
    min-height: 2.4rem;
  }
  .chip.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .opt {
    min-height: 2.2rem;
    padding: 0 0.6rem;
    font-size: 0.9em;
  }
  .opt.on {
    border-color: var(--frame);
    background: var(--paper-2);
  }
  .exh {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0.75rem 0 0;
  }
  .exh button {
    min-width: 2.75rem;
    padding: 0;
  }
  .exh strong {
    font-family: var(--font-num);
    min-width: 1.5em;
    text-align: center;
  }
  .hint {
    font-size: 0.9em;
    color: var(--ink-soft);
    margin: 0.5rem 0 0;
  }

  /* Active effects: one line each, duration on the right. */
  .effects {
    list-style: none;
    padding: 0;
    margin: 0 0 0.5rem;
  }
  .effects li {
    display: flex;
    gap: 0.5em;
    align-items: center;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--rule);
    min-height: 2.9rem;
  }
  .effects li.off {
    opacity: 0.6;
  }
  .effects li > input[type='checkbox'] {
    accent-color: var(--ink);
  }
  .effects small {
    color: var(--ink-soft);
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    min-height: 2rem;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.22em;
    text-align: left;
    flex: 1;
  }
  .link:hover:not(:disabled) {
    background: none;
    color: var(--accent);
  }
  .conc {
    min-width: 2.4rem;
    min-height: 2.4rem;
    padding: 0;
    color: var(--ink-soft);
    border-color: transparent;
  }
  .conc.on {
    color: var(--arcane);
    border-color: var(--arcane);
  }
  .rounds {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .rounds input {
    width: 3.6rem;
    min-height: 2.4rem;
    text-align: center;
  }
  .rounds button {
    min-width: 2.4rem;
    min-height: 2.4rem;
    padding: 0;
  }
  .del {
    color: var(--danger);
    border-color: transparent;
    min-width: 2.4rem;
    min-height: 2.4rem;
    padding: 0;
  }
  .custom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin: 0.5rem 0;
  }
  .custom input,
  .custom select {
    min-height: 2.75rem;
    padding: 0 0.5rem;
    max-width: 100%;
  }
  .custom input[type='number'] {
    width: 4.5em;
  }
  .custom small {
    color: var(--ink-soft);
  }
  summary {
    cursor: pointer;
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    gap: 0.4em;
    list-style: none;
  }
  summary::before {
    content: '+';
    font-family: var(--font-num);
    font-weight: 700;
    width: 1rem;
  }
  details[open] summary::before {
    content: '−';
  }
  summary::-webkit-details-marker {
    display: none;
  }
</style>
