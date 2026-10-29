# Um, actually… — review of 2026-10-25 (first full review of the 2024 playboard)

Scope: the whole engine (`src/engine/sheet/*`, `stacking.ts`, `hitPoints.ts`, `rests.ts`, `companions.ts`), the rule checks (`src/engine/checks/*`), the generated data (`src/data/srd/*.json`) and `custom/effects.json`, the examples and tests, and the UI texts that state a rule.
Sources used: `sources/SRD_CC_v5.2.1.pdf` (pages via `tools/srd_find.py`), `sources/FR_SRD_CC_v5.2.1.pdf`, `sources/dnd-5e-srd-markdown/`, `docs/house-rules.md` (empty: pure SRD), `docs/rules/*.md`.
Method: four reviewers in parallel, each with temporary Vitest reproductions (run, then deleted) or Python over the JSON. The detailed evidence (rule quote, page, `path:line`, reproduction, fix) is in the four part reports:
`parts/core.md` (core sheet, HP, rests, species), `parts/combat-magic.md` (attacks, spells, resources, companions), `parts/checks-examples-ui.md` (rule checks, examples, UI wording), `parts/data.md` (data against the PDFs).
This file merges them, removes the duplicates and ranks the findings. Nothing has been fixed yet.

## Meaningful (14 distinct findings)

Numbers a player would use at the table, or a legality verdict, are wrong.

### M1. Um, actually… a level 11 Fighter attacks three times, four at level 20
- Rule: "Level 11: Two Extra Attacks… attack three times"; "Level 20: Three Extra Attacks… four times" — SRD 5.2.1 p. 48 (FR p. 57).
- Code: `attacks.ts` reads the flags `two-extra-attacks` / `three-extra-attacks`, but `custom/effects.json` has no entry for `fighter:two-extra-attacks` / `fighter:three-extra-attacks`. Fighter 11 → 2 attacks (expected 3); Fighter 20 → 2 (expected 4).
- Fix: two one-line entries in `effects.json`. (combat-magic M2)

### M2. Um, actually… a Monk's fist is a d6 and uses Dexterity (Martial Arts)
- Rule: "Martial Arts Die… Dexterous Attacks… Unarmed Strikes and Monk weapons" — p. 50 (FR p. 65).
- Code: the `martial-arts` flag is set and read nowhere; Monk 1 Str 10 / Dex 16 → Unarmed Strike +2, damage 1 (expected +5, 1d6 + 3); Quarterstaff uses Str.
- Fix: in the attacks stage, with the flag and no armor/Shield, max(Str, Dex) for Unarmed Strikes and Monk weapons, Martial Arts die from the table column. (combat-magic M3)

### M3. Um, actually… a Monk isn't proficient with a Greatsword
- Rule: Core Monk Traits "Simple weapons and Martial weapons that have the Light property" — p. 49 (FR p. 65).
- Data: `classes.json` monk `weaponProficiencies: ["simple", "martial"]`; `tools/build_classes.py` only maps the Rogue's "Finesse or Light" phrase. A Monk gets +PB with a Greatsword or Longbow.
- Fix: `martial:light` marker in the builder and in `weaponProficient()`. (combat-magic M4 = data M2)

### M4. Um, actually… a Rogue, Paladin or Ranger has Weapon Mastery for two kinds of weapons
- Rule: "the mastery properties of two kinds of weapons of your choice" — Rogue p. 62, Paladin p. 54, Ranger p. 58 (no table column for those three classes).
- Code: `attacks.ts` and `LevelEditor.svelte` count masteries from the table column only → Rogue 1 with a Dagger: mastery never usable, picker shows "1 / 0". No checker reads `char.weaponMastery` at all (five masteries on a Rogue: no warning).
- Fix: count 2 from the feature when no column exists; add a build check (count, and proficiency with the chosen weapon). (combat-magic M1, checks m5)

### M5. Um, actually… every ability score is nailed to 20: Epic Boons go to 30, Primal Champion to 25
- Rule: Epic Boons "to a maximum of 30" — p. 88; Barbarian 20 Primal Champion "+4, to a maximum of 25" — p. 30; Monk 20 Body and Mind — p. 52.
- Code: `core.ts` clamps at 20 + `ability.*.max` parts, and no data ever produces such a part. Fighter 19 + boon: Str 20 → 20 (expected 21); Barbarian 20: Str 20 (expected 24).
- Fix: effects for the seven boons and the two capstones. (core M2)

