# Um, actually… — recheck of 2026-10-25 (part: the twelve level-10 examples)

Scope: `examples/*-niveau-10.json` (barbare, barde, clerc, druide, ensorceleuse, guerrier, magicien, moine, occultiste,
paladine, rodeur, voleuse). For each: the key numbers recomputed by hand from the SRD 5.2.1 and compared with
`compute()`; the build's legality checked independently of `validate()`; the French identity and `settings.lang`.

Sources used: `sources/SRD_CC_v5.2.1.pdf` (pages via `tools/srd_find.py`), `sources/dnd-5e-srd-markdown/*.md` (wording),
`sources/FR_SRD_CC_v5.2.1.pdf` (FR pages), `src/data/srd/classes.json` (class tables and spell lists),
`src/data/custom/effects/*.json`, `docs/house-rules.md` (two pending multiclass items, none relevant: all twelve are
single-classed), `docs/rules/rulings-classes.md` (C4, C5, C6, C7 applied as written).

Reproductions: a temporary Vitest file `src/engine/__tests__/zz_recheck_dump.test.ts` loaded each example with
`migrate()` and printed every `compute()` value with its parts and every `validate()` warning; a second temporary file
`zz_recheck_repro.test.ts` ran the two repros quoted below. Both deleted after the run. `validate()` returns **no warning
at all** for the twelve examples (not even `info`), and `examples.test.ts` passes.

## Hand computation vs engine, example by example

Every number below was recomputed by hand; "✓" means the engine agrees.

