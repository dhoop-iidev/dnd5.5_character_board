"""Validate src/data/srd/*.json against src/data/types.ts (hand-written schema checks), cross-references and pages.
Exit code 1 on errors. Also runs the per-kind validators (validate_<kind>.py: validate() -> list[str]) when present.

Run:  C:/Users/le_re/miniforge3/python.exe tools/validate_data.py
"""
from __future__ import annotations

import importlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
SRD = ROOT / "src" / "data" / "srd"
ERR: list[str] = []
WARN: list[str] = []

ABILITIES = {"str", "dex", "con", "int", "wis", "cha"}
SKILLS = {"acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
          "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand",
          "stealth", "survival"}
SIZES = {"tiny", "small", "medium", "large", "huge", "gargantuan"}
ID_RE = re.compile(r"^[a-z0-9]+([-:][a-z0-9]+)*$")
# Chapter page ranges of the two PDFs (English / French), from the bookmarks and the French contents.
PAGES = {
    "Playing the Game": ((5, 18), (5, 19)), "Character Creation": ((19, 27), (20, 29)), "Classes": ((28, 82), (30, 86)),
    "Character Origins": ((83, 86), (87, 91)), "Feats": ((87, 88), (92, 94)), "Equipment": ((89, 103), (95, 110)),
    "Spells": ((104, 175), (111, 186)), "Rules Glossary": ((176, 191), (187, 202)),
}
# The same chapters in the Spanish PDF (SP_SRD_CC_v5.2.1.pdf, chapter headings of sources/extracted/es.json).
ES_PAGES = {
    "Playing the Game": (5, 20), "Character Creation": (21, 31), "Classes": (32, 88), "Character Origins": (89, 93),
    "Feats": (94, 96), "Equipment": (97, 113), "Spells": (114, 193), "Rules Glossary": (194, 210),
}


def err(where, msg):
    ERR.append(f"{where}: {msg}")


def load(name):
    p = SRD / name
    if not p.exists():
        WARN.append(f"{name}: missing (not built yet)")
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(name, f"does not parse: {e}")
        return None


def i18n(where, v, allow_empty_fr=False, allow_empty=False):
    if not (isinstance(v, dict) and set(v) in ({"en", "fr"}, {"en", "fr", "es"}) and all(isinstance(v[k], str) for k in v)):
        err(where, f"bad I18n {str(v)[:80]}")
        return
    if not allow_empty and not v["en"].strip():
        err(where, "empty English text")
    if not allow_empty_fr and not allow_empty and not v["fr"].strip():
        err(where, "empty French text")


def source(where, s, chapter):
    allowed = {"page", "frPage", "esPage", "section", "houseRule"}
    if not isinstance(s, dict) or set(s) - allowed or "page" not in s:
        err(where, f"bad Source {s}")
        return
    (lo, hi), (flo, fhi) = PAGES[chapter]
    if not lo <= s["page"] <= hi:
        err(where, f"page {s['page']} outside {chapter} ({lo}–{hi})")
    if "frPage" in s and not flo <= s["frPage"] <= fhi:
        err(where, f"frPage {s['frPage']} outside {chapter} ({flo}–{fhi})")
    elo, ehi = ES_PAGES[chapter]
    if "esPage" in s and not elo <= s["esPage"] <= ehi:
        err(where, f"esPage {s['esPage']} outside {chapter} ({elo}–{ehi})")


def ids_unique(where, items):
    seen = set()
    for x in items:
        if not ID_RE.match(x["id"]):
            err(where, f"bad id {x['id']!r}")
        if x["id"] in seen:
            err(where, f"duplicate id {x['id']!r}")
        seen.add(x["id"])


def check_rules(r):
    w = "rules.json"
    if len(r["proficiencyBonus"]) != 20 or r["proficiencyBonus"] != [2] * 4 + [3] * 4 + [4] * 4 + [5] * 4 + [6] * 4:
        err(w, f"proficiencyBonus {r['proficiencyBonus']}")
    if len(r["xpByLevel"]) != 20 or r["xpByLevel"][0] != 0 or r["xpByLevel"][-1] != 355000:
        err(w, f"xpByLevel {r['xpByLevel']}")
    ms = r["multiclassSlots"]
    if len(ms) != 20 or any(len(x) != 9 for x in ms) or ms[0] != [2, 0, 0, 0, 0, 0, 0, 0, 0] or ms[19] != [4, 3, 3, 3, 3, 2, 2, 1, 1]:
        err(w, f"multiclassSlots {ms[0]} … {ms[-1]}")
    if r["standardArray"] != [15, 14, 13, 12, 10, 8] or r["pointCost"].get("15") != 9 or r["pointCost"].get("8") != 0:
        err(w, "standardArray / pointCost")
    if len(r["standardArrayByClass"]) != 12:
        err(w, "standardArrayByClass should have 12 classes")
    for row in r["abilityModifiers"]:
        if not (1 <= row["from"] <= row["to"] <= 30):
            err(w, f"abilityModifiers {row}")


