// Formulas typed for custom content (house rule #5): sums of numbers, pb, level, ability modifiers and class levels.
import { describe, expect, it } from 'vitest'
import { evalFormula, formulaOk, type FormulaContext } from '../formula'

const ctx: FormulaContext = {
  pb: 4,
  level: 10,
  classLevels: { druid: 8, ranger: 2 },
  mods: { str: 0, dex: 2, con: 1, int: 0, wis: 3, cha: -1 },
}

describe('formulas', () => {
  it('reads sums of terms', () => {
    expect(evalFormula('13 + wis', ctx)).toBe(16)
    expect(evalFormula('5 + rangerLevel*5', ctx)).toBe(15)
    expect(evalFormula('druidLevel/3', ctx)).toBe(2) // rounded down
    expect(evalFormula('pb + level - cha', ctx)).toBe(15)
    expect(evalFormula('wizardLevel', ctx)).toBe(0)
    expect(evalFormula(7, ctx)).toBe(7)
  })
  it('refuses what it cannot read', () => {
    for (const bad of ['13 ++ wis', 'wisdom', '2d6', '13 + ', 'x*2']) expect(evalFormula(bad, ctx), bad).toBeUndefined()
    expect(evalFormula('', ctx)).toBeUndefined()
    expect(formulaOk('')).toBe(true)
    expect(formulaOk('13 + wis')).toBe(true)
    expect(formulaOk('13 + wisdom')).toBe(false)
  })
})
