<script lang="ts">
  // Summoned creatures (Companions pane), like the 3.5 playboard's SummonBlock: pick one of the character's summoning
  // spells (the block is hidden for a character with none and no creature left), the creature, the form or size and the slot level when they matter, then
  // track each creature's Hit Points, AC, attacks and the rounds left (counted down by the turn bar). Concentration
  // spells start a Concentration effect; when it ends, the creatures disappear. Rules: engine/summons.ts.
  import { rules } from '../data/rules'
  import type { I18n } from '../data/types'
  import { UI } from '../i18n/ui'
  import { fmt } from '../engine/stacking'
  import {
    availableSummonSpells,
    multiattack,
    newSummon,
    pruneSummons,
    summonAc,
    summonAttacks,
    summonCaster,
    summonCount,
    summonCreatures,
    summonEffect,
    summonSpell,
    SUMMON_SPELLS,
  } from '../engine/summons'
  import type { Summon } from '../model/character'
  import { app, tr, view } from '../state.svelte'
  import CreatureBlock from './CreatureBlock.svelte'
  import { openPopup } from './popupState.svelte'

  const c = $derived(app.character)
  const sheet = $derived(view.sheet)
  const summons = $derived(c.summons ?? [])

  // A summon whose Concentration effect was removed (Combat effects list) disappears with it.
  $effect(() => {
    pruneSummons(c)
  })

  const spellName = (id: string): I18n => rules.spells.get(id)?.name ?? { en: id, fr: id, es: id }
  const spellLevel = (id: string) => rules.spells.get(id)?.level ?? 1
  const avail = $derived(
    [...availableSummonSpells(sheet)].sort(
      (a, b) =>
        spellLevel(a.spellId) - spellLevel(b.spellId) ||
        tr(spellName(a.spellId)).localeCompare(tr(spellName(b.spellId))),
    ),
  )

  let form = $state({ spellId: '', creatureId: '', variant: '', slot: 0, qty: 1 })
  // With no summoning spell the form is hidden (only creatures still around are shown); the fallback keeps the types.
  const spell = $derived(avail.find((s) => s.spellId === form.spellId) ?? avail[0] ?? SUMMON_SPELLS[0])
  const minSlot = $derived(spellLevel(spell.spellId))
  const slot = $derived(Math.min(9, Math.max(minSlot, form.slot || minSlot)))
  const creatures = $derived(summonCreatures(spell, slot))
  const creatureId = $derived(creatures.includes(form.creatureId) ? form.creatureId : creatures[0])
  const variant = $derived(spell.variants?.find((v) => v.id === form.variant)?.id ?? spell.variants?.[0]?.id)
  const count = $derived(summonCount(spell.spellId, slot, creatureId))
  const qty = $derived(Math.max(1, Math.min(count ?? 10, Math.floor(form.qty) || 1)))

  function summon() {
    const def = rules.creatures.get(creatureId)
    if (!def) return
    let effectUid: string | undefined
    if (spell.concentration) {
      const current = c.activeEffects.find((e) => e.uid === c.concentration)
      if (current && current.refId === spell.spellId) effectUid = current.uid
      else {
        // Starting another Concentration effect ends the first (Rules Glossary "Concentration", p. 180).
        if (current?.concentration) c.activeEffects = c.activeEffects.filter((e) => e.uid !== current.uid)
        const e = summonEffect(spell, spellName(spell.spellId))
        c.activeEffects.push(e)
        c.concentration = e.uid
        effectUid = e.uid
      }
    }
    const list = c.summons ?? []
    for (let i = 0; i < qty; i++) list.push(newSummon(spell, def, slot, variant, effectUid))
    c.summons = list
    pruneSummons(c)
  }

  function dismiss(s: Summon) {
    c.summons = (c.summons ?? []).filter((x) => x.uid !== s.uid)
  }
  function damage(s: Summon, n: number) {
    if (!(n > 0)) return
    const fromTemp = Math.min(s.hp.temp, n)
    s.hp.temp -= fromTemp
    s.hp.current = Math.max(0, s.hp.current - (n - fromTemp))
  }
  function heal(s: Summon, n: number) {
    if (!(n > 0)) return
    s.hp.current = Math.min(s.hp.max, s.hp.current + n)
  }
  function setRounds(s: Summon, v: string) {
    const n = Math.floor(Number(v))
    if (v === '' || !(n > 0)) delete s.rounds
    else s.rounds = n
  }
  let amounts = $state<Record<string, number>>({})

  const variantName = (spellId: string, v?: string) => summonSpell(spellId)?.variants?.find((x) => x.id === v)?.name
  function spellPopup(id: string) {
    const sp = rules.spells.get(id)
    if (sp) openPopup({ title: sp.name, html: sp.text, source: sp.source, noteKey: `spell:${id}` })
  }
  const durationText = (rounds: number): string =>
    rounds >= 10 && rounds % 10 === 0
      ? `${rounds} ${tr({ en: 'rd', fr: 'rd', es: 'as.' })} (${rounds / 10} min)`
      : `${rounds} rd`
</script>

