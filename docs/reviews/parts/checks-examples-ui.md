# Um, actually… — review of 2026-10-25 (part: rule checks, examples, tests, UI wording)

Scope: `src/engine/validate.ts`, `src/engine/checks/*.ts` (build, equipment, spells, companions), `examples/*.json`,
`src/engine/__tests__/*.test.ts`, rule-stating strings in `src/ui/**/*.svelte`, `src/i18n/ui.ts` and the check messages.
Other parts (engine stages, data) are covered by other reviewers.

Sources used: `sources/SRD_CC_v5.2.1.pdf` (EN pages via `tools/srd_find.py`), `sources/FR_SRD_CC_v5.2.1.pdf` (FR pages, plus
`sources/extracted/fr.json`), `sources/dnd-5e-srd-markdown/*.md` (English wording), `docs/house-rules.md` (empty: pure SRD),
`docs/rules/core-formulas.md`, `docs/rules/rulings-data.md`.

Reproductions: a temporary Vitest file `src/engine/__tests__/zz_um_actually_repro.test.ts` (deleted after the run) built
characters with `newCharacter()` and ran `compute()` / `validate()`; the lines quoted below ("got") are its output.
`npm test -- src/engine/__tests__/zz_um_actually_repro.test.ts`: 10 tests, all passed (they only logged values).

## Meaningful

### M1. Um, actually… a Rogue with Dex 16 can take a Fighter level: the Fighter's primary ability is Strength **or** Dexterity
- Rule: "To qualify for a new class, you must have a score of at least 13 in the primary ability of the new class and your
  current classes." — SRD 5.2.1 p. 24 (FR p. 26). The Fighter's Core Traits table: "Primary Ability: Strength or
  Dexterity" — p. 47 (FR p. 56 "caractéristique principale : force ou dextérité").
- Code: `src/engine/checks/build.ts:103-111` — `need` collects every ability of every class's `primaryAbility` and flags
  each one below 13. `classes.json` stores the Fighter as `primaryAbility: ['str', 'dex']`, the Monk as `['dex', 'wis']`,
  the Paladin as `['str', 'cha']`, the Ranger as `['dex', 'wis']`: the data can't tell "or" (Fighter) from "and" (Monk,
  Paladin, Ranger), and the check treats all of them as "and".
- Repro: Human Rogue 1 (Dex 16, Str 10) + Fighter 1 → got
  `multiclass-2|error|Level 2: multiclassing into Fighter needs 13+ in Strength, Dexterity (Strength too low).`;
  expected no warning (Dex 16 ≥ 13 satisfies "Strength or Dexterity"). The reverse (Fighter 1 Str 16 / Dex 10 → Rogue)
  is rightly flagged (Rogue needs Dex 13), so only the Fighter side is wrong.
- Fix: give the Fighter's prerequisite an "any of" semantics (e.g. `primaryAbility: { any: ['str','dex'] }` or a
  `primaryAbilityMode: 'or'`) and test `some` instead of `every` for it; keep "all" for Monk, Paladin and Ranger.

### M2. Um, actually… at level 4 you may take *any* feat you qualify for: an Origin feat is legal, not an "error"
- Rule: each class's Ability Score Improvement feature: "You gain the Ability Score Improvement feat (see 'Feats') or
  another feat of your choice for which you qualify." — SRD 5.2.1 p. 29 (Barbarian), p. 48 (Fighter), p. 38 (Druid)…
  (FR p. 31, 57, 45 "un autre don de votre choix"). And the Feats chapter: "If you're instructed to choose a feat and no
  category is specified, you can choose from any category." — p. 87 (FR p. 92 "vous pouvez le choisir dans n'importe
  quelle catégorie"). Origin feats have no prerequisite, so they always qualify; a Fighting Style feat qualifies for a
  character with the Fighting Style feature (p. 87–88).
- Code: `src/engine/checks/build.ts:62-63` — `if (asi && !boon && f.category !== 'general')` pushes an **error** "an
  Ability Score Improvement level grants a General feat". Also the wording of `feat-missing` (line 55: "choose a General
  feat") and the Epic Boon branch (line 60: allows only `epic-boon` or `general`, so an Origin feat at level 19 is also
  flagged, although "another feat of your choice for which you qualify" applies there too, p. 48 "Level 19: Epic Boon").