def check_skills(skills):
    w = "skills.json"
    ids_unique(w, skills)
    if {s["id"] for s in skills} != SKILLS:
        err(w, "the 18 skills")
    for s in skills:
        i18n(f"{w}:{s['id']}.name", s["name"])
        i18n(f"{w}:{s['id']}.text", s["text"])
        if s["ability"] not in ABILITIES:
            err(w, f"{s['id']}: ability {s['ability']}")
        source(f"{w}:{s['id']}", s["source"], "Playing the Game")


def check_conditions(conds):
    w = "conditions.json"
    ids_unique(w, conds)
    if len(conds) != 15:
        err(w, f"{len(conds)} conditions, expected 15")
    for c in conds:
        i18n(f"{w}:{c['id']}.name", c["name"])
        i18n(f"{w}:{c['id']}.text", c["text"])
        source(f"{w}:{c['id']}", c["source"], "Rules Glossary")


def check_glossary(gl):
    w = "glossary.json"
    ids_unique(w, gl)
    if len(gl) != 155:
        err(w, f"{len(gl)} entries, expected 155")
    no_fr = 0
    for g in gl:
        i18n(f"{w}:{g['id']}.name", g["name"], allow_empty_fr=True)
        i18n(f"{w}:{g['id']}.text", g["text"], allow_empty_fr=True)
        if not g["text"]["fr"]:
            no_fr += 1
        source(f"{w}:{g['id']}", g["source"], "Rules Glossary")
    if no_fr:
        WARN.append(f"{w}: {no_fr} entries without French text")


