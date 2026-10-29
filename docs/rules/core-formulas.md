# Core formulas the engine computes (SRD 5.2.1 pages)

Every number below is encoded in `src/engine/sheet/*.ts`; the page is the English PDF (`SRD_CC_v5.2.1.pdf`), the French
page follows when it differs. Check a page with `python tools/srd_find.py "<phrase>"`.

| Rule | Formula | SRD 5.2.1 |
|---|---|---|
| Ability modifier | (score − 10) / 2, rounded down | p. 6 |
| Proficiency Bonus | by total character level: +2 (1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20); never added twice | p. 23, p. 8 "The Bonus Doesn't Stack" |
| Saving throw | ability modifier + PB if proficient; proficiencies come from the **first** class only | p. 7, p. 25 "Multiclassing > Proficiencies" |
| Skill check | modifier + PB (Expertise ×2, Jack of All Trades half, round down) | p. 9, p. 181, p. 32 |
| Passive check | 10 + the check's modifiers | p. 9 |
| Hit Points | level 1: Hit Point Die maximum + Con; each later level: roll (or fixed value = half the die + 1) + Con, minimum 1 | p. 22, p. 23 |
| Hit Point Dice | one per class level, pooled per die type | p. 24 |
| AC base | 10 + Dex, or the armor's base (Dex: full / max 2 / none), or one alternative formula (Unarmored Defense…); only one base applies; Shield +2 | p. 177, p. 92, p. 25 |
| Heavy armor Strength | below the listed Strength: Speed −10 ft | p. 92 |
| Initiative | Dex modifier (+ PB with Alert) | p. 13, p. 87 |
| Speed | species Speed + features (Fast Movement, Unarmored Movement) − 5 ft per Exhaustion level | p. 86, p. 29, p. 51, p. 181 |
| Carrying capacity | Str × 15 lb (Small/Medium; Tiny × 7.5; one size larger with Powerful Build); drag/lift/push × 2 | p. 178, p. 85 |
| Attack roll | ability modifier (Str melee; Dex ranged; Finesse: either) + PB if proficient | p. 7, p. 89 |
| Weapon damage | dice + the same ability modifier; Versatile dice with two hands | p. 17, p. 90 |
| Heavy weapon | Disadvantage without Str 13 (melee) / Dex 13 (ranged) | p. 89 |
| Unarmed Strike | Str + PB to hit; 1 + Str Bludgeoning | p. 190 |
| Extra Attack | two attacks with the Attack action; doesn't stack between classes | p. 25 |
| Spell save DC / attack | 8 + PB + ability modifier / PB + ability modifier | p. 23 and each Spellcasting feature |
| Spell slots | one Spellcasting class: its table; several: full levels + Paladin/Ranger levels ÷ 2 **rounded up** → Multiclass Spellcaster table; Pact Magic separate | p. 25–26 |
| Rituals | any prepared spell with the Ritual tag | p. 104 |
| Exhaustion | −2 × level on D20 Tests, −5 ft × level Speed, death at 6; Long Rest −1 | p. 181 |
| Short Rest | spend Hit Point Dice (roll + Con, min 1); short-rest features recharge | p. 187 |
| Long Rest | all HP and all Hit Point Dice back, Exhaustion −1, features and slots back | p. 185 |
| Temporary HP | absorb damage first, don't add up (keep the higher) | p. 19 |
| 0 HP | Unconscious, Death Saving Throws (10+ success; 20 = 1 HP; 1 = two failures); damage at 0 HP = a failure (two on a Critical Hit); instant death when the remaining damage ≥ HP maximum | p. 18 |
| Attunement | no more than three items | p. 177 |
| Multiclass prerequisite | 13+ in the primary ability of the new class and of the current ones | p. 24 |
| Combining effects | the same effect never applies twice (most potent applies); different effects add | p. 106, p. 8, p. 25 |
| Wild Shape | Bonus Action; lasts half the Druid level in hours (rounded down, p. 5); Temporary HP = Druid level; uses from the Druid Features table, one back per Short Rest, all per Long Rest; known forms, max CR and Fly Speed from the Beast Shapes table (level 2: 4 forms, CR 1/4, no Fly; 4: 6, 1/2; 8: 8, 1, Fly) | p. 42 |
| Find Familiar | form = Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel or any Beast of CR 0; Celestial, Fey or Fiend; one familiar at a time; Pact of the Chain adds Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite, Venomous Snake | p. 130, p. 74 |
| Otherworldly Steed | AC 10 + 1 per spell level; HP 5 + 10 per spell level; PB = the caster's | p. 131 |
| Monster Initiative score | 10 + Initiative modifier (the score stands for a roll); 15 + modifier when the creature has Advantage on Initiative (Invisible condition, p. 184) | p. 254 |