- Repro: Human Fighter 4 (Champion) with `feat: { featId: 'alert' }` at level 4 → got
  `feat-cat-4|error|Level 4: an Ability Score Improvement level grants a General feat; Alert is a origin feat.`; expected
  no warning (Alert is a legal pick; it is even the classic level-4 choice for a Fighter without Dex).
- Fix: at an ASI level accept any category whose prerequisites are met (the General level 4+ prerequisite is already
  checked separately); at level 19 accept any category too. Keep the error only for a Fighting Style feat without the
  Fighting Style feature (already covered by `feat-prereq-feature`). Reword `feat-missing` to "choose a feat (Ability
  Score Improvement by default)".

### M3. Um, actually… a Human gets an Origin feat *and* a skill: the app gives a Human nothing, and flags the skill as an error
- Rule: "Skillful. You gain proficiency in one skill of your choice." and "Versatile. You gain an Origin feat of your
  choice (see 'Feats'). Skilled is recommended." — SRD 5.2.1 p. 86 (FR p. 90 "Compétent" / "Polyvalent"). "Resourceful.
  You gain Heroic Inspiration whenever you finish a Long Rest." — same page.
- Code: `src/data/srd/species.json` (human traits `human:skillful`, `human:versatile` have no `grants`/`choices`),
  `src/data/custom/effects.json` (no `human:*` entry), `src/model/character.ts` (`speciesChoices: Record<string, string>`
  has no feat slot; `grantedSkills()` in `src/engine/sheet/skills.ts:14-26` reads only class picks, background, level and
  feat choices), `src/engine/checks/build.ts:112-116` (`skills-count` compares `skillProficiencies.length` with the first
  class's count only). Nothing asks for the Human's feat; nothing accepts the Human's skill.
- Repro: Human Fighter 1 vs Dwarf Fighter 1, same build → got identical sheets: feats `["savage-attacker"]`, 4 proficient
  skills for both; `validate()` on the Human gives `[]` (no "choose your Origin feat / your skill" warning). Adding the
  Skillful skill to `skillProficiencies` → got `skills-count|error|Fighter: choose 2 skill proficiencies (3 chosen).`
  Both example characters (`examples/guerriere-niveau-5.json`, `examples/druidesse-niveau-5.json`) are Humans built this
  way: each is missing one Origin feat and one skill proficiency, and `examples.test.ts` calls them legal.
- Impact at the table: a feat's numbers (Alert: +PB initiative; Skilled: three proficiencies; Magic Initiate: two
  cantrips and a spell) and a +PB skill are simply absent; a player who adds the skill is told it's illegal.
- Fix: model the Human's choices (a `speciesFeat: FeatPick` or a feat entry under `speciesChoices`, and a species skill
  pick counted in `skills-count`), emit an actionable warning when they are missing, and add them to both examples (then
  update the expected values in `examples.test.ts` if the chosen feat changes a number).

## Minor

### m1. The Fighter example wakes up with 49 current HP for a 44 maximum
- Rule: Fighter 5, Con 15 (+2): 10 + 2 at level 1, then 4 × (6 + 2) = 44 — SRD 5.2.1 p. 22–23. The test
  `examples.test.ts` expects `10 + 2 + 4 * (6 + 2)` = 44 (correct).
- Code/data: `examples/guerriere-niveau-5.json` `"hp": { "current": 49, … }`.
- Repro: `compute()` on the example → got `hpMax 44`, `hp.current 49`. No check flags current > max.
- Fix: set `current` to 44 (and consider clamping/flagging `hp.current > hpMax` in `checks/build.ts` or the HP engine).

### m2. The Druid example's Magic Initiate has no list, cantrips or spell, and no check asks for them
- Rule: "Two Cantrips. You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list… Level 1 Spell.
  Choose a level 1 spell from the same list… You always have that spell prepared." — SRD 5.2.1 p. 87 (FR p. 92). Sage:
  "Feat: Magic Initiate (Wizard)" — p. 83.
