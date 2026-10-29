# Effects: how a feature's rules are encoded

Every class feature, subclass feature, species trait, feat, condition and class option (Metamagic, Eldritch Invocation)
that the SRD gives the character is an **owner**; its mechanical content is one entry in
`src/data/custom/effects/<class>.json` (or `species.json`, `feats.json`, `conditions.json`), keyed by the owner id
(`fighter:second-wind`, `rogue:thief:fast-hands`, `human:versatile`, `feat:alert`, `condition:prone`,
`warlock:eldritch-invocation:agonizing-blast`). The SRD text stays in the generated data; the entry only encodes it.
`src/__tests__/features-coverage.test.ts` fails when a feature up to level 12 has no entry. Types: `EffectDef` in
`src/data/types.ts`. Every entry carries a `source` (SRD page EN, `frPage`, section).

## Fields

| Field | What it does | Example |
|---|---|---|
| `modifiers[]` | `{ target, value, effectName?, when?, condition? }` numeric parts. Targets: `ac`, `initiative`, `speed`, `speed.climb/swim/fly` (value `"speed"` = walking Speed), `hp.max`, `ability.<id>`, `ability.<id>.max`, `save.<id>`, `save.all`, `skill.<id>`, `check.<ability>`, `check.all`, `attack.melee/ranged/spell/all`, `damage.melee/ranged/all`, `damage.melee.str`, `spell.dc`, `d20`, `critRange` (value 19), `cantrips.<class>`, `prepared.<class>`, `extraDamage.melee/ranged/all` (value = dice `"1d8"` or a dice column `"sneakAttack"`). Values: number, `"pb"`, `"half-pb"`, `"level"`, `"<class>Level"`, `"<class>Level*5"`, `"<class>Level/2"`, an ability (`"cha"`, `"wis:min1"`), a class-table column (`"rageDamage"`). `effectName` = "same name doesn't stack". | Aura of Protection: `{ "target": "save.all", "value": "cha:min1", "effectName": "Aura of Protection" }` |
| `grants[]` | `{ kind, on?, value?, condition?, when? }`: `advantage` / `disadvantage` (on `initiative`, `attack`, `attack.melee`, `save.<id>`, `save.<condition>`, `skill.<id>`, `check.<ability>`, `check.all`, `attacks-against`), `proficiency` (on `skill.<id>`, `armor.<cat>`, `weapon.<cat|id>`, `tool.<name>`), `expertise`, `resistance` / `immunity` (on a damage type or condition id), `darkvision` (value), `language`, `flag` (on = flag name). | Danger Sense: advantage on `save.dex` |
| `when` | Condition on a modifier or grant: `no-armor`, `no-heavy-armor`, `no-armor-no-shield`, `armor`, `shield`, `melee-weapon`, `ranged-weapon`, `toggle:<key>` (a switch in the Combat pane; `condition` is its label). | Rage damage: `"when": "toggle:rage"` |
| `uses` | `{ count, per: "short"\|"long", byLevel?, shortRestRegain? }`; count: number, column id, `"pb"`, ability (`"cha"` = modifier, min 1), `"paladinLevel*5"`. | Second Wind: `{ "count": "secondWind", "per": "long", "shortRestRegain": 1 }` |
| `flags` | Engine switches: `extra-attack`, `two-extra-attacks`, `three-extra-attacks`, `martial-arts`, `jack-of-all-trades`, `rage`, `powerful-build`, `speed-0`, `resourceful`, `tireless`, `pact-weapon`, `reliable-talent`. | |
| `acFormula` | `{ base?, abilities[], noArmor, noShield }` an alternative base AC. | Unarmored Defense (Monk): Dex + Wis, no armor, no Shield |
| `choices[]` | `{ id?, kind, name?, count?, byLevel?, from?, options?, list?, level?, maxLevel?, category? }`. Kinds: `option` (inline `options` with their own effects, or `from` a class option list such as `"eldritch-invocation"`), `skill`, `expertise`, `spell`, `damage-type`, `feat` (an extra feat, stored in `character.extraFeats[owner id]`), `language`, `tool`, `text`. Stored in `character.featureChoices[owner id]` (`owner id#choice id` with several choices) or `LevelEntry.choices`; a feat's choices in `FeatPick.choices[choice id]`. | Primal Order: option `magician` / `warden` |
| `computed[]` | `{ id, label, dice?, parts? }` a value shown in the Combat pane ("Feature values"). | Stunning Strike: `parts: [8, "pb", "wis"]`; Deflect Attacks: `dice: "1d10", parts: ["dex", "monkLevel"]` |
| `spells` | `{ always?: [ids], lists?: [class ids], fromChoices?: [choice ids], ability? }`: always-prepared spells (not counted), extra lists to prepare from (Magical Secrets), spells picked by choices. | Favored Enemy: `{ "always": ["hunters-mark"] }` |
| `mastery` | Weapon Mastery count: number or column id. | Rogue: `2`; Fighter: `"weaponMastery"` |
| `overrides[]` | `{ resource, per?, shortRestRegain? }` change another owner's resource. | Font of Inspiration → `bard:bardic-inspiration` per `short` |
| `textOnly` | `{ en, fr }`: nothing computed, and why (an action with no sheet number, applied at the dice, needs the GM). | Cunning Action |
| `activation[]` | How the owner is used during a turn (Combat pane "Your turn", `engine/turn.ts`): `{ kind: 'action' \| 'bonus-action' \| 'reaction' \| 'free' \| 'attack', name?, action?, actions?, trigger?, cost?, when?, minLevel?, setsToggle?, extraAction? }`. `action`: the standard action it is (`magic` for "As a Magic action"); `actions`: standard actions it lets you take (Cunning Action: dash, disengage, hide); `cost`: `{ resource?, amount? }` (default: this owner's uses, 1; `amount: 0` spends nothing); `when`: `toggle:<key>` / `!toggle:<key>`; `setsToggle`: switch turned on when used (Rage); `extraAction`: one more action this turn (Action Surge, `except: ['magic']`); `'attack'` replaces one attack of the Attack action (Breath Weapon). An empty list = the text names a part of the turn but gives nothing to take. `src/__tests__/activation-coverage.test.ts` fails when a feature, option, trait, feat or magic item whose text says "Bonus Action", "take a Reaction", "Magic action"… has no list. Magic items: derived from their text by `tools/build_magic_item_effects.py` (potions excluded: always a Bonus Action, p. 204). | Second Wind: `[{ "kind": "bonus-action" }]` |

### Magic items (`custom/effects/magic-items.json`, ids `item:<magic item id>`)

One owner per inventory item, `item:<uid>`, built only while the item is active (`engine/items.ts` `inactiveReason`: worn,
a weapon or Shield in hand, attuned when it requires Attunement; `activeWhen: "attuned"` or `"on-person"` when the item
text says so). Its choices are stored per instance under `item:<uid>` (`item:<uid>#<choice id>`). Same-named items don't
stack (parts are named after the SRD item). An SRD magic weapon or armor is its base item with `ItemInstance.magicItemId`
(`magicBase`: the entry's `baseItem` or a default, editable in the Equipment pane).

| Field / target | What it does |
|---|---|
| `byVariant` (on a modifier) | the value for each variant (`ItemInstance.variant` = index in `MagicItemDef.variants`): +1/+2/+3, giant type |
| `ability.<id>.set` | sets the score to the value when it is higher (Belt of Giant Strength, Headband of Intellect) |
| `speed.min`, `speed.double` | Speed at least N feet; Speed doubled (with `when: "toggle:<key>"`) |
| `item.attack`, `item.damage`, `extraDamage.item` | attack, damage and extra dice with that weapon only (the owner's `itemUid`) |
| `attack.weapon.<id>`, `damage.weapon.<id>`, `attack.unarmed`, `damage.unarmed` | one weapon kind; Unarmed Strikes |
| flags `no-armor-speed-penalty`, `no-armor-stealth-disadvantage` | armor that ignores the Strength or Stealth column (Mithral Armor, Dwarven Plate) |
| `activeWhen` | `"attuned"` (on you, attuned, not necessarily worn) or `"on-person"` (worn or in the backpack) |
| `spellItem` | `{ spells[{ spellId, cost? (number or "level"), level?, maxLevel?, dc?, attack?, perDay?, atWill?, note? }], charges? (number or dice), recharge?, rechargeAt?, wielderDc?, consumable?, scroll?, stores?, variantNotes?, note? }`: spells cast from the item and its charges, used from the Combat pane (`engine/spellItems.ts`; SRD p. 206 "Spells Cast from Items", p. 244 "Spell Scroll": DC and attack bonus by spell level) |
| `weapon` | `{ name, base, damage?, damageType?, range?, proficient?, mastery? }`: a weapon the feature creates (custom subclass features, house rule #5): built on the catalog weapon `base` with these overrides, listed with the attacks as `feature:<owner id>` (never in the inventory, not counted against the hands); `proficient` grants proficiency with that weapon only, `mastery` lets its mastery property be used without a Weapon Mastery pick | Psychic Blades: `{ "base": "dagger", "damage": "1d6", "damageType": "psychic" }` |
| `wildShape` | `{ maxCr?, tempHp?, acMin? }`, formulas (`model/formula.ts`): a Druid feature changing Wild Shape (custom subclass, house rule #5); the highest of the Beast Shapes table and the formula applies, `acMin` raises a form's Armor Class on the in-play card (`engine/companions.ts` `wildShapeLimitsFor`) | `{ "maxCr": "druidLevel/3", "acMin": "13 + wis" }` |

Rules of thumb: a number the sheet shows → `modifiers`; a per-rest counter → `uses`; a situational bonus → `when: "toggle:…"`; a DC
or a heal/damage formula → `computed`; options the player picks → `choices`; nothing numeric → `textOnly` (never leave a feature
without an entry). Cite the SRD page of the sentence you encode.
