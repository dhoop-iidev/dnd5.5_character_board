# Content packs (house rule #7)

A **content pack** is the content of one book outside the SRD (Player's Handbook 2024, *Mordenkainen Presents: Monsters
of the Multiverse*…), in the same shapes as the SRD data, so the app treats it like the SRD: pickers, Spells pane,
effects, rule checks, popups, PDF. **Packs are private**: they hold the book's text and are made from the player's own
copies. Nothing of them is in this repository, the app ships none, and they are never published. They live in a local
folder (`D&D 5.5/dnd5.5_packs/`, sources per book and the built files in `dist/`).

- Code: `src/model/packs.ts` (format, `readPack`, `installPack`, the copy embedded in characters), `src/model/packStore.ts`
  (IndexedDB), `src/ui/PacksPanel.svelte` (welcome screen and the footer's "Books" button), `state.svelte.ts` `initPacks`
  (installed before the app mounts).
- A saved character carries a copy of the pack entries it uses (`Character.packContent`, rewritten on every save), so its
  file opens on a device without the pack. A pack loaded later doesn't replace what is already installed: the first wins,
  SRD entries are never replaced.
- Build: `python tools/build_pack.py <source folder>` merges the folder's files into `dist/<id>.pack.json`.
- Checks: `PACKS_DIR=<dist folder> npm test` runs `src/__tests__/packs-content.test.ts` on every pack (the SRD data's
  checks: effect coverage for every level, activations, summaries, three languages, sources, smoke characters).

## Source folder

```
dnd5.5_packs/
  phb-2024/
    pack.json              { "id": "phb-2024", "book": { "en": "Player's Handbook (2024)", "fr": "Manuel des joueurs (2024)", "es": "Manual del jugador (2024)" } }
    species.json           { "species": [...], "effects": [...], "summaries": {...} }
    backgrounds.json       { "backgrounds": [...], "summaries": {...} }
    feats-origin.json      { "feats": [...], "effects": [...], "summaries": {...} }
    spells-*.json          { "spells": [...], "summaries": {...} }
    subclasses/<class>.json { "subclasses": [...], "effects": [...], "summaries": {...} }
  motm/ …
  dist/                    built packs (load them in the app)
```

Every file is a partial pack: any of the lists `species`, `backgrounds`, `feats`, `spells`, `subclasses`,
`classOptions`, `magicItems`, `effects`, and a `summaries` object. Keep an entry, its effects and its summaries in the
same file.

## Entries

Shapes: `src/data/types.ts` (`SpeciesDef`, `BackgroundDef`, `FeatDef`, `SpellDef`, `SubclassDef`, `ClassOptionDef`,
`MagicItemDef`, `EffectDef`), plus:

- background: `kits` = the starting equipment options as `model/startingEquipment.ts` `KitOption` (`letter`, `gp`,
  `items` with catalog ids of `src/data/srd/weapons.json` / `armor.json` / `gear.json`); option B is `{ "letter": "B",
  "gp": 50, "items": [] }`.
- subclass: `classId` (`"warlock"`), `id` = `<class>:<subclass>` (`"warlock:archfey-patron"`), features
  `<class>:<subclass>:<feature>` with their `level` (class level). Subclass spells (always prepared) in `spells`.
- class option: `classId`, `kind` (`"eldritch-invocation"`, `"metamagic"`), `id`.

Ids: kebab-case English names (`"lucky"`, `"wayfarer"`, `"aasimar"`, `"hunger-of-hadar"`); species traits
`<species>:<trait>`. An id the SRD already uses (or another pack's) gets the pack's suffix: `"goliath-motm"`,
`"aasimar-motm"`.

`source` on every entry and feature: `{ "pack": "<pack id>", "bookPage": <printed page>, "section": "<heading>" }`.

## Text

- `name`, `text` and every other `I18n` in **English, French and Spanish**. English: the book's text, verbatim, as HTML
  (`<p>`, `<strong>`, `<em>`, `<ul><li>`, `<table>`), as in `src/data/srd/*.json`. French and Spanish: our translations of
  that text, complete (not summaries), with the official terms of the French and Spanish SRD 5.2.1 (the names in
  `src/data/srd/*.json`: conditions, spells, skills, damage types, glossary; `src/i18n/ui.ts`). Lengths: 1,50 m per 5 ft in
  French and Spanish (30 ft = 9 m), as the translated SRDs do.
- `summaries`: one line (≤ 140 characters) per entry, in our own words, in the three languages, keyed `species:<id>`,
  `trait:<trait id>`, `background:<id>`, `feat:<id>`, `spell:<id>`, `feature:<feature id>`, `invocation:<id>`,
  `metamagic:<id>`.

## Effects

Exactly as `docs/effects.md`: one entry per owner (species trait, `feat:<id>`, subclass feature at every level, class
option), computed when the sheet can show it, else `textOnly` with the reason; an `activation` list when the text names a
part of the turn. Model on the SRD's entries in `src/data/custom/effects/*.json` (Champion, Life Domain, Fiend Patron…).
Spells granted by a trait or feature: `spells.always` / `byLevel` (cast once per Long Rest without a slot, as Elven
Lineage).