- Code: `src/engine/checks/build.ts:14-26` checks only `background.feat.featId === bg.feat`; feat `choices` are never
  validated (Magic Initiate list/cantrips/spell, Skilled's three proficiencies). `examples/druidesse-niveau-5.json` has
  `"feat": { "featId": "magic-initiate" }` with no `choices`.
- Repro: → got `bg feat choices undefined`; druid cantrips `3 / 3` (the two Magic Initiate cantrips and the always-prepared
  level 1 spell appear nowhere). `validate()` → no warning.
- Fix: a check "Magic Initiate: choose a list, two cantrips and one level 1 spell" (and "Skilled: choose 3"), and fill
  the example's choices (e.g. Wizard: Fire Bolt, Mage Hand, Shield… the SRD text says "Wizard" for the Sage).

### m3. Prepared spell level is checked against the *combined* slots, not per class
- Rule: "Spells Prepared. You determine what spells you can prepare for each class individually, as if you were a
  single-classed member of that class." — SRD 5.2.1 p. 25 (FR p. 27).
- Code: `src/engine/checks/spells.ts:9` `const maxSlotLevel = now.slots.length` and line 21 `highest = … maxSlotLevel`
  for every non-pact class.
- Repro: Wizard 4 / Paladin 1 (slots `[4,3,2]`, caster level 5) with *Lesser Restoration* (level 2 Paladin spell)
  prepared as a Paladin → got `[]`; expected a `spell-level-paladin-lesser-restoration` warning (a Paladin 1 prepares only
  level 1 spells: Paladin table p. 54).
- Fix: compute each class's highest slot level from its own table row (`def.table[cl-1].slots`) and compare to that.

### m4. Boon of Spell Recall's "Spellcasting Feature" prerequisite is never checked
- Rule: "Epic Boon Feat (Prerequisite: Level 19+, Spellcasting Feature)" — SRD 5.2.1 p. 88 (FR p. 93).
- Code: `src/data/srd/feats.json` → `boon-of-spell-recall.prereq = { text, level: 19 }` without `feature: 'spellcasting'`,
  so `build.ts:72` (`p?.feature === 'spellcasting'`) never fires. (Data belongs to another reviewer; the check is blind
  because of it.)
- Repro: Fighter 19 with Boon of Spell Recall → got `[]`; expected `feat-prereq-feature-19`.
- Fix: add `feature: 'spellcasting'` to the feat's prerequisite in `tools/build_feats.py`.

### m5. Weapon Mastery count is shown in the editor but never checked
- Rule: Fighter "Weapon Mastery… three kinds of Simple or Martial weapons of your choice" (p. 48), 4 at level 4, 5 at 10,
  6 at 16 (Fighter Features table p. 47); Barbarian 2 (p. 29), Paladin 2, Ranger 2, Rogue 2.
- Code: `src/ui/LevelEditor.svelte:68` computes `masteryMax` for display only; no checker reads `char.weaponMastery`.
- Repro: Fighter 8 with 5 masteries (table: 4) → got no warning (`ability-cap-str` only, which is correct for Str 21).
- Fix: `weapon-mastery-count` warning in `checks/build.ts` (sum of the `weaponMastery` columns), plus "only weapons you are
  proficient with" for the Rogue/Paladin wording when relevant.

### m6. A non-repeatable feat can be taken twice
- Rule: "Repeatable. A feat can be taken only once unless its description states otherwise in a 'Repeatable'
  subsection." — SRD 5.2.1 p. 87 (FR p. 92). Grappler has no Repeatable subsection.
- Code: `checks/build.ts` has no duplicate-feat test; `feats.json` carries `repeatable: true` for Ability Score
  Improvement, Magic Initiate and Skilled only.
- Repro: Fighter 8 with Grappler at levels 4 and 8 → got no warning; feats list `["savage-attacker","alert","grappler",
  "ability-score-improvement","grappler"]`.
- Fix: flag a second pick of any feat without `repeatable`, across background, species (M3), level and Fighting Style
  slots.

### m7. The Fighting Style choice accepts any feat, and applies it
- Rule: "Level 1: Fighting Style. You have honed your martial prowess and gain a Fighting Style feat of your choice (see
  'Feats')." — SRD 5.2.1 p. 48 (FR p. 56 "le don de Style de combat de votre choix").
