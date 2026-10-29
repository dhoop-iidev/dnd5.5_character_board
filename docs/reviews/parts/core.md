# Um, actually… — review of 2026-10-25 (part: core sheet, hit points, rests)

Scope: `src/engine/sheet/{build,modifiers,core,defense,skills,common,assemble}.ts`, `src/engine/stacking.ts`, `src/engine/hitPoints.ts`, `src/engine/rests.ts`, the species traits of `src/data/srd/species.json` and their entries in `src/data/custom/effects.json`.
Sources used: `sources/SRD_CC_v5.2.1.pdf` (pages via `tools/srd_find.py`), `sources/FR_SRD_CC_v5.2.1.pdf`, `sources/dnd-5e-srd-markdown/` (quotes), `docs/house-rules.md` (empty: pure SRD), `docs/rules/core-formulas.md`, `docs/rules/rulings-data.md`.
Reproductions: a temporary Vitest file `src/engine/__tests__/um_core_repro.test.ts` (14 assertions of the SRD value, all failed as described below; 4 sanity checks passed), run with `npm test -- src/engine/__tests__/um_core_repro.test.ts`, then deleted. Each "Repro" below is one of those tests; characters built with `newCharacter()` (Human Soldier unless stated), abilities 10 unless stated.

## Meaningful

### M1. Um, actually… that chain mail clanks: the Stealth column of the Armor table is data nobody reads
- Rule: "**Stealth.** If the table shows 'Disadvantage' in the Stealth column for an armor type, the wearer has Disadvantage on Dexterity (Stealth) checks." — SRD 5.2.1 p. 92 "Equipment > Armor" (FR p. 98 "colonne Discrétion").
- Code: `src/data/srd/armor.json` carries `stealthDisadvantage: true` for Padded, Scale Mail, Half Plate, Ring Mail, Chain Mail, Splint, Plate (correct per the table), but no engine file reads it: `src/engine/sheet/skills.ts:123-126` takes Disadvantage only from `pool.disadvantage('skill.stealth')` / `check.dex`, and `src/engine/sheet/build.ts:97-116` never turns the worn armor into an owner with a `disadvantage` grant. `grep -rn stealth src/engine` hits only the comments of `sheet/types.ts`.
- Repro: Fighter 1, `inventory = [chain-mail worn]` → `rollState(skills.stealth.total)` = `'normal'`; expected `'disadvantage'` (R1).
- Fix: in `buildStage`, when `armor.def.stealthDisadvantage`, push an owner for the armor with `grants: [{ kind: 'disadvantage', on: 'skill.stealth' }]` (the Combat/General panes then show ▼ and the popup names the armor). Note the Mithral armor exception (p. 247) once magic armor is modelled.

### M2. Um, actually… an Epic Boon goes to 30 and Primal Champion to 25: the engine nails every score to 20
- Rule: "**Ability Score Increase.** Increase one ability score of your choice by 1, to a maximum of 30." — every Epic Boon, SRD 5.2.1 p. 88 (FR p. 93–94). "Your Strength and Constitution scores increase by 4, to a maximum of 25." — Barbarian level 20 Primal Champion, p. 30 (FR p. 32); same for Monk level 20 Body and Mind (Dex/Wis), p. 52 (FR p. 67). Only the Ability Score Improvement feat (p. 87) and the background increases (p. 20) stop at 20.
- Code: `src/engine/sheet/core.ts:283-289` — `max = 20 + Σ parts('ability.<id>.max')`, then clamps. Nothing ever produces an `ability.*.max` part: `src/data/custom/effects.json` has no entry for any `boon-of-*` feat, nor for `barbarian:primal-champion` / `monk:body-and-mind` (both feature ids exist in `classes.json`), although the comment on line 283 announces "Primal Champion: 25".
- Repro: Fighter 19 with base Str 20, level-19 feat `boon-of-combat-prowess` `abilities: { str: 1 }` → Str 20, expected 21 (R2). Barbarian 20 with base Str/Con 20 → Str 20, expected 24 (R3; the feature is present in `sheet.features`).
- Fix: give the seven boons an effect `{ modifiers: [{ target: 'ability.<chosen>.max', value: 10 }] }` (or let `FeatDef.category === 'epic-boon'` raise the cap to 30 in `coreStage`), and add `barbarian:primal-champion` / `monk:body-and-mind` entries with `+4` on both scores and `+5` on their `.max`. The checker for the boon's +1 belongs to `checks/build` (other reviewer).