| Example | Abilities (after background + feats) | HP | AC | Init | Speed | Saves (prof.) | Key attack | DC / slots / counts | Resources |
|---|---|---|---|---|---|---|---|---|---|
| **barbare** (Goliath Barbarian 10, Berserker, Soldier) | Str 15+2+2+1 = 20 ✓, Con 14+1+1 = 16 ✓ | 12+3 + 9×(7+3) = 105 ✓ | Unarmored Defense 10+2+3 = 15 ✓ | +2, Advantage (Feral Instinct) ✓ | 35 + 10 Fast Movement = 45 ✓, +10 Large Form toggle ✓ | Str +9, Con +7 ✓; Danger Sense Adv. Dex ✓ | Greataxe +9, 1d12+5, Rage +3 toggle ✓ (Rage Damage +3 at 9–15), Cleave ✓ | Mastery 4 ✓ | Rages 4, regain 1 on Short Rest ✓; Stone's Endurance PB uses, 1d12+3 ✓; Large Form 1/LR ✓; carry 20×15×2 (Powerful Build) = 600 lb ✓ |
| **barde** (Halfling Bard 10, Lore, Acolyte) | Cha 15+2+2+1 = 20 ✓, Con 13+1 = 14 ✓ | 8+2 + 9×(5+2) = 73 ✓ | Leather 11+2 = 13 ✓ | +2 (Jack of All Trades doesn't apply: no skill, p. 31) ✓ | 30 ✓ | Dex +6, Cha +9 ✓ | Dagger (Finesse) +6, 1d4+2 ✓ | DC 17 ✓; 4/3/3/3/2 ✓; cantrips 4, prepared 15 ✓ (table level 10); Expertise 4 (2 at 2, 2 at 9) ✓; Jack of All Trades +2 ✓ | Bardic Inspiration 5 (Cha), d10, Short Rest (Font of Inspiration) ✓ |
| **clerc** (Dwarf Cleric 10, Life, Sage) | Wis 15+2+2+1 = 20 ✓, Str 15, Con 14 ✓ | 8+2 + 9×(5+2) + 10 Dwarven Toughness = 83 ✓ | Chain Mail 16 + Shield 2 = 18 ✓ (Protector: heavy armor ✓; Str 15 ≥ 13 ✓) | +0 ✓ | 30 ✓ | Wis +9, Cha +5 ✓ | Mace +6, 1d6+2, Blessed Strikes 1d8 ✓ | DC 17 ✓; cantrips 5, prepared 15 ✓; Life Domain 10 always-prepared ✓ | Channel Divinity 3, regain 1 on SR ✓; Divine Spark 2d8+5 ✓; Preserve Life 50 ✓; Divine Intervention 1/LR ✓; Stonecunning PB ✓ |
| **druide** (Gnome Druid 10, Land, Criminal) | Wis 15+2+2 = 19 ✓, Dex 14+2 = 16 ✓ | 73 ✓ | Leather 11+3 + Shield 2 = 16 ✓ | +3 + PB 4 (Alert) = 7 ✓ | 30 ✓ | Int +5, Wis +8 ✓; Gnomish Cunning Adv. Int/Wis/Cha ✓ | Quarterstaff +3, 1d6−1 ✓ | DC 16 ✓; cantrips 4+1 (Magician) = 5 ✓; prepared 15 ✓; Temperate land spells (Misty Step, Shocking Grasp, Sleep, Lightning Bolt, Freedom of Movement, Tree Stride) ✓; Arcana/Nature +Wis (Magician) ✓ | Wild Shape 3, regain 1 on SR ✓, Temp HP 10 ✓, 8 known forms, CR ≤ 1, flying allowed at 8 ✓; Natural Recovery 1/LR ✓; Potent Spellcasting +4 ✓; Land's Aid **3d6** at 10 ✓ (p. 46: "Druid levels 10 (3d6) and 14 (4d6)"); familiar via Wild Companion (Fey raven) legal ✓ |
| **ensorceleuse** (Dragonborn Sorcerer 10, Draconic, Acolyte) | Cha 20 ✓, Wis 14 ✓ | 6+2 + 9×(4+2) + 10 Draconic Resilience (3 at level 3, +1 for levels 4–10) = 72 ✓ | Draconic Resilience 10+2+5 = 17 ✓ | +2 ✓ | 30 ✓ | Con +6, Cha +9 ✓ | Spear +3, 1d6−1 ✓ | DC 17, +1 Innate Sorcery toggle ✓; cantrips 6, prepared 15 ✓; Draconic spells 10 always-prepared ✓; Metamagic 4 (2 at 2, +2 at 10) ✓ | Sorcery Points 10 ✓; Innate Sorcery 2/LR ✓; Sorcerous Restoration 5 ✓; Breath Weapon PB uses, DC 8+2+4 = 14 ✓; Draconic Flight 1/LR ✓ |
| **guerrier** (Dwarf Fighter 10, Champion, Criminal) | Str 15+2+2+1 = 20 ✓, Con 14+2 = 16 ✓, Dex 13+1 = 14 ✓ | 10+3 + 9×(6+3) + 10 = 104 ✓ | Chain Mail 16 + Defense 1 = 17 ✓ | +2 + 4 (Alert) = 6, Advantage (Remarkable Athlete) ✓ | 30 ✓ | Str +9, Con +7 ✓ | Greatsword +9, 2d6+5, crit 19–20 ✓, Graze ✓; 2 attacks ✓ | Mastery 5 ✓ (table level 10); feats at 4, 6, 8 ✓; Additional Fighting Style at 7 ✓ | Second Wind 4, regain 1 on SR, 1d10+10 ✓; Action Surge 1/SR ✓; Indomitable 1/LR, +10 ✓ |
| **magicien** (Gnome Wizard 10, Evoker, Sage) | Int 20 ✓, Con 15 ✓ | 6+2 + 9×(4+2) = 62 ✓ | 10+2 = 12 ✓ | +2 ✓ | 30 ✓ | Int +9, Wis +5 ✓ | Quarterstaff +3 ✓ | DC 17 ✓; cantrips 5, prepared 15 ✓; Scholar: Expertise Arcana +13 ✓; Rock Gnome Mending + Prestidigitation ✓ | Arcane Recovery 1/LR ✓; Empowered Evocation +5 ✓; owl familiar (Fey, 1 HP) via Find Familiar ✓ |
| **moine** (Elf Monk 10, Open Hand, Acolyte) | Dex 15+2+1 = 18 ✓, Wis 15+2+1 = 18 ✓ | 73 ✓ | 10+4+4 = 18 ✓ | +4 ✓ | 30 + 20 Unarmored Movement + 5 Wood Elf = 55 ✓ | Str +4, Dex +8 ✓ | Spear (Monk weapon) +8, Martial Arts die 1d8 +4 ✓; Unarmed 1d8+4 ✓; 2 attacks ✓ | Focus DC 8+4+4 = 16 ✓ | Focus Points 10/SR ✓; Deflect Attacks 1d10+14 ✓; Slow Fall 50 ✓; Wholeness of Body 4 uses, 1d8+4 ✓; Uncanny Metabolism 1/LR ✓. **Lineage spells of levels 3 and 5 missing: see M1** |
| **occultiste** (Tiefling Warlock 10, Fiend, Criminal) | Cha 16+2+2 = 20 ✓, Dex 16 ✓ | 8+2 + 9×(5+2) = 73 ✓ | Armor of Shadows 13+3 = 16 ✓ | +3 + 4 (Alert) = 7 ✓ | 30 ✓ | Wis +5, Cha +9 ✓ | Sickle +3, 1d4−1 ✓ | DC 17 ✓; Pact slots 2 × level 5 ✓; cantrips 4, prepared 10 ✓; invocations 7 ✓ (table), prerequisites met ✓; Pact of the Tome 3 cantrips + 2 level-1 rituals ✓; Fiend spells 10 always-prepared ✓; Contact Other Plane always-prepared (Contact Patron) ✓ | Magical Cunning 1/LR ✓; Dark One's Blessing 15 ✓; Dark One's Own Luck 5 (Cha) /LR ✓; Fiendish Vigor 8 ✓. **Legacy spells of levels 3 and 5 missing: see M1** |
| **paladine** (Dragonborn Paladin 10, Devotion, Acolyte) | Str 16+2 = 18 ✓, Cha 14+2+2 = 18 ✓, Wis 11+1 = 12 ✓ | 10+2 + 9×(6+2) = 84 ✓ | 16 + 2 + 1 (Defense) = 19 ✓ | +0 ✓ | 30 ✓ | all saves +4 Aura of Protection ✓; Wis +9, Cha +12 ✓ | Longsword +8, 1d8/1d10+4, Sacred Weapon +4 toggle ✓, Sap ✓; 2 attacks ✓; no Radiant Strikes before 11 ✓ | DC 16 ✓; 4/3/2 ✓; prepared 9, max level 3 ✓; Devotion spells + Divine Smite + Find Steed always-prepared ✓; Mastery 2 ✓ (C7) | Lay On Hands 50 ✓; Channel Divinity 2, regain 1 on SR ✓; Paladin's Smite 1/LR ✓; Faithful Steed 1/LR ✓; Abjure Foes 4 targets ✓; Aura of Courage (10) / Devotion (7) immunities ✓ |
| **rodeur** (Orc Ranger 10, Hunter, Soldier) | Dex 15+2+1 = 18 ✓, Wis 15+1+2 = 18 ✓ | 84 ✓ | Studded Leather 12+4 = 16 ✓ | +4 ✓ | 30 + 10 Roving = 40, Climb and Swim 40 ✓ | Str +5, Dex +8 ✓ | Longbow +4+4+2 (Archery) = +10, 1d8+4, Colossus Slayer 1d8 ✓, Slow ✓; 2 attacks ✓ | DC 16 ✓; 4/3/2 ✓; prepared 9, max level 3 ✓; Hunter's Mark always ✓; Expertise 3 (Deft Explorer 1 + Expertise 2) ✓; Mastery 2 ✓ | Favored Enemy 4 ✓; Tireless 4 uses (Wis), 1d8+4 ✓; Adrenaline Rush PB uses /SR, Temp HP 4 ✓; Relentless Endurance 1/LR ✓ |
| **voleuse** (Tiefling Rogue 10, Thief, Criminal) | Dex 15+2+2+1 = 20 ✓, Con 14+2 = 16 ✓ | 8+3 + 9×(5+3) = 83 ✓ | Leather 11+5 = 16 ✓ | +5 + 4 (Alert) = 9 ✓ | 30, Climb 30 (Second-Story Work) ✓ | Dex +9, Int +6 ✓ | Shortsword +9, 1d6+5 and Dagger +9, 1d4+5, Sneak Attack 5d6 ✓, Vex / Nick ✓ | Expertise 4 (2 at 1, 2 at 6) ✓; Mastery 2 ✓; feats at 4, 8, **10** ✓ (Rogue table); Cunning Strike DC 17 ✓ | Reliable Talent flag ✓. **Legacy spells of levels 3 and 5 missing: see M1** |

Skill totals: every proficient / Expertise / Jack of All Trades line recomputed for the twelve sheets agrees with the
engine (e.g. bard Deception 5+8 = 13, druid Nature 1+4+4 = 9, ranger Perception 4+8 = 12 and passive 22, cleric Stealth
Disadvantage from Chain Mail). `hp.current` equals the maximum in all twelve files; XP 64 000 = level 10 ✓.

## Meaningful

### M1. Um, actually… a level 10 Wood Elf knows *Longstrider* and *Pass without Trace*, and an Infernal Tiefling *Hellish Rebuke* and *Darkness* — three examples show only the cantrip
- Rule: "When you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table. You always have
  that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when
  you finish a Long Rest." — SRD 5.2.1 p. 84 (Elven Lineage; Wood Elf: Longstrider, Pass without Trace), p. 86 (Fiendish
  Legacy; Infernal: Hellish Rebuke, Darkness) (FR p. 88 "Lignage elfique", p. 91 "Héritage fiélon").