- Code: `src/engine/sheet/build.ts:85-87` adds whatever feat id sits in `choices['fighter:fighting-style']`; no check of
  its category, and no warning when the choice is missing.
- Repro: Fighter with `'fighter:fighting-style': 'alert'` → got Alert applied (initiative 0 + PB 3 = 3) and no warning.
- Fix: check `category === 'fighting-style'` for that choice and warn when the feature's choice is empty.

### m8. Expertise count is not checked
- Rule: Rogue "Level 1: Expertise… two of your skill proficiencies… At Rogue level 6, you gain Expertise in two more" (p. 61);
  Bard level 2 and 9 (p. 32).
- Code: `checks/build.ts:120-124` only verifies proficiency in the skill; `LevelEditor.svelte:69` shows a maximum.
- Repro: Rogue 1 with Expertise in four skills → got `[]`.
- Fix: compare `char.expertise.length` with the same `expertiseMax` formula (move it into the engine).

### m9. The spellbook may hold non-Wizard spells, and they bypass the list check
- Rule: "Copying a Spell into the Book. When you find a level 1+ Wizard spell, you can copy it into your spellbook if it's
  of a level you can prepare…" — SRD 5.2.1 p. 78 (FR p. 61).
- Code: `checks/spells.ts:28` `!list.has(id) && !(sc.spellbook && sc.spellbook.includes(id))` — any spell in the spellbook
  is accepted as preparable; the spellbook's contents themselves are never validated.
- Repro: Wizard 1 with *Cure Wounds* in the spellbook and prepared → got `[]`; expected a "not a Wizard spell" warning.
- Fix: validate each spellbook entry against the Wizard list (level ≥ 1), then let the list check trust the spellbook.

### m10. Skills from a multiclass dip are counted as an error
- Rule: "As a Multiclass Character… proficiency in one skill of your choice from the Rogue's skill list" (Rogue p. 61,
  FR p. 84); the Bard (p. 31) and Ranger (p. 57, FR p. 80) say the same.
- Code: `checks/build.ts:112-116` compares with `first.skillChoices.count` only, although `classes.json` already stores
  `multiclass.skills: 1` for bard, ranger and rogue.
- Repro (by reading): a Fighter 5 / Rogue 1 with 2 + 1 chosen skills gets `skills-count|error|Fighter: choose 2 skill
  proficiencies (3 chosen).`
