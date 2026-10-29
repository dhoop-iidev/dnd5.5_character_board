// The player's own content for a character (house rules #4 and #5): custom feats and custom subclasses, merged into a
// per-character copy of the rules. compute() and validate() call it; the UI reads `view.rules`.
import type { Rules } from '../data/rules'
import type { Character } from './character'
import { withCustomFeats } from './customFeats'
import { withCustomSubclasses } from './customSubclasses'

export function withCustom(rules: Rules, char: Pick<Character, 'customFeats' | 'customSubclasses'> | undefined): Rules {
  return withCustomSubclasses(withCustomFeats(rules, char), char)
}