- Code/data: `src/data/custom/effects/species.json` entries `elf:elven-lineage` and `tiefling:fiendish-legacy` encode only
  the level 1 cantrip (`spells.always`) and carry a `textOnly` saying the level 3 and 5 spells "are in the trait text"; no
  `uses` either. `src/engine/sheet/spells.ts` therefore lists nothing else. The gap is declared, but it is a list the
  player uses at the table, and it bites three of the twelve reference builds.
- Repro: `compute(moine-niveau-10)` → `extraSpells` = `[["elf:elven-lineage",["druidcraft"]], ["feat:magic-initiate",…]]`
  and no `elf:elven-lineage` resource; expected Druidcraft, Longstrider, Pass without Trace, each level 1+ spell with one
  free casting per Long Rest. `occultiste` and `voleuse` → `tiefling:fiendish-legacy` = `["fire-bolt"]` only; expected
  Fire Bolt, Hellish Rebuke, Darkness. For the warlock a number follows: Hellish Rebuke sits among the 10 counted
  prepared spells (`preparedMax 10`, `prepared=10`), whereas the trait makes it always prepared and uncounted, so the
  character is entitled to an 11th prepared Warlock spell and the app would flag it.
- Fix: give the lineage/legacy options level-gated `spells.always` (character levels 3 and 5) and a `uses` of 1 per Long
  Rest per spell (or a `byLevel` list), as the Gnome's Speak with Animals already does; then add the spells to the three
  examples (and for the Rogue and Monk, who have no Spellcasting block, make sure the Spells pane shows `extraSpells`).

