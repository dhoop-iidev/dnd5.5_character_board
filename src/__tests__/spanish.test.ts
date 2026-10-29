// Spanish (SP_SRD_CC_v5.2.1.pdf): the language switch falls back to English when a text has no `es`, and key entries
// of the generated SRD data carry their official Spanish names and text.
import { describe, expect, it } from 'vitest'
import { rules } from '../data/rules'
import type { Character } from '../model/character'
import { app, tr, trIn } from '../state.svelte'
import { fmtDistance, fmtWeight } from '../ui/format'

describe('Spanish language', () => {
  it('falls back to English when the Spanish text is missing or empty', () => {
    expect(trIn({ en: 'Alert', fr: 'Vigilant' }, 'es')).toBe('Alert')
    expect(trIn({ en: 'Alert', fr: 'Vigilant', es: '' }, 'es')).toBe('Alert')
    expect(trIn({ en: 'Alert', fr: 'Vigilant', es: 'Alerta' }, 'es')).toBe('Alerta')
    expect(trIn({ en: 'Alert', fr: 'Vigilant', es: 'Alerta' }, 'fr')).toBe('Vigilant')
    expect(trIn(undefined, 'es')).toBe('')
  })

  it('tr() follows the character language setting', () => {
    const before = app.character
    app.character = { settings: { lang: 'es' } } as unknown as Character
    try {
      expect(tr({ en: 'Rage', fr: 'Rage', es: 'Furia' })).toBe('Furia')
      expect(tr({ en: 'Rage', fr: 'Rage' })).toBe('Rage')
    } finally {
      app.character = before
    }
  })

  it('uses metric units like French', () => {
    expect(fmtWeight({ lb: 3, kg: 1.5 }, 'es')).toBe('1,5 kg')
    expect(fmtDistance({ ft: 30, m: 9 }, 'es')).toBe('9 m')
    expect(fmtDistance({ ft: 30, m: 9 }, 'en')).toBe('30 ft')
  })

  it('key SRD entries have their Spanish name, text and page', () => {
    const fireball = rules.spells.get('fireball')!
    expect(fireball.name.es).toBe('Bola de fuego')
    expect(fireball.text.es).toMatch(/\S/)
    expect((fireball.source as { esPage?: number }).esPage).toBeGreaterThan(113)
    const rage = rules.classes.get('barbarian')!.features.find((f) => f.id === 'barbarian:rage')!
    expect(rage.name.es).toBe('Furia')
    expect(rage.text.es).toMatch(/\S/)
    expect(rules.weapons.get('longsword')!.name.es).toBe('Espada larga')
    expect(rules.feats.get('alert')!.name.es).toBe('Alerta')
    expect(rules.conditions.get('poisoned')!.name.es).toBe('Envenenado')
    expect(rules.damageTypeNames.fire.es).toBe('fuego')
  })
})
