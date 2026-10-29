# Um, actually… — review of 2026-10-25 (part: combat & magic)

Scope: `src/engine/sheet/attacks.ts`, `src/engine/sheet/spells.ts` (+ `engine/checks/spells.ts` where it reads the same numbers), `src/engine/sheet/classes.ts` and `src/data/custom/effects.json`, `src/engine/companions.ts` and `src/engine/checks/companions.ts`.
Sources used: `sources/SRD_CC_v5.2.1.pdf` (pages from `tools/srd_find.py`), `sources/FR_SRD_CC_v5.2.1.pdf` (FR pages), `sources/dnd-5e-srd-markdown/{classes,character-creation,playing-the-game,rules-glossary,spells}.md` for the English wording, `docs/house-rules.md` (empty: pure SRD), `docs/rules/core-formulas.md`, `docs/rules/rulings-data.md`.
Method: every finding was reproduced with a temporary Vitest file (`src/engine/__tests__/um-actually-combat-magic.tmp.test.ts`, run with `npm test -- <file>`, deleted afterwards); the inputs and outputs below are copied from that run. Nothing was fixed or committed.

## Meaningful

### M1. Um, actually… a Rogue, Paladin or Ranger *does* have Weapon Mastery — the app just can't count to two
- Rule: "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows." — Rogue, SRD 5.2.1 p. 62 (FR p. 85); same sentence for the Paladin ("such as Longswords and Javelins", p. 54 / FR p. 77) and the Ranger ("such as Longbows and Shortswords", p. 58 / FR p. 81). Those three classes have **no Weapon Mastery column** in their class table: the count is in the feature text only.
- Code: `src/engine/sheet/attacks.ts:45` — `masteryCount` is the sum of the `weaponMastery` **table column** over the classes, and line 78 sets `mastery.usable = masteryCount > 0 && mastery.has(w.id)`. `src/ui/LevelEditor.svelte:68` computes the same sum for the "x / max" picker, so the Rogue's picker shows "1 / 0".
- Repro: Rogue 1, `weaponMastery: ['dagger']`, dagger in hand → `attacks[0].mastery.usable = false` (expected `true`; `tableValues.rogue = {"sneakAttack":"1d6"}`). Paladin 1 with a Longsword → `false`; Ranger 1 with a Longbow → `false`. Also, `validate()` with **five** masteries on a Rogue returns no mastery warning at all (expected a count warning: 2 allowed) — no checker reads `char.weaponMastery` (`grep weaponMastery src/engine/checks` → nothing).
- Fix: make the count come from the feature (data: `uses`/`count: 2` on `rogue|paladin|ranger:weapon-mastery`, or fall back to 2 when the class has the feature but no column), and add a build check "N weapons chosen, M allowed" + "chosen weapon must be one you're proficient with" (same sentence).

### M2. Um, actually… a level 11 Fighter attacks three times, and four at 20 — the flags exist, the data doesn't
- Rule: "Level 11: Two Extra Attacks. You can attack three times instead of once whenever you take the Attack action on your turn." and "Level 20: Three Extra Attacks. You can attack four times instead of once…" — SRD 5.2.1 p. 48 (FR p. 57).
- Code: `src/engine/sheet/attacks.ts:112-114` reads the flags `two-extra-attacks` / `three-extra-attacks`, but `src/data/custom/effects.json` only defines `fighter:extra-attack` (line 63). The feature ids `fighter:two-extra-attacks` and `fighter:three-extra-attacks` (present in `classes.json`) have no entry, so the flags are never set.
- Repro: Fighter 11 (Champion) → `attacksPerAction = 2`, `pool.flags = ['extra-attack']` (expected 3); Fighter 20 → `2` (expected 4). The Combat pane header prints this number (`Combat.svelte:93`).
- Fix: add `{ "id": "fighter:two-extra-attacks", "flags": ["two-extra-attacks"] }` and `{ "id": "fighter:three-extra-attacks", "flags": ["three-extra-attacks"] }` to `effects.json`.