- Fix: add `multiclass.skills` of every later class (and the Human's skill, M3) to the allowed count.

### m11. One copy only: two *Rings of Protection* can both be attuned
- Rule: "you can't attune to more than one copy of an item. For example, you can't attune to more than one Ring of
  Protection at a time." — SRD 5.2.1 p. 177 ("No More Than Three Items", FR p. 188).
- Code: `checks/equipment.ts:15-21` counts attuned items (≤ 3, worn only) and "doesn't require Attunement"; no same-item
  test. Also an item attuned while `carried` is not counted toward the three (line 15 filters `location === 'worn'`).
- Fix: group attuned items by `refId`; count attuned items in every location.

### m12. "Choose a subclass" at level 3 fires even when it was noted at level 1
- Code: `checks/build.ts:42` tests `cl === 3 && !l.subclassId` on the level-3 entry only; `sheet/build.ts:33` takes a
  `subclassId` from any level.
- Repro: Fighter 3 with `subclassId` on the level-1 entry → got the Champion features *and*
  `subclass-fighter|warning|Fighter level 3: choose a subclass.`
- Fix: look for the subclass across the class's levels; warn when it is set before class level 3 ("You gain a Fighter
  subclass of your choice" is the level 3 feature, p. 48).

### m13. French terms that aren't the official SRD ones
Checked against `FR_SRD_CC_v5.2.1.pdf` with `srd_find.py` (20 terms sampled; the ones below differ):
- "Magie **du** pacte" (`src/i18n/ui.ts` `pactSlots`, `src/ui/panes/Spells.svelte:84`, `checks/build.ts:74`) → the PDF
  says "Magie **de** pacte" (FR p. 24, 27, 69–71, 75); "Magie du pacte" appears nowhere.
- "Trouver un familier" (`src/engine/companions.ts:120`, `checks/companions.ts:34`, `companions.ts:102`) → the spell is
  "**Appel de familier**" (FR p. 45, 61, 117; `spells.json` already uses that name).
- "Trouver une monture" (`checks/companions.ts:51-53`) → "**Appel de destrier**" (FR p. 77–78).
- "Monture d'outremonde" (`checks/companions.ts:51`, `Companions.svelte:233`) → the French text writes
  "d'**outre-monde**" with a hyphen (FR p. 73, 77, 117); the creature data says "Monture d'outre-monde".
- Correct (for the record): Amélioration de caractéristique, Style de combat, Faveur épique, don général, sorts mineurs,
  Harmonisation, test d20, Dés de vie, Forme sauvage, Compagnon sauvage, Touche-à-tout, Inspiration héroïque, Bottes
  d'arme, Attaque à mains nues, Capacité de charge, armure intermédiaire, Épuisement, Un seul familier, Formes de Bête,
  Valeurs standard, se multiclasser, "réduit la vitesse… de 3 m".

### m14. A Shield without training: the message announces the wrong penalty
- Rule: "Shield. You gain the Armor Class benefit of a Shield only if you have training with it." — SRD 5.2.1 p. 92
  (FR p. 98); Rules Glossary "If you use a Shield and lack training with it, you don't gain its AC bonus." — p. 177.
  Disadvantage and "no spells" apply to Light, Medium or Heavy armor only (same paragraphs).
- Code: `src/engine/checks/equipment.ts:11` — `shield-training` says "Disadvantage on Strength and Dexterity D20 Tests,
  no spellcasting" (FR "Désavantage aux tests d20…, pas de sorts").
- Repro (by reading): a Wizard (no Shield training) holding a Shield gets that message; expected "no AC bonus from the
  Shield". Whether the engine still adds the +2 is the engine reviewer's call; the check's claim is wrong either way.
- Fix: reword the message, and have the check (or the defense stage) drop the Shield's +2 instead.

## Nitpicks
- `examples/druidesse-niveau-5.json` stores `toolProficiencies: ["Herbalism Kit"]` in English only, while gear data has
  "Matériel d'herboriste"; the Sage's Calligrapher's Supplies (p. 83) is missing from the list. No check counts tools
  (class + background).
- `checks/build.ts:14` message "scores run from 1 to 20 (3–18 before the background)": the three methods on p. 20 give 8–15
  (Standard Array, Point Cost) or 3–18 (4d6); a base score of 19 or 20 passes silently (repro: base Str 20 → only the
  cap warning after the background +2). Consider an informative warning above 18 ("no SRD method produces this").
- `checks/build.ts:88` (Ability Score Improvement +2 one / +1 two) is right, and the engine's cap at 20 is right ("This
  feat can't increase an ability score above 20", p. 87).
- `Welcome.svelte:84` cites "SRD p. 20" for the ability-score methods: correct (p. 20–21).

## Checked and correct
- Feat-or-ASI levels: Fighter 4, 6, 8, 12, 14, 16 and Rogue 4, 8, 10, 12, 16 in `classes.json` match the Fighter Features
  (p. 47) and Rogue Features (p. 59–60) tables; every other class 4, 8, 12, 16; Epic Boon at class level 19 for all twelve.
- Skill proficiency counts and lists: Fighter "Choose 2: Acrobatics, Animal Handling, Athletics, History, Insight,
  Intimidation, Persuasion, Perception, or Survival" (p. 47), Rogue "Choose 4: …" (p. 61), Bard 3 any, Ranger 3 — data
  matches.
- Multiclass prerequisite semantics for the "and" classes (Monk, Paladin, Ranger) and the "both current and new class"
  rule (p. 24); `compute.test.ts` 'multiclass-2' case (Fighter Str 13 / Int 11 → Wizard) is right.
- General feat level 4+ and Epic Boon level 19+ prerequisites, Grappler's "Strength or Dexterity 13+" (`any`), Fighting
  Style feats requiring the feature, prerequisites evaluated with the sheet at the level taken (p. 87 "Prerequisite").
- Background: +2/+1 or +1/+1/+1 among the three listed abilities, fixed Origin feat, two skills (p. 20, p. 82–83); the
  four backgrounds' abilities/feats/skills match p. 83.
- Attunement ≤ 3 (p. 177), "doesn't require Attunement" warning, hands (Two-Handed = 2, Shield = 1), heavy armor
  Strength → Speed −10 ft / 3 m (p. 92, FR p. 98), armor training wording for Light/Medium/Heavy (p. 92).
- Prepared / cantrip counts against the class table row; cantrip-level check; unknown spell/class/subclass/feat errors.
- Companions: Beast Shapes table (p. 42), familiar forms and "One Familiar Only" (p. 130), Pact of the Chain forms
  (p. 74), Find Steed slot level.
- Test expectations recomputed by hand and all right: level-1 Fighter (Str 17 → +3, HP 13, saves +5/+5/+2, AC 12,
  Athletics +5, passive Perception 12, carry 255 lb, Unarmed +5 / 4), chain mail 16 + Shield 2, Str 12 → Speed 20,
  rapier Dex 17 → +5, breastplate Dex cap 2 → 16, Barbarian 10 + 2 + 3 + 2 = 17, Monk 15 with or without Shield, Dwarven
  Toughness +1, Alert +PB, Rage +2, fixed HP 6 − 1 / 4 − 1 / min 1 = 9 (p. 23), PB +3 at level 5, Cleric 3 / Paladin 2 →
  caster level 4 (half levels rounded **up**, p. 25) → slots [4, 3], DC 14 / attack +6, Warlock 1 pact slot, Bard 1 → 2
  slots, saves from the first class only (p. 25), Exhaustion −2 / −5 ft per level (p. 181).
- Example values in `examples.test.ts`: Fighter 5 Str 19, HP 44, AC 19, 2 attacks, longsword +7, Second Wind 3 (p. 47
  table), Action Surge 1. Druid example: HP 38 = current 38, AC 15 (leather 11 + Dex 2 + Shield 2), 9 prepared / 3
  cantrips at level 5 (p. 41 table), all nine spells on the Druid list, 4 known forms ≤ 6 (CR ≤ 1/2, no Fly), owl familiar
  via Wild Companion (Fey, p. 42).
- UI claims verified word for word: Wild Shape "what you keep" (p. 42 "Game Statistics", "No Spellcasting"), the familiar
  "rolls its own Initiative… can't attack" (p. 130 "Combat"), the steed "shares your Initiative count… controlled mount"
  (p. 130), "AC 10 + 1 per spell level, HP 5 + 10 per spell level" (p. 131), "Pact Magic slots… return on a Short Rest"
  (p. 71), one Wild Shape use back per Short Rest (p. 42).

## Open questions
- Standard Array / Point Cost (8–15) vs rolling (3–18): the save format doesn't record the method, so the check can't
  enforce 27 points or the array. Record `abilityMethod` in the character? (Then Point Cost can be summed with the table
  p. 20.)
- Human size (Medium or Small, p. 86) and other species choices (`speciesChoices`) are not validated; out of this part's
  numbers, listed for completeness.
- Tool proficiencies (class + background + Skilled) have no check; neither do languages (p. 20: "Common and two other
  languages"). Is a count check wanted, given tools are free text?

## Verdict
The core numbers the tests pin down (HP, AC, attacks, saves, slots, resources) are right, and most checks say what the
SRD says. But three legality verdicts are wrong in ways a player meets early: a Fighter dip is refused on Dex, an Origin
feat at level 4 is called an error, and a Human loses a feat and a skill (both shipped examples are affected). Fix M1–M3
before trusting the "No rule issue" line; the Minor items are mostly missing checks rather than wrong ones.
