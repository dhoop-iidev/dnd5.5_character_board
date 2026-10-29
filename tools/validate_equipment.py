"""Validate the equipment and magic item JSON (src/data/srd/weapons.json, armor.json, gear.json, weapon-properties.json,
magic-items.json, magic-item-rarity.json) against the shapes of src/data/types.ts: fields, string unions, counts, pages
inside the chapter ranges, both languages present, and every `baseItem` of a magic item pointing to a weapon or armor id.

Run:  C:/Users/le_re/miniforge3/python.exe tools/validate_equipment.py
validate() returns the problems as strings ("ERROR …" / "warning …"); an empty list means the data is consistent.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT  # noqa: E402

TYPES = ROOT / "src" / "data" / "types.ts"
EQUIPMENT_PAGES = {"en": (89, 103), "fr": (95, 110)}
MAGIC_PAGES = {"en": (204, 253), "fr": (215, 266)}
# SRD 5.2.1 counts: 38 weapons (10 + 4 + 18 + 6), 13 armor rows (3 + 5 + 4 + shield), 10 + 8 properties, 25 tools,
# 82 Adventuring Gear rows, 5 ammunition rows, 8 mounts, 10 tack rows, 7 ships, 258 magic items, 6 rarities.
EXPECTED = {"weapons": 38, "armor": 13, "weapon-properties": 18, "magic-items": 258, "magic-item-rarity": 6}
EXPECTED_GEAR = {"tool": 25, "gear": 82, "ammunition": 5, "mount": 8}

WEAPON_REQ = {"id", "name", "category", "kind", "damage", "damageType", "properties", "mastery", "weight", "cost", "source"}
WEAPON_OPT = {"versatile", "range", "ammunition"}
ARMOR_REQ = {"id", "name", "category", "dex", "stealthDisadvantage", "don", "doff", "weight", "cost", "source"}
ARMOR_OPT = {"baseAc", "bonus", "strength"}
GEAR_REQ = {"id", "name", "kind", "source"}
GEAR_OPT = {"weight", "cost", "tool", "text"}
PROP_REQ = {"id", "name", "kind", "text", "source"}
MAGIC_REQ = {"id", "name", "kind", "rarity", "attunement", "text", "source"}
MAGIC_OPT = {"attunementBy", "baseItem", "variants", "weight", "modifiers", "grants", "charges"}


def ts_union(name: str) -> set[str]:
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(rf"export type {name} =((?:\s*\|?\s*'[^']+')+)", src)
    if not m:
        raise KeyError(name)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def ts_field_union(field: str) -> set[str]:
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(rf"\n\s*{field}\??:((?:\s*\|?\s*'[^']+')+)", src)
    if not m:
        raise KeyError(field)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def load(name: str):
    p = OUT_SRD / f"{name}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def is_i18n(v, allow_empty_fr: bool = False) -> bool:
    return (isinstance(v, dict) and set(v) in ({"en", "fr"}, {"en", "fr", "es"}) and all(isinstance(x, str) for x in v.values())
            and bool(v["en"]) and (allow_empty_fr or bool(v["fr"])))


def is_weight(v) -> bool:
    return isinstance(v, dict) and set(v) == {"lb", "kg"} and all(isinstance(x, (int, float)) for x in v.values())


def is_cost(v) -> bool:
    return isinstance(v, dict) and set(v) == {"gp", "text"} and isinstance(v["gp"], (int, float)) and is_i18n(v["text"])


def check_source(e: list[str], what: str, src, pages: dict[str, tuple[int, int]]) -> None:
    if not isinstance(src, dict) or "page" not in src or "frPage" not in src:
        e.append(f"ERROR {what}: source without page / frPage: {src!r}")
        return
    for key, lang in (("page", "en"), ("frPage", "fr")):
        lo, hi = pages[lang]
        if not (lo <= src[key] <= hi):
            e.append(f"ERROR {what}: {key} {src[key]} outside the chapter ({lo}-{hi})")
    if not src.get("section"):
        e.append(f"warning {what}: source without section")


def check_fields(e: list[str], what: str, d: dict, req: set[str], opt: set[str]) -> None:
    keys = set(d)
    if not req <= keys:
        e.append(f"ERROR {what}: missing fields {sorted(req - keys)}")
    extra = keys - req - opt
    if extra:
        e.append(f"ERROR {what}: unexpected fields {sorted(extra)}")


def validate() -> list[str]:
    e: list[str] = []
    weapons, armor, gear, props = load("weapons"), load("armor"), load("gear"), load("weapon-properties")
    magic, rarity = load("magic-items"), load("magic-item-rarity")
    for name, data in (("weapons", weapons), ("armor", armor), ("gear", gear), ("weapon-properties", props),
                       ("magic-items", magic), ("magic-item-rarity", rarity)):
        if data is None:
            e.append(f"ERROR {name}.json missing")
    if any(x is None for x in (weapons, armor, gear, props, magic, rarity)):
        return e

    for name, data in (("weapons", weapons), ("armor", armor), ("weapon-properties", props), ("magic-items", magic),
                       ("magic-item-rarity", rarity)):
        if len(data) != EXPECTED[name]:
            e.append(f"ERROR {name}.json: {len(data)} entries, expected {EXPECTED[name]}")
        ids = [d["id"] for d in data]
        dup = sorted({x for x in ids if ids.count(x) > 1})
        if dup:
            e.append(f"ERROR {name}.json: duplicate ids {dup}")
        if ids != sorted(ids):
            e.append(f"warning {name}.json: not sorted by id")

    wp, mp = ts_union("WeaponProperty"), ts_union("MasteryProperty")
    dmg, cats, acats = ts_union("DamageType"), ts_union("WeaponCategory"), ts_union("ArmorCategory")
    rarities = ts_union("Rarity") | {"varies"}
    gear_kinds = ts_field_union("kind") if False else {"gear", "tool", "ammunition", "mount", "vehicle", "tack", "service"}
    magic_kinds = {"armor", "potion", "ring", "rod", "scroll", "staff", "wand", "weapon", "wondrous"}
    abilities = ts_union("AbilityId")

    for w in weapons:
        what = f"weapon {w.get('id')}"
        check_fields(e, what, w, WEAPON_REQ, WEAPON_OPT)
        if not is_i18n(w.get("name")):
            e.append(f"ERROR {what}: name must be {{en, fr}} non-empty")
        if w.get("category") not in cats:
            e.append(f"ERROR {what}: category {w.get('category')!r}")
        if w.get("kind") not in ("melee", "ranged"):
            e.append(f"ERROR {what}: kind {w.get('kind')!r}")
        if w.get("damage") is not None and not re.fullmatch(r"\d+(d\d+)?", w["damage"]):
            e.append(f"ERROR {what}: damage {w['damage']!r}")
        if (w.get("damage") is None) != (w.get("damageType") is None):
            e.append(f"ERROR {what}: damage and damageType must be both set or both null")
        if w.get("damageType") is not None and w["damageType"] not in dmg:
            e.append(f"ERROR {what}: damageType {w['damageType']!r}")
        bad = [p for p in w.get("properties", []) if p not in wp]
        if bad:
            e.append(f"ERROR {what}: unknown properties {bad}")
        if w.get("mastery") not in mp:
            e.append(f"ERROR {what}: mastery {w.get('mastery')!r}")
        if not is_weight(w.get("weight")) or not is_cost(w.get("cost")):
            e.append(f"ERROR {what}: weight/cost shape")
        if "range" in w:
            r = w["range"]
            ok = isinstance(r, dict) and set(r) == {"normal", "long"} and all(set(x) == {"ft", "m"} for x in r.values())
            if not ok:
                e.append(f"ERROR {what}: range shape {r!r}")
            if "range" not in w.get("properties", []):
                e.append(f"warning {what}: has a range but not the 'range' property")
        if "versatile" in w and "versatile" not in w.get("properties", []):
            e.append(f"ERROR {what}: versatile damage without the property")
        if "ammunition" in w.get("properties", []) and not w.get("ammunition"):
            e.append(f"ERROR {what}: Ammunition property without an ammunition kind")
        check_source(e, what, w.get("source"), EQUIPMENT_PAGES)

    for a in armor:
        what = f"armor {a.get('id')}"
        check_fields(e, what, a, ARMOR_REQ, ARMOR_OPT)
        if not is_i18n(a.get("name")) or not is_i18n(a.get("don")) or not is_i18n(a.get("doff")):
            e.append(f"ERROR {what}: name/don/doff must be {{en, fr}} non-empty")
        if a.get("category") not in acats:
            e.append(f"ERROR {what}: category {a.get('category')!r}")
        if a.get("dex") not in ("full", "max2", "none"):
            e.append(f"ERROR {what}: dex {a.get('dex')!r}")
        if a.get("category") == "shield":
            if "bonus" not in a or "baseAc" in a:
                e.append(f"ERROR {what}: a shield has bonus, not baseAc")
        elif "baseAc" not in a or "bonus" in a:
            e.append(f"ERROR {what}: armor has baseAc, not bonus")
        if a.get("category") in ("heavy", "shield") and a.get("dex") != "none":
            e.append(f"ERROR {what}: heavy armor and shields add no Dex")
        if a.get("category") == "medium" and a.get("dex") != "max2":
            e.append(f"ERROR {what}: medium armor adds Dex (max 2)")
        if a.get("category") == "light" and a.get("dex") != "full":
            e.append(f"ERROR {what}: light armor adds the full Dex modifier")
        if not isinstance(a.get("stealthDisadvantage"), bool):
            e.append(f"ERROR {what}: stealthDisadvantage must be boolean")
        if not is_weight(a.get("weight")) or not is_cost(a.get("cost")):
            e.append(f"ERROR {what}: weight/cost shape")
        check_source(e, what, a.get("source"), EQUIPMENT_PAGES)

    kinds_count: dict[str, int] = {}
    for g in gear:
        what = f"gear {g.get('id')}"
        check_fields(e, what, g, GEAR_REQ, GEAR_OPT)
        kinds_count[g.get("kind")] = kinds_count.get(g.get("kind"), 0) + 1
        if not is_i18n(g.get("name")):
            e.append(f"ERROR {what}: name must be {{en, fr}} non-empty")
        if g.get("kind") not in gear_kinds:
            e.append(f"ERROR {what}: kind {g.get('kind')!r}")
        if "weight" in g and not is_weight(g["weight"]):
            e.append(f"ERROR {what}: weight shape")
        if "cost" in g and not is_cost(g["cost"]):
            e.append(f"ERROR {what}: cost shape")
        if "text" in g and not is_i18n(g["text"]):
            e.append(f"ERROR {what}: text must be {{en, fr}} non-empty")
        if g.get("kind") == "tool":
            t = g.get("tool")
            if not isinstance(t, dict) or t.get("ability") not in abilities or not is_i18n(t.get("utilize")):
                e.append(f"ERROR {what}: tool block {t!r}")
            else:
                for k in ("craft", "variants"):
                    if k in t and not is_i18n(t[k]):
                        e.append(f"ERROR {what}: tool.{k} must be {{en, fr}} non-empty")
        elif "tool" in g:
            e.append(f"ERROR {what}: tool block on a non-tool")
        if g.get("kind") in ("gear", "ammunition") and "cost" not in g and not re.search(r"focus|symbol|ammunition", g["id"]):
            e.append(f"warning {what}: no cost")
        check_source(e, what, g.get("source"), EQUIPMENT_PAGES)
    for k, n in EXPECTED_GEAR.items():
        if kinds_count.get(k, 0) != n:
            e.append(f"ERROR gear.json: {kinds_count.get(k, 0)} entries of kind {k!r}, expected {n}")

    prop_ids = set()
    for p in props:
        what = f"weapon property {p.get('id')}"
        check_fields(e, what, p, PROP_REQ, set())
        prop_ids.add(p.get("id"))
        if p.get("kind") == "property" and p.get("id") not in wp or p.get("kind") == "mastery" and p.get("id") not in mp:
            e.append(f"ERROR {what}: id/kind mismatch")
        if not is_i18n(p.get("name")) or not is_i18n(p.get("text")):
            e.append(f"ERROR {what}: name/text must be {{en, fr}} non-empty")
        check_source(e, what, p.get("source"), EQUIPMENT_PAGES)
    missing = (wp | mp) - prop_ids
    if missing:
        e.append(f"ERROR weapon-properties.json: no definition for {sorted(missing)}")
    used = {p for w in weapons for p in w["properties"]} | {w["mastery"] for w in weapons}
    unused = (wp | mp) - used
    if unused:
        e.append(f"warning weapon-properties: {sorted(unused)} used by no weapon")

    base_ids = {w["id"] for w in weapons} | {a["id"] for a in armor}
    for m in magic:
        what = f"magic item {m.get('id')}"
        check_fields(e, what, m, MAGIC_REQ, MAGIC_OPT)
        if not is_i18n(m.get("name")):
            e.append(f"ERROR {what}: name must be {{en, fr}} non-empty")
        if m.get("kind") not in magic_kinds:
            e.append(f"ERROR {what}: kind {m.get('kind')!r}")
        if m.get("rarity") not in rarities:
            e.append(f"ERROR {what}: rarity {m.get('rarity')!r}")
        if not isinstance(m.get("attunement"), bool):
            e.append(f"ERROR {what}: attunement must be boolean")
        if "attunementBy" in m:
            if not m["attunement"]:
                e.append(f"ERROR {what}: attunementBy without attunement")
            if not is_i18n(m["attunementBy"]):
                e.append(f"ERROR {what}: attunementBy must be {{en, fr}} non-empty")
        if "baseItem" in m and m["baseItem"] not in base_ids:
            e.append(f"ERROR {what}: baseItem {m['baseItem']!r} is not a weapon or armor id")
        if "baseItem" in m and m["kind"] not in ("armor", "weapon"):
            e.append(f"ERROR {what}: baseItem on a {m['kind']}")
        if not is_i18n(m.get("text")):
            e.append(f"ERROR {what}: text must be {{en, fr}} non-empty")
        if "variants" in m:
            if m["rarity"] != "varies":
                e.append(f"ERROR {what}: variants but rarity {m['rarity']!r}")
            for v in m["variants"]:
                if not is_i18n(v.get("name")) or v.get("rarity") not in rarities - {"varies"}:
                    e.append(f"ERROR {what}: variant {v!r}")
        elif m["rarity"] == "varies":
            e.append(f"warning {what}: rarity varies without a variants table (run-in variants in the text)")
        if "charges" in m:
            c = m["charges"]
            if not isinstance(c, dict) or set(c) != {"max", "recharge"} or not isinstance(c["max"], (int, str)) \
                    or not is_i18n(c["recharge"], allow_empty_fr=True) and c["recharge"] != {"en": "", "fr": ""}:
                e.append(f"ERROR {what}: charges shape {c!r}")
        check_source(e, what, m.get("source"), MAGIC_PAGES)

    rids = {r["id"] for r in rarity}
    if rids != ts_union("Rarity"):
        e.append(f"ERROR magic-item-rarity.json: ids {sorted(rids)} vs types.ts Rarity")
    for r in rarity:
        if not is_i18n(r.get("name")) or not is_i18n(r.get("text")):
            e.append(f"ERROR rarity {r.get('id')}: name/text must be {{en, fr}} non-empty")
        if r.get("value") is None and r.get("id") != "artifact":
            e.append(f"ERROR rarity {r.get('id')}: no value")
        check_source(e, f"rarity {r.get('id')}", r.get("source"), MAGIC_PAGES)
    return e


if __name__ == "__main__":
    problems = validate()
    for p in problems:
        print(p)
    print(f"{len(problems)} problem(s)")
    sys.exit(1 if any(p.startswith("ERROR") for p in problems) else 0)
