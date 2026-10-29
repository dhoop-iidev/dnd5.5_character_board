<script lang="ts">
  // The picks of the custom background (house rule #3, `model/customBackground.ts`): an optional name, three different
  // abilities for the +2/+1 or +1/+1/+1, two different skills, one tool and one Origin feat, the parts of an SRD
  // background (SRD 5.2.1 p. 83). Used by the welcome screen and by the Origin block of the progression.
  import { rules } from '../data/rules'
  import type { AbilityId, I18n, SkillId } from '../data/types'
  import { ABILITIES } from '../data/types'
  import { ABILITY_NAMES } from '../engine/sheet/common'
  import type { CustomBackground } from '../model/character'
  import { originFeats, toolList } from '../model/customBackground'
  import { tr, view } from '../state.svelte'

  let { custom, featId, onfeat }: { custom: CustomBackground; featId: string; onfeat: (id: string) => void } = $props()

  const byName = <T extends { name: I18n }>(list: T[]) => [...list].sort((a, b) => tr(a.name).localeCompare(tr(b.name)))
  const skills = $derived(byName([...rules.skills.values()]))
  const tools = $derived(byName(toolList(rules)))
  const feats = $derived(byName(originFeats(view.rules)))

  /** Picking a value already used in another box swaps the two, so the picks stay different. */
  function pick<T>(list: T[], i: number, v: T) {
    const other = list.indexOf(v)
    if (other >= 0 && other !== i) list[other] = list[i]
    list[i] = v
  }
</script>

<div class="custom">
  <p class="sub">
    {tr({
      en: 'Custom background (house rule #3): three abilities, two skills, one tool and one Origin feat of your choice; equipment: 50 GP.',
      fr: 'Historique personnalisé (règle maison n° 3) : trois caractéristiques, deux compétences, un outil et un don d’origine au choix ; équipement : 50 po.',
      es: 'Trasfondo personalizado (regla de la casa n.º 3): tres características, dos habilidades, una herramienta y una dote de origen a elegir; equipo: 50 po.',
    })}
  </p>
  <div class="fields">
    <label class="wide">
      {tr({ en: 'Name', fr: 'Nom', es: 'Nombre' })}
      <input
        type="text"
        bind:value={custom.name}
        placeholder={tr({ en: 'Custom background', fr: 'Historique personnalisé', es: 'Trasfondo personalizado' })}
      />
    </label>
    {#each [0, 1, 2] as i (i)}
      <label>
        {tr({ en: 'Ability', fr: 'Caractéristique', es: 'Característica' })}
        {i + 1}
        <select
          value={custom.abilities[i] ?? ''}
          onchange={(e) => pick(custom.abilities, i, e.currentTarget.value as AbilityId)}
        >
          <option value="" disabled>—</option>
          {#each ABILITIES as a (a)}<option value={a}>{tr(ABILITY_NAMES[a])}</option>{/each}
        </select>
      </label>
    {/each}
    {#each [0, 1] as i (i)}
      <label>
        {tr({ en: 'Skill', fr: 'Compétence', es: 'Habilidad' })}
        {i + 1}
        <select
          value={custom.skills[i] ?? ''}
          onchange={(e) => pick(custom.skills, i, e.currentTarget.value as SkillId)}
        >
          <option value="" disabled>—</option>
          {#each skills as s (s.id)}<option value={s.id}>{tr(s.name)}</option>{/each}
        </select>
      </label>
    {/each}
    <label>
      {tr({ en: 'Tool', fr: 'Outil', es: 'Herramienta' })}
      <select bind:value={custom.tool}>
        <option value="" disabled>—</option>
        {#each tools as t (t.id)}<option value={t.id}>{tr(t.name)}</option>{/each}
      </select>
    </label>
    <label>
      {tr({ en: 'Origin feat', fr: 'Don d’origine', es: 'Dote de origen' })}
      <select value={featId} onchange={(e) => onfeat(e.currentTarget.value)}>
        <option value="" disabled>—</option>
        {#each feats as f (f.id)}<option value={f.id}>{tr(f.name)}</option>{/each}
      </select>
    </label>
  </div>
</div>

<style>
  .sub {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
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
  .wide {
    flex-basis: 100%;
  }
</style>