def check_classes(classes, spells, feats):
    w = "classes.json"
    ids_unique(w, classes)
    if len(classes) != 12:
        err(w, f"{len(classes)} classes")
    spell_ids = {s["id"] for s in spells} if spells else None
    for c in classes:
        cw = f"{w}:{c['id']}"
        i18n(cw + ".name", c["name"])
        source(cw, c["source"], "Classes")
        if c["hitDie"] not in (6, 8, 10, 12):
            err(cw, f"hitDie {c['hitDie']}")
        if not c["primaryAbility"] or set(c["primaryAbility"]) - ABILITIES:
            err(cw, f"primaryAbility {c['primaryAbility']}")
        if len(c["saveProficiencies"]) != 2 or set(c["saveProficiencies"]) - ABILITIES:
            err(cw, f"saveProficiencies {c['saveProficiencies']}")
        sk = c["skillChoices"]
        if not (isinstance(sk["count"], int) and 1 <= sk["count"] <= 4) or (sk["from"] != "any" and (not sk["from"] or set(sk["from"]) - SKILLS)):
            err(cw, f"skillChoices {sk}")
        for wp in c["weaponProficiencies"]:
            if wp not in ("simple", "martial", "martial:finesse-or-light", "martial:light"):
                err(cw, f"weaponProficiencies {wp!r}")
        if set(c["armorTraining"]) - {"light", "medium", "heavy", "shield"}:
            err(cw, f"armorTraining {c['armorTraining']}")
        i18n(cw + ".startingEquipment", c["startingEquipment"])
        i18n(cw + ".multiclass.text", c["multiclass"]["text"])
        if len(c["table"]) != 20:
            err(cw, f"table has {len(c['table'])} rows")
        pb_expected = [2] * 4 + [3] * 4 + [4] * 4 + [5] * 4 + [6] * 4
        for row, pb in zip(c["table"], pb_expected):
            rw = f"{cw}.table[{row['level']}]"
            if row["pb"] != pb:
                err(rw, f"pb {row['pb']} != {pb}")
            for f in row["features"]:
                i18n(rw + ".features", f)
            if "slots" in row and (len(row["slots"]) > 9 or any(not isinstance(x, int) or x < 0 or x > 4 for x in row["slots"])):
                err(rw, f"slots {row['slots']}")
            if "pact" in row and not (1 <= row["pact"]["slots"] <= 4 and 1 <= row["pact"]["level"] <= 5):
                err(rw, f"pact {row['pact']}")
        col_ids = {col["id"] for col in c["columns"]}
        for row in c["table"]:
            for k in row["resources"]:
                if k not in col_ids:
                    err(cw, f"resource {k!r} not a declared column")
        # features
        names = set()
        for f in c["features"]:
            fw = f"{w}:{f['id']}"
            if not f["id"].startswith(c["id"] + ":"):
                err(fw, "id prefix")
            if not 1 <= f["level"] <= 20:
                err(fw, f"level {f['level']}")
            i18n(fw + ".name", f["name"])
            i18n(fw + ".text", f["text"])
            source(fw, f["source"], "Classes")
            names.add(f["name"]["en"])
        # every feature named in the table exists (apart from the generic placeholders)
        generic = {"Ability Score Improvement", "Epic Boon", "Subclass feature", f"{c['name']['en']} Subclass"}
        for row in c["table"]:
            for f in row["features"]:
                base = re.sub(r"\s*\(.*\)$", "", f["en"])
                if base not in names and base not in generic:
                    err(cw, f"table feature {f['en']!r} (level {row['level']}) has no feature entry")
        # Every class improves at 4, 8, 12 and 16; the Fighter adds 6 and 14, the Rogue 10 (SRD class tables).
        extra = {"fighter": [6, 14], "rogue": [10]}.get(c["id"], [])
        if c["asiLevels"] != sorted([4, 8, 12, 16] + extra):
            err(cw, f"asiLevels {c['asiLevels']}")
        if len(c["subclasses"]) != 1:
            err(cw, f"{len(c['subclasses'])} subclasses, expected 1")
        for sub in c["subclasses"]:
            sw = f"{w}:{sub['id']}"
            i18n(sw + ".name", sub["name"])
            source(sw, sub["source"], "Classes")
            if len(sub["features"]) < 4:
                err(sw, f"{len(sub['features'])} features")
            for f in sub["features"]:
                i18n(f"{w}:{f['id']}.name", f["name"])
                i18n(f"{w}:{f['id']}.text", f["text"])
                if f.get("subclass") != sub["id"]:
                    err(f"{w}:{f['id']}", "subclass field")
            for lv in sub.get("spells", []):
                for sid in lv["spells"]:
                    if spell_ids is not None and sid not in spell_ids:
                        err(sw, f"subclass spell {sid!r} not in spells.json")
        for key, opts in c.get("options", {}).items():
            for o in opts:
                i18n(f"{w}:{o['id']}.name", o["name"])
                i18n(f"{w}:{o['id']}.text", o["text"])
        sc = c.get("spellcasting")
        caster = c["id"] in ("bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard")
        if bool(sc) != caster:
            err(cw, f"spellcasting present={bool(sc)} for a {'caster' if caster else 'non-caster'}")
        if sc:
            if sc["ability"] not in ABILITIES or sc["kind"] not in ("full", "half", "pact") or sc["change"] not in ("long-rest", "level"):
                err(cw, f"spellcasting {sc}")
            if not c.get("spellList"):
                err(cw, "caster without spellList")
            for lv in c.get("spellList", []):
                if not 0 <= lv["level"] <= 9 or not lv["spells"]:
                    err(cw, f"spellList level {lv['level']}")
                for sid in lv["spells"]:
                    if spell_ids is not None and sid not in spell_ids:
                        err(cw, f"spell list entry {sid!r} not in spells.json")
            has_slots = any("slots" in r for r in c["table"]) or any("pact" in r for r in c["table"])
            if not has_slots:
                err(cw, "caster table without slots")
        elif c.get("spellList"):
            err(cw, "non-caster with spellList")


def check_species(species, feats):
    w = "species.json"
    ids_unique(w, species)
    if len(species) != 9:
        err(w, f"{len(species)} species, expected 9")
    for s in species:
        sw = f"{w}:{s['id']}"
        i18n(sw + ".name", s["name"])
        i18n(sw + ".creatureType", s["creatureType"])
        i18n(sw + ".sizeText", s["sizeText"])
        if not s["size"] or set(s["size"]) - SIZES:
            err(sw, f"size {s['size']}")
        if not (isinstance(s["speed"], dict) and s["speed"]["ft"] in (30, 35) and abs(s["speed"]["m"] - s["speed"]["ft"] * 0.3) < 0.01):
            err(sw, f"speed {s['speed']}")
        if len(s["traits"]) < 3:
            err(sw, f"{len(s['traits'])} traits")
        for t in s["traits"]:
            i18n(f"{w}:{t['id']}.name", t["name"])
            i18n(f"{w}:{t['id']}.text", t["text"])
            source(f"{w}:{t['id']}", t["source"], "Character Origins")
        source(sw, s["source"], "Character Origins")