## Minor

### m1. Magical Secrets lets a Bard take any number of Cleric/Druid/Wizard spells; the rule allows only the *new* ones
- Rule: "Whenever you reach a Bard level (including this level) and the Prepared Spells number in the Bard Features table
  increases, you can choose any of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell lists… In
  addition, whenever you replace a spell prepared for this class, you can replace it with a spell from those lists." —
  SRD 5.2.1 p. 33 (FR p. 35 "Secrets magiques"). At level 10 the count goes 14 → 15: one new pick.
- Code: `src/engine/checks/spells.ts:15-18` merges every spell of `sc.extraLists` into the allowed list, with no count.
- Repro (not the example itself, which is legal: Revivify is its single off-list spell): `barde-niveau-10` with Shatter and
  Charm Person swapped for Spirit Guardians and Guardian of Faith (three Cleric-only spells) → `validate()` = `[]`;
  expected a warning (only one new prepared spell at level 10, plus replacements… which the "replace" clause makes hard
  to bound; at least an `info`).
- Fix: count the off-list prepared spells against the number of prepared-spell increases since level 10 (1 at 10, +1 at
  11, 13, 15, 17) and warn above it, with the replacement clause noted in the message.

### m2. The barbarian's Strength save shows Advantage while he isn't raging
- Rule: "While your Rage is active… You have Advantage on Strength checks and Strength saving throws." — SRD 5.2.1 p. 29
  (FR p. 31). Rage Damage is encoded with `when: "toggle:rage"` and switches off; the Advantage and resistances of the same
  entry only carry a `condition` label.
- Code/data: `src/data/custom/effects/barbarian.json` `barbarian:rage.grants` (no `when`); `src/engine/sheet/modifiers.ts:192-203`
  pushes a conditional grant as an active Advantage source with the label "Rage (while raging)".
- Repro: `compute(barbare-niveau-10)` with `toggles = {}` → Str save `9 … ADV`, Athletics `9 … ADV`, resistances listed;
  Rage Damage `+3 (off)`. Expected: all Rage grants follow the same toggle.