{#if avail.length || summons.length}
  <section class="box wide summons">
    <h3>{tr({ en: 'Summoned creatures', fr: 'Créatures convoquées', es: 'Criaturas invocadas' })}</h3>

    {#if avail.length}
      <div class="add">
        <label
          >{tr({ en: 'Spell', fr: 'Sort', es: 'Conjuro' })}
          <select value={spell.spellId} onchange={(e) => (form.spellId = e.currentTarget.value)}>
            {#each avail as s (s.spellId)}
              <option value={s.spellId}>{tr(spellName(s.spellId))} ({spellLevel(s.spellId)})</option>
            {/each}
          </select>
        </label>
        {#if spell.scales}
          <label
            >{tr({ en: 'Slot level', fr: 'Niveau d’emplacement', es: 'Nivel del espacio' })}
            <select value={slot} onchange={(e) => (form.slot = Number(e.currentTarget.value))}>
              {#each Array.from({ length: 10 - minSlot }, (_, i) => minSlot + i) as l (l)}
                <option value={l}>{l}</option>
              {/each}
            </select>
          </label>
        {/if}
        {#if creatures.length > 1}
          <label
            >{tr({ en: 'Creature', fr: 'Créature', es: 'Criatura' })}
            <select value={creatureId} onchange={(e) => (form.creatureId = e.currentTarget.value)}>
              {#each creatures as id (id)}
                <option value={id}>{tr(rules.creatures.get(id)?.name)}</option>
              {/each}
            </select>
          </label>
        {/if}
        {#if spell.variants}
          <label
            >{tr(
              spell.spellId === 'animate-objects'
                ? { en: 'Size', fr: 'Taille', es: 'Tamaño' }
                : { en: 'Form', fr: 'Forme', es: 'Forma' },
            )}
            <select value={variant} onchange={(e) => (form.variant = e.currentTarget.value)}>
              {#each spell.variants as v (v.id)}
                <option value={v.id}>{tr(v.name)}</option>
              {/each}
            </select>
          </label>
        {/if}
        <label
          >{tr({ en: 'Number', fr: 'Nombre', es: 'Número' })}
          <input
            type="number"
            min="1"
            max={count ?? 10}
            value={qty}
            onchange={(e) => (form.qty = Number(e.currentTarget.value))}
          />
        </label>
        <button class="main" onclick={summon}>{tr({ en: 'Summon', fr: 'Convoquer', es: 'Invocar' })}</button>
      </div>
      <p class="hint">
        <button class="link" onclick={() => spellPopup(spell.spellId)}>{tr(spellName(spell.spellId))}</button>
        {#if spell.concentration}· {tr(UI.concentration)}{/if}
        {#if spell.rounds}· {durationText(spell.rounds)}{/if}
        {#if count !== undefined}
          · {tr({
            en: `Up to ${count} with this slot`,
            fr: `Jusqu’à ${count} avec cet emplacement`,
            es: `Hasta ${count} con este espacio`,
          })}{/if}
        {#if spell.note}· {tr(spell.note)}{/if}
      </p>
    {/if}

    {#if summons.length}
      <ul class="list">
        {#each summons as s (s.uid)}
          {@const def = rules.creatures.get(s.creatureId)}
          {#if def}
            {@const ac = summonAc(def, s.slotLevel)}
            {@const attacks = summonAttacks(def, s.slotLevel, s.variant, summonCaster(sheet, s.spellId))}
            {@const multi = summonSpell(s.spellId)?.scales && def.ac === null ? undefined : multiattack(def)}
            {@const vName = variantName(s.spellId, s.variant)}
            <li class="card" class:down={s.hp.current <= 0}>
              <div class="head">
                <strong class="name">{tr(def.name)}{vName ? ` (${tr(vName)})` : ''}</strong>
                <button class="link meta" onclick={() => spellPopup(s.spellId)}
                  >{tr(spellName(s.spellId))} · {tr({ en: 'slot', fr: 'emplacement', es: 'espacio' })}
                  {s.slotLevel}</button
                >
                <span class="num">{tr(UI.acShort)} {ac ?? '—'}</span>
                <span class="num hp" class:zero={s.hp.current <= 0}
                  >{tr(UI.hpShort)} {s.hp.current}{s.hp.temp ? ` (+${s.hp.temp})` : ''} / {s.hp.max}</span
                >
                <span
                  class="rounds"
                  title={tr({
                    en: 'Rounds left (blank = no set duration)',
                    fr: 'Rounds restants (vide = pas de durée fixée)',
                    es: 'Asaltos restantes (vacío = sin duración fija)',
                  })}
                >
                  {#if s.rounds !== undefined}<button
                      aria-label="−1"
                      onclick={() => setRounds(s, String(s.rounds! - 1))}>−</button
                    >{/if}
                  <input
                    type="number"
                    min="1"
                    inputmode="numeric"
                    placeholder="∞"
                    value={s.rounds ?? ''}
                    onchange={(e) => setRounds(s, e.currentTarget.value)}
                    aria-label={tr({ en: 'Rounds left', fr: 'Rounds restants', es: 'Asaltos restantes' })}
                  />
                  <small>{tr({ en: 'rd', fr: 'rd', es: 'as.' })}</small>
                </span>
                <button class="del" onclick={() => dismiss(s)}
                  >{tr({ en: 'Dismiss', fr: 'Renvoyer', es: 'Despedir' })}</button
                >
              </div>
              <div class="hpctl">
                {#each [1, 5, 10] as n (n)}
                  <button class="dmg" onclick={() => damage(s, n)} aria-label={`${tr(UI.damage)} ${n}`}>−{n}</button>
                {/each}
                {#each [1, 5, 10] as n (n)}
                  <button
                    onclick={() => heal(s, n)}
                    aria-label={tr({ en: `Heal ${n}`, fr: `Soin ${n}`, es: `Curar ${n}` })}>+{n}</button
                  >
                {/each}
                <input
                  type="number"
                  min="1"
                  bind:value={amounts[s.uid]}
                  placeholder="0"
                  aria-label={tr({ en: 'Amount', fr: 'Quantité', es: 'Cantidad' })}
                />
                <button class="dmg" onclick={() => damage(s, amounts[s.uid] ?? 0)}>{tr(UI.damage)}</button>
                <button onclick={() => heal(s, amounts[s.uid] ?? 0)}
                  >{tr({ en: 'Heal', fr: 'Soin', es: 'Curar' })}</button
                >
                <button onclick={() => (s.hp.temp = Math.max(s.hp.temp, amounts[s.uid] ?? 0))}>{tr(UI.tempHp)}</button>
                {#if s.hp.current <= 0}
                  <span class="zero"
                    >{tr({
                      en: '0 HP: the creature disappears (or reverts)',
                      fr: '0 pv : la créature disparaît (ou redevient objet)',
                      es: '0 PG: la criatura desaparece (o vuelve a su forma)',
                    })}</span
                  >
                {/if}
              </div>
              {#if multi}<p class="multi">{tr(multi)}</p>{/if}
              {#if attacks.length}
                <ul class="attacks">
                  {#each attacks as a, i (i)}
                    <li>
                      <strong>{tr(a.name)}{a.count !== undefined ? ` ×${a.count}` : ''}</strong>
                      {#if a.toHit !== undefined}<span class="num">{fmt(a.toHit)}</span>{/if}
                      {#if a.dc !== undefined}<span class="num">{tr({ en: 'DC', fr: 'DD', es: 'CD' })} {a.dc}</span
                        >{/if}
                      <span>{tr(a.hit)}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <CreatureBlock {def} title={tr({ en: 'Stat block', fr: 'Profil', es: 'Perfil' })} />
            </li>
          {/if}
        {/each}
      </ul>
    {:else}
      <p class="hint">
        {tr({ en: 'No creature summoned.', fr: 'Aucune créature convoquée.', es: 'Ninguna criatura invocada.' })}
      </p>
    {/if}
  </section>
{/if}

<style>
  .summons {
    margin-bottom: 1.25rem;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.9rem;
    align-items: flex-end;
  }
  .add label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: var(--font-title);
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
  .add select,
  .add input {
    min-height: 2.6rem;
  }
  .add input[type='number'] {
    width: 4.5rem;
  }
  button {
    min-height: 2.6rem;
  }
  button.main {
    background: var(--frame);
    color: var(--on-frame);
    border-color: var(--frame);
    padding: 0 1rem;
  }
  .hint {
    font-size: 0.88rem;
    color: var(--ink-soft);
    margin: 0.5rem 0 0;
  }
  .link {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    min-height: 0;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule-strong);
    text-underline-offset: 0.2em;
  }
  .link:hover {
    color: var(--accent);
  }
  .list {
    list-style: none;
    margin: 0.8rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
    gap: 0.8rem;
  }
  .card {
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.5rem 0.7rem;
    background: var(--paper);
  }
  .card.down {
    border-color: var(--danger);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.8rem;
  }
  .name {
    font-family: var(--font-title);
    font-weight: 400;
    font-size: 1.1rem;
  }
  .meta {
    color: var(--ink-soft);
    font-size: 0.85em;
  }
  .num {
    font-family: var(--font-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .hp.zero,
  .zero {
    color: var(--danger);
  }
  .rounds {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .rounds input {
    width: 4rem;
    min-height: 2.4rem;
  }
  .rounds button {
    min-width: 2.4rem;
    padding: 0;
  }
  .del {
    margin-left: auto;
    color: var(--ink-soft);
  }
  .hpctl {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin: 0.5rem 0;
  }
  .hpctl button {
    min-width: 2.6rem;
    padding: 0 0.5rem;
  }
  .hpctl input {
    width: 4.5rem;
    min-height: 2.6rem;
  }
  .dmg {
    color: var(--danger);
  }
  .multi {
    margin: 0.2rem 0;
    font-size: 0.92em;
    color: var(--ink-soft);
  }
  .attacks {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
  }
  .attacks li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
    border-bottom: 1px solid var(--rule);
    padding: 0.25rem 0;
  }
</style>