### M3. Um, actually… Temporary Hit Points don't survive a Long Rest
- Rule: "**Duration.** Temporary Hit Points last until they're depleted or you finish a Long Rest." — SRD 5.2.1 p. 18 "Playing the Game > Temporary Hit Points" (FR p. 19).
- Code: `src/engine/rests.ts:205-217` `longRest()` resets current HP, death saves, Hit Dice, resources, slots, Exhaustion, timed effects and Concentration, but never touches `char.hp.temp` (nor `ActiveEffect.tempHp`).
- Repro: `hp.temp = 5`, `longRest()` → `hp.temp` = 5, expected 0 (R4).
- Fix: `char.hp.temp = 0` (and clear `tempHp` on the effects that stay) in `longRest`.

### M4. Um, actually… a Grappled fighter still shows Speed 30: the 15 conditions are text only
- Rule: Grappled and Restrained: "**Speed 0.** Your Speed is 0 and can't increase." — p. 182 / p. 187 (FR p. 187, 194). Poisoned: "You have Disadvantage on attack rolls and ability checks." — p. 186. Frightened: Disadvantage on ability checks and attack rolls while the source is in sight — p. 181. Restrained: Disadvantage on Dexterity saving throws — p. 187. Invisible: "If you're Invisible when you roll Initiative, you have Advantage on the roll." — p. 184. Incapacitated: Disadvantage on Initiative — p. 183. Prone/Blinded/Restrained/Invisible: Advantage or Disadvantage on the character's attack rolls.
- Code: `src/engine/sheet/build.ts:81-84` makes every ticked condition an owner via `rules.effects.get('condition:<id>')`, but `effects.json` has no `condition:*` entry, so a condition changes nothing (only Exhaustion is wired, through `char.exhaustion`). The Combat pane lets the player tick them (`Combat.svelte` `toggleCondition`) and the sheet numbers don't move.
- Repro: `conditions = ['grappled', 'poisoned']` → Speed 30 (expected 0) and Athletics `rollState` `'normal'` (expected `'disadvantage'`) (R12); `conditions = ['invisible']` → Initiative `'normal'`, expected `'advantage'` (R14).
- Fix: add `condition:grappled` / `condition:restrained` (a `speed` override: needs a "set to 0" modifier kind or a `flags: ['speed-0']` read in `defenseStage`), `condition:poisoned` / `condition:frightened` (`disadvantage` on `check.all` and `attack.all`), `condition:restrained` (`disadvantage` on `save.dex`, `attack.all`), `condition:invisible` (`advantage` on `initiative`), `condition:incapacitated` (`disadvantage` on `initiative`), `condition:prone` / `condition:blinded` (`disadvantage` on attacks) to `effects.json`. Speed 0 "can't increase" also means Fast Movement/Unarmored Movement must not add back.

### M5. Um, actually… a Human gets a second Origin feat (Versatile), and the model has nowhere to put it
- Rule: "**Versatile.** You gain an Origin feat of your choice (see 'Feats'). Skilled is recommended." — Human, SRD 5.2.1 p. 86 (FR p. 90).
- Code: `src/engine/sheet/build.ts:66-79` collects feats from `char.background.feat`, each `LevelEntry.feat` and `:fighting-style` choices only; `Character` (`src/model/character.ts`) has no field for a species-granted feat (`speciesChoices` is `Record<string, string>` and is read by nothing in the engine: `grep speciesChoices src/engine` is empty). So a Human who takes Alert through Versatile cannot have +PB on Initiative, and Skilled's three proficiencies can only be entered by hand in `skillProficiencies`.
- Repro: no engine input can express it (model gap). The level-1 count check is the other reviewer's scope.
- Fix: store the Versatile pick as a `FeatPick` (e.g. `speciesFeat?: FeatPick` or `speciesChoices['human:versatile']` → `addFeat(..., 'species')`) and feed it to `addFeat`.

