"""Validate src/data/srd/spells.json: shape of every SpellDef (src/data/types.ts), counts, pages, both languages present,
and agreement with the class spell list tables of the Classes chapter (EN pages 28-82: "Level N <Class> Spells" and
"Cantrips (Level 0 <Class> Spells)", columns Spell / School / Special with C = Concentration, R = Ritual, M = "a specific
Material component", i.e. one with a GP cost or consumed by the spell, SRD p. 33).

Run:  C:/Users/le_re/miniforge3/python.exe tools/validate_spells.py
validate() returns the problems as strings: "ERROR …" (shape, counts, missing spells, level/school disagreements) and
"warning …" (the `classes` field vs the class lists, a school that differs between the description and a class list — the
description wins, e.g. Flaming Sphere is Conjuration in its description but Evocation in the lists —, the Special column vs
concentration/ritual/costly material).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT, chapter, kebab, load_blocks, norm  # noqa: E402

TYPES = ROOT / "src" / "data" / "types.ts"
# 338 h3 headings + "Acid Splash", whose heading the extraction turned into an empty sidebar (EN p. 107): 339 spells, as in
# the class spell lists and in the French PDF (339 h3).
EXPECTED_COUNT = 339
EN_PAGES = (104, 175)
FR_PAGES = (111, 186)
CLASS_PAGES = (28, 82)
CLASS_IDS = ("bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard")
REQUIRED = {"id", "name", "level", "school", "classes", "castingTime", "castingKind", "ritual", "range", "components",
            "duration", "concentration", "text", "source"}
OPTIONAL = {"upcast"}


def ts_union(name: str) -> set[str]:
    """Members of a string-literal union in types.ts (`export type School = 'a' | 'b'` or an inline field type)."""
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(rf"export type {name} =((?:\s*\|?\s*'[^']+')+)", src)
    if not m:
        raise KeyError(name)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def casting_kinds() -> set[str]:
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(r"castingKind:((?:\s*\|?\s*'[^']+')+)", src)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def is_i18n(v, allow_empty: bool = False) -> bool:
    return (isinstance(v, dict) and set(v) in ({"en", "fr"}, {"en", "fr", "es"}) and all(isinstance(x, str) for x in v.values())
            and (allow_empty or all(v.values())))


def check_shape(sp: dict, schools: set[str], kinds: set[str]) -> list[str]:
    e: list[str] = []
    sid = sp.get("id", "?")
    keys = set(sp)
    if not REQUIRED <= keys:
        e.append(f"ERROR {sid}: missing fields {sorted(REQUIRED - keys)}")
    if keys - REQUIRED - OPTIONAL:
        e.append(f"ERROR {sid}: unknown fields {sorted(keys - REQUIRED - OPTIONAL)}")
    if not isinstance(sp.get("id"), str) or kebab(sp.get("name", {}).get("en", "")) != sp.get("id"):
        e.append(f"ERROR {sid}: id is not kebab(name.en)")
    for k in ("name", "castingTime", "range", "duration", "text"):
        if not is_i18n(sp.get(k)):
            e.append(f"ERROR {sid}: {k} is not a non-empty {{en, fr}}")
    if "upcast" in sp and not is_i18n(sp["upcast"]):
        e.append(f"ERROR {sid}: upcast is not a non-empty {{en, fr}}")
    if not (isinstance(sp.get("level"), int) and 0 <= sp["level"] <= 9):
        e.append(f"ERROR {sid}: level {sp.get('level')!r}")
    if sp.get("school") not in schools:
        e.append(f"ERROR {sid}: school {sp.get('school')!r}")
    cl = sp.get("classes")
    if not (isinstance(cl, list) and cl and all(c in CLASS_IDS for c in cl) and cl == sorted(set(cl))):
        e.append(f"ERROR {sid}: classes {cl!r}")
    if sp.get("castingKind") not in kinds:
        e.append(f"ERROR {sid}: castingKind {sp.get('castingKind')!r}")
    for k in ("ritual", "concentration"):
        if not isinstance(sp.get(k), bool):
            e.append(f"ERROR {sid}: {k} is not a boolean")
    c = sp.get("components")
    if not (isinstance(c, dict) and set(c) <= {"v", "s", "m"} and {"v", "s"} <= set(c)
            and isinstance(c["v"], bool) and isinstance(c["s"], bool) and ("m" not in c or is_i18n(c["m"]))):
        e.append(f"ERROR {sid}: components {c!r}")
    elif not (c["v"] or c["s"] or "m" in c):
        e.append(f"ERROR {sid}: no component at all")
    src = sp.get("source")
    if not (isinstance(src, dict) and set(src) - {"esPage"} == {"page", "frPage", "section"} and src["section"] == "Spells"):
        e.append(f"ERROR {sid}: source {src!r}")
    else:
        if not (EN_PAGES[0] <= src["page"] <= EN_PAGES[1]):
            e.append(f"ERROR {sid}: page {src['page']} outside {EN_PAGES}")
        if not (FR_PAGES[0] <= src["frPage"] <= FR_PAGES[1]):
            e.append(f"ERROR {sid}: frPage {src['frPage']} outside {FR_PAGES}")
    # consistency of the derived flags with the English text
    if isinstance(sp.get("duration"), dict) and isinstance(sp.get("concentration"), bool):
        if sp["concentration"] != norm(sp["duration"]["en"]).startswith("concentration"):
            e.append(f"ERROR {sid}: concentration flag disagrees with the duration")
    if isinstance(sp.get("castingTime"), dict) and isinstance(sp.get("ritual"), bool):
        if sp["ritual"] != ("or ritual" in norm(sp["castingTime"]["en"])):
            e.append(f"ERROR {sid}: ritual flag disagrees with the casting time")
    return e


def class_lists(en_blocks: list[dict]) -> list[tuple[str, int, str, str, str, int]]:
    """(class id, level, spell name, school, special, page) for every row of the class spell list tables."""
    rows = []
    for b in chapter(en_blocks, "Classes").blocks:
        if b["kind"] != "table" or not (CLASS_PAGES[0] <= b["page"] <= CLASS_PAGES[1]):
            continue
        m = re.fullmatch(r"Level (\d) (\w+) Spells", b["title"]) or re.fullmatch(r"Cantrips \(Level (0) (\w+) Spells\)", b["title"])
        if not m:
            continue
        level, cls = int(m.group(1)), m.group(2).lower()
        for r in b["rows"]:
            if len(r) >= 3:
                rows.append((cls, level, r[0], r[1], r[2], b["page"]))
    return rows


def validate() -> list[str]:
    out: list[str] = []
    data = json.loads((OUT_SRD / "spells.json").read_text(encoding="utf-8"))
    schools, kinds = ts_union("School"), casting_kinds()
    if len(data) != EXPECTED_COUNT:
        out.append(f"ERROR {len(data)} spells instead of {EXPECTED_COUNT}")
    ids = [sp.get("id") for sp in data]
    if ids != sorted(ids) or len(set(ids)) != len(ids):
        out.append("ERROR spells are not sorted by unique id")
    for sp in data:
        out += check_shape(sp, schools, kinds)
    by_id = {sp["id"]: sp for sp in data}
    fr_names = [sp["name"]["fr"] for sp in data]
    for n in sorted({x for x in fr_names if fr_names.count(x) > 1}):
        out.append(f"ERROR French name {n!r} used by several spells")

    # class spell lists
    rows = class_lists(load_blocks("en"))
    if not rows:
        out.append("ERROR no class spell list table found in the Classes chapter")
    listed: dict[str, set[str]] = {}
    class_warn = special_warn = school_warn = 0
    for cls, level, name, school, special, page in rows:
        sid = kebab(name)
        sp = by_id.get(sid)
        if sp is None:
            out.append(f"ERROR {sid}: listed in Level {level} {cls} spells (p. {page}) but not in spells.json")
            continue
        listed.setdefault(sid, set()).add(cls)
        if sp["level"] != level:
            out.append(f"ERROR {sid}: level {sp['level']} but listed as level {level} for {cls} (p. {page})")
        if sp["school"] != school.lower():
            school_warn += 1
            out.append(f"warning {sid}: school {sp['school']} in its description but {school} in the {cls} list (p. {page}) — SRD inconsistency, the description wins")
        flags = {x.strip() for x in special.split(",")} - {"—", "–", ""}
        costly = "m" in sp["components"] and bool(re.search(r"\bGP\b|consume", sp["components"]["m"]["en"]))
        expect = {x for x, on in (("C", sp["concentration"]), ("R", sp["ritual"]), ("M", costly)) if on}
        if flags != expect:
            special_warn += 1
            out.append(f"warning {sid}: Special {special!r} in the {cls} list (p. {page}) vs C/R/M {sorted(expect)} from the description")
    for sid, sp in by_id.items():
        cls = listed.get(sid, set())
        if set(sp["classes"]) != cls:
            class_warn += 1
            out.append(f"warning {sid}: classes {sp['classes']} (italic line) vs class lists {sorted(cls)}")
    out.append(f"info class lists: {len(rows)} rows, {len(listed)} distinct spells; {class_warn} classes disagreements, "
               f"{school_warn} school disagreements, {special_warn} Special-column disagreements")
    return out


if __name__ == "__main__":
    problems = validate()
    for p in problems:
        print(p)
    errors = [p for p in problems if p.startswith("ERROR")]
    print(f"{len(errors)} errors, {len([p for p in problems if p.startswith('warning')])} warnings")
    sys.exit(1 if errors else 0)
