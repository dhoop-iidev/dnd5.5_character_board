# Data pipeline (`tools/`)

Python scripts (miniforge, `C:/Users/le_re/miniforge3/python.exe`, pymupdf) that turn the three official SRD 5.2.1 PDFs
(English, French, Spanish) into the multilingual JSON the app reads (`src/data/srd/*.json`, shaped as `src/data/types.ts`). Python is only used here.

## Run

```sh
python tools/extract_srd.py      # PDFs -> sources/extracted/{en,fr,es}.json (only after a change to srd_pdf.py)
python tools/build_data.py [build_x ...] [-v]  # -> src/data/srd/*.json (idempotent), counts, notes, Spanish coverage
python tools/validate_data.py    # schema vs types.ts, counts, pages, cross-references; exit 1 on errors
python tools/crosscheck_classes.py / crosscheck_spells.py / crosscheck_equipment.py / crosscheck_creatures.py
python tools/srd_find.py "phrase" [--en|--fr] [--context]   # pages where a phrase appears: use it for every citation
python tools/peek_blocks.py en 28 30                        # print the extracted blocks of a page range
```

Needs the gitignored `sources/`: `SRD_CC_v5.2.1.pdf`, `FR_SRD_CC_v5.2.1.pdf`, `SP_SRD_CC_v5.2.1.pdf` (official English,
French and Spanish SRD 5.2.1, CC-BY-4.0) and `dnd-5e-srd-markdown/` (clone of github.com/downfallx/dnd-5e-srd-markdown, English Markdown of the same
SRD, used only by the cross-checks as an independent second parse).

## Modules

| Module                             | Role                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `srd_pdf.py`                       | PDF layout -> ordered blocks (chapter/h1–h4 headings by GillSans-SemiBold size, paragraphs and bullets with hanging indents, `field` key: value lines, tables rebuilt from cell positions, sidebars, raw stat-block lines). Both PDFs share one InDesign layout.                                                               |
| `extract_srd.py`                   | Runs the extractor on both PDFs, compares the heading structure per chapter (they match).                                                                                                                                                                                                                                      |
| `common.py`                        | Block navigation (`chapter`, `Section`, `split_sections`), text -> HTML (`blocks_html`), units (`parse_weight_pair`, `parse_distance_pair`: both languages as printed), ids, `note()`.                                                                                                                                         |
| `build_rules.py`                   | `rules.json` (Proficiency Bonus, XP, Multiclass Spellcaster slots, Point Cost, Standard Array by class, ability modifiers), `skills.json`, `conditions.json` (15), `glossary.json` (155; French text for the conditions only so far).                                                                                          |
| `build_classes.py`                 | `classes.json`: 12 classes (core traits, 20-row table with resources and slots, features, subclass, Metamagic / Eldritch Invocation options, class spell lists). Classes are paired to their French entry by name (French order is alphabetical in French), features by position.                                              |
| `build_origins.py`                 | `species.json` (9, traits paired by a checked French name map), `backgrounds.json` (4).                                                                                                                                                                                                                                        |
| `build_feats.py`                   | `feats.json` (17, categories and parsed prerequisites).                                                                                                                                                                                                                                                                        |
| `build_equipment.py`               | `weapons.json`, `armor.json`, `gear.json`, `weapon-properties.json`; French rows matched by content (dice, weight, cost).                                                                                                                                                                                                      |
| `build_spells.py`                  | `spells.json` (339); French spells matched by a language-independent signature (level, school, classes, components, numbers).                                                                                                                                                                                                  |
| `build_magic_items.py`             | `magic-items.json` (258), `magic-item-rarity.json`; signature matching + `fr_overrides_magic_items.csv`.                                                                                                                                                                                                                       |
| `build_creatures.py`               | `creatures.json` (334 stat blocks: Monsters A–Z, Animals, four spell-summoned creatures). `CORRECTIONS` fixes the two SRD misprints verified against the 2024 Monster Manual (Young White Dragon Int save, Gray Ooze Initiative score) and stores a bilingual `errata` note on the creature (`docs/rules/rulings-data.md` D1). |
| `build_srd_links.py`               | `links.json`: crawls https://5e24srd.com (48 pages, cached in `sources/5e24srd/`, `--refresh` to download again) and maps every `source.section` to a heading anchor for the popup Source links; prints coverage (exact / parent / page / none). Run after `build_data.py`.                                                    |
| `validate_*.py`, `crosscheck_*.py` | Per-kind validators and Markdown cross-checks, run by `validate_data.py`.                                                                                                                                                                                                                                                      |

French names that no signal could pair are written to `fr_overrides_<kind>.csv` with status `todo`; set `status` to
`ok` after correcting `fr_guess`. Rows with `ok` always win.

## Spanish (two-pass build)

The builders pair English with one translation, `common.LANG` (`common.L(fr=..., es=...)` picks per-language vocabulary,
`common.overrides_path(kind)` gives `{fr,es}_overrides_<kind>.csv`). `build_data.py` runs them once with the French blocks
and once with the Spanish blocks (modules reloaded, output captured instead of written), then merges: each I18n `{en, fr}`
of the French pass whose twin in the Spanish pass has the same `en` gets `es` = the twin's translation, and each `source`
gets `esPage`. Lists with ids are matched by id, other lists by position; a twin with a different `en` is reported as a
structure mismatch and never merged. The report also lists Spanish texts equal to the English or French one (suspects).
`validate_data.py` warns, per file, about I18n fields without `es`. The Spanish PDF marks line-end hyphenation with a soft
hyphen (U+00AD): `srd_pdf.py` joins such words back without a space.

## Known defects of the extraction (worked around in the builders)

- A few headings or field lines come out with another kind (Acid Splash as an empty sidebar; "Component:" singular).
- Paragraphs cut by a column or page break without final punctuation are re-joined by the builders.
- The French multiclass-slot table and the Trinkets table (FR p. 27) are merged (trinkets lose 11 rows; English used).
