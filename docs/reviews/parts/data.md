# Um, actually… — review of 2026-10-25 (part: generated data)

Scope: `src/data/srd/*.json` checked against the two SRD 5.2.1 PDFs for *semantic* errors beyond the table-shape
validators (`classes.json` core traits, tables, Spellcasting, subclasses and options; `species.json`, `backgrounds.json`,
`feats.json`; weapons / armor / gear / weapon properties; a spell sample and then every spell header; conditions and the
rules tables; French names and `frPage` values). Engine, checks, UI and examples are covered by other parts.
Sources used: `sources/SRD_CC_v5.2.1.pdf` (pages read with pymupdf, located with `tools/srd_find.py`),
`sources/FR_SRD_CC_v5.2.1.pdf`, `docs/house-rules.md` (empty), `docs/rules/rulings-data.md` (D1–D7).
Method: Python over the JSON (snippets below), PDF page text for every citation. Nothing was fixed or committed.

## Meaningful

### M1. Um, actually… a Circle of the Land Druid picks a land *every Long Rest* — the data only knows the desert
- Rule: "Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. Consult the table
  below that corresponds to the chosen type; you have the spells listed for your Druid level and lower prepared." Four
  tables follow (Arid, Polar, Temperate, Tropical) — SRD 5.2.1 p. 46 (FR p. 48 "choisissez un type d'environnement
  entre : aride, polaire, tempéré et tropical"). Nature's Ward (p. 46) also keys its Resistance on the current land.
- Code: `tools/build_classes.py:174-186` `parse_subclass_spells()` returns the **first** two-column table whose header ends
  in "Level" and stops; `src/data/srd/classes.json` → `druid` → `subclasses[0].spells` therefore holds only the Arid Land
  rows (`blur, burning-hands, fire-bolt / fireball / blight / wall-of-stone`). The `SubclassDef.spells` shape
  (`src/data/types.ts`) has no slot for a land choice at all. `src/engine/checks/spells.ts:13` reads
  `sub.spells` as the always-prepared list.
- Repro (Python):
  ```python
  import json; c = {x['id']: x for x in json.load(open('src/data/srd/classes.json', encoding='utf-8'))}
  print(c['druid']['subclasses'][0]['spells'])
  # [{'level': 3, 'spells': ['blur','burning-hands','fire-bolt']}, {'level': 5, 'spells': ['fireball']},
  #  {'level': 7, 'spells': ['blight']}, {'level': 9, 'spells': ['wall-of-stone']}]   <- Arid only
  ```
  Got: a Polar druid 5 is told Fireball is always prepared; expected Fog Cloud, Hold Person, Ray of Frost, Sleet Storm.
- Fix: parse all four tables (`Arid Land`, `Polar Land`, `Temperate Land`, `Tropical Land`) into a keyed structure
  (e.g. `spellsByChoice: { choice: 'land', options: { arid: [...], polar: [...], ... } }`) plus a class-feature choice
  renewed on a Long Rest; the validator should fail when a subclass section has more than one "… Level" table.

### M2. Um, actually… a Monk is not proficient with a Greatsword — only Martial weapons with the Light property
- Rule: Core Monk Traits, "Weapon Proficiencies: Simple weapons and Martial weapons that have the Light property" —
  SRD 5.2.1 p. 49 (FR p. 65 "Armes courantes ; et armes de guerre dotées de la propriété Légère").
- Code: `tools/build_classes.py:68-74` recognises only the Rogue phrase ("Finesse or Light") and otherwise appends
  `martial` whenever the word appears; `classes.json` → `monk.weaponProficiencies = ["simple", "martial"]`.
  `src/engine/sheet/attacks.ts:31-36` (`weaponProficient`) then treats every martial weapon as proficient
  (`p === w.category`), the Light filter only exists for `martial:finesse-or-light`.
- Repro (Python):
  ```python
  import json; c = {x['id']: x for x in json.load(open('src/data/srd/classes.json', encoding='utf-8'))}
  print(c['monk']['weaponProficiencies'])   # ['simple', 'martial']  — expected ['simple', 'martial:light']
  ```
  Got: a level 1 Monk with a Greatsword or Longbow adds the Proficiency Bonus to the attack; expected a
  non-proficiency warning / no PB (Longbow is Heavy and not Light; Scimitar and Shortsword stay proficient).
- Fix: add a `martial:light` marker (builder regex "Martial weapons that have the Light property") and handle it in
  `weaponProficient` next to `martial:finesse-or-light`.

### M3. Um, actually… Boon of Spell Recall requires the Spellcasting feature — and the checker never hears about it
- Rule: "Boon of Spell Recall — Epic Boon Feat (Prerequisite: Level 19+, Spellcasting Feature)" — SRD 5.2.1 p. 88
  (FR p. 93 "prérequis : niveau 19 ou supérieur, aptitude Sorts").
- Code: `tools/build_feats.py:48` sets `prereq.feature = 'spellcasting'` only when the heading reads "Spellcasting or
  Pact Magic Feature" — a phrase that exists nowhere in the Feats chapter (`srd_find` finds it only on p. 23). So
  `feats.json` → `boon-of-spell-recall.prereq` is `{ level: 19, text: {...} }` with no `feature`, and the ready-made
  check `src/engine/checks/build.ts:74` (`p?.feature === 'spellcasting'`) can never fire.
- Repro (Python):
  ```python
  import json; f = {x['id']: x for x in json.load(open('src/data/srd/feats.json', encoding='utf-8'))}
  print(f['boon-of-spell-recall']['prereq'].get('feature'))   # None — expected 'spellcasting'
  print(f['archery']['prereq'].get('feature'))                # 'fighting-style' (the parallel case works)
  ```
  Got: a Fighter 19 (Champion, no spells) taking Boon of Spell Recall gets no warning; expected an error.
- Fix: match `Spellcasting Feature` (optionally "or Pact Magic") in `parse_prereq`; the checker already accepts Pact
  Magic (`sheet.spellcasting.length`), which is the intended reading of a prerequisite on "the Spellcasting feature"
  for a Warlock — leave that reading as is (or note it in `rulings-data.md`).

## Minor

### m1. Bard and Rogue multiclass proficiencies: the tool is in the prose, not in the data
- Rule: Bard "As a Multiclass Character … proficiency in one skill of your choice, proficiency with one Musical
  Instrument of your choice, and training with Light armor" (p. 31); Rogue "… proficiency in one skill of your choice
  from the Rogue's skill list, proficiency with Thieves' Tools, and training with Light armor" (p. 61).
- Code: `classes.json` → `bard.multiclass = { armor: ['light'], weapons: [], skills: 1 }` and
  `rogue.multiclass = { armor: ['light'], weapons: [], skills: 1 }`: no `tools`, and the Rogue's skill is not
  restricted to the Rogue list (`multiclass.skills` is a bare count). The verbatim `text` is right.
- Repro: `print(c['bard']['multiclass'].get('tools'), c['rogue']['multiclass'].get('tools'))` → `None None`.
- Fix: fill `multiclass.tools` ({en,fr}) in `build_classes.py` (~l. 251-266) and add a `skillsFrom: 'class'` flag for the
  Rogue so the skill-count check can restrict the list.

### m2. Three Eldritch Invocation prerequisites are cut short
- Rule: "Agonizing Blast — Prerequisite: Level 2+ Warlock, a Warlock Cantrip That Deals Damage" (p. 72, FR p. 71);
  "Eldritch Spear — … a Warlock Cantrip That Deals Damage" (p. 73); "Repelling Blast — … a Warlock Cantrip That Deals
  Damage via an Attack Roll" (p. 74).
- Code: `classes.json` → `warlock.options['eldritch-invocation']` stores `prereq.en = "Level 2+ Warlock, a Warlock
  Cantrip"` for all three (the line break after "Cantrip" ended the extraction). The other 25 prerequisites are exact.
- Repro: `[o['prereq']['en'] for o in c['warlock']['options']['eldritch-invocation'] if o['id'].endswith(('agonizing-blast','eldritch-spear','repelling-blast'))]`
  → three times `'Level 2+ Warlock, a Warlock Cantrip'`.
- Fix: join the continuation line of the italic prerequisite in the builder (same re-join the README describes for
  cut paragraphs).

### m3. `spellcasting.ritual` is `false` for every class, against ruling D4
- Rule / ruling: `docs/rules/rulings-data.md` D4 decides "`spellcasting.ritual = true` for every Spellcasting class"
  (SRD p. 104 "Rituals").
- Code: `tools/build_classes.py:205` derives the flag from the word "Ritual" in the class's Spellcasting text, which no
  class text contains, so `classes.json` has `ritual: false` for all nine casters. The engine does not read the flag yet
  (`grep ritual src/engine` finds nothing; `ui/panes/Spells.svelte:114` uses the *spell's* flag), so there is no table
  impact today — but the data contradicts a recorded ruling and will bite the first time the flag is used.
- Repro: `print({k: v['spellcasting']['ritual'] for k, v in c.items() if v.get('spellcasting')})` → all `False`.
- Fix: set `ritual: True` in `spellcasting_def()` (the ruling) or drop the field.

### m4. `rules.json` "Typical Difficulty Classes" has empty French strings
- Rule (project): every user-facing text is `{ en, fr }` (CLAUDE.md). The FR PDF has the table ("Très facile 5 …").
- Code: `src/data/srd/rules.json` → `typicalDcs[*].task.fr === ""` for all six rows; `rules.source` has no `frPage`.
- Repro: `print([t['task']['fr'] for t in json.load(open('src/data/srd/rules.json'))['typicalDcs']])` → `['', '', '', '', '', '']`.
- Fix: read the French table in `build_rules.py` and add `frPage`.

## Nitpicks

- `src/data/types.ts` `WeaponDef.damage` says "null for the Net", but SRD 5.2.1 p. 91 has no Net (38 weapons, all
  present with a damage die or "1" for the Blowgun). Stale comment from an earlier assumption.
- 24 gear rows (`inn-stay-*`, `meal-*`, `saddle-*`, `spellcasting-level-*`, `wine-*`) have composed French names
  ("Séjour à l'auberge (modeste)", "Services d'incantation (Niveau du sort 1)") that do not appear as such on FR p. 107–108;
  the parts do. Cosmetic, but "Niveau du sort Sort mineur" reads oddly — consider "Services d'incantation (sort mineur)".
- `rules.json.source` cites only `page: 23` for six tables that live on p. 21 (Point Costs, Standard Array by Class),
  p. 23 (Advancement) and p. 26 (Multiclass Spellcaster); no `frPage`.

## Checked and correct

- **Class tables, every row by hand against the PDF:** Barbarian (p. 28: Rages 2/2/3/3/3/4/4/4/4/4/4/5/5/5/5/5/6/6/6/6,
  Rage Damage +2→+3 at 9→+4 at 16, Weapon Mastery 2/3/4), Monk (p. 50: Martial Arts d6→d8 (5)→d10 (11)→d12 (17),
  Focus Points = level from 2, Unarmored Movement +10/+15 (6)/+20 (10)/+25 (14)/+30 (18)), Warlock (p. 71: invocations
  1/3/3/3/5/5/6/6/7/7/7/8/8/8/9/9/9/10/10/10, cantrips 2/3 (4)/4 (10), prepared 2…15, Pact slots 1/2/3 (11)/4 (17) and slot
  level 1/2 (3)/3 (5)/4 (7)/5 (9)), Paladin (p. 53: Channel Divinity 2 (3)/3 (11), prepared spells, half-caster slots),
  Cleric (p. 36: Channel Divinity 2/3 (6)/4 (18), cantrips 3/4 (4)/5 (10), full-caster slots 1–9). All PB values match.
- **Core traits of the 12 classes** (p. 28–82): hit die, primary ability, saving throws, skill count and lists, armor
  training, tool proficiencies, `asiLevels` (Fighter 4/6/8/12/14/16, Rogue 4/8/10/12/16, others 4/8/12/16), multiclass
  armor and weapons (except m1), Spellcasting ability / full-half-pact / spellbook / `change` (bard, sorcerer, warlock =
  `level`; others `long-rest`, matching "Spell Preparation by Class").
- **Subclass spell lists**: Life Domain (p. 40), Oath of Devotion (p. 56), Draconic Spells (p. 70), Fiend Spells (p. 76)
  — exact. Metamagic: the 10 SRD options, no prerequisites. Invocations: 28 options, 25 prerequisites exact.
- **Table ↔ feature consistency**: every named entry of the 12 class tables exists as a feature at that level
  (the only differences are the printed reminders "Expertise" at bard 9 / rogue 6, "Metamagic" at sorcerer 10/17,
  "Indomitable (two uses)", "Mystic Arcanum (level 7/8/9 spell)", which the SRD itself describes inside the lower-level
  feature).
- **Class spell lists vs spell `classes`**: consistent for all nine casters, apart from Mind Spike and Phantasmal
  Force — already ruled (D3).
- **`rules.json`**: Proficiency Bonus and XP (p. 23), Multiclass Spellcaster slots 1–20 (p. 26), Point Costs and Standard
  Array by Class (p. 21), ability modifiers 1–30 — exact.
- **Species** (p. 84–86): sizes (Human and Tiefling Medium or Small; Gnome, Halfling Small), speeds (Goliath 35 ft /
  10,5 m), Darkvision ranges in the trait texts (Dwarf and Orc 120 ft / 36 m; Dragonborn, Elf, Gnome, Tiefling 60 ft /
  18 m), trait names and `frPage`s.
- **Backgrounds** (p. 83): abilities, Origin feat, skills, tool, equipment of Acolyte, Criminal, Sage, Soldier — exact.
- **Feats** (p. 87–88): 17 feats, categories, levels (4+ / 19+), Grappler "Strength or Dexterity 13+", Fighting Style
  prerequisites, repeatable flags (ASI, Magic Initiate, Skilled), ability increases (Grappler Str/Dex, Irresistible
  Offense Str/Dex, Spell Recall Int/Wis/Cha, other boons any).
- **Weapons** (p. 91): all 38 rows — damage, type, properties (incl. Range as a 2024 property), Versatile dice, ranges,
  ammunition, mastery, weight (Dart 1/4 lb, Sling —), cost (incl. 5 CP, 1 SP, 500 GP). Lance per D6.
- **Armor** (p. 92): all 13 rows — AC, Dex cap, Strength 13/15, Stealth Disadvantage, don/doff times, weight, cost.
- **Spells**: the 38-spell sample (levels 0–9, every school, Concentration, Ritual, reaction triggers, materials with
  GP values) matched by eye, then **all 339 headers checked programmatically against the cited PDF page** (name,
  "Level N School" / "School cantrip", Casting Time, Range, Components, Duration, Concentration and Ritual flags): 339/339
  correct. The two apparent misses (Barkskin p. 112, Jump p. 143) are the PDF's own "Component:" singular — the data is
  right.
- **Conditions** (Rules Glossary p. 177–191): 15 conditions, every sentence of every text found verbatim on the cited
  page; Exhaustion = −2 × level on D20 Tests, −5 ft × level Speed, death at 6, FR "1,50 m x votre niveau".
- **French names / `frPage`**: 941 entries (spells, feats, weapons, armor, conditions, gear, species and traits,
  backgrounds, classes, features, subclasses, options) — 917 French names found on their cited French page; the 24
  misses are the composed gear names of the nitpick above. Random 10 verified: Sous-classe de Barde (FR p. 34),
  Simulacre de vie (177), Lueur d'espoir (155), Bottes d'arme (77), Simulacre (176), Rayon affaiblissant (172),
  Allié planaire (114), Insecte géant (151), Foulée preste (68), Agrandissement/rapetissement (114). Twenty terms
  checked explicitly: Voie du Berserker, Collège du Savoir, Domaine de la Vie, Cercle de la Terre, Credo de la Paume,
  Serment de Dévotion, Protecteur Fiélon, Sorcellerie draconique, Évocateur, Bottes d'arme, Vigilant, Doué,
  Sauvagerie martiale, Faveur de mémoire magique, Décharge déchirante, Pacte de la lame, Aspersion acide, Soins,
  Retour à la vie, Épuisement — all on their FR pages.

## Open questions

- Species Darkvision is only in the trait *text*: `src/data/custom/effects.json` has no `darkvision` grant, so the
  ranges above are not computed anywhere (engine part to confirm whether that is intended as "text only").
- Bard 9 / Rogue 6 extra Expertise and Sorcerer 10 / 17 extra Metamagic are in the features' text only; the data has
  no per-level count (`choices` is empty on those features). Whether the engine counts them is for the engine part.

## Verdict

The tables, slots, weapons, armor, spells and conditions are reliable: thousands of values checked, none wrong. The
three meaningful problems are modelling gaps of the generator (one land out of four for the Circle of the Land, the
Monk's Light-only martial proficiency, a feat prerequisite the checker is already waiting for), so trust the numbers but
not yet the legality verdicts for a Land Druid, a Monk with a non-Light martial weapon, or Boon of Spell Recall.
