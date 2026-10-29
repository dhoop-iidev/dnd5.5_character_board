// The example characters in examples/ are legal builds: the app shows no warning of any severity for them; a few spot values.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { compute } from '../compute'
import { validate } from '../validate'

const DIR = join(__dirname, '..', '..', '..', 'examples')

describe('examples/', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  it('has at least one example', () => expect(files.length).toBeGreaterThan(0))
  for (const f of files) {
    it(`${f} is legal`, () => {
      const c = migrate(JSON.parse(readFileSync(join(DIR, f), 'utf8')))
      const bad = validate(c, rules)
      expect(bad.map((w) => `${w.id}: ${w.message.en}`)).toEqual([])
    })
  }
  it('guerriere-niveau-5: fighter 5, Champion, chain mail + shield + Defense', () => {
    const c = migrate(JSON.parse(readFileSync(join(DIR, 'guerriere-niveau-5.json'), 'utf8')))
    const s = compute(c, rules)
    expect(s.level).toBe(5)
    expect(s.pb).toBe(3)
    expect(s.abilities.str.score.total).toBe(19) // 15 + 2 (Soldier) + 2 (ASI)
    expect(s.hpMax.total).toBe(10 + 2 + 4 * (6 + 2)) // d10 max + Con, then fixed 6 + Con ×4 (Con 15 → +2)
    expect(s.ac.total).toBe(16 + 2 + 1) // chain mail, Shield, Defense fighting style
    expect(s.attacksPerAction).toBe(2)
    const sword = s.attacks.find((a) => a.weapon.id === 'longsword')!
    expect(sword.attack.total).toBe(4 + 3)
    expect(sword.mastery.usable).toBe(true)
    expect(s.resources.find((r) => r.id === 'fighter:second-wind')?.max).toBe(3)
    expect(s.resources.find((r) => r.id === 'fighter:action-surge')?.max).toBe(1)
  })
})
