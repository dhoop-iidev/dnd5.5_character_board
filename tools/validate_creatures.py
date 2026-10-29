"""Validate src/data/srd/creatures.json: shape of every CreatureDef (src/data/types.ts), counts against the SRD's "Index of
Stat Blocks" (EN PDF pages 2-4, read with pymupdf), pages inside the chapter ranges, both languages present everywhere.

Run:  C:/Users/le_re/miniforge3/python.exe tools/validate_creatures.py
validate() returns the problems as strings: "ERROR …" (shape, a stat block of the index missing or an extra one, pages,
an empty language) and "warning …" (an ability modifier that is not floor((score - 10) / 2), e.g. the Young White Dragon's
Int save printed "2" on EN p. 340), plus "info …" lines with the counts.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT, kebab, norm  # noqa: E402

TYPES = ROOT / "src" / "data" / "types.ts"
PDF_EN = ROOT / "sources" / "SRD_CC_v5.2.1.pdf"
INDEX_PAGES = (2, 4)
# chapter page ranges (the "Monsters A–Z" chapter ends and "Animals" starts on EN p. 344 / FR p. 360)
PAGES = {
    "Monsters A–Z": ((258, 344), (272, 360)),
    "Animals": ((344, 364), (360, 380)),
    "Spells": ((104, 175), (111, 186)),
}
SPELL_CREATURES = {"animated-object", "otherworldly-steed", "giant-insect", "draconic-spirit"}
REQUIRED = {"id", "name", "size", "type", "tags", "alignment", "ac", "hp", "speed", "abilities", "senses",
            "passivePerception", "languages", "cr", "xp", "pb", "traits", "actions", "source"}
OPTIONAL = {"group", "flavour", "acText", "initiative", "hpText", "errata", "skills", "resistances", "immunities", "vulnerabilities",
            "gear", "xpInLair", "crText", "bonusActions", "reactions", "legendaryActionsIntro", "legendaryActions"}
ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]
SPEED_MODES = {"walk", "fly", "swim", "climb", "burrow"}


def ts_union(name: str) -> set[str]:
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(rf"export type {name} =((?:\s*\|?\s*'[^']+')+)", src)
    if not m:
        raise KeyError(name)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def ts_fields(interface: str) -> tuple[set[str], set[str]]:
    """(required, optional) field names of an interface in types.ts."""
    src = TYPES.read_text(encoding="utf-8")
    m = re.search(rf"export interface {interface} \{{(.*?)\n\}}", src, re.S)
    if not m:
        raise KeyError(interface)
    body = re.sub(r"/\*\*.*?\*/", "", m.group(1), flags=re.S)
    req, opt = set(), set()
    for line in body.splitlines():
        f = re.match(r"  (\w+)(\??):", line)  # top-level fields only (nested object types are indented deeper)
        if f:
            (opt if f.group(2) else req).add(f.group(1))
    return req, opt


def is_i18n(v, allow_empty: bool = False) -> bool:
    return (isinstance(v, dict) and set(v) in ({"en", "fr"}, {"en", "fr", "es"}) and all(isinstance(x, str) for x in v.values())
            and (allow_empty or all(v.values())))


def is_distance(v) -> bool:
    return isinstance(v, dict) and set(v) == {"ft", "m"} and all(isinstance(x, (int, float)) for x in v.values())


def check_shape(c: dict, sizes: set[str], req: set[str], opt: set[str]) -> list[str]:
    e: list[str] = []
    cid = c.get("id", "?")
    keys = set(c)
    if not req <= keys:
        e.append(f"ERROR {cid}: missing fields {sorted(req - keys)}")
    if keys - req - opt:
        e.append(f"ERROR {cid}: unknown fields {sorted(keys - req - opt)}")
    if not isinstance(c.get("id"), str) or kebab(c.get("name", {}).get("en", "")) != c.get("id"):
        e.append(f"ERROR {cid}: id is not kebab(name.en)")
    for k in ("name", "type", "alignment", "senses", "languages"):
        if not is_i18n(c.get(k)):
            e.append(f"ERROR {cid}: {k} is not a non-empty {{en, fr}}")
    for k in ("group", "flavour", "acText", "hpText", "skills", "resistances", "immunities", "vulnerabilities", "gear",
              "crText", "legendaryActionsIntro"):
        if k in c and not is_i18n(c[k]):
            e.append(f"ERROR {cid}: {k} is not a non-empty {{en, fr}}")
    sz = c.get("size")
    if not (isinstance(sz, list) and sz and all(s in sizes for s in sz) and len(set(sz)) == len(sz)):
        e.append(f"ERROR {cid}: size {sz!r}")
    tags = c.get("tags")
    if not (isinstance(tags, list) and tags and all(isinstance(t, str) and t == kebab(t) and t for t in tags)):
        e.append(f"ERROR {cid}: tags {tags!r}")
    elif isinstance(c.get("type"), dict) and kebab(c["type"]["en"].split()[0]) not in tags and "swarm" not in tags:
        e.append(f"ERROR {cid}: tags {tags} do not start with the type word of {c['type']['en']!r}")
    ac = c.get("ac")
    if ac is None:
        if not is_i18n(c.get("acText")):
            e.append(f"ERROR {cid}: ac null without acText")
    elif not (isinstance(ac, int) and 0 < ac < 40):
        e.append(f"ERROR {cid}: ac {ac!r}")
    ini = c.get("initiative")
    if ini is not None and not (isinstance(ini, dict) and set(ini) == {"mod", "score"} and isinstance(ini["mod"], int)
                                and isinstance(ini["score"], int)):
        e.append(f"ERROR {cid}: initiative {ini!r}")
    elif ini is not None and ini["score"] != 10 + ini["mod"]:
        # The score is 10 + modifier (SRD p. 254: it replaces a roll), 15 + modifier when the creature has Advantage on
        # Initiative: the Invisible Stalker "+7 (22)" (p. 301) has the Invisible condition, whose "Surprise" effect is
        # Advantage on Initiative (Rules Glossary p. 184). The Gray Ooze "−2 (13)" (p. 293) is a misprint corrected by
        # build_creatures.CORRECTIONS after the 2024 Monster Manual.
        invisible = any("Invisible condition" in t["text"]["en"] for t in c.get("traits", []))
        if not (invisible and ini["score"] == 15 + ini["mod"]):
            e.append(f"warning {cid}: initiative {ini['mod']:+d} ({ini['score']}) — the score is not 10 + modifier (as printed)")
    if ini is None and cid not in SPELL_CREATURES:
        e.append(f"ERROR {cid}: no initiative")
    hp = c.get("hp")
    if hp is None:
        if not is_i18n(c.get("hpText")):
            e.append(f"ERROR {cid}: hp null without hpText")
    elif not (isinstance(hp, dict) and set(hp) == {"average", "dice"} and isinstance(hp["average"], int)
              and re.fullmatch(r"\d+d\d+( [+−-] \d+)?", hp["dice"])):
        e.append(f"ERROR {cid}: hp {hp!r}")
    sp = c.get("speed")
    if not (isinstance(sp, dict) and is_i18n(sp.get("text")) and set(sp) - SPEED_MODES - {"hover", "text"} == set()
            and all(is_distance(sp[m]) for m in SPEED_MODES if m in sp) and any(m in sp for m in SPEED_MODES)
            and ("hover" not in sp or sp["hover"] is True)):
        e.append(f"ERROR {cid}: speed {sp!r}")
    else:
        for m in SPEED_MODES:
            if m in sp and abs(sp[m]["m"] - sp[m]["ft"] * 0.3) > 0.01:
                e.append(f"warning {cid}: {m} speed {sp[m]} is not 0.3 m per ft (stored as printed)")
    ab = c.get("abilities")
    if not (isinstance(ab, dict) and list(ab) == ABILITIES and all(
            isinstance(v, dict) and set(v) == {"score", "mod", "save"} and all(isinstance(x, int) for x in v.values())
            for v in ab.values())):
        e.append(f"ERROR {cid}: abilities {ab!r}")
    else:
        for k, v in ab.items():
            if v["mod"] != math.floor((v["score"] - 10) / 2):
                e.append(f"warning {cid}: {k} {v['score']} with modifier {v['mod']:+d}")
            if v["save"] not in (v["mod"], v["mod"] + (c.get("pb") or 0)) and c.get("pb") is not None:
                e.append(f"warning {cid}: {k} save {v['save']:+d} is neither the modifier {v['mod']:+d} nor modifier + PB")
    pp = c.get("passivePerception")
    if not isinstance(pp, int):
        e.append(f"ERROR {cid}: passivePerception {pp!r}")
    elif isinstance(c.get("senses"), dict) and f"Passive Perception {pp}" not in c["senses"]["en"]:
        e.append(f"ERROR {cid}: passivePerception {pp} not in senses {c['senses']['en']!r}")
    cr, xp, pb = c.get("cr"), c.get("xp"), c.get("pb")
    if cr is None or pb is None:
        if not is_i18n(c.get("crText")):
            e.append(f"ERROR {cid}: cr/pb null without crText")
        if cid not in SPELL_CREATURES:
            e.append(f"ERROR {cid}: cr or pb null for a monster")
    else:
        if not (isinstance(cr, (int, float)) and (cr in (0, 0.125, 0.25, 0.5) or (isinstance(cr, int) and 1 <= cr <= 30))):
            e.append(f"ERROR {cid}: cr {cr!r}")
        if not (isinstance(pb, int) and 2 <= pb <= 9):
            e.append(f"ERROR {cid}: pb {pb!r}")
        elif isinstance(cr, (int, float)) and pb != max(2, math.ceil(cr / 4) + 1):
            e.append(f"warning {cid}: pb +{pb} for CR {cr} (table gives +{max(2, math.ceil(cr / 4) + 1)})")
    if not (isinstance(xp, int) and xp >= 0):
        e.append(f"ERROR {cid}: xp {xp!r}")
    if "xpInLair" in c and not (isinstance(c["xpInLair"], int) and c["xpInLair"] > (xp or 0)):
        e.append(f"ERROR {cid}: xpInLair {c['xpInLair']!r}")
    for sec in ("traits", "actions", "bonusActions", "reactions", "legendaryActions"):
        if sec not in c:
            continue
        v = c[sec]
        if not isinstance(v, list):
            e.append(f"ERROR {cid}: {sec} is not a list")
            continue
        if sec not in ("traits", "actions") and not v:
            e.append(f"ERROR {cid}: {sec} is empty")
        for i, en in enumerate(v):
            if not (isinstance(en, dict) and set(en) == {"name", "text"} and is_i18n(en["name"]) and is_i18n(en["text"])):
                e.append(f"ERROR {cid}: {sec}[{i}] is not {{name{{en,fr}}, text{{en,fr}}}} with both languages: "
                         f"{en.get('name') if isinstance(en, dict) else en!r}")
    if "legendaryActionsIntro" in c and "legendaryActions" not in c:
        e.append(f"ERROR {cid}: legendaryActionsIntro without legendaryActions")
    src = c.get("source")
    if not (isinstance(src, dict) and set(src) - {"esPage"} == {"page", "frPage", "section"}):
        e.append(f"ERROR {cid}: source {src!r}")
    else:
        sec = src["section"]
        rng = PAGES.get("Spells" if sec.startswith("Spells: ") else sec)
        if rng is None:
            e.append(f"ERROR {cid}: source section {sec!r}")
        else:
            if not (rng[0][0] <= src["page"] <= rng[0][1]):
                e.append(f"ERROR {cid}: page {src['page']} outside {rng[0]} for {sec}")
            if not (rng[1][0] <= src["frPage"] <= rng[1][1]):
                e.append(f"ERROR {cid}: frPage {src['frPage']} outside {rng[1]} for {sec}")
        if (sec.startswith("Spells: ")) != (cid in SPELL_CREATURES):
            e.append(f"ERROR {cid}: section {sec!r} vs spell creature set")
    return e


def index_of_stat_blocks() -> dict[str, int]:
    """Name -> page from the "Index of Stat Blocks" (EN PDF p. 2-4)."""
    import fitz  # pymupdf

    doc = fitz.open(PDF_EN)
    text = "\n".join(doc[p - 1].get_text() for p in range(INDEX_PAGES[0], INDEX_PAGES[1] + 1))
    text = re.split(r"Index of Stat\s*Blocks", text, maxsplit=1)[1]  # the heading wraps: "Index of Stat \nBlocks"
    out: dict[str, int] = {}
    for m in re.finditer(r"^([A-Z][^.\n]*?)\s*\.{3,}\s*(\d+)\s*$", text, re.M):
        out[m.group(1).strip()] = int(m.group(2))
    return out


def validate() -> list[str]:
    out: list[str] = []
    data = json.loads((OUT_SRD / "creatures.json").read_text(encoding="utf-8"))
    sizes = ts_union("Size")
    req, opt = ts_fields("CreatureDef")
    if req != REQUIRED or opt != OPTIONAL:
        out.append(f"ERROR types.ts CreatureDef fields changed: required {sorted(req ^ REQUIRED)}, optional {sorted(opt ^ OPTIONAL)}")
    ids = [c.get("id") for c in data]
    if ids != sorted(ids) or len(set(ids)) != len(ids):
        out.append("ERROR creatures are not sorted by unique id")
    for c in data:
        out += check_shape(c, sizes, req, opt)
    fr_names = [c["name"]["fr"] for c in data]
    for n in sorted({x for x in fr_names if fr_names.count(x) > 1}):
        out.append(f"ERROR French name {n!r} used by several creatures: {[c['id'] for c in data if c['name']['fr'] == n]}")

    # counts against the index
    by_section: dict[str, list[dict]] = {}
    for c in data:
        sec = c["source"]["section"]
        by_section.setdefault("Spells" if sec.startswith("Spells: ") else sec, []).append(c)
    index = index_of_stat_blocks()
    listed = {norm(n): p for n, p in index.items()}
    have = {norm(c["name"]["en"]): c for c in data if not c["source"]["section"].startswith("Spells: ")}
    for n in sorted(set(listed) - set(have)):
        out.append(f"ERROR index p.{listed[n]}: stat block {n!r} missing from creatures.json")
    for n in sorted(set(have) - set(listed)):
        out.append(f"ERROR {have[n]['id']}: not in the Index of Stat Blocks")
    for n in sorted(set(listed) & set(have)):
        if have[n]["source"]["page"] != listed[n]:
            out.append(f"warning {have[n]['id']}: page {have[n]['source']['page']} but the index says {listed[n]}")
    out.append(f"info {len(data)} creatures: " + ", ".join(f"{k} {len(v)}" for k, v in sorted(by_section.items()))
               + f"; Index of Stat Blocks {len(index)} names")
    return out


if __name__ == "__main__":
    problems = validate()
    for p in problems:
        print(p)
    errors = [p for p in problems if p.startswith("ERROR")]
    print(f"{len(errors)} errors, {len([p for p in problems if p.startswith('warning')])} warnings")
    sys.exit(1 if errors else 0)
