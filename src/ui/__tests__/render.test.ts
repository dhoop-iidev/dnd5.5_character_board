// Smoke test: the panes render (server-side) for an example character without throwing.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { migrate } from '../../model/migrate'
import { app } from '../../state.svelte'
import General from '../panes/General.svelte'
import Equipment from '../panes/Equipment.svelte'
import Combat from '../panes/Combat.svelte'
import Spells from '../panes/Spells.svelte'
import Companions from '../panes/Companions.svelte'
import Welcome from '../Welcome.svelte'
import { rules } from '../../data/rules'

const example = migrate(
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'guerriere-niveau-5.json'), 'utf8')),
)

describe('panes render', () => {
  it('welcome screen', () => {
    const body = render(Welcome).body
    expect(body).toContain('SRD 5.2.1')
    // Creation starts here and goes on in the Builder (ui/Builder.svelte).
    expect(body.match(/<input/g)?.length).toBeGreaterThanOrEqual(2)
  })
  it('general, equipment, combat and spells panes for the example character', () => {
    app.character = example
    app.loaded = true
    const general = render(General).body
    expect(general).toContain('Brienne de Valcourt')
    expect(general).toContain('Champion')
    expect(render(Equipment).body).toContain('Cotte de mailles')
    const combat = render(Combat).body
    expect(combat).toContain('Épée longue')
    expect(combat).toContain('Second souffle')
    expect(render(Spells).body).toBeTypeOf('string')
    expect(render(Companions).body).toContain('compagnons')
  })
  it('druid example: Wild Shape forms at the top of the Spells pane, the familiar in the Companions pane', () => {
    app.character = migrate(
      JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'druidesse-niveau-5.json'), 'utf8')),
    )
    app.loaded = true
    const spells = render(Spells).body
    expect(spells).toContain('Forme sauvage')
    expect(spells).toContain('Loup')
    expect(spells.indexOf('Forme sauvage')).toBeLessThan(spells.indexOf('Sorts mineurs'))
    const body = render(Companions).body
    expect(body).not.toContain('Formes connues')
    expect(body).toContain('Chouette')
    expect(body).toContain('Repli aérien') // the owl familiar's stat block (known forms open in a popup)
  })
  it('spells pane for the wizard example: one-line summaries, Cast buttons, spellbook level by level', () => {
    app.character = migrate(
      JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'magicien-niveau-10.json'), 'utf8')),
    )
    app.loaded = true
    const body = render(Spells).body
    expect(body).toContain('Grimoire')
    expect(body).toContain('6 / 6')
    expect(body).toContain('Lancer')
    expect(body).toContain(rules.summaries.get('spell:fireball')!.fr)
  })
})
