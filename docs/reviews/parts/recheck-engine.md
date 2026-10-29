# Um, actually… — recheck of the engine after the fixes of 2026-10-25

Scope: the 14 Meaningful findings (M1–M14) and the Minor list of `../um_actually-2026-10-25.md`, then a regression pass over the rewritten engine (`src/engine/sheet/*`, `src/engine/checks/*`, `rests.ts`, `hitPoints.ts`, `companions.ts`) and ten effect entries of `src/data/custom/effects/*.json` read against their SRD sentence.
Sources: `sources/SRD_CC_v5.2.1.pdf` (pages via `tools/srd_find.py`), `sources/dnd-5e-srd-markdown/` (sentences), `docs/house-rules.md` (#1 and #2 pending), `docs/rules/rulings-classes.md` (C1–C7), `docs/effects.md`.
Method: one temporary Vitest file (`src/engine/__tests__/zz-recheck-tmp.test.ts`, 16 cases, deleted after the run) building characters with `newCharacter()` and reading `compute()` / `validate()` / `shortRest()` / `longRest()` / `takeDamage()` / `deathSave()`; the full suite (18 files, 293 tests) is green. Nothing was fixed; nothing committed.

## Fixed (with the value the engine now gives)

| # | Finding | Reproduction | Status |
|---|---|---|---|
| M1 | Fighter attack count | Fighter 11 → `attacksPerAction` 3; Fighter 20 → 4 (`fighter:two-extra-attacks` / `three-extra-attacks` flags, `attacks.ts:270-272`) | Fixed |
| M2 | Martial Arts | Monk 1, Str 10 / Dex 16, no armor: Unarmed Strike Dex, +5, 1d6 + 3; Quarterstaff Dex +5 1d6 (`attacks.ts:79-80, 103-107, 156-161`) | Fixed |
| M3 | Monk weapon proficiency | Same Monk with Greatsword → not proficient (+0), Longbow → not proficient (+3), Scimitar → proficient (+5); `classes.json` monk `["simple", "martial:light"]`, `weaponProficient()` reads the marker | Fixed |
| M4 | Rogue / Paladin / Ranger mastery | `masteryMax` 2 for each (`mastery: 2` in the effects), 3 for Fighter 1, 2 for Barbarian 1; Rogue with Dagger → `mastery.usable true`; 5 masteries on a Rogue → `mastery-count` error; Dagger + Longbow on a Rogue → `mastery-prof-longbow` warning (`checks/build.ts:433-481`) | Fixed |
| M5 | Scores nailed to 20 | Fighter 20, Str 18, ASI +2 at 4, Boon of Combat Prowess +1 at 19 → 21 (`core.ts:262-337`); `barbarian:primal-champion` and `monk:body-and-mind` give +4 with `ability.*.max` +5 (p. 30, p. 52) | Fixed, **but see N1**: the cap is applied once to the total, not increase by increase |
| M6 | Fighter "Strength or Dexterity" | Rogue 1 (Dex 18, Str 10) + Fighter → no `multiclass` warning; Rogue + Paladin (Str 10, Cha 10) → `multiclass-2` error (`primaryAbilityAny`, `checks/build.ts:300-333`, ruling C3) | Fixed |
| M7 | Any feat at an ASI level | Fighter 4 with Alert → no warning; with Grappler (+1 Str) → no warning (ruling C4) | Fixed |
| M8 | Human Versatile / Skillful | Human Fighter without them → `choice-human:versatile` and `choice-human:skillful` warnings; with `extraFeats['human:versatile'] = alert` and `featureChoices['human:skillful'] = 'insight'` → Alert applied (initiative +2 at level 1), Insight proficient, `feats` lists `alert (species)`; Grappler as Versatile → `choice-human:versatile` error (Origin only). Both Human examples carry the two picks | Fixed |
| M9 | Divine Order / Primal Order | Protector Cleric in Chain Mail with a Longsword → proficient, armor training `light, medium, shield, heavy`, no `armor-training` warning; Thaumaturge Wis 18 → `cantripsMax` 4 (3 + 1), Arcana +4 (Int 0 + Wis min 1, p. 37); Magician Druid with 3 cantrips → `cantripsMax` 3, no `cantrips-druid` warning | Fixed |
| M10 | Per-class spell level | Cleric 3 / Wizard 3 → slots [4, 3, 3], `maxSpellLevel` 2 for each class, Spirit Guardians and Fireball both flagged `spell-level-*` (ruling C5) | Fixed |
| M11 | Circle of the Land lands | `classes.json` holds the four lists (arid, polar, temperate, tropical); Polar Druid 5 → always prepared `fog-cloud, hold-person, ray-of-frost, sleet-storm` (+ Speak with Animals from Druidic, p. 42). With no stored choice the engine takes the first land (arid): acceptable, the `spellChoice` block lets the pane change it | Fixed |
| M12 | Font of Inspiration | Bard 5, 2 uses spent → `per: 'short'` after the override, `shortRest()` leaves 0 spent (ruling C6) | Fixed |
| M13 | Armor Stealth / conditions / temp HP | Chain Mail → Stealth `disadvantage`, passive Stealth 5 (−5, p. 186); Grappled and Restrained → Speed 0; Poisoned → Disadvantage on attacks and all checks, Passive Perception 5; Invisible → Advantage on Initiative; Restrained → Disadvantage on Dex saves; Stunned keeps its Speed (right: the 2024 Stunned has no Speed 0, glossary p. 188); `longRest()` → `hp.temp` 0 | Fixed (one data slip in Petrified, see N4) |
| M14 | Boon of Spell Recall prerequisite | Fighter 19 → `feat-prereq-feature-19` error (`feats.json` now has `feature: 'spellcasting'`) | Fixed for the Spellcasting classes; see N10 for Pact Magic |

Minor items of the previous report that are now fixed (reproduced):
- Rests at 0 HP: `canRest` false, `shortRest()` / `longRest()` return false and leave `hp.current` 0 (p. 185, 187). Healing the dead: `heal()` on 3 failures leaves 0 HP, state `dead` (p. 180). Massive damage: 6/12 HP taking 18 → `dead: true` **and** `hpState` `dead` (p. 18). Death Saving Throw: die 10 with Exhaustion 1 (modifier −2 passed by `Combat.svelte:22`) → failure (p. 181). Exhaustion 6 → `dead` (p. 181). Resourceful: Human `longRest()` → `heroicInspiration` true (p. 86).
- Passive scores ±5 with Advantage / Disadvantage (`skills.ts:136-137`, p. 186).
- Species: Gnomish Cunning (Gnome Int save → Advantage), Dwarven Resilience, Fey Ancestry, Dragonborn ancestry resistance, and per-rest uses (Stonecunning PB, Breath Weapon PB, Adrenaline Rush PB / Short Rest, Relentless Endurance 1, Large Form 1, Giant Ancestry PB) are effect entries now.
- Innate Sorcery: resource 2 / Long Rest, toggle +1 to the save DC and Advantage on spell attacks (p. 65).
- Tireless: Ranger 10 with Exhaustion 2 → 1 after `shortRest()` (p. 59).
- Checks: non-repeatable feat twice (Grappler at 4 and 8 → `feat-repeat-grappler` error, p. 87); Alert as a Fighting Style → `fighting-style-1` error and Alert **not** applied (initiative stays +2 = Dex); Expertise count (Rogue 1 with 3 → `expertise-count` error, `expertiseMax` 2); spellbook contents (Cure Wounds in a Wizard's book → `spellbook-list-cure-wounds`); attunement copies and carried attuned items (two Rings of Protection, one carried → `attune-copy-ring-of-protection` error, p. 177); subclass noted at level 1 no longer triggers "choose a subclass" at 3; Magic Initiate / Skilled / Metamagic (3 at Sorcerer 3 → error) / Eldritch Invocation counts and "Level N+" prerequisites (Lifedrinker at Warlock 5 → error) are checked through the generic `choices` machinery; Weapon Mastery count and proficiency checked.
- Boon of Spell Recall `feature: 'spellcasting'` in the data (data m3 of the previous report).

## Still open

| Previous id | Finding | Evidence now | Rank |
|---|---|---|---|
| core m3 | Conditional Advantage lit while the condition is off | Barbarian 1, `toggles.rage` unset → `rollState(abilities.str.save)` = `advantage`, label "Rage (while raging)". `barbarian:rage` grants carry a `condition` but no `when: "toggle:rage"`, and `modifiers.ts:191-205` drops a grant only when its `when` toggle is off. Reckless Attack does it right (`when: "toggle:reckless-attack"`). Same for the three Rage resistances | Minor |
| combat m1 | Barbarian Weapon Mastery is Melee-only (p. 29) | Barbarian 1, `weaponMastery: ['longbow', 'greataxe']` → no warning, Longbow `mastery.usable true` | Minor |
| combat m3 | Rage in Heavy armor (p. 28) | `barbarian:rage` modifier has `when: "toggle:rage"` only; `holds()` still evaluates one condition | Minor |
| combat m4 / m5 | Thrown weapons have no ranged line; Loading weapons shown with the full attack count; no "enemy within 5 ft" toggle (p. 15, 90) | Fighter with a Javelin → one line, `range 30 ft`, `kind melee` | Minor |
| checks m10 (+ core m6, data m1) | Multiclass dip proficiencies | Fighter 1 / Rogue 1 with 3 skills → `skills-count` **error** and `skill-list-stealth` error (the Rogue's skill, p. 61); `classes.json` now has `multiclass.tools` for Bard and Rogue but `assemble.ts:34` reads `toolProficiencies` of the first class only → `proficiencies.tools` = the Soldier's gaming set, no Thieves' Tools; and the new data has `"fr": ""` (CLAUDE.md: every text bilingual) | Minor |
| checks m14 | Shield without training | **Engine confirmed:** Wizard, Dex 14, Shield in hand → AC 14 (`defense.ts:513-519` adds the Shield whatever the training); rule: "You gain the Armor Class benefit of a Shield only if you have training with it" — p. 92 (`equipment.md:598`), expected 12. The message (`checks/equipment.ts:27`) still announces "Disadvantage on Strength and Dexterity D20 Tests, and you can't cast spells" and now adds "a Shield is armor": p. 92 reserves that penalty for "Light, Medium, or Heavy armor" | **Meaningful** (an AC the player reads; promoted from Minor now that the engine side is checked) |
| checks m7 (half) | Missing Fighting Style choice is not flagged | Fighter 1 with `choices: {}` → no warning (`fighter:fighting-style` is `textOnly` with no `choices`) | Minor |
| checks m1 | `examples/guerriere-niveau-5.json` `hp.current` 49 > `hpMax` 44 | `compute()` → 44, file still says 49; no check compares them | Minor |
| checks m13 | French terms | "Trouver un familier" (`companions.ts:127,148`, `checks/companions.ts:90`), "Trouver une monture" / "Monture d'outremonde" (`checks/companions.ts:127,138`, `Companions.svelte:334`), "Magie du pacte" (`checks/build.ts:222`, `i18n/ui.ts:87`, `Spells.svelte:103`) unchanged; the PDF says Appel de familier, Appel de destrier, outre-monde, Magie de pacte | Minor |
| core m11 | A cast *Mage Armor* can't be an active-effect AC formula | `ActiveEffect.modifiers` numeric only (`character.ts:99`); Armor of Shadows works because it is an owner | Minor |
| data m2 | Three invocation prerequisites truncated | `classes.json` still "Level 2+ Warlock, a Warlock Cantrip" for Agonizing Blast, Eldritch Spear, Repelling Blast (p. 72–74 "…That Deals Damage") | Minor |
| data m3 | `spellcasting.ritual` false for all casters against ruling D4 | still `False` ×8 | Minor (unused flag) |
| data m4 | `rules.json` typicalDcs French empty, no `frPage` | still `['', '', '', '', '', '']`, source `{page: 23}` | Minor |
| nitpicks | `CLAUDE.md:34` "half the Hit Dice" (p. 185: all); `hitPoints.ts:9` `SRC_TEMP` p. 19 (sentence p. 18); `character.ts:169` "p. 15" (p. 187); `types.ts:421` "null for the Net"; `companions.ts:9` and `druid:wild-shape` cite p. 42 for the Temporary Hit Points sentence (p. 43: `srd_find` → [43]); `grantTempHp` keeps the higher value automatically (p. 18 lets the player choose); `holds()` still returns false silently for an unknown `when` | Nitpick |

## New findings

### Meaningful

#### N1. Um, actually… an Epic Boon raises the maximum to 30, it doesn't resurrect the +2s you wasted at 20
- Rule: Ability Score Improvement "can't increase an ability score above 20" — p. 87 (`feats.md:65`); Epic Boons "Increase one ability score of your choice by 1, to a maximum of 30" — p. 88; Primal Champion "+4, to a maximum of 25" — p. 30. Each increase is capped when it is applied.
- Code: `core.ts:322-337` sums every part first, then applies one cap: 30 as soon as any Epic Boon touched the ability, else 20 + `ability.*.max`. The `ability-cap-*` warning (`checks/build.ts:351-363`) keys on the cap part, which no longer appears.
- Repro: Fighter 20 (base Str 15 + Soldier 2 = 17), ASI +2 Str at 4, 6 and 8 (raw 23), Boon of Combat Prowess +1 Str at 19 → **Str 24**, no warning; expected **21** (17 → 19 → 20 → 20 → 21) with the level-6/8 picks flagged. Barbarian 20, same ASIs (raw 23) + Primal Champion → **25**, expected **24**. Without the boon the same Fighter reads 20 with the cap warning, so today's fix traded a wrong warning for a wrong number on records that overflow 20.
- Fix: cap at 20 progressively (each increase min(20 − current, value)) before adding the boon / capstone parts, or at least keep the 20-cap on the non-boon parts and let the boon add to the capped value; keep the `ability-cap` warning for overflowing ASIs.

#### N2. Um, actually… a Shield only protects you if you have Shield training (carry-over of m14, engine side now proven)
See "Still open" (checks m14): Wizard with a Shield → AC 14, expected 12 — p. 92. Not introduced today, but the fix for the message added an incorrect "a Shield is armor" claim.

### Minor

#### N3. Martial Arts switches off while a non-Monk weapon is in hand
- Rule: "You gain the following benefits while you are unarmed or wielding only Monk weapons and you aren't wearing armor or wielding a Shield." — p. 50 (`classes.md:5137`).
- Code: `attacks.ts:79` `martialArts = flag && !armor && !shield`; the weapons in hand are not consulted.
- Repro: Monk 1 with only a Greatsword in hand → Unarmed Strike still Dex, 1d6, note "Martial Arts die 1d6"; expected Str, 1 + Str.

#### N4. Petrified: the SRD grants Immunity to the Poisoned *condition*, the data grants Poison damage immunity
- Rule: "_Poison Immunity._ You have Immunity to the Poisoned condition." — p. 186 (`rules-glossary.md:1163`, inside the Petrified entry).
- Data: `conditions.json` `condition:petrified` → `{ "kind": "immunity", "on": "poison" }`; `on` accepts a condition id (`docs/effects.md`).
- Repro: Petrified character → `pool.grants` `immunity:poison`, nothing on `poisoned`.

#### N5. Brutal Strike, Divine Strike and Primal Strike never grow
- Rule: "The extra damage of your Brutal Strike increases to 2d10" (Barbarian 17, p. 30); "The extra damage of your Divine Strike increases to 2d8" (Cleric 14, p. 38); "The extra damage of your Primal Strike increases to 2d8" (Druid 14, p. 43).
- Data: `barbarian:improved-brutal-strike`, `cleric:improved-blessed-strikes`, `druid:improved-elemental-fury` are `textOnly`; the lower entries have a fixed `value`.
- Repro: Barbarian 17 with Reckless Attack on → `extraDamage` "Brutal Strike 1d10"; Cleric 14 Divine Strike → 1d8. `diceByLevel` exists for exactly this.

#### N6. Innate Sorcery's +1 lands on every class's spell save DC
- Rule: "The spell save DC of your Sorcerer spells increases by 1" — p. 65.
- Code: `spells.ts:56` adds `pool.parts('spell.dc')` to each class block.
- Repro: Sorcerer 1 / Wizard 1, Cha 16 / Int 16, toggle on → Sorcerer DC 14 **and** Wizard DC 14 (parts include `sorcerer:innate-sorcery`); expected Wizard 13.

#### N7. Blessed Warrior / Druidic Warrior: the info says the cantrips don't count, the checker counts them
- Rule: Paladin "Blessed Warrior… two Cleric cantrips… count as Paladin spells" — p. 54; Ranger Druidic Warrior — p. 58.
- Code: `checks/build.ts:276` info "add them under the class's cantrips (they don't count against the class limit yet)"; `checks/spells.ts:32-43` compares them with `cantripsMax` 0 (no column).
- Repro: Paladin 2 with Blessed Warrior and two cantrips → `fighting-style-2|info` **and** `cantrips-paladin|warning` ("2 cantrips, 0 allowed").

#### N8. Large Form from level 1
- Rule: "Starting at character level 5, you can change your size to Large…" — p. 86 (`character-origins.md:275`).
- Data: `goliath:large-form` has `uses` and a toggle with no level gate.
- Repro: Goliath Fighter 1 → toggle `large-form` offered, resource `goliath:large-form` listed.

#### N9. Pact of the Blade gives proficiency with the bonded weapon
- Rule: "Until the bond ends, you have proficiency with the weapon" — p. 74 (`classes.md:9181`).
- Code: `attacks.ts:81,108-111` reads the `pact-weapon` flag for Charisma only.
- Repro: Warlock 1 with Pact of the Blade, toggle on, Greatsword → Cha used, `proficient false`, attack +3 instead of +5, `weapon-prof` info shown.

#### N10. Boon of Spell Recall for a Warlock: the SRD says "Spellcasting Feature"
- Rule: "Epic Boon Feat (Prerequisite: Level 19+, Spellcasting Feature)" — p. 88. Pact Magic is a distinct feature (p. 25 distinguishes "the Pact Magic feature from the Warlock class and the Spellcasting feature").
- Code: `checks/build.ts:215-225` tests `sheet.spellcasting.length`, which includes the Pact Magic block, and the message says "requires the Spellcasting or Pact Magic feature" — a claim the SRD doesn't make.
- Repro: Warlock 19 with the boon → no warning. If the table wants Pact Magic to qualify, record it in `docs/house-rules.md`; otherwise warn.

#### N11. Pact of the Chain forms are allowed for any Warlock although invocations are now stored
- Rule: Imp, Pseudodragon… are forms of the Pact of the Chain invocation — p. 74.
- Code: `checks/companions.ts:94` `warlock = classLevels.warlock >= 1`; `featureChoices['warlock:eldritch-invocations']` is never consulted (`CLAUDE.md` still says invocations aren't tracked, which is no longer true).
- Repro: Warlock 1 without the invocation, familiar `imp` → no warning.

#### N12. An extra feat can smuggle an ability increase
- Rule: Origin feats grant no Ability Score Increase (p. 87); the `feat-asi-*` checks (`checks/build.ts:226-264`) run on level feats only.
- Code: `core.ts:310-321` adds `extraFeats[*].abilities` parts unchecked.
- Repro: Human with `extraFeats['human:versatile'] = { featId: 'alert', abilities: { str: 2 } }` → Str 20 (from 18), no warning.

#### N13. Relentless Rage shown as a 1 / Short Rest resource
- Rule: unlimited uses, "Each time you use this feature after the first, the DC increases by 5. When you finish a Short or Long Rest, the DC resets to 10." — p. 30.
- Data: `barbarian:relentless-rage` `uses: { count: 1, per: 'short' }`: after one use the pane reads 0 / 1 as if the feature were spent. The computed DC label is right. A counter of uses (no maximum) or text only would be truer.

### Nitpicks
- `classes.json` `multiclass.tools` French strings empty (`"fr": ""`) for Bard and Rogue.
- `checks/equipment.ts:27-28` "a Shield is armor" / "un bouclier est une armure" justifies a penalty the SRD doesn't apply to Shields (see N2).
- `CLAUDE.md` "Eldritch Invocations are not tracked" is stale (they are, `featureChoices['warlock:eldritch-invocations']`).

## Checked and correct (this pass)
- Ten effect entries against their SRD sentence and page: `cleric:channel-divinity` Divine Spark 1d8 + Wis, 2d8 / 3d8 / 4d8 at 7 / 13 / 18 (p. 37); `monk:deflect-attacks` 1d10 + Dex + Monk level, redirect two Martial Arts dice + Dex (p. 51); `orc:adrenaline-rush` temp HP = PB, PB uses per Short Rest (p. 86); `warlock:fiend-patron:dark-ones-own-luck` 1d10, Cha uses per Long Rest (p. 76); `ranger:roving` +10 ft outside Heavy armor, Climb and Swim = Speed (p. 59); `paladin:aura-of-protection` Cha min +1 on all saves (p. 55); `sorcerer:sorcerous-restoration` half level round down, once per Long Rest (p. 66); `monk:warrior-of-the-open-hand:wholeness-of-body` Martial Arts die + Wis, min 1, Wis uses (p. 52); `condition:stunned` no Speed 0 in 2024 (p. 188); `druid:primal-order` / `cleric:divine-order` texts (p. 42, p. 37). Brutal Strike 1d10 (p. 29), Petrified and Large Form are right apart from N4, N5, N8.
- Heavy property as the 2024 text splits it (Str 13 melee / Dex 13 ranged, p. 89); Monk weapons = Simple Melee + Martial Melee Light (p. 50); Dexterous Attacks optional ("can"); Martial Arts die only when larger ("can roll… in place of").
- Fighter Extra Attack flags, Devouring Blade = two extra attacks (p. 72), Thirsting Blade = Extra Attack non-stacking (p. 25).
- Choices machinery: inline options merge (Divine/Primal Order, Elemental Affinity, Fiendish Legacy, Draconic Ancestry), list options spawn owners with `classId` (Metamagic, invocations; their `spells.always` / `fromChoices` feed the Warlock block: Pact of the Tome cantrips and rituals are always-prepared and uncounted), `feat` choices feed `addFeat` with category enforcement (Versatile → Origin, Champion's Additional Fighting Style → Fighting Style, Lessons of the First Ones → Origin), repeatable check sees them.
- Toggled grants (Reckless Attack, Mindless Rage, Superior Defense, Boon of the Night Spirit, Dragon Wings, Pact weapon) are dropped when the toggle is off; `extraDamage` dice: Sneak Attack column, Frenzy `rageDamage*d6`, Radiant Strikes on melee and Unarmed, Colossus Slayer, Giant Ancestry; `computed` values resolve `pb`, abilities with `:min1`, `<class>Level*n` and `/n`, dice columns (`bardicDie`, `martialArts`) and `diceByLevel`.
- Always-prepared spells: Druidic's Speak with Animals (p. 42), Favored Enemy's Hunter's Mark, Paladin's Smite / Faithful Steed, Words of Creation, subclass lists by class level, Circle of the Land by chosen land; `maxSpellLevel` from the class's own row (Paladin 1 → 1, Warlock → pact level); extra spells of feats and species traits kept out of the class counts.
- Weapon Mastery: counts summed across classes (house rule #1 default), usable only with proficiency; Epic Boon ability increase lists (Irresistible Offense Str/Dex, Spell Recall Int/Wis/Cha, others any) enforced by `feat-asi`.
- Rests: Short Rest refills `per: 'short'` resources and `shortRestRegain` (Rage, Second Wind, Channel Divinity, Wild Shape), Pact slots; Long Rest restores HP, all Hit Dice, Exhaustion −1, every resource and slot, ends temp HP, timed effects and Concentration (p. 185).
- Multiclass: saves from the first class only (p. 25); armor / weapon training of later classes from `multiclass`; prerequisite checked for every class held (p. 24).
- The full suite (293 tests) passes and the twelve `examples/*-niveau-10.json` plus the two level-5 examples are warning-free.

## Verdict
All fourteen Meaningful findings of the morning are fixed and reproduce correctly, and most of the Minor list with them; the sheet is now trustworthy for Monks, Fighters 11+, Rogue/Paladin/Ranger masteries, Humans, Fighter dips, multiclass spell levels, Land Druids, conditions and armor Stealth. Two numbers still need care at the table: a Shield held without Shield training is counted (+2 too many), and a character whose recorded Ability Score Improvements overflowed 20 before an Epic Boon or capstone now reads 3 points too high with no warning (the one regression introduced today). The rest of what is open is situational (Rage arrows lit while not raging, thrown and Loading weapons, multiclass skill/tool dips, three "improved" dice that stay at their first value) or wording and data hygiene.