### M3. Um, actually… a Monk's fist is a d6 and uses Dexterity — Martial Arts is flagged but never applied
- Rule: "Martial Arts Die. You can roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapons… Dexterous Attacks. You can use your Dexterity modifier instead of your Strength modifier for the attack and damage rolls of your Unarmed Strikes and Monk weapons." — SRD 5.2.1 p. 50 (FR p. 65). Monk weapons = Simple Melee weapons and Martial Melee weapons with the Light property (same page); the die grows with the Martial Arts column (`martialArts` in the Monk table).
- Code: `src/engine/sheet/attacks.ts:84-110` builds the Unarmed Strike with `abilities.str` and a flat `1` (`uDmg` line 94), and the weapon lines (line 48-49) only switch to Dex for Finesse weapons; the `martial-arts` flag set by `effects.json:74` is read nowhere (`grep martial-arts src/engine` → only the flag definition).
- Repro: Monk 1, Str 10, Dex 16: `unarmed.attack = 2` (expected Dex 3 + PB 2 = **5**), `unarmed.damage.dice = ""`, `damage.bonus = 1` (expected **1d6 + 3**); Quarterstaff in hand → `ability = 'str'`, `attack = 2` (expected Dex, 5; dice 1d6 is fine since 1d6 = Martial Arts die at level 1, but at Monk 5 it should offer 1d8).
- Fix: in the attacks stage, when the `martial-arts` flag holds and the character wears no armor/Shield, use `max(Str, Dex)` for the Unarmed Strike and for Monk weapons, and show `max(weapon dice, martialArts column)` as the damage dice; the Unarmed Strike dice become the Martial Arts die.

### M4. Um, actually… a Monk is not proficient with a Greatsword (Core Monk Traits)
- Rule: Core Monk Traits, "Weapon Proficiencies: Simple weapons and Martial weapons that have the Light property" — SRD 5.2.1 p. 49 (FR p. 65).
- Code: data `src/data/srd/classes.json` → monk `weaponProficiencies: ["simple", "martial"]` (the generator reads the trait line too loosely); `attacks.ts:26-39` then returns `proficient = true` for any Martial weapon. (The Rogue line "Simple weapons and Martial weapons that have the Finesse or Light property" *is* encoded as `martial:finesse-or-light`, so the mechanism exists.)
- Repro: Monk 1, Str 10, Greatsword in hand → `proficient = true`, `attack = 2`, `proficiencies.weapons = ['simple','martial']` (expected `false`, attack +0, and the "Not proficient" note).
- Fix: `weaponProficiencies: ["simple", "martial:light"]` for the Monk (and teach `weaponProficient()` the `martial:light` key, as for `martial:finesse-or-light`). Pipeline side: `tools/build_classes.py` should map the "that have the Light property" phrase.

### M5. Um, actually… a Cleric 3 / Wizard 3 has level 3 slots but can't *prepare* a level 3 spell
- Rule: "Spells Prepared. You determine what spells you can prepare for each class individually, as if you were a single-classed member of that class… [Ranger 4 / Sorcerer 3] you can't prepare any level 3 spells, nor can you prepare any level 2 Ranger spells." — SRD 5.2.1 p. 25 (FR p. 27).
- Code: `src/engine/checks/spells.ts:8,18` — `highest = now.slots.length` (the **combined** Multiclass Spellcaster slots) is used as the ceiling of a prepared spell's level for every Spellcasting class; the per-class table row (`def.table[cl-1].slots`) is ignored.
- Repro: Cleric 3 / Wizard 3, `spirit-guardians` (level 3) prepared as a Cleric spell and `fireball` as a Wizard spell → `casterLevel = 6`, `slots = [4,3,3]`, spell warnings `[]` (expected `spell-level-cleric-spirit-guardians` and `spell-level-wizard-fireball`: each class alone is level 3 → max spell level 2).
- Fix: per class, `highest = (def.table[classLevel-1].slots ?? []).filter(n => n > 0).length` (Pact Magic: `row.pact.level`, as today).