## Minor

### m1. Rests at 0 HP (or dead) still work
- Rule: "To start a Long Rest, you must have at least 1 Hit Point." — p. 185; "To start a Short Rest, you must have at least 1 Hit Point." — p. 187. "A dead creature has no Hit Points and can't regain them unless it is first revived by magic…" — p. 180 (FR p. 174–175).
- Code: `src/engine/rests.ts:205` `longRest` and `:193` `shortRest` have no HP guard; `src/ui/panes/Combat.svelte:63-64` buttons are never disabled.
- Repro: `hp.current = 0`, `deathSaves.failures = 3`, `longRest()` → current 10 (full), expected unchanged (R5).
- Fix: refuse (or disable the buttons) when `hp.current <= 0`, and never when `hpState` is `dead`.

### m2. Death Saving Throws ignore Exhaustion (and any bonus to saving throws)
- Rule: "D20 Tests encompass the three main d20 rolls of the game: ability checks, attack rolls, and saving throws." — p. 180; Exhaustion: "When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level." — p. 181 (FR p. 192 "Tests d20 affectés"). A Death Saving Throw is a saving throw ("Unlike other saving throws, this one isn't tied to an ability score", p. 18), so the 10 threshold applies to the reduced roll; only the 1 and the 20 are read on the die.
- Code: `src/engine/hitPoints.ts:136-152` `deathSave(hp, roll)` compares the raw die with 10; `Combat.svelte:53` passes the die value, no penalty or `save.all` parts.
- Repro: Exhaustion 1, die 10 → success (failures 0), expected failure (R6).
- Fix: `deathSave(hp, roll, modifier)` with `modifier = sheet.exhaustionPenalty + Σ pool.parts('save.all')`; success when `roll + modifier >= 10`, natural 1/20 unchanged.