- Fix: add `"when": "toggle:rage"` to the five Rage grants (the label can stay).

### m3. Seven examples use ability arrays that only rolling can produce
- Rule: three methods, SRD 5.2.1 p. 21 (FR p. 22): Standard Array 15, 14, 13, 12, 10, 8; Point Cost "You have 27 points to
  spend… a score of 14 costs 7"; Random Generation 4d6 drop lowest. Point Cost and the array cap scores at 15.
- Data: `barbare` (15, 14, 14, 8, 12, 10 = 29 points), `ensorceleuse` (29), `magicien` (29), `moine` (29), `rodeur`
  (12, 15, 14, 8, 15, 10 = 31), `occultiste` (Cha 16) and `paladine` (Str 16) are neither the array nor a 27-point buy.
  Legal as rolled scores, so `validate()` is right to stay silent (it checks 1–20); but reference "legal builds" that
  need lucky rolls are a weak reference. `barde`, `clerc`, `druide`, `guerrier`, `voleuse` are the Standard Array.
- Fix: rewrite the seven base arrays as Standard Array / 27 points (e.g. barbare 15, 14, 13, 8, 12, 10), or say
  "rolled" in the identity text.

### m4. The warlock lists Thieves' Cant as a language without a Rogue level
- Rule: "Your character knows at least three languages: Common plus two languages you roll or choose from the Standard
  Languages table." and the Rare Languages table (Druidic, Thieves' Cant…): "Some features let a character learn a rare
  language." — SRD 5.2.1 p. 20 (FR p. 21). Thieves' Cant is a Rogue feature (p. 62).
- Data: `examples/occultiste-niveau-10.json` `identity.languages: ["Common", "Infernal", "Thieves' Cant"]`. Free text, so
  no check applies; the example simply isn't SRD-legal as written (the Criminal background grants no language).
- Fix: replace with a standard language (e.g. Undercommon is rare too; Dwarvish, Elvish, Halfling… are standard).

### m5. Nine French-named examples carry English identity text under `settings.lang: "fr"`
- Not a rule, a consistency point the brief asked for. `barde`, `clerc`, `druide` have French background text, French
  language names ("Commun", "Nain", "Céleste") and French tool names; `barbare`, `ensorceleuse`, `guerrier`, `magicien`,
  `moine`, `occultiste`, `paladine`, `rodeur`, `voleuse` have English background text and English language names
  ("Common", "Dwarvish") with `lang: "fr"`. All twelve store the alignment in English ("Chaotic Good", "Neutral").
- Fix: translate the nine background texts, language names and alignments (or store alignment as an id rendered
  bilingually).

### m6. Tool proficiencies: placeholders and duplicates in the derived list
- `rodeur`: `toolProficiencies: []`, so the Soldier's Gaming Set stays "Choose one kind of Gaming Set (see “Equipment”)" on
  the sheet; `barbare` and `moine` show the placeholder *and* the chosen kind. `guerrier` lists "Thieves’ Tools" in
  `toolProficiencies` although the Criminal background already grants it (shown twice); same for `moine` (Calligrapher's
  Supplies ×2), `clerc`/`barde`/`druide` (English grant + French user entry). `voleuse` and `druide` likewise list
  "Thieves’ Cant" / "Druidique" in `identity.languages` while the class grants "Thieves’ Cant" / "Druidic" → both shown.
- Fix: pick the gaming set in `rodeur`, drop the duplicated entries, and have the engine dedupe case/apostrophe variants
  (or let a user entry *resolve* a "Choose one…" placeholder instead of sitting next to it).

## Nitpicks
- `magicien`: the spellbook holds 30 spells for 24 free ones (6 at level 1 + 2 × 9 levels, p. 77); six copied spells
  with 5 gp left is plausible only with found scrolls. Not illegal.
- `occultiste`: `leather-armor` is `carried`, not worn, so the AC rightly comes from Armor of Shadows; a reader may
  wonder why the armor is in the pack (it would give only 14).

