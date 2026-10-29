// A background that fixes its feat's spell list: the Sage's Magic Initiate (Wizard), SRD 5.2.1 p. 84.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { rules } from '../../data/rules'
import { migrate } from '../../model/migrate'
import { validate } from '../validate'

it('Sage with a Druid Magic Initiate list is flagged', () => {
  const c = migrate(
    JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'examples', 'druidesse-niveau-5.json'), 'utf8')),
  )
  expect(validate(c, rules).some((x) => x.id === 'background-feat-list')).toBe(false)
  c.background.feat.choices = { ...c.background.feat.choices, list: 'druid' }
  const w = validate(c, rules).find((x) => x.id === 'background-feat-list')
  expect(w?.message.en).toContain('Wizard')
  expect(w?.message.es).toBeTruthy()
})