### M6. Um, actually… the Rogue with Dex 16 may take a Fighter level (Strength **or** Dexterity)
- Rule: p. 24 multiclass prerequisite + Fighter "Primary Ability: Strength or Dexterity" — p. 47.
- Code: `checks/build.ts` treats every `primaryAbility` list as "and"; Rogue 1 (Dex 16, Str 10) + Fighter → error, expected none. Monk, Paladin and Ranger are rightly "and".
- Fix: an "any of" mode for the Fighter in the data and the check. (checks M1)

### M7. Um, actually… at an Ability Score Improvement level you may take *any* feat you qualify for
- Rule: "the Ability Score Improvement feat… or another feat of your choice for which you qualify" — every class, e.g. p. 48; "no category specified → any category" — p. 87.
- Code: `checks/build.ts` makes an Origin feat at level 4 (Alert on a Fighter 4) an error; same at level 19.
- Fix: accept any category whose prerequisites hold (the General "level 4+" prerequisite is already checked). (checks M2)

### M8. Um, actually… a Human gets an Origin feat (Versatile) and a skill (Skillful), and the model has nowhere to put them
- Rule: Human traits — p. 86 (FR p. 90).
- Code: no feat slot for a species feat (`speciesChoices` is read by nothing in the engine); `skills-count` counts the first class only, so entering the Skillful skill is flagged as an error. Both shipped examples are Humans missing a feat and a skill while `examples.test.ts` calls them legal.
- Fix: `speciesFeat: FeatPick` (or a `speciesChoices` feat entry) fed to `addFeat`, a species skill pick counted by `skills-count`, an actionable warning when missing, and update the two examples. (core M5 = checks M3)

### M9. Um, actually… Divine Order and Primal Order exist (Thaumaturge/Magician cantrip, Protector/Warden proficiencies)
- Rule: Cleric Divine Order — p. 37; Druid Primal Order — p. 42.
- Code: the choice is stored (`choices['cleric:divine-order']`, `['druid:primal-order']`) and read nowhere: a Magician druid with 3 cantrips at level 1 is told she has too many (the shipped druid example is a Magician); a Protector cleric in Chain Mail with a Longsword is "not proficient" and gets the armor-training warning.
- Fix: effects keyed on the choice value (`cleric:divine-order=protector` → grants; `=thaumaturge` → +1 cantrip), or a small `engine/classChoices.ts`. (combat-magic M6)

### M10. Um, actually… a Cleric 3 / Wizard 3 has level 3 slots but prepares as two single-classed level 3 casters
- Rule: "as if you were a single-classed member of that class" — p. 25 (FR p. 27).
- Code: `checks/spells.ts` caps a prepared spell's level by the combined multiclass slots: Spirit Guardians + Fireball accepted without warning (expected max level 2 per class).
- Fix: per class, the highest slot of the class's own table row. (combat-magic M5 = checks m3)

### M11. Um, actually… a Circle of the Land Druid picks a land every Long Rest; the data only knows the desert
- Rule: "choose one type of land: arid, polar, temperate, or tropical" with four tables — p. 46 (FR p. 48); Nature's Ward keys on it too.
- Data: `build_classes.py parse_subclass_spells()` keeps the first table only → `classes.json` holds the Arid list; a Polar druid is told Fireball is always prepared.
- Fix: parse the four tables into a keyed structure plus a Long-Rest choice; validator fails when a subclass has several "… Level" tables. (data M1)

### M12. Um, actually… from Bard level 5, Bardic Inspiration comes back on a Short Rest (Font of Inspiration)
- Rule: p. 32 (FR p. 35).
- Code: `effects.json` has `bard:bardic-inspiration` per long rest only and no `bard:font-of-inspiration`; after `shortRest()` the uses stay spent.
- Fix: an entry that flips the resource to `per: 'short'` from Bard 5. (combat-magic M7)

### M13. Um, actually… that chain mail clanks: armor Stealth Disadvantage is data nobody reads; the 15 conditions are text only; Temporary HP survive a Long Rest
Three situational rules whose numbers never move:
- Armor "Stealth: Disadvantage" (p. 92): `armor.json` has `stealthDisadvantage`, no engine file reads it. (core M1)
- Conditions (Grappled/Restrained Speed 0, Poisoned/Frightened Disadvantage, Invisible Advantage on Initiative, Incapacitated, Prone, Blinded… pp. 181–187): `build.ts` looks up `condition:<id>` effects that don't exist in `effects.json`; ticking a condition in the Combat pane changes nothing. (core M4)
- "Temporary Hit Points last until they're depleted or you finish a Long Rest" (p. 18): `longRest()` keeps `hp.temp`. (core M3)
- Fix: an owner for the worn armor with a Stealth disadvantage grant; `condition:*` entries (including a "speed 0" kind); `hp.temp = 0` in `longRest`.

