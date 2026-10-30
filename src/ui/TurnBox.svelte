<script lang="ts">
  // "Your turn" (top of the Combat pane), for players learning the turn: what a turn holds (SRD 5.2.1 p. 13 "Your
  // Turn"), a tracker that spends the action(s), Bonus Action, Reaction, movement and the free object interaction, and
  // four columns of cards built from the sheet: the standard actions (the main five, the others folded), then what the
  // character's features, traits, feats, spells, potions and items allow (engine/turn.ts). Attack opens the weapons in
  // hand with their numbers; Magic, Bonus Action and Reaction spells open the spells with that casting time
  // (ui/SpellRow.svelte). Every step can be undone; "New turn" and the turn bar's "Next round" give everything back.
  // A card is greyed with its reason as soon as its part of the turn is spent, and so is a spell's Cast button in the
  // open panel; undoing a cast from its row ("Cast ✓") also gives the part of the turn back (2026-10-29 fixes).
  import { rules } from '../data/rules'
  import type { AttackLine } from '../engine/sheet/types'
  import type { I18n, Source } from '../data/types'
  import { spellRounds, undoCast } from '../engine/casting'
  import { castFromItem, spellItemInfo } from '../engine/spellItems'
  import { fmt } from '../engine/stacking'
  import {
    actionBlocker,
    actionSlots,
    attackCapacity,
    attackWith,
    castableSpells,
    castInTurn,
    lightDamageBonus,
    lightExtra,
    lightExtraAttacks,
    lightExtraWaiting,
    MAIN_ACTIONS,
    move,
    movement,
    OTHER_ACTIONS,
    placeActions,
    potions,
    spend,
    SRC_BONUS_ACTIONS,
    SRC_BREAKING_UP,
    SRC_LIGHT,
    SRC_POTIONS,
    SRC_PRONE,
    SRC_REACTIONS,
    SRC_YOUR_TURN,
    standUp,
    takeAction,
    peekTurn,
    turnOptions,
    type TurnOption,
    undoStep,
    useObject,
    useOption,
  } from '../engine/turn'
  import { UI } from '../i18n/ui'
  import type { ItemInstance } from '../model/character'
  import { app, lang, tr, view } from '../state.svelte'
  import { fmtFeet, isMetric } from './format'
  import { itemName, newUid } from './items'
  import { openPopup } from './popupState.svelte'
  import { castLog } from './castLog.svelte'
  import SpellRow from './SpellRow.svelte'
  import { summaryOf } from './summary'
  import TurnBar, { effectName } from './TurnBar.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const turn = $derived(peekTurn(c))
  const slots = $derived(actionSlots(c, rules))
  const placed = $derived(placeActions(turn.actions, slots, sheet) ?? [])
  const options = $derived(turnOptions(c, sheet))
  const byKind = (k: TurnOption['kind']) => options.filter((o) => o.kind === k)
  const capacity = $derived(attackCapacity(c, sheet, rules))
  const mv = $derived(movement(c, sheet))
  const dashed = $derived(mv.total > mv.speed)
  const SPEED_KIND: Record<string, I18n> = {
    climb: { en: 'Climb', fr: 'Escalade', es: 'Trepar' },
    swim: { en: 'Swim', fr: 'Nage', es: 'Nadar' },
    fly: { en: 'Fly', fr: 'Vol', es: 'Volar' },
  }
  const attackLines = $derived([...sheet.attacks, ...(sheet.unarmed ? [sheet.unarmed] : [])])
  /** Weapons an Opportunity Attack can use: melee ones (a Thrown melee weapon too), and the Unarmed Strike. */
  const meleeLines = $derived(attackLines.filter((a) => a.weapon.kind === 'melee'))
  const light = $derived(lightExtraAttacks(c, sheet))
  const lightWaiting = $derived(lightExtraWaiting(c, sheet))
  const spellsBy = $derived({
    action: castableSpells(sheet, rules, 'action'),
    'bonus-action': castableSpells(sheet, rules, 'bonus-action'),
    reaction: castableSpells(sheet, rules, 'reaction'),
  })
  const potionList = $derived(potions(c, rules))
  const concentrating = $derived(c.activeEffects.find((e) => e.uid === c.concentration))
  const bonusFree = $derived(!turn.bonus)
  const reactionFree = $derived(!turn.reaction)
  const prone = $derived(c.conditions.includes('prone'))

  /** Which panel is open under the columns. */
  type Panel = 'attack' | 'opportunity' | 'action' | 'bonus-action' | 'reaction' | 'potion'
  let panel = $state<Panel | undefined>(undefined)
  let message = $state('')
  let panelEl = $state<HTMLElement | undefined>()
  /** Open or close a panel; the panel sits under the four columns, so it is scrolled into view when opened. */
  function toggle(p: Panel) {
    panel = panel === p ? undefined : p
    if (panel) requestAnimationFrame(() => panelEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  // ---- labels
  const gloss = (id: string) => rules.glossary.get(id)
  /** Cards that are not a Rules Glossary entry: their name, rule text and source. */
  const OWN: Record<string, { name: I18n; html?: () => I18n | undefined; source: Source }> = {
    move: {
      name: { en: 'Move', fr: 'Se déplacer', es: 'Moverse' },
      html: () => gloss('speed')?.text,
      source: SRC_BREAKING_UP,
    },
    object: {
      name: { en: 'Interact with an object', fr: 'Interagir avec un objet', es: 'Interactuar con un objeto' },
      source: SRC_YOUR_TURN,
    },
    potion: { name: { en: 'Drink a potion', fr: 'Boire une potion', es: 'Beber una poción' }, source: SRC_POTIONS },
    'light-attack': {
      name: { en: 'Light extra attack', fr: 'Attaque légère en plus', es: 'Ataque ligero extra' },
      html: () => rules.weaponProperties.get('light')?.text,
      source: SRC_LIGHT,
    },
    'stand-up': {
      name: { en: 'Stand up', fr: 'Se relever', es: 'Levantarse' },
      html: () => rules.conditions.get('prone')?.text,
      source: SRC_PRONE,
    },
  }
  const nameOf = (id: string): I18n => OWN[id]?.name ?? gloss(id)?.name ?? { en: id, fr: id, es: id }
  const summary = (id: string) => rules.summaries.get(`action:${id}`) ?? { en: '', fr: '', es: '' }
  const featLine = (o: TurnOption): I18n => {
    if (o.activation.trigger) return o.activation.trigger
    const keys = o.itemUid
      ? [o.effectId ?? o.ownerId]
      : [
          `feature:${o.ownerId}`,
          `trait:${o.ownerId}`,
          `feat:${o.ownerId.replace(/^feat:/, '').replace(/@.*$/, '')}`,
          `invocation:${o.ownerId}`,
        ]
    for (const k of keys) {
      const s = rules.summaries.get(k)
      if (s) return s
    }
    return summaryOf(keys[0], o.text)
  }
  function rulePopup(id: string) {
    const own = OWN[id]
    const g = gloss(id)
    openPopup({
      title: nameOf(id),
      html: own ? own.html?.() : g?.text,
      source: own ? own.source : g?.source,
      summary: summary(id),
      noteKey: `action:${id}`,
    })
  }
  function optionPopup(o: TurnOption) {
    openPopup({ title: o.name, html: o.text, source: o.source, summary: featLine(o), noteKey: `feature:${o.ownerId}` })
  }
  const say = (t: I18n) => (message = tr(t))
  const did = (what: I18n): I18n => ({ en: `✓ ${what.en}`, fr: `✓ ${what.fr}`, es: `✓ ${what.es ?? what.en}` })

  // ---- steps
  function standard(id: string) {
    if (id === 'attack') return toggle('attack')
    if (id === 'magic') return toggle('action')
    takeAction(c, id, nameOf(id))
    say(did(nameOf(id)))
  }
  function attack(lineName: I18n, uid?: string) {
    const line = attackLines.find((a) => a.uid === uid)
    attackWith(c, sheet, rules, line, lineName)
    say(did(lineName))
  }
  /** The Light extra attack with this weapon (Bonus Action, or inside the Attack action with Nick). */
  function lightAttack(l: { line: AttackLine; nick: boolean }) {
    lightExtra(c, l.nick, {
      en: `${l.line.name.en} (Light)`,
      fr: `${l.line.name.fr} (légère)`,
      es: `${l.line.name.es ?? l.line.name.en} (ligera)`,
    })
    say(did(l.line.name))
  }
  const lightLine = (l: { line: AttackLine; nick: boolean }) =>
    `${tr(l.line.name)} ${fmt(l.line.attack.total)} · ${l.line.damage.dice}${lightDamageBonus(l.line, sheet) ? fmt(lightDamageBonus(l.line, sheet)) : ''}`
  const NICK_NOTE = {
    en: 'Nick: inside the Attack action',
    fr: 'Coup double : dans l’action Attaque',
    es: 'Mella: dentro de la acción de Atacar',
  }
  const LIGHT_WAIT = {
    en: 'after an Attack-action attack with a Light weapon',
    fr: 'après une attaque de l’action Attaque avec une arme Légère',
    es: 'tras un ataque de la acción de Atacar con un arma Ligera',
  }
  function use(o: TurnOption, sub?: string) {
    const label = sub
      ? {
          en: `${o.name.en}: ${nameOf(sub).en}`,
          fr: `${o.name.fr} : ${nameOf(sub).fr}`,
          es: `${o.name.es ?? o.name.en}: ${nameOf(sub).es ?? nameOf(sub).en}`,
        }
      : o.name
    useOption(c, o, label, sub)
    say(did(label))
  }
  // The Opportunity Attack is one melee attack outside the Attack action: it spends the Reaction only, and its panel
  // shows the melee weapons' numbers (opening the Attack panel would have spent the action).
  function opportunity() {
    spend(c, 'reaction', 'opportunity-attacks', nameOf('opportunity-attacks'))
    say(did(nameOf('opportunity-attacks')))
    panel = undefined
    toggle('opportunity')
  }
  function drink(item: ItemInstance) {
    const info = spellItemInfo(item, rules)
    const name = itemName(item)
    const first = info?.spells[0]
    let effectUid: string | undefined
    if (info && first) {
      castFromItem(item, info, first, rules.spells.get(first.spellId)?.level ?? 0, rules)
      // Potions confer the spell's effects with its usual duration (SRD p. 206 "Spells Cast from Items").
      const sp = rules.spells.get(first.spellId)
      const rounds = sp ? spellRounds(sp) : undefined
      if (sp && rounds) {
        effectUid = newUid()
        c.activeEffects.push({ uid: effectUid, kind: 'spell', refId: sp.id, enabled: true, rounds })
      }
    } else item.quantity = Math.max(0, item.quantity - 1)
    spend(c, 'bonus', 'potion', name, { item: item.uid, ...(effectUid ? { cast: { cast: {}, effectUid } } : {}) })
    const note = info?.variantNote ?? info?.note
    say({
      en: `✓ ${name.en}${note ? ` · ${note.en}` : ''}`,
      fr: `✓ ${name.fr}${note ? ` · ${note.fr}` : ''}`,
      es: `✓ ${name.es ?? name.en}${note ? ` · ${note.es ?? note.en}` : ''}`,
    })
    panel = undefined
  }

  function undo() {
    const label = undoStep(c, (u) => {
      undoCast(c, u.cast, u.effectUid)
      // The spell's row must not stay "Cast ✓" (castLog keeps the last cast of each row for the round).
      for (const [k, r] of Object.entries(castLog.rows))
        if ((u.effectUid && r.effectUid === u.effectUid) || JSON.stringify(r.cast) === JSON.stringify(u.cast))
          delete castLog.rows[k]
    })
    message = label ? `↶ ${tr(label)}` : ''
  }
  /** "Cast ✓" undone from a spell row: the spell and its slot are already back; give back its part of the turn when it
   * was the last step. */
  function uncast(name: I18n) {
    const last = turn.undo[turn.undo.length - 1]
    if (last?.cast && last.label.en === name.en) {
      undoStep(c)
      message = `↶ ${tr(name)}`
    }
  }
  /** Why a spell of the open panel can't be cast now: its part of the turn is spent. */
  const castBlocked = (kind: 'action' | 'bonus-action' | 'reaction'): string => {
    const b =
      kind === 'action'
        ? actionBlocker(c, sheet, rules, 'magic')
        : kind === 'bonus-action' && !bonusFree
          ? SPENT.bonus
          : kind === 'reaction' && !reactionFree
            ? SPENT.reaction
            : undefined
    return b ? tr(b) : ''
  }
  /** Why one sub-action of an option (Cunning Action: Dash, Disengage, Hide) can't be taken. */
  const subBlocked = (o: TurnOption, sub: string): string =>
    o.kind === 'bonus-action' && !bonusFree ? tr(SPENT.bonus) : optBlocked(o, o.kind === 'action' ? sub : undefined)

  // ---- display helpers
  const ft = (n: number) => (isMetric(lang()) ? fmtFeet(n, lang()) : `${n} ft`)
  const costText = (o: TurnOption) =>
    o.cost
      ? tr({
          en: `${o.cost.amount > 1 ? `${o.cost.amount} uses` : '1 use'} · ${o.cost.left} left`,
          fr: `${o.cost.amount > 1 ? `${o.cost.amount} utilisations` : '1 utilisation'} · ${o.cost.left} restante${o.cost.left > 1 ? 's' : ''}`,
          es: `${o.cost.amount > 1 ? `${o.cost.amount} usos` : '1 uso'} · quedan ${o.cost.left}`,
        })
      : ''
  /** Why an option can't be used: its own reason, or its part of the turn is spent. */
  function optBlocked(o: TurnOption, sub?: string): string {
    if (o.blocked) return tr(o.blocked)
    if (o.kind === 'action') {
      const b = actionBlocker(
        c,
        sheet,
        rules,
        sub ?? (o.activation.action ? `use:${o.key}|${o.activation.action}` : `use:${o.key}`),
      )
      return b ? tr(b) : ''
    }
    if (o.kind === 'bonus-action' && !bonusFree) return tr(SPENT.bonus)
    if (o.kind === 'reaction' && !reactionFree) return tr(SPENT.reaction)
    if (o.activation.extraAction && turn.surge)
      return tr({ en: 'once per turn', fr: 'une fois par tour', es: 'una vez por turno' })
    if (o.kind === 'attack' && turn.attacks >= capacity)
      return tr({
        en: 'take the Attack action first',
        fr: 'prenez d’abord l’action Attaque',
        es: 'primero haz la acción de Atacar',
      })
    return ''
  }
  const SPENT = {
    bonus: { en: 'Bonus Action already used', fr: 'Action Bonus déjà utilisée', es: 'acción adicional ya usada' },
    reaction: {
      en: 'Reaction already used this round',
      fr: 'Réaction déjà utilisée ce round',
      es: 'reacción ya usada esta ronda',
    },
  }
  // Movement first: it is what a turn starts with, before or after the action.
  const COLS: { id: 'action' | 'bonus-action' | 'reaction' | 'move'; label: I18n; source: Source }[] = [
    {
      id: 'move',
      label: { en: 'Movement and free', fr: 'Déplacement et gratuit', es: 'Movimiento y gratis' },
      source: SRC_BREAKING_UP,
    },
    { id: 'action', label: UI.actions, source: SRC_YOUR_TURN },
    { id: 'bonus-action', label: UI.bonusActions, source: SRC_BONUS_ACTIONS },
    { id: 'reaction', label: UI.reactions, source: SRC_REACTIONS },
  ]
  const spentLabel = (what: string | undefined): string => {
    if (!what) return ''
    if (what.startsWith('use:')) {
      const key = what.slice(4).split(/[>|]/)[0]
      const o = options.find((x) => x.key === key)
      const sub = what.includes('>') ? what.split('>')[1] : undefined
      return o ? tr(o.name) + (sub ? ` (${tr(nameOf(sub))})` : '') : ''
    }
    if (what === 'spell') return tr({ en: 'spell', fr: 'sort', es: 'conjuro' })
    if (what === 'light-attack')
      return tr({ en: 'Light extra attack', fr: 'attaque légère en plus', es: 'ataque ligero extra' })
    if (what === 'potion') return tr({ en: 'potion', fr: 'potion', es: 'poción' })
    return tr(nameOf(what))
  }
  const hasMagic = $derived(spellsBy.action.length > 0 || byKind('action').some((o) => o.activation.action === 'magic'))
  const mainActions = $derived(MAIN_ACTIONS.filter((a) => a !== 'magic' || hasMagic))
  const otherActions = $derived([...(hasMagic ? [] : ['magic']), ...OTHER_ACTIONS])
</script>

<section class="box turn">
  <h3>{tr({ en: 'Your turn', fr: 'Votre tour', es: 'Tu turno' })}</h3>
  <!-- Round, next round (which also gives the turn back), end of the encounter, Concentration, timed effects. -->
  <TurnBar embedded />
  <p class="rule">
    <button
      class="link"
      onclick={() =>
        openPopup({
          title: { en: 'Your Turn', fr: 'Votre tour', es: 'Tu turno' },
          summary: summary('move'),
          source: SRC_YOUR_TURN,
        })}
      >{tr({
        en: 'On your turn: move up to your Speed and take one action, in either order · a Bonus Action only if something gives you one · one Reaction per round · one object for free.',
        fr: 'À votre tour : déplacez-vous jusqu’à votre Vitesse et entreprenez une action, dans l’ordre voulu · une Action Bonus seulement si quelque chose vous en donne une · une Réaction par round · un objet gratuitement.',
        es: 'En tu turno: muévete hasta tu velocidad y haz una acción, en el orden que quieras · una acción adicional solo si algo te la da · una reacción por ronda · un objeto gratis.',
      })}</button
    >
  </p>

  <!-- Tracker: one chip per part of the turn; a spent part says what it went to. -->
  <div class="tracker">
    {#each slots as s (s.id)}
      {@const at = placed.findIndex((p) => p === s)}
      <span class="chip" class:spent={at >= 0} title={s.id !== 'main' ? tr(s.label) : ''}>
        {tr(s.label)}{at >= 0 ? ` : ${spentLabel(turn.actions[at])}` : ''}
      </span>
    {/each}
    <span class="chip" class:spent={!bonusFree}
      >{tr({ en: 'Bonus Action', fr: 'Action Bonus', es: 'Acción adicional' })}{turn.bonus
        ? ` : ${spentLabel(turn.bonus)}`
        : ''}</span
    >
    <span class="chip" class:spent={!reactionFree}
      >{tr({ en: 'Reaction', fr: 'Réaction', es: 'Reacción' })}{turn.reaction
        ? ` : ${spentLabel(turn.reaction)}`
        : ''}</span
    >
    <span class="chip move" class:spent={!!turn.moved}
      >{tr(nameOf('move'))} : {tr({ en: 'up to', fr: 'jusqu’à', es: 'hasta' })} {ft(mv.total)}</span
    >
    <span class="chip" class:spent={turn.object}
      >{tr({ en: 'Object', fr: 'Objet', es: 'Objeto' })}{turn.object ? ' ✓' : ''}</span
    >
    {#if turn.attacks || capacity}
      <span class="chip" class:spent={capacity > 0 && turn.attacks >= capacity}
        >{tr(UI.attacks)} {turn.attacks} / {capacity}</span
      >
    {/if}
    <button
      class="undo"
      disabled={!turn.undo.length}
      onclick={undo}
      title={turn.undo.length ? tr(turn.undo[turn.undo.length - 1].label) : ''}
      >↶ {tr({ en: 'Undo', fr: 'Annuler', es: 'Deshacer' })}</button
    >
  </div>
  {#if turn.slotSpent}
    <p class="warn">
      ⚠ {tr({
        en: 'You already spent a spell slot this turn: only cantrips and spells cast without a slot now (SRD p. 105).',
        fr: 'Vous avez déjà dépensé un emplacement de sort ce tour-ci : seulement des sorts mineurs ou sans emplacement maintenant (SRD p. 112 FR).',
        es: 'Ya gastaste un espacio de conjuro este turno: ahora solo trucos o conjuros sin espacio (SRD p. 105).',
      })}
    </p>
  {/if}
  {#if message}<p class="msg" role="status">{message}</p>{/if}

  {#snippet card(id: string, onclick: () => void, blocked: string, extra?: string)}
    <div class="card" class:off={!!blocked}>
      <button class="do" disabled={!!blocked} {onclick} title={blocked}>
        <strong>{tr(nameOf(id))}</strong>{#if extra}<span class="meta"> · {extra}</span>{/if}
        <span class="line">{blocked ? `— ${blocked}` : tr(summary(id))}</span>
      </button>
      <button class="info" onclick={() => rulePopup(id)} aria-label="SRD">ⓘ</button>
    </div>
  {/snippet}
  {#snippet optCard(o: TurnOption)}
    {@const subs = o.activation.actions ?? []}
    {@const blocked = subs.length
      ? o.blocked
        ? tr(o.blocked)
        : subs.every((x) => subBlocked(o, x))
          ? subBlocked(o, subs[0])
          : ''
      : optBlocked(o)}
    <div class="card" class:off={!!blocked}>
      <button class="do" disabled={!!blocked || !!o.activation.actions} onclick={() => use(o)} title={blocked}>
        <strong>{tr(o.name)}</strong>{#if o.cost}<span class="meta"> · {costText(o)}</span>{/if}
        <span class="line">{blocked ? `— ${blocked}` : tr(featLine(o))}</span>
      </button>
      <button class="info" onclick={() => optionPopup(o)} aria-label="SRD">ⓘ</button>
      {#if subs.length && !blocked}
        <div class="subs">
          {#each subs as sub (sub)}
            {@const b = subBlocked(o, sub)}
            <button disabled={!!b} title={b} onclick={() => use(o, sub)}>{tr(nameOf(sub))}</button>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  <div class="cols">
    {#each COLS as col (col.id)}
      <div class="col">
        <h4>
          <button
            class="link"
            onclick={() =>
              openPopup({
                title: col.label,
                html: gloss(col.id === 'move' ? 'speed' : col.id)?.text,
                source: col.source,
              })}>{tr(col.label)}</button
          >
        </h4>
        {#if col.id === 'action'}
          {#each mainActions as id (id)}
            {@render card(
              id,
              () => standard(id),
              id === 'attack'
                ? turn.attacks < capacity
                  ? ''
                  : actionBlocker(c, sheet, rules, 'attack')
                    ? tr(actionBlocker(c, sheet, rules, 'attack')!)
                    : ''
                : actionBlocker(c, sheet, rules, id)
                  ? tr(actionBlocker(c, sheet, rules, id)!)
                  : '',
              id === 'attack'
                ? `${sheet.attacksPerAction} ${tr(UI.attacks).toLowerCase()}`
                : id === 'magic'
                  ? `${spellsBy.action.length}`
                  : undefined,
            )}
          {/each}
          {#each byKind('action') as o (o.key)}{@render optCard(o)}{/each}
          <details>
            <summary>{tr({ en: 'Other actions', fr: 'Autres actions', es: 'Otras acciones' })}</summary>
            {#each otherActions as id (id)}
              {@render card(
                id,
                () => standard(id),
                actionBlocker(c, sheet, rules, id) ? tr(actionBlocker(c, sheet, rules, id)!) : '',
              )}
            {/each}
          </details>
        {:else if col.id === 'bonus-action'}
          {#if lightWaiting}
            {@render card('light-attack', () => {}, tr(LIGHT_WAIT))}
          {/if}
          {#each light as l (l.line.uid)}
            {@render card(
              'light-attack',
              () => lightAttack(l),
              !l.nick && !bonusFree ? tr(SPENT.bonus) : '',
              `${lightLine(l)}${l.nick ? ` · ${tr(NICK_NOTE)}` : ''}`,
            )}
          {/each}
          {#if spellsBy['bonus-action'].length}
            {@const b = castBlocked('bonus-action')}
            <div class="card" class:off={!!b} class:open={panel === 'bonus-action'}>
              <button
                class="do"
                disabled={!!b}
                title={b}
                aria-expanded={panel === 'bonus-action'}
                onclick={() => toggle('bonus-action')}
              >
                <strong
                  >{tr({
                    en: 'Bonus Action spells',
                    fr: 'Sorts en Action Bonus',
                    es: 'Conjuros de acción adicional',
                  })}</strong
                ><span class="meta"> · {spellsBy['bonus-action'].length}</span>
                <span class="line"
                  >{b ? `— ${b}` : spellsBy['bonus-action'].map((x) => tr(x.spell.name)).join(', ')}</span
                >
              </button>
            </div>
          {/if}
          {#if potionList.length}
            {@render card(
              'potion',
              () => toggle('potion'),
              bonusFree ? '' : tr(SPENT.bonus),
              `${potionList.reduce((n, p) => n + p.quantity, 0)}`,
            )}
          {/if}
          {#each byKind('bonus-action') as o (o.key)}{@render optCard(o)}{/each}
          {#if !light.length && !spellsBy['bonus-action'].length && !potionList.length && !byKind('bonus-action').length}
            <p class="hint">
              {tr({
                en: 'Nothing gives you a Bonus Action yet: it only comes from a feature, a spell, an item or a Light weapon.',
                fr: 'Rien ne vous donne encore d’Action Bonus : elle ne vient que d’une aptitude, d’un sort, d’un objet ou d’une arme légère.',
                es: 'Aún nada te da una acción adicional: solo la dan un rasgo, un conjuro, un objeto o un arma ligera.',
              })}
            </p>
          {/if}
        {:else if col.id === 'reaction'}
          {@render card('opportunity-attacks', opportunity, reactionFree ? '' : tr(SPENT.reaction))}
          {#if spellsBy.reaction.length}
            {@const b = castBlocked('reaction')}
            <div class="card" class:off={!!b} class:open={panel === 'reaction'}>
              <button
                class="do"
                disabled={!!b}
                title={b}
                aria-expanded={panel === 'reaction'}
                onclick={() => toggle('reaction')}
              >
                <strong>{tr({ en: 'Reaction spells', fr: 'Sorts en Réaction', es: 'Conjuros de reacción' })}</strong
                ><span class="meta"> · {spellsBy.reaction.length}</span>
                <span class="line">{b ? `— ${b}` : spellsBy.reaction.map((x) => tr(x.spell.name)).join(', ')}</span>
              </button>
            </div>
          {/if}
          {#each byKind('reaction') as o (o.key)}{@render optCard(o)}{/each}
          <p class="hint">
            {tr({
              en: 'Reactions happen on anyone’s turn, when their trigger occurs.',
              fr: 'Les Réactions se jouent au tour de n’importe qui, quand leur déclencheur survient.',
              es: 'Las reacciones ocurren en el turno de cualquiera, cuando se da su desencadenante.',
            })}
          </p>
        {:else}
          {@render card(
            'move',
            () => {
              move(c, nameOf('move'))
              say(did(nameOf('move')))
            },
            '',
            `${tr({ en: 'up to', fr: 'jusqu’à', es: 'hasta' })} ${ft(mv.total)}`,
          )}
          {#if turn.moved}
            <!-- Selected: the move is not counted in feet (the character may fly, swim or ride), only explained. -->
            <p class="moving">
              ✓ {tr({
                en: `You can move up to ${ft(mv.total)}${dashed ? ' (with Dash)' : ''}. Split it as you like: before, between and after your action, Bonus Action and Reaction.`,
                fr: `Vous pouvez vous déplacer jusqu’à ${ft(mv.total)}${dashed ? ' (avec Pointe)' : ''}. Fractionnez-le comme vous voulez : avant, entre et après votre action, votre Action Bonus et votre Réaction.`,
                es: `Puedes moverte hasta ${ft(mv.total)}${dashed ? ' (con Correr)' : ''}. Repártelo como quieras: antes, entre y después de tu acción, tu acción adicional y tu reacción.`,
              })}
              {#if sheet.otherSpeeds.length}
                {tr({
                  en: 'Flying, swimming or climbing: use that Speed instead',
                  fr: 'En volant, nageant ou escaladant : utilisez plutôt cette Vitesse',
                  es: 'Volando, nadando o trepando: usa esa velocidad en su lugar',
                })}
                ({sheet.otherSpeeds
                  .map((x) => `${tr(SPEED_KIND[x.kind] ?? { en: x.kind, fr: x.kind, es: x.kind })} ${ft(x.ft)}`)
                  .join(', ')}).
              {/if}
            </p>
          {/if}
          {#if prone}
            {@render card(
              'stand-up',
              () => {
                standUp(c, nameOf('stand-up'))
                say(did(nameOf('stand-up')))
              },
              '',
              ft(Math.floor(sheet.speed.total / 2)),
            )}
          {/if}
          {@render card(
            'object',
            () => {
              useObject(c, { en: 'Object', fr: 'Objet', es: 'Objeto' })
              say(did({ en: 'Object', fr: 'Objet', es: 'Objeto' }))
            },
            turn.object
              ? tr({
                  en: 'used: a second object needs the Utilize action',
                  fr: 'utilisé : un deuxième objet demande l’action Utilisation',
                  es: 'usado: un segundo objeto requiere la acción de Utilizar',
                })
              : '',
          )}
          {#each byKind('free') as o (o.key)}{@render optCard(o)}{/each}
        {/if}
      </div>
    {/each}
  </div>

  <!-- The open panel: weapons in hand, the Opportunity Attack, spells of one casting time, or potions. -->
  <div bind:this={panelEl}>
    {#if panel === 'attack'}
      <div class="panel">
        <h4>
          {tr({ en: 'Attack with', fr: 'Attaquer avec', es: 'Atacar con' })}
          <span class="meta"
            >{turn.attacks} / {capacity} · {tr({
              en: 'one click per attack',
              fr: 'un clic par attaque',
              es: 'un clic por ataque',
            })}</span
          >
          <button class="x" onclick={() => (panel = undefined)} aria-label={tr(UI.close)}>✕</button>
        </h4>
        <ul class="rows">
          {#each attackLines as a (a.uid)}
            {@const b =
              turn.attacks < capacity
                ? ''
                : actionBlocker(c, sheet, rules, 'attack')
                  ? tr(actionBlocker(c, sheet, rules, 'attack')!)
                  : ''}
            <li>
              <strong>{tr(a.name)}</strong>
              <span class="num">{fmt(a.attack.total)}</span>
              <span>{a.damage.dice}{a.damage.bonus.total ? fmt(a.damage.bonus.total) : ''} {tr(a.damage.type)}</span>
              {#if a.mastery.id && a.mastery.usable}<span class="meta">{tr(a.mastery.name)}</span>{/if}
              {#if a.weapon.properties.includes('light')}<span class="meta"
                  >{tr({ en: 'Light', fr: 'Légère', es: 'Ligera' })}</span
                >{/if}
              <button disabled={!!b} title={b} onclick={() => attack(a.name, a.uid)}>{tr(UI.attack)}</button>
              {#if b}<small class="meta">{b}</small>{/if}
            </li>
          {:else}
            <li class="hint">
              {tr({
                en: 'No weapon in hand: pick one in Attacks below.',
                fr: 'Aucune arme en main : choisissez-en une dans Attaques plus bas.',
                es: 'Ningún arma en la mano: elige una en Ataques más abajo.',
              })}
            </li>
          {/each}
          {#each light.filter((l) => l.nick) as l (l.line.uid)}
            <!-- Nick (p. 90): the Light extra attack inside the Attack action, once per turn. -->
            <li>
              <strong>{tr(l.line.name)}</strong>
              <span class="meta">{tr(NICK_NOTE)} · {lightLine(l)}</span>
              <button onclick={() => lightAttack(l)}>{tr(UI.attack)}</button>
            </li>
          {/each}
          {#each byKind('attack') as o (o.key)}
            {@const b = optBlocked(o)}
            <li>
              <strong>{tr(o.name)}</strong>
              <span class="meta"
                >{tr({ en: 'replaces one attack', fr: 'remplace une attaque', es: 'sustituye un ataque' })}{o.cost
                  ? ` · ${costText(o)}`
                  : ''}</span
              >
              <button disabled={!!b} title={b} onclick={() => use(o)}
                >{tr({ en: 'Use', fr: 'Utiliser', es: 'Usar' })}</button
              >
              <button class="info" onclick={() => optionPopup(o)} aria-label="SRD">ⓘ</button>
            </li>
          {/each}
        </ul>
        <p class="hint">
          <button class="link" onclick={() => rulePopup('unarmed-strike')}>{tr(nameOf('unarmed-strike'))}</button> :
          {tr({
            en: 'instead of damage, an Unarmed Strike can Grapple or Shove the target.',
            fr: 'au lieu de dégâts, une Attaque à mains nues peut agripper ou pousser la cible.',
            es: 'en lugar de daño, un ataque sin armas puede agarrar o empujar al objetivo.',
          })}
          {#if light.length || lightWaiting}
            ·
            <button
              class="link"
              onclick={() =>
                openPopup({
                  title: { en: 'Light', fr: 'Légère', es: 'Ligera' },
                  html: rules.weaponProperties.get('light')?.text,
                  source: SRC_LIGHT,
                })}>{tr({ en: 'Light', fr: 'Légère', es: 'Ligera' })}</button
            >
            {tr({
              en: ': after an attack with a Light weapon, the extra attack with the other one appears here with Nick, else in the Bonus Action column.',
              fr: ' : après une attaque avec une arme Légère, l’attaque en plus avec l’autre apparaît ici avec Coup double, sinon dans la colonne Action Bonus.',
              es: ': tras un ataque con un arma Ligera, el ataque extra con la otra aparece aquí con Mellar, si no en la columna de acción adicional.',
            })}
          {/if}
        </p>
      </div>
    {:else if panel === 'opportunity'}
      <div class="panel">
        <h4>
          {tr(nameOf('opportunity-attacks'))}
          <span class="meta"
            >{tr({
              en: 'one melee attack, Reaction spent',
              fr: 'une attaque au corps à corps, Réaction dépensée',
              es: 'un ataque cuerpo a cuerpo, reacción gastada',
            })}</span
          >
          <button class="x" onclick={() => (panel = undefined)} aria-label={tr(UI.close)}>✕</button>
        </h4>
        <ul class="rows">
          {#each meleeLines as a (a.uid)}
            <li>
              <strong>{tr(a.name)}</strong>
              <span class="num">{fmt(a.attack.total)}</span>
              <span>{a.damage.dice}{a.damage.bonus.total ? fmt(a.damage.bonus.total) : ''} {tr(a.damage.type)}</span>
            </li>
          {:else}
            <li class="hint">
              {tr({
                en: 'No melee weapon in hand: an Unarmed Strike works too.',
                fr: 'Aucune arme de corps à corps en main : une Attaque à mains nues convient aussi.',
                es: 'Ningún arma cuerpo a cuerpo en la mano: también vale un ataque sin armas.',
              })}
            </li>
          {/each}
        </ul>
      </div>
    {:else if panel === 'action' || panel === 'bonus-action' || panel === 'reaction'}
      {@const kind = panel}
      {@const b = castBlocked(kind)}
      <div class="panel">
        <h4>
          {kind === 'action'
            ? tr(nameOf('magic'))
            : kind === 'bonus-action'
              ? tr({ en: 'Bonus Action spells', fr: 'Sorts en Action Bonus', es: 'Conjuros de acción adicional' })
              : tr({ en: 'Reaction spells', fr: 'Sorts en Réaction', es: 'Conjuros de reacción' })}
          <button class="x" onclick={() => (panel = undefined)} aria-label={tr(UI.close)}>✕</button>
        </h4>
        {#if b}<p class="warn">⚠ {b}</p>{/if}
        {#if concentrating}
          <p class="hint">
            {tr({
              en: `You concentrate on ${tr(effectName(concentrating))}: a spell marked C ⚠ would end it.`,
              fr: `Vous vous concentrez sur ${tr(effectName(concentrating))} : un sort marqué C ⚠ y mettrait fin.`,
              es: `Te concentras en ${tr(effectName(concentrating))}: un conjuro marcado C ⚠ la terminaría.`,
            })}
          </p>
        {/if}
        <ul class="spells">
          {#each spellsBy[kind] as x (`${x.classId ?? x.ownerId ?? ''}:${x.spell.id}`)}
            <SpellRow
              s={x.spell}
              classId={x.classId}
              ownerId={x.ownerId}
              pactFirst={x.pactFirst}
              blocked={b || undefined}
              slotSpentThisTurn={turn.slotSpent}
              oncast={(r) => {
                castInTurn(c, kind, r.slotUsed, x.spell.name, { cast: r.cast, effectUid: r.effectUid })
                say(did(x.spell.name))
              }}
              onundo={() => uncast(x.spell.name)}
            />
          {:else}
            <li class="hint">
              {tr({
                en: 'No spell with this casting time.',
                fr: 'Aucun sort avec ce temps d’incantation.',
                es: 'Ningún conjuro con este tiempo de lanzamiento.',
              })}
            </li>
          {/each}
        </ul>
        {#if kind === 'action'}
          <p class="hint">
            {tr({
              en: 'Magic items: most take a Magic action to activate (SRD p. 206); spells from items are in the Spell items box below.',
              fr: 'Objets magiques : la plupart s’activent avec l’action Magie (SRD p. 217 FR) ; les sorts des objets sont dans le bloc des objets à sorts plus bas.',
              es: 'Objetos mágicos: la mayoría se activan con la acción de Magia (SRD p. 225 ES); los conjuros de objetos están en el bloque de objetos con conjuros más abajo.',
            })}
          </p>
        {/if}
      </div>
    {:else if panel === 'potion'}
      <div class="panel">
        <h4>
          {tr({ en: 'Drink a potion', fr: 'Boire une potion', es: 'Beber una poción' })}
          <button
            class="link meta"
            onclick={() =>
              openPopup({
                title: { en: 'Potions', fr: 'Potions', es: 'Pociones' },
                summary: summary('potion'),
                source: SRC_POTIONS,
              })}>SRD</button
          >
          <button class="x" onclick={() => (panel = undefined)} aria-label={tr(UI.close)}>✕</button>
        </h4>
        <ul class="rows">
          {#each potionList as p (p.uid)}
            <li>
              <strong>{tr(itemName(p))}</strong>
              <span class="meta">× {p.quantity}</span>
              <button disabled={!bonusFree} title={bonusFree ? '' : tr(SPENT.bonus)} onclick={() => drink(p)}
                >{tr({ en: 'Drink', fr: 'Boire', es: 'Beber' })}</button
              >
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>

<style>
  .turn {
    margin-bottom: 1.25rem;
  }
  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .undo {
    min-height: 2rem;
    font-size: 0.85rem;
    margin-left: auto;
  }
  .rule {
    margin: 0 0 0.5rem;
    font-size: 0.92rem;
  }
  .link {
    font: inherit;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    text-decoration: underline dotted var(--rule-strong);
    text-underline-offset: 0.2em;
  }
  .tracker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    border: 1.5px solid var(--accent);
    border-radius: 999px;
    font-family: var(--font-title);
    font-size: 0.85rem;
    background: var(--accent-soft);
  }
  .chip.spent {
    border-color: var(--rule-strong);
    background: none;
    color: var(--ink-soft);
    text-decoration: line-through;
    text-decoration-color: var(--rule-strong);
  }
  .chip.move {
    text-decoration: none;
  }
  .moving {
    margin: -0.1rem 0 0.35rem;
    font-size: 0.85rem;
    color: var(--accent);
  }
  .warn {
    margin: 0.2rem 0;
    color: var(--danger);
    font-size: 0.9rem;
  }
  .msg {
    margin: 0.2rem 0;
    color: var(--accent);
    font-size: 0.9rem;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem 1rem;
    margin-top: 0.4rem;
  }
  @media (max-width: 64rem) {
    .cols {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 40rem) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .col h4,
  .panel h4 {
    margin: 0 0 0.35rem;
    font-family: var(--font-title);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: var(--accent);
    border-bottom: 1px solid var(--rule);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .card {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    margin-bottom: 0.3rem;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
  }
  .card.off {
    opacity: 0.55;
  }
  .card.open {
    border-color: var(--accent);
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .card .do {
    flex: 1 1 0;
    min-width: 0;
    min-height: 2.4rem;
    text-align: left;
    border: none;
    background: none;
    padding: 0.25rem 0.45rem;
    font: inherit;
    cursor: pointer;
  }
  .card .do:disabled {
    cursor: default;
  }
  .card .do:not(:disabled):hover {
    background: var(--paper-2);
  }
  .line {
    display: block;
    font-size: 0.85rem;
    color: var(--ink-soft);
    line-height: 1.25;
  }
  .info {
    border: none;
    border-left: 1px solid var(--rule);
    background: none;
    padding: 0 0.45rem;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .subs {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0 0.45rem 0.35rem;
  }
  .subs button {
    min-height: 2rem;
    font-size: 0.85rem;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85rem;
    font-family: var(--font-title);
  }
  .hint {
    color: var(--ink-soft);
    font-size: 0.85rem;
    margin: 0.3rem 0;
  }
  details summary {
    cursor: pointer;
    font-family: var(--font-title);
    font-size: 0.85rem;
    color: var(--ink-soft);
    margin: 0.2rem 0 0.3rem;
  }
  .panel {
    margin-top: 0.75rem;
    padding: 0.5rem 0.6rem;
    border: 1.5px solid var(--frame);
    background: var(--paper-2);
  }
  .panel .x {
    margin-left: auto;
    min-height: 1.8rem;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rows li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .rows li button {
    margin-left: auto;
    min-height: 2.2rem;
  }
  .rows .info {
    margin-left: 0;
    border-left: none;
  }
  .num {
    font-family: var(--font-num);
    font-weight: 700;
  }
  .spells {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>