def check_backgrounds(bgs, feats):
    w = "backgrounds.json"
    ids_unique(w, bgs)
    if len(bgs) != 4:
        err(w, f"{len(bgs)} backgrounds, expected 4")
    feat_ids = {f["id"] for f in feats} if feats else None
    for b in bgs:
        bw = f"{w}:{b['id']}"
        i18n(bw + ".name", b["name"])
        if len(b["abilities"]) != 3 or set(b["abilities"]) - ABILITIES:
            err(bw, f"abilities {b['abilities']}")
        if feat_ids is not None and b["feat"] not in feat_ids:
            err(bw, f"feat {b['feat']!r} not in feats.json")
        if len(b["skills"]) != 2 or set(b["skills"]) - SKILLS:
            err(bw, f"skills {b['skills']}")
        for k in ("featText", "tool", "equipment", "text"):
            i18n(f"{bw}.{k}", b[k])
        source(bw, b["source"], "Character Origins")


def check_feats(feats):
    w = "feats.json"
    ids_unique(w, feats)
    if len(feats) != 17:
        err(w, f"{len(feats)} feats, expected 17")
    cats = {"origin": 4, "general": 2, "fighting-style": 4, "epic-boon": 7}
    for cat, n in cats.items():
        if sum(1 for f in feats if f["category"] == cat) != n:
            err(w, f"{cat}: expected {n} feats")
    for f in feats:
        fw = f"{w}:{f['id']}"
        i18n(fw + ".name", f["name"])
        i18n(fw + ".categoryText", f["categoryText"])
        i18n(fw + ".text", f["text"])
        source(fw, f["source"], "Feats")
        if f["category"] == "general" and f.get("prereq", {}).get("level") != 4:
            err(fw, "General feats require level 4+")
        if f["category"] == "epic-boon" and f.get("prereq", {}).get("level") != 19:
            err(fw, "Epic Boon feats require level 19+")
        if f["category"] == "fighting-style" and f.get("prereq", {}).get("feature") != "fighting-style":
            err(fw, "Fighting Style feats require the Fighting Style feature")
        if f["category"] in ("general", "epic-boon") and not f.get("abilityIncrease") and f["id"] != "ability-score-improvement":
            err(fw, "General and Epic Boon feats include an Ability Score Increase")
        if "prereq" in f:
            i18n(fw + ".prereq.text", f["prereq"]["text"])


def check_spanish() -> None:
    """Report the I18n fields (non-empty English text) that have no Spanish text (`es`): every generated file and the
    hand-written data of src/data/custom (effects, summaries, damage types)."""
    for p in sorted(SRD.glob("*.json")) + sorted((ROOT / "src" / "data" / "custom").rglob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        missing: list[str] = []
        total = 0

        def walk(x, path):
            nonlocal total
            if isinstance(x, dict):
                if "en" in x and "fr" in x and set(x) <= {"en", "fr", "es"} and isinstance(x["en"], str):
                    if x["en"].strip():
                        total += 1
                        if not str(x.get("es", "")).strip():
                            missing.append(path)
                    return
                for k, v in x.items():
                    walk(v, f"{path}.{k}" if path else k)
            elif isinstance(x, list):
                for i, v in enumerate(x):
                    walk(v, f"{path}[{v.get('id', i) if isinstance(v, dict) else i}]")

        walk(data, "")
        if missing:
            WARN.append(f"{p.relative_to(ROOT / 'src' / 'data').as_posix()}: {len(missing)}/{total} I18n fields without Spanish text (es): {missing[:5]}"
                        + (" …" if len(missing) > 5 else ""))


def main() -> int:
    rules = load("rules.json")
    skills = load("skills.json")
    conditions = load("conditions.json")
    glossary = load("glossary.json")
    classes = load("classes.json")
    species = load("species.json")
    backgrounds = load("backgrounds.json")
    feats = load("feats.json")
    spells = load("spells.json")
    if rules:
        check_rules(rules)
    if skills:
        check_skills(skills)
    if conditions:
        check_conditions(conditions)
    if glossary:
        check_glossary(glossary)
    if classes:
        check_classes(classes, spells, feats)
    if species:
        check_species(species, feats)
    if backgrounds:
        check_backgrounds(backgrounds, feats)
    if feats:
        check_feats(feats)
    check_spanish()
    for name in ("validate_spells", "validate_equipment", "validate_creatures", "validate_magic_items"):
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError as e:
            if e.name == name:
                WARN.append(f"{name}: not written yet")
                continue
            raise
        for msg in mod.validate():
            (WARN if msg.lower().startswith(("warning", "info")) else ERR).append(f"{name}: {msg}")
    for w in WARN:
        print("warning:", w)
    for e in ERR:
        print("ERROR:", e)
    print(f"{len(ERR)} errors, {len(WARN)} warnings")
    return 1 if ERR else 0


if __name__ == "__main__":
    sys.exit(main())