### M14. Um, actually… Boon of Spell Recall requires the Spellcasting feature, and the checker never hears about it
- Rule: "Prerequisite: Level 19+, Spellcasting Feature" — p. 88 (FR p. 93).
- Data: `build_feats.py` looks for the phrase "Spellcasting or Pact Magic Feature", which exists only on p. 23; `feats.json` has no `feature: 'spellcasting'` on the boon, so the ready check in `checks/build.ts` can never fire. A Fighter 19 can take it. (data M3 = checks m4)

## Minor (35, deduplicated)

Right in the common case, wrong elsewhere; or a rarely used rule missing. Details and pages in the part reports.

- HP and rests: Short/Long Rest allowed at 0 HP and revive a dead character (p. 185/187/180); `heal()` revives the dead; massive-damage death not persisted (sheet still says "dying"); Death Saving Throws ignore Exhaustion and save bonuses (p. 180/181); Exhaustion 6 doesn't kill (p. 181); Resourceful (Heroic Inspiration on a Long Rest) not applied. (core m1, m2, m4, m5, m7, m10)
- Conditional Advantage shown even when the condition is off (Rage Str save ▲ while not raging). (core m3)
- Species: Gnomish Cunning, Dwarven Resilience, Fey Ancestry, Dragonborn resistance have no effects; species per-rest uses (Stonecunning, Giant Ancestry, Breath Weapon, Adrenaline Rush, Relentless Endurance…) untracked. (core m7, m8)
- Passive scores ignore the ±5 of Advantage/Disadvantage (p. 186); Mage Armor can't be expressed as an active-effect AC formula. (core m9, m11)
- Multiclass proficiencies: Rogue's Thieves' Tools and Bard's instrument missing from `multiclass` data (p. 61, p. 32); multiclass skill grants (`multiclass.skills: 1`) counted as an error by `skills-count`; Rogue multiclass skill must come from the Rogue list. (core m6, checks m10, data m1)
- Combat: Barbarian mastery is melee-only (Longbow accepted); Innate Sorcery (2/long rest, +1 DC), Uncanny Metabolism, Arcane Recovery, Magical Cunning untracked; Rage toggle works in Heavy armor; Thrown melee weapons get no ranged line; Loading weapons shown with 2 attacks/action and no "enemy within 5 ft" Disadvantage toggle; mastery doesn't require proficiency. (combat-magic m1–m6)
- Checks: non-repeatable feat taken twice not flagged; Fighting Style choice accepts any feat (Alert as a fighting style → +PB Initiative); Expertise count not checked (bard 9 and rogue 6 extra Expertise are text only); spellbook contents not validated against the Wizard list and bypass the list check; attunement "one copy only" (p. 177) not checked and carried attuned items not counted; subclass noted at level 1 still triggers "choose a subclass" at 3; Magic Initiate / feat choices never checked and the granted spells have nowhere to live; Metamagic counts (sorcerer 10/17) text only. (checks m2, m6–m9, m11, m12; data open)
- Data: three invocation prerequisites truncated to "a Warlock Cantrip" (Agonizing Blast, Eldritch Spear, Repelling Blast: "…That Deals Damage"); `spellcasting.ritual = false` for all nine casters, contradicting ruling D4 (the engine doesn't read the flag yet); `rules.json` typicalDcs French strings empty. (data m2–m4)
- UI wording: `shield-training` says Disadvantage/no spells, but a Shield without training just gives no AC bonus (p. 92/177); fighter example `hp.current` 49 above its max 44. (checks m14, m1)
- French terms to align with the official PDF: "Magie du pacte" → "Magie de pacte", "Trouver un familier" → "Appel de familier", "Trouver une monture" → "Appel de destrier", "outremonde" → "outre-monde". (checks m13)

## Nitpicks

- `CLAUDE.md` says a Long Rest restores "half the Hit Dice": SRD p. 185 says all (code and `core-formulas.md` are right).
- Page citations: Wild Shape Temporary HP sentence is p. 43 (code says 42); Rage Damage p. 29 (effects cite 28); Thrown p. 90 (header cites 89); `SRC_TEMP` p. 19 → 18; `character.ts` "p. 15" → 187; `rests.ts` French pages to verify (Long Rest FR p. 199?); `rules.json` source cites p. 23 for tables on pp. 21/23/26.
- Stale "null for the Net" comment in `types.ts` (no Net in SRD 5.2.1); 24 composed French gear names (inn stays, meals, saddles, spellcasting services) not literally on FR pp. 107–108.
- `core-formulas.md` "Versatile dice with two hands" overstates what is computed (only displayed); `grantTempHp` always keeps the higher value where p. 18 lets the player choose; `holds()` silently drops an unknown `when` string (worth a validator check).

## Checked and correct

- Ability modifiers, Proficiency Bonus table, background increases, saves from the first class only and every class's save pair, HP at level 1 and after (fixed and rolled, minimum 1), Hit Dice per class, Dwarven Toughness and Draconic Resilience HP.
- AC: armor table (base, Dex cap, Strength), Shield only when held, one base formula with the player's choice, Barbarian vs Monk Unarmored Defense Shield rule, Draconic Resilience, Defense only in armor. Speed (species, heavy armor, Fast Movement, Unarmored Movement, Exhaustion). Carrying capacity by size and Powerful Build, stored items weigh nothing. Skills (proficiency, Expertise only if proficient, Jack of All Trades not on Initiative in 2024), Alert, Feral Instinct, Danger Sense.
- Stacking (same name → most potent; Advantage/Disadvantage cancel; temp HP don't add). Damage, 0 HP, Death Saving Throws, Stable, Bloodied, instant death arithmetic. Short Rest Hit Dice (roll + Con, min 1) and short-rest regains; Long Rest restores everything the SRD lists.
- Attacks: ability by Finesse/ranged/Thrown, Heavy 13 rule, hands > 2 check, non-Monk Unarmed Strike, Extra Attack non-stacking, Archery/Defense, Rage uses/damage/resistances. Spell save DC and attack, every row of the Multiclass Spellcaster table, half-casters rounded up, Pact Magic separate and short-rest restored, prepared/cantrip counts, all resource columns and rest types (Channel Divinity, Wild Shape, Second Wind, Action Surge, Indomitable, Focus Points, Lay on Hands, Favored Enemy, Sorcery Points).
- Companions: Beast Shapes table, Find Familiar forms, Pact of the Chain forms, Otherworldly Steed AC/HP, the UI claims of the Companions and Spells panes.
- Checks: ASI/feat levels of all 12 classes (Fighter 4/6/8/12/14/16, Rogue 4/8/10/12/16, Epic Boon 19), skill counts and lists, "and" multiclass prerequisites, General level 4+/19+, Grappler and Fighting Style prerequisites, attunement ≤ 3, heavy armor Strength, every expected value of the three test files recomputed by hand.
- Data: every row of the Barbarian, Monk, Warlock, Paladin and Cleric tables; core traits of all 12 classes (except the Monk weapons); Life Domain, Oath of Devotion, Draconic and Fiend spell lists; 10 Metamagic and 28 invocations; rules tables; 9 species sizes/speeds/Darkvision; 4 backgrounds; 17 feats; all 38 weapons and 13 armors; all 339 spell headers checked programmatically against their cited PDF page; all 15 condition texts verbatim; 917/941 French names found on their cited French page.

## Open questions

- Weapon Mastery stacking across classes (Barbarian 1 / Fighter 1 → 5 in the app; the SRD is silent).
- Cleric + Paladin Channel Divinity: one pool or two? (app keeps two; SRD silent).
- Ability-score method (Standard Array / Point Cost) isn't recorded, so the 8–15 / 27-point limits can't be enforced.
- Magic items carry no modifiers or grants yet (a worn *Armor +1* is neither armor nor a bonus); Human size and Goliath Large Form are stored nowhere.
- Species Darkvision is text only (no sense model).

## Verdict

For a plain single-class build between levels 1 and 18 wearing ordinary gear, the static numbers (abilities, saves, HP, AC options, speed, load, skills, slots, DCs, resources) are right and sourced. Don't trust it yet for: any Monk (Martial Arts and proficiencies), a Fighter 11+ (attack count), a Rogue/Paladin/Ranger mastery, a Human's feat and skill, a multiclass Fighter prerequisite or spell levels, level 19–20 scores, conditions ticked in Combat, armor Stealth, and the Circle of the Land spell list. Fix M1–M14 and the review should be re-run on the examples.