### m3. Conditional Advantage is always lit: a barbarian who isn't raging shows ▲ on Str saves
- Rule: Rage: "You have Advantage on Strength checks and Strength saving throws" only while the Rage is active — p. 28.
- Code: `src/engine/sheet/modifiers.ts:225-230` pushes every `advantage`/`disadvantage` grant into the pool whatever its `condition`, with no link to `toggle:rage`, while the Rage Damage modifier on line 213-218 is correctly gated by the toggle. `Combat.svelte:87` prints the ▲ from `rollState`.
- Repro: Barbarian 1, `toggles.rage` unset → `rollState(abilities.str.save)` = `'advantage'`, expected `'normal'` (R7). The popup does list "Rage (while raging)", which is why this is Minor.
- Fix: give `GrantSpec` the same `when: 'toggle:rage'` handling as modifiers, and drop a grant whose toggle is off (keep Danger Sense's "unless Incapacitated" as an always-on label).

### m4. Massive damage returns `dead: true` but the sheet keeps saying "make a Death Saving Throw"
- Rule: "When damage reduces a character to 0 Hit Points and damage remains, the character dies if the remainder equals or exceeds their Hit Point maximum." — p. 18.
- Code: `src/engine/hitPoints.ts:107` sets the local `dead` only; `hp.deathSaves` is untouched, and `Combat.svelte:21` ignores the result; `hpState` (`:160-168`) derives "dead" from `failures >= 3` only.
- Repro: max 12, current 6, damage 18 → `dead: true` but `hpState().kind` = `'unconscious'`, expected `'dead'` (R8).
- Fix: on instant death set `hp.deathSaves.failures = 3` (or add `hp.dead = true`) inside `takeDamage`.

### m5. Healing a dead character revives it
- Rule: p. 180 "Dead" (quoted in m1): no HP regained without Raise Dead / Revivify.
- Code: `src/engine/hitPoints.ts:117-124` `heal()` raises `current` and resets the death saves whatever their count.
- Repro: failures 3, `heal(5)` → `hpState` `'bloodied'`, expected `'dead'` (R9).
- Fix: `if (hp.deathSaves.failures >= 3) return` (the GM revives explicitly, e.g. a dedicated "Revive" action).

### m6. Multiclassing into Rogue forgets Thieves' Tools (and the Bard's instrument)
- Rule: "As a Multiclass Character: Gain the following traits from the Core Rogue Traits table: Hit Point Die, proficiency in one skill of your choice from the Rogue's skill list, proficiency with Thieves' Tools, and training with Light armor." — p. 61; Bard: "proficiency with one Musical Instrument of your choice" — p. 32.
- Code: `src/engine/sheet/assemble.ts:223` adds `toolProficiencies` only for `i === 0`; `ClassDef.multiclass` in `classes.json` has `armor`, `weapons`, `skills` but no `tools`. The `skills: 1` field is read by nobody (skills are a flat list in the model; the count check is the other reviewer's scope).
- Repro: Fighter 1 / Rogue 1 → `proficiencies.tools` = `["Choose one kind of Gaming Set…"]` (the Soldier's), no Thieves' Tools (R10).
- Fix: add `multiclass.tools` to the data (Rogue: Thieves' Tools; Bard: one instrument) and push it in `assembleStage`.

### m7. Species traits with a number and no effect entry
- Rule / data: Gnomish Cunning "You have Advantage on Intelligence, Wisdom, and Charisma saving throws." — p. 85 (FR p. 89 "Ruse gnome"), unconditional; Dwarven Resilience (Resistance to Poison, Advantage vs Poisoned) — p. 84; Fey Ancestry (Advantage vs Charmed) — p. 84; Dragonborn Damage Resistance — p. 84; Resourceful "You gain Heroic Inspiration whenever you finish a Long Rest." — p. 86.
- Code: `effects.json` has entries for Dwarven Toughness, Powerful Build and Brave only; `rests.ts` `longRest` never sets `char.heroicInspiration`.
- Repro: Gnome Wizard → Int save `rollState` `'normal'`, expected `'advantage'` (R11); Human, `heroicInspiration = false`, `longRest()` → still false, expected true (R13).
- Fix: `gnome:gnomish-cunning` → `grants: advantage on save.int/wis/cha`; `dwarf:dwarven-resilience`, `elf:fey-ancestry` → `advantage` with a condition (like Brave) + `resistance`; `dragonborn:damage-resistance` → `resistance` on the chosen ancestry; `longRest`: `if (sheet.pool.flags.has('resourceful')) char.heroicInspiration = true`.

### m8. Species per-rest uses are not tracked
- Rule: Stonecunning (PB uses / Long Rest, p. 84), Giant Ancestry (PB uses / Long Rest, p. 85), Adrenaline Rush (PB uses / Short or Long Rest, p. 86), Breath Weapon (PB uses / Long Rest, p. 84), Relentless Endurance, Large Form, Draconic Flight (once / Long Rest, pp. 84–86), lineage spells (PB casts / Long Rest).
- Code: only class features have `uses` in `effects.json`; `classesStage` builds resources from them. Species owners can carry `uses` too (`owner()` in `build.ts` reads `rules.effects` for traits), so data alone fixes it.
- Fix: add `uses: { count: 'pb', per: 'long' }` (etc.) entries for the traits above; Relentless Endurance also deserves a hook in `takeDamage` ("drop to 1 Hit Point instead", p. 86).

### m9. Passive scores ignore Advantage/Disadvantage
- Rule: "A creature's Passive Perception equals 10 plus the creature's Wisdom (Perception) check bonus. If the creature has Advantage on such checks, increase the score by 5. If the creature has Disadvantage on them, decrease the score by 5." — p. 186 (FR p. 197).
- Code: `src/engine/sheet/skills.ts:127` `passive: 10 + total.total`, without reading `total.advantage/disadvantage`.
- Repro: no permanent skill Advantage source exists yet in the data (Rage's is conditional), so no live case; it bites as soon as M1/M4 are fixed (a Poisoned character's Passive Perception should drop by 5).
- Fix: `passive = 10 + total.total + (rollState(total) === 'advantage' ? 5 : rollState(total) === 'disadvantage' ? -5 : 0)`.

### m10. Exhaustion 6 does not kill
- Rule: "You die if your Exhaustion level is 6." — p. 181 (FR p. 192).
- Code: `Combat.svelte:154` caps at 6, `hpState` ignores `char.exhaustion`.
- Fix: `hpState(hp, max, exhaustion)` returns `dead` at 6 (and the pane says so).

### m11. A spell that sets a base AC (Mage Armor, 13 + Dex, p. 143) cannot be expressed as an active effect
- Code: `ActiveEffect.modifiers` (`src/model/character.ts:98`) are numeric parts only; `acFormulas` come from `EffectDef` owners (`modifiers.ts:232`). A player entering Mage Armor as "+3 AC" would stack it on armor, which the spell forbids ("while not wearing armor"). Likely the spells reviewer's area too; listed here because the AC-formula machinery lives in `defense.ts`.
- Fix: allow `ActiveEffect.acFormula` (base 13 + Dex, `noArmor: true`) and push it into `pool.acFormulas`.

## Nitpicks

- `CLAUDE.md` "Long Rest restores HP, **half** the Hit Dice and all resources" — SRD 5.2.1 p. 185: "You regain all lost Hit Points and **all spent Hit Point Dice**". The code (`rests.ts:209`) and `core-formulas.md` are right; the spec sentence is 2014.
- `src/engine/hitPoints.ts:82` `SRC_TEMP` cites p. 19; the "Temporary Hit Points" section and the Long Rest sentence are on p. 18 (`srd_find "Temporary Hit Points last until"` → [18]). `src/model/character.ts:168` comment "SRD 'Short Rest', p. 15" → p. 187.
- `src/engine/rests.ts:174-175` French pages: `srd_find "Repos court"` hits FR p. 198 and "Repos long" FR p. 196 and 199, and "dés de vie dépensés" is on FR p. 199 only; the Long Rest entry is probably FR p. 199 (alphabetical after "Repos court"), not 196. To verify in the French PDF.
- `core.ts:283` comment promises "Primal Champion: 25" that no data delivers (see M2).
- `grantTempHp` (`hitPoints.ts:127`) keeps the higher value automatically; p. 18 says "you decide whether to keep the ones you have or to gain the new ones". Keeping the higher is almost always the choice, but a shorter-lived larger pool is a legitimate reason to refuse; a confirm when `n < hp.temp` would be exact.
- `defenseStage` Initiative (`defense.ts:42`) takes `initiative` and `d20` parts but not `check.dex` / `check.all` parts or Advantage on Dex checks, although "they make a Dexterity check" (p. 13). No current data source is affected (Jack of All Trades correctly does not apply in 2024, p. 32). Future-proofing only.
- `holds()` in `modifiers.ts:161` returns `false` for an unknown `when` string silently; a typo in `effects.json` makes a modifier vanish without a validator error. Worth a `validate_data.py` check of the `when` vocabulary.

## Checked and correct

- Ability modifier floor((score − 10)/2) (p. 6); Proficiency Bonus table +2/+3/+4/+5/+6 by total level (`rules.json`, p. 23); background +2/+1 or +1/+1/+1 added as parts, cap 20 (p. 20).
- Saving-throw proficiencies from the first class only (p. 25); class save pairs in `classes.json` match the Core Traits tables (Barbarian Str/Con, Bard Dex/Cha, Cleric Wis/Cha, Druid Int/Wis, Fighter Str/Con, Monk Str/Dex, Paladin Wis/Cha, Ranger Str/Dex, Rogue Dex/Int, Sorcerer Con/Cha, Warlock Wis/Cha, Wizard Int/Wis).
- Hit points: level 1 = die maximum + Con (p. 22); later levels roll or fixed (half + 1: d6→4, d8→5, d10→6, d12→7) + Con, minimum 1 per level (p. 23 "add the total (minimum of 1)"); one Hit Point Die per class level, pooled per class; `hp.max` parts (Dwarven Toughness = character level, p. 84; Draconic Resilience = Sorcerer level, i.e. 3 at level 3 then +1, p. 69) — sanity tests C1, C3 passed.
- AC: 10 + Dex without armor; armor base with Dex full / max 2 / none (`armor.json` matches the Armor table p. 92, Strength 13/15/15 for Chain Mail/Splint/Plate); Shield +2 only when held; only one base formula, the player's `acChoice` else the best (p. 177); Barbarian Unarmored Defense allows a Shield, Monk's does not (p. 29, p. 50), Draconic Resilience 10 + Dex + Cha (p. 69); Defense +1 only in armor (p. 87).
- Speed: species value (Goliath 35 ft, others 30, p. 84–86); heavy armor below the Strength score −10 ft (p. 92); Fast Movement +10 unless Heavy armor (p. 29); Unarmored Movement from the Monk table, none in armor or with a Shield (p. 51) — C4 passed; Exhaustion −5 ft per level (p. 181).
- Carrying capacity: Str × 15 (Small/Medium), × 7.5 Tiny, Powerful Build one size larger → × 30, drag/lift/push × 2 (table p. 178) — C2 passed; stored items weigh nothing.
- Skills: PB when proficient, ×2 with Expertise only if proficient (p. 181), Jack of All Trades half PB round down on skill checks you lack proficiency in — 2024 wording, not applied to Initiative (p. 32); passive 10 + bonus (p. 186) apart from m9; Exhaustion −2 × level on saves, skills and Initiative (p. 181).
- Alert: +PB to Initiative (p. 87). Feral Instinct: Advantage on Initiative (p. 29). Danger Sense: Advantage on Dex saves (p. 29).
- Stacking: same `effectName` → most potent only (p. 106, p. 8); Advantage and Disadvantage cancel to normal and never stack (p. 8); temporary HP never add (p. 18).
- Hit points at the table: temp HP lost first (p. 18); damage at 0 HP = one failure, two on a Critical Hit, death when ≥ HP maximum (p. 18); massive damage when the remainder ≥ maximum (p. 18); Death Saving Throw 10+ success, 1 = two failures, 20 = regain 1 HP, three successes = Stable and reset, regaining HP resets the saves (p. 18); Bloodied at half or fewer (p. 177); Stable text (1d4 hours, p. 18).
- Short Rest: each Hit Point Die = roll + Con, minimum 1 HP (p. 187); per-Short-Rest resources refill; Rage, Second Wind, Channel Divinity (Cleric and Paladin), Wild Shape regain one use (`shortRestRegain: 1`) as their texts say; Pact Magic slots return. Long Rest: all HP, all Hit Point Dice, Exhaustion −1, all resources and slots (p. 185).
- Multiclass armor/weapon training per the "Becoming a … Multiclass Character" sidebars (Fighter/Paladin/Ranger as a later class: Light, Medium, Shields, Martial weapons — no Heavy; Barbarian: Shields, Martial; Cleric: Light, Medium, Shields; Druid: Light, Shields; Bard/Rogue/Warlock: Light; Monk/Sorcerer/Wizard: nothing).
- Species data: sizes (Gnome and Halfling Small, Human and Tiefling Small or Medium), Darkvision ranges (Dwarf and Orc 120 ft, others 60 ft, Goliath, Halfling and Human none), trait texts match the SRD pages cited.

## Open questions

- Magic items: `magic-items.json` has no `modifiers`/`grants` at all and `build.ts:107-114` treats `kind: 'magic'` items as modifier carriers only, so a worn *Armor +1* or *Animated Shield* is neither armor nor a bonus (the `baseItem` field exists but is unused). This is the equipment reviewer's area; flagged here because `buildStage` is where it would plug in.
- Human size choice (`species.size = ['small','medium']`) is stored nowhere (`speciesChoices` is unused by the engine); it matters only for carrying capacity (same ×15 for Small and Medium), so no number is wrong today.
- Goliath Large Form (p. 85): while Large, carrying capacity would be ×30 for size plus Powerful Build (one size larger again → ×60) and Speed +10; not modelled (text only). Needs a toggle once Large Form has an effect entry.

## Verdict

The static sheet (abilities, PB, saves, HP, AC options, speed, load, skills, Exhaustion) is right for a plain build and the rest/HP bookkeeping follows the 2024 text closely, including the 2024-only details (all Hit Dice back, JoAT not on Initiative). The table-side gaps are in what *changes* a number situationally: armor's Stealth Disadvantage, ticked conditions, temp HP after a Long Rest, and the hard 20 cap that breaks every level-19+ build — fix M1–M5 before trusting the roll-state arrows and any character above level 18.
