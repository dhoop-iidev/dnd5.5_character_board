// Smoke test: the printable sheet ("Generate the PDF", ui/PrintSheet.svelte) renders (server-side) for example
// characters, with the numbers and names it should print.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { migrate } from '../../model/migrate'
import { app, view } from '../../state.svelte'
import PrintSheet from '../PrintSheet.svelte'

const load = (file: string) =>
  migrate(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', file), 'utf8')))

describe('printable sheet', () => {
  it('fighter: identity, AC, abilities, skills, weapons', () => {
    app.character = load('guerriere-niveau-5.json')
    app.loaded = true
    const body = render(PrintSheet).body
    expect(body).toContain('Brienne de Valcourt')
    expect(body).toContain('Champion')
    expect(body).toContain('Épée longue')
    expect(body).toContain('Jet de sauvegarde')
    expect(body).toContain('Perception passive')
    expect(body).toContain(`>${view.sheet.ac.total}<`)
    expect(body).toContain('Harmonisation')
  })
  it('druid: spellcasting, slots and Wild Shape forms', () => {
    app.character = load('druidesse-niveau-5.json')
    app.loaded = true
    const body = render(PrintSheet).body
    expect(body).toContain('Incantation')
    expect(body).toContain('DD de sauvegarde des sorts')
    expect(body).toContain('Forme sauvage')
    expect(body).toContain('Loup')
  })
  it('every level-10 example renders in both languages', () => {
    for (const f of [
      'barbare',
      'barde',
      'clerc',
      'druide',
      'ensorceleuse',
      'guerrier',
      'magicien',
      'moine',
      'occultiste',
      'paladine',
      'rodeur',
      'voleuse',
    ]) {
      app.character = load(`${f}-niveau-10.json`)
      app.loaded = true
      expect(render(PrintSheet).body).toContain(app.character.identity.name)
      app.character.settings.lang = 'en'
      expect(render(PrintSheet).body).toContain('Saving Throw')
    }
  })
})