## Checked and correct
- Every ability score (background +2/+1 among the background's three abilities, Ability Score Improvement +2 or +1/+1
  at the class's ASI levels — Fighter 4/6/8, Rogue 4/8/10, others 4/8 — and the cap of 20): twelve for twelve.
- HP: maximum die at level 1, fixed value afterwards, current Con on every level; Dwarven Toughness +1/level (clerc,
  guerrier) and Draconic Resilience (+3 then +1/level, p. 68) applied.
- AC: armor table values and Dex caps, Shield +2, Defense +1, Unarmored Defense (Barbarian Dex+Con, Monk Dex+Wis),
  Draconic Resilience 10+Dex+Cha, Armor of Shadows 13+Dex; only one base formula.
- Initiative: Alert adds PB (p. 87); Feral Instinct and Remarkable Athlete give Advantage; Jack of All Trades does not
  apply to Initiative (p. 31 "uses a skill proficiency you lack").
- Speed: Goliath 35 + Fast Movement; Monk Unarmored Movement +20 at 10 and Wood Elf +5; Roving +10 with Climb/Swim; Thief
  Second-Story Work climb.
- Saves: first class's two proficiencies; Aura of Protection +Cha on all six; Danger Sense, Gnomish Cunning, Brave,
  Fey Ancestry, Dwarven Resilience Advantages present.
- Skills: counts and lists (class picks on the class list, background skills, Primal Knowledge, Lore Bonus
  Proficiencies, Keen Senses, Deft Explorer, Scholar), Expertise counts (Bard 2+2, Rogue 2+2, Ranger 1+2), Jack of All
  Trades, Primal Order Magician (+Wis to Arcana/Nature), Chain Mail Stealth Disadvantage, passive scores.
- Attacks: ability by property (Finesse → Dex, Martial Arts → Dex on Monk weapons), PB only when proficient, Archery +2,
  Extra Attack for Barbarian/Fighter/Monk/Paladin/Ranger at 5, Improved Critical 19, Rage Damage +3, Sneak Attack 5d6,
  Colossus Slayer 1d8, Blessed Strikes 1d8, Sacred Weapon +Cha; Weapon Mastery counts (Barbarian 4, Fighter 5, Paladin /
  Ranger / Rogue 2) and proficiency with every chosen weapon; mastery unusable for classes without the feature.
- Spells: DC 8+PB+mod; full-caster slots 4/3/3/3/2, half-caster 4/3/2, Pact 2 × level 5; cantrip and prepared counts of
  the eight tables; per-class maximum spell level (5 / 3); every prepared spell on its own class list (the bard's
  Revivify via Magical Secrets, one new pick at level 10, legal), always-prepared subclass lists (Life, Draconic, Fiend,
  Devotion, Temperate land with its cantrip), Divine Smite, Find Steed, Hunter's Mark, Contact Other Plane, Pact of the
  Tome cantrips and rituals, Magical Discoveries (Fireball, Spirit Guardians) uncounted; Magic Initiate choices on the
  chosen list with the right levels; wizard prepared spells all in the spellbook.
- Class resources: Rages 4 (+1 on Short Rest), Second Wind 4, Action Surge 1, Indomitable 1, Channel Divinity 3 (Cleric)
  / 2 (Paladin) with one use back on a Short Rest, Wild Shape 3 and Temp HP 10, Focus Points 10, Sorcery Points 10 and
  Sorcerous Restoration 5, Innate Sorcery 2, Lay On Hands 50, Favored Enemy 4, Bardic Inspiration 5 × d10 on a Short
  Rest, Metamagic 4, Invocations 7, species uses (Giant Ancestry / Breath Weapon / Stonecunning / Adrenaline Rush = PB).
- Land's Aid 3d6 at Druid 10 (I suspected 2d6; the SRD says 3d6 at 10, p. 46).
- Companions: the druid's Fey raven through Wild Companion and the wizard's Fey owl through Find Familiar are legal;
  the eight Wild Shape forms respect the Beast Shapes table (CR ≤ 1, Fly Speed allowed from level 8).
- Subclass at class level 3 and Fighting Style at the right level (Fighter 1, Paladin / Ranger 2) in all twelve.

## Verdict
The twelve sheets' numbers (abilities, HP, AC, initiative, saves, skills, attacks, DCs, slots, counts, resources) all
match the SRD by hand: nothing to correct at the table. The one gap worth fixing is the species lineage spells of
levels 3 and 5 (three examples), a declared engine gap that also hides one prepared-spell slot from the warlock; the rest
is example hygiene (rolled ability arrays, an illegal Thieves' Cant, English identity text in French files).
