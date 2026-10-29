<script lang="ts">
  // Coat of arms and face drawing. Images are resized in the browser and stored in the character
  // (so they travel with the JSON export), kept small to fit the browser's storage.
  import { app, tr } from '../state.svelte'
  import { imageToDataUrl } from './images'

  type Kind = 'coatOfArms' | 'face'
  // Which pictures to show: the portrait sits at the top of the General pane, the coat of arms beside the background.
  let { kinds = ['face', 'coatOfArms'] }: { kinds?: Kind[] } = $props()
  async function pick(kind: Kind, e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    ;(app.character.images ??= {})[kind] = await imageToDataUrl(file)
    input.value = ''
  }

  function remove(kind: Kind) {
    if (app.character.images) delete app.character.images[kind]
  }

  const LABEL: Record<Kind, { en: string; fr: string; es?: string }> = {
    coatOfArms: { en: 'Coat of arms', fr: 'Blason', es: 'Escudo de armas' },
    face: { en: 'Portrait', fr: 'Portrait', es: 'Retrato' },
  }
</script>

<div class="portraits" class:single={kinds.length === 1}>
  {#each kinds as kind (kind)}
    {@const src = app.character.images?.[kind]}
    <figure class={kind}>
      <div class="frame">
        {#if src}
          <img {src} alt={tr(LABEL[kind])} />
        {:else if kind === 'coatOfArms'}
          <!-- Placeholder: heater shield with a simple division -->
          <svg viewBox="0 0 100 120" aria-hidden="true">
            <path
              d="M10 8 H90 V58 C90 88 70 104 50 114 C30 104 10 88 10 58 Z"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            />
            <path d="M50 8 V114 M10 52 H90" stroke="currentColor" stroke-width="1" opacity="0.5" />
          </svg>
        {:else}
          <!-- Placeholder: head and shoulders -->
          <svg viewBox="0 0 100 120" aria-hidden="true">
            <ellipse cx="50" cy="44" rx="20" ry="25" fill="none" stroke="currentColor" stroke-width="2.5" />
            <path
              d="M14 116 C16 88 32 78 50 78 C68 78 84 88 86 116"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            />
          </svg>
        {/if}
      </div>
      {#if kind === 'coatOfArms'}
        <input
          class="motto"
          bind:value={app.character.identity.motto}
          placeholder={tr({ en: 'Motto…', fr: 'Devise…', es: 'Lema…' })}
          aria-label={tr({ en: 'Motto', fr: 'Devise', es: 'Lema' })}
        />
      {/if}
      <figcaption>
        <span>{tr(LABEL[kind])}</span>
        <label class="btn">
          {src
            ? tr({ en: 'Change', fr: 'Changer', es: 'Cambiar' })
            : tr({ en: 'Add image', fr: 'Ajouter une image', es: 'Añadir imagen' })}
          <input type="file" accept="image/*" onchange={(e) => pick(kind, e)} hidden />
        </label>
        {#if src}<button
            class="btn"
            onclick={() => remove(kind)}
            aria-label={tr({ en: 'Remove', fr: 'Retirer', es: 'Quitar' })}>✕</button
          >{/if}
      </figcaption>
    </figure>
  {/each}
</div>

<style>
  .portraits {
    display: grid;
    grid-template-columns: 1.25fr 1fr;
    gap: 1rem;
    align-items: end;
  }
  .portraits.single {
    grid-template-columns: 1fr;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .frame {
    display: grid;
    place-items: center;
    aspect-ratio: 5 / 6;
    border: 1.5px solid var(--frame);
    border-radius: 3px;
    background: var(--paper);
    color: var(--rule-strong);
    overflow: hidden;
  }
  .face .frame {
    border-radius: 50% 50% 3px 3px / 30% 30% 3px 3px;
  }
  .frame svg {
    width: 55%;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .face img {
    object-fit: cover;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-title);
  }
  figcaption span {
    flex: 1;
  }
  .btn {
    font-family: var(--font-body);
    font-size: 0.9rem;
    min-height: 2.5rem;
    min-width: 2.5rem;
    padding: 0 0.6rem;
    display: inline-grid;
    place-items: center;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    background: var(--box);
    color: var(--ink);
    cursor: pointer;
  }
  .motto {
    width: 100%;
    font: inherit;
    font-style: italic;
    font-size: 1.05rem;
    text-align: center;
    min-height: 2.4rem;
    border: none;
    border-bottom: 1px solid var(--rule-strong);
    background: transparent;
    color: var(--ink);
  }
</style>
