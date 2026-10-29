// The player's own content for a character (house rules #4, #5 and #6): custom feats, subclasses and species, merged
// into a per-character copy of the rules. compute() and validate() call it; the UI reads `view.rules`.
import type { Rules } from '../data/rules'
import type { Character } from './character'
import { withCustomFeats } from './customFeats'
import { withCustomSpecies } from './customSpecies'
import { withCustomSubclasses } from './customSubclasses'

export function withCustom(
  rules: Rules,
  char: Pick<Character, 'customFeats' | 'customSubclasses' | 'customSpecies'> | undefined,
): Rules {
  return withCustomSpecies(withCustomSubclasses(withCustomFeats(rules, char), char), char)
}