### M6. Um, actually… Divine Order and Primal Order exist: the Thaumaturge's extra cantrip and the Protector's Martial weapons are ignored
- Rule: Cleric "Divine Order… Protector. Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor. Thaumaturge. You know one extra cantrip from the Cleric spell list." — SRD 5.2.1 p. 37 (FR pp. 38–39). Druid "Primal Order… Magician. You know one extra cantrip from the Druid spell list… Warden… proficiency with Martial weapons and training with Medium armor." — p. 42 (FR p. 44).
- Code: the choice is stored (`LevelEntry.choices['cleric:divine-order']`, the druid example uses `'druid:primal-order': 'magician'`), but nothing reads it: `grep -ri "thaumaturge|protector|magician|warden" src --include=*.ts --include=*.svelte` → no hit outside tests. `spells.ts:39` takes `cantripsMax` from the table only; `attacks.ts:26` and `checks/equipment.ts` take proficiencies from the class lists only.
- Repro: Cleric 1 Thaumaturge with 4 cantrips → `cantripsMax = 3`, warning `cantrips-cleric` (expected none). Cleric 1 Protector with Longsword + Chain Mail → `proficient = false`, `attack = 3` (Str only; expected +PB = 5) and warning `armor-training` (expected none). Druid 1 Magician with 3 cantrips → `cantripsMax = 2`, warning `cantrips-druid` (expected none; the shipped `examples/druidesse-niveau-5.json` is a Magician and would be told she can't take her fourth cantrip).
- Fix: `effects.json` entries keyed on the choice (e.g. `cleric:divine-order=protector` → grants `weapon.martial`, `armor.heavy`; `=thaumaturge` → `modifiers: [{ target: 'cantrips.cleric', value: 1 }]`), or a small `engine/classChoices.ts` as in the 3.5 playboard.

### M7. Um, actually… from Bard level 5 Bardic Inspiration comes back on a Short Rest
- Rule: "Level 5: Font of Inspiration. You now regain all your expended uses of Bardic Inspiration when you finish a Short or Long Rest. In addition, you can expend a spell slot (no action required) to regain one expended use." — SRD 5.2.1 p. 32 (FR p. 35).
- Code: `src/data/custom/effects.json:38-42` — `bard:bardic-inspiration` is `per: 'long'` with no `shortRestRegain`, and `bard:font-of-inspiration` has no entry; `rests.ts:25-34` therefore leaves the uses spent after a Short Rest.
- Repro: Bard 5 (Cha 16), resource `{max: 3, per: 'long'}`; spend 3, `shortRest()` → still `3` spent (expected 0).
- Fix: an entry `bard:font-of-inspiration` that flips the Bardic Inspiration resource to `per: 'short'` (e.g. `uses` override on the same resource id, or a flag the classes stage reads).

## Minor

### m1. Barbarian Weapon Mastery is Melee-only
- Rule: "the mastery properties of two kinds of Simple or Martial **Melee** weapons of your choice" — SRD 5.2.1 p. 29 (FR p. 31). The Fighter's is "Simple or Martial weapons" (p. 48).
- Code: `attacks.ts:78` accepts any weapon id in `char.weaponMastery`; no check.
- Repro: Barbarian 1, `weaponMastery: ['longbow', 'greataxe']`, Longbow in hand → `mastery.usable = true` (expected false).
- Fix: in the M1 check, reject ranged weapons for mastery slots that come from the Barbarian.

### m2. Innate Sorcery has no resource and no +1 to the save DC
- Rule: "The spell save DC of your Sorcerer spells increases by 1… You have Advantage on the attack rolls of Sorcerer spells you cast. You can use this feature twice, and you regain all expended uses of it when you finish a Long Rest." — SRD 5.2.1 p. 65 (FR p. 51).
- Code: no `sorcerer:innate-sorcery` entry in `effects.json`; `classes.ts` builds no resource and `spells.ts` no toggle.
- Repro: Sorcerer 1, Cha 16 → `resources = []`, DC parts `base 8, pb 2, ability 3` with no situational "+1 Innate Sorcery" part (expected a 2/long-rest resource and a toggleable +1 DC / Advantage on spell attacks).
- Fix: `{ "id": "sorcerer:innate-sorcery", "uses": { "count": 2, "per": "long" }, "modifiers": [{ "target": "spell.dc", "value": 1, "when": "toggle:innate-sorcery" }], "grants": [{ "kind": "advantage", "on": "attack.spell", "condition": … }] }` (the `spell.dc` target already exists, `spells.ts:31`). Same gap, lower stakes: Uncanny Metabolism (1/long, p. 51), Arcane Recovery (1/long, p. 78), Magical Cunning (1/long, p. 72) are not tracked as resources either — they are shown as text, which CLAUDE.md allows, so they are listed here for completeness only.

### m3. Rage in Heavy armor
- Rule: "You can enter it as a Bonus Action if you aren't wearing Heavy armor… it ends early if you don Heavy armor" — SRD 5.2.1 p. 28 (FR p. 30).
- Code: the `toggle:rage` part (`effects.json:10`) has no `when: 'no-heavy-armor'`; `modifiers.ts:holds()` can only evaluate one `when`.
- Repro: Barbarian 1 in Chain Mail, Greataxe, `toggles.rage = true` → Rage Damage +2 applies (`damage.bonus = 5`), no combat warning (only `armor-training`).
- Fix: allow a list of `when` conditions, or grey the Rage toggle in the Combat pane while `armor.category === 'heavy'`.

### m4. Thrown weapons have no ranged line
- Rule: "If a weapon has the Thrown property, you can throw the weapon to make a ranged attack… If the weapon is a Melee weapon, use the same ability modifier for the attack and damage rolls that you use for a melee attack with that weapon." — SRD 5.2.1 p. 90 (FR p. 96).
- Code: `attacks.ts:46-83` builds one line per weapon with `kind = w.kind`; a Handaxe/Javelin/Spear/Dagger thrown is a ranged attack (so Archery doesn't apply — correct — but neither do `attack.ranged` parts from other sources, and Rage Damage *does* still apply since it is "an attack using Strength"). The range is shown, the attack bonus for the throw is not computed separately.
- Fix: for Thrown melee weapons, add a second line (or a sub-row) with `kind = 'ranged'` and the same ability.

### m5. Loading vs Extra Attack, and ranged attacks in close combat
- Rule: "You can fire only one piece of ammunition from a Loading weapon when you use an action, a Bonus Action, or a Reaction to fire it, regardless of the number of attacks you can normally make." — p. 90 (FR p. 96). "Ranged Attacks in Close Combat… you have Disadvantage on the roll if you are within 5 feet of an enemy who can see you and doesn't have the Incapacitated condition." — p. 15 (FR p. 16).
- Code: `attacksPerAction` is one number for the whole sheet (`attacks.ts:112`) and the Combat pane header applies it to every weapon, including Loading ones (a Fighter 5 with a Heavy Crossbow reads "2 attacks"); no situational Disadvantage toggle exists for ranged attacks in melee.
- Fix: per-line `attacks` (1 for Loading weapons) and an "enemy within 5 ft" toggle feeding `pool.disadvantage('attack')` for ranged lines.

### m6. Weapon Mastery requires proficiency with the chosen weapon
- Rule: "two kinds of weapons of your choice with which you have proficiency" — Rogue p. 62, Paladin p. 54, Ranger p. 58 (the Barbarian/Fighter wording omits it, but the Fighter is proficient with everything anyway).
- Code: `attacks.ts:78` never consults `weaponProficient()`.
- Repro: covered by M1 (no mastery check exists at all). Listed separately because it survives the M1 fix if only the count is added.

## Nitpicks

- `src/engine/companions.ts:9,33` cite p. 42 for "Temporary Hit Points equal to your Druid level"; the sentence is on p. 43 (the Wild Shape feature spans pp. 42–43). `core-formulas.md` says the same.
- `effects.json:19` cites p. 28 for Rage; the Rage Damage sentence that the modifier encodes is on p. 29 (the feature starts p. 28). Fine for the popup, imprecise for the proof.
- `attacks.ts:1-4` header: "Heavy: Disadvantage without Str/Dex 13" is on p. 89 in the English PDF; the code cites p. 89 correctly but the Thrown rule is quoted as p. 89 too while it prints on p. 90.
- `docs/rules/core-formulas.md` row "Weapon damage": "Versatile dice with two hands" — the engine only *displays* the Versatile dice; it doesn't know whether both hands are free (a Longsword + Shield still shows "1d8 (1d10)"). Not wrong, but the table reads as if the choice were computed.

## Checked and correct

- Attack roll = ability modifier + PB when proficient (p. 7, p. 89); Finesse takes the better of Str/Dex (p. 89; test: Rogue Dex 17 → +5); ranged weapons use Dex.
- Heavy: Disadvantage when Str < 13 (melee) / Dex < 13 (ranged) (p. 89): Fighter Str 12 / Dex 16 → Greatsword flagged, Heavy Crossbow not.
- More than two hands of weapons + Shield → `hands` warning (`checks/equipment.ts:24`), so Two-Handed + Shield is caught.
- Unarmed Strike (non-Monk): Str + PB to hit, 1 + Str Bludgeoning (p. 190).
- Extra Attack from several classes doesn't stack (p. 25): one flag → 2 attacks, whatever the number of classes.
- Archery +2 only on Ranged weapons (p. 87, `when: 'ranged-weapon'`); Defense +1 only in armor (p. 87); Alert adds PB to Initiative (p. 87).
- Rage: uses from the Rages column, one back per Short Rest, all per Long Rest (p. 28); Rage Damage on Strength attacks only (p. 29: `damage.melee.str` is skipped for a Dex Finesse attack); Resistance B/P/S and Advantage on Str checks/saves; table values 2/3/4/5/6 rages and +2/+3/+4 damage match the Barbarian Features table.
- Spell save DC 8 + PB + mod, spell attack PB + mod (p. 23); multiclass slots: full levels + Paladin/Ranger levels ÷ 2 **rounded up** (p. 25) → Cleric 3 / Paladin 1 = level 4 → [4, 3]; Cleric 3 / Paladin 2 = 4 → [4, 3]; the `multiclassSlots` table matches the Multiclass Spellcaster table (checked rows 1–20); a single Spellcasting class keeps its own table; Pact Magic separate (p. 26) and restored on a Short Rest (p. 71); Warlock pact column (1×L1, 2×L1, 2×L2 … 3×L5 at 11, 4×L5 at 17) matches the Warlock Features table.
- Prepared and cantrip counts per class from each class's table, determined per class in a multiclass (p. 25); Wizard 22/25 at 17/20, Bard 19/22, Paladin/Ranger no cantrips.
- Resources: Channel Divinity 2 → 3 (Cleric 6) → 4 (Cleric 18), Paladin 2 → 3 at 11, one back per Short Rest (pp. 37, 54); Wild Shape 2/3/4 at 2/6/17, one back per Short Rest (p. 42); Second Wind 2/3/4 at 1/4/10 (p. 48); Action Surge 1/short, 2 at 17 (p. 48); Indomitable 1/2/3 at 9/13/17 per Long Rest (p. 48); Focus Points = Monk level, back on a Short Rest (p. 50); Lay on Hands 5 × Paladin level per Long Rest (p. 53; Paladin 11 → 55); Favored Enemy 2/3/4/5/6 per Long Rest (p. 58); Sorcery Points = Sorcerer level, all back on a Long Rest (pp. 65–66; `effects.json` cites p. 65, the sentence prints on p. 66); Bardic Inspiration = Cha modifier, minimum 1 (p. 31).
- Unarmored Defense: Barbarian 10 + Dex + Con with a Shield allowed (p. 29), Monk 10 + Dex + Wis without armor or Shield (p. 50), Draconic Resilience 10 + Dex + Cha and +1 HP per Sorcerer level (p. 69: 3 at level 3 then +1 → equals the Sorcerer level); Fast Movement +10 ft outside Heavy armor (p. 29); Danger Sense and Feral Instinct as Advantage grants; Dwarven Toughness +1 HP per level (p. 84).
- Companions: Beast Shapes table 4 / CR 1/4 / no Fly at 2; 6 / 1/2 at 4; 8 / 1 / Fly at 8 (p. 42); duration half the Druid level rounded down (p. 42, p. 5), Temporary HP = Druid level (p. 43); Find Familiar forms (the 11 named animals or any CR 0 Beast) and "One Familiar Only" (p. 130); Pact of the Chain forms = Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite, Venomous Snake (p. 74 — no Slaad Tadpole in the SRD, so the data is right); Wild Companion (spell slot or Wild Shape use, Fey, gone after a Long Rest; p. 42); Otherworldly Steed AC 10 + 1 per spell level, HP 5 + 10 per spell level (p. 131); Find Steed is level 2.
- Multiclass weapon proficiencies: the SRD 5.2.1 puts them in each class's "As a Multiclass Character" list; Monk (Hit Point Die only) and Warlock (Hit Point Die + Light armor) grant no weapons, Barbarian/Fighter/Paladin/Ranger grant Martial weapons — the data matches.

## Open questions

- **Weapon Mastery across classes.** A Barbarian 1 / Fighter 1 gets 2 + 3 = 5 mastery weapons in the app. The SRD has no stacking rule for Weapon Mastery (p. 25 only covers Extra Attack, Spellcasting and AC); the general "same name doesn't stack" rule (Rules Glossary) is about effects. Reading the two features as two separate permissions (5 kinds) seems as defensible as "the most generous applies" (3). Worth a `pending` row in `docs/house-rules.md` if a multiclass martial character ever shows up.
- **Channel Divinity across Cleric and Paladin.** The app keeps two separate pools (`cleric:channel-divinity`, `paladin:channel-divinity`). The SRD 5.2.1 says nothing about combining them (grep "Channel Divinity" + "more than one" → nothing). Two pools is the literal reading; flagging so nobody treats it as settled.
- **Magic Initiate spells.** The feat's two cantrips and level 1 spell have nowhere to live: put under a class's `prepared`/`cantrips` they trip `spell-list-*` and the cantrip count. Out of this part's scope (feats), but it touches the Sorts pane numbers.

## Verdict
Single-class Fighters, Barbarians, Clerics and Druids below level 11 who use the class table's choices get correct attack, DC, slot and resource numbers; the breakdowns and the tables all check out against the PDF. Don't trust the sheet yet for a Monk (fists and weapons), a Rogue/Paladin/Ranger's mastery, a Fighter 11+, a Bard 5+ short rest, a Divine/Primal Order pick, or the "spell level allowed" check of a multiclass caster.
