"""Cross-check src/data/srd/spells.json against sources/dnd-5e-srd-markdown/spells.md (CC-BY-4.0, an independent parse
of the same SRD 5.2.1, English only): level, school, classes, casting time, range, components and duration of every spell.

Run:  C:/Users/le_re/miniforge3/python.exe tools/crosscheck_spells.py
check() returns the discrepancies as strings (empty list = the two parses agree).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT, kebab, norm  # noqa: E402

MD = ROOT / "sources" / "dnd-5e-srd-markdown" / "spells.md"
HEADER_RE = re.compile(r"^_(?:Level (\d) (\w+)|(\w+) Cantrip) \((.+)\)_$")
FIELD_RE = re.compile(r"^\*\*(Casting Time|Range|Components?|Duration):\*\*\s*(.*)$")


def parse_md() -> dict[str, dict]:
    text = MD.read_text(encoding="utf-8").split("## Spell Descriptions", 1)[1]
    spells: dict[str, dict] = {}
    cur: dict | None = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#### "):
            cur = {"name": line[5:].strip()}
            continue
        if cur is None:
            continue
        m = HEADER_RE.match(line)
        if m and "level" not in cur:
            cur["level"] = int(m.group(1)) if m.group(1) else 0
            cur["school"] = (m.group(2) or m.group(3)).lower()
            cur["classes"] = sorted(c.strip().lower() for c in m.group(4).split(","))
            spells[kebab(cur["name"])] = cur  # a heading without this line is a stat block, not a spell
            continue
        m = FIELD_RE.match(line)
        if m and "level" in cur:
            key = {"Casting Time": "castingTime", "Range": "range", "Components": "components",
                   "Component": "components", "Duration": "duration"}[m.group(1)]
            cur[key] = m.group(2).strip()
    return spells


def same(a: str, b: str) -> bool:
    def k(s: str) -> str:
        s = norm(s).replace("−", "-").replace("–", "-").replace("\u00ad", "")
        s = re.sub(r"\s*-\s*", "-", s).replace("_", "")  # the Markdown italicizes spell names (_Magic Missile_)
        return s.rstrip(".").strip()
    return k(a) == k(b)


def components_text(sp: dict) -> str:
    c = sp["components"]
    letters = [x for x, on in (("V", c["v"]), ("S", c["s"]), ("M", "m" in c)) if on]
    s = ", ".join(letters)
    if "m" in c:
        s += f" ({c['m']['en']})"
    return s


def check() -> list[str]:
    out: list[str] = []
    ours = {sp["id"]: sp for sp in json.loads((OUT_SRD / "spells.json").read_text(encoding="utf-8"))}
    md = parse_md()
    for sid in sorted(set(md) - set(ours)):
        out.append(f"{sid}: in the Markdown, not in spells.json")
    for sid in sorted(set(ours) - set(md)):
        out.append(f"{sid}: in spells.json, not in the Markdown")
    for sid in sorted(set(ours) & set(md)):
        a, b = ours[sid], md[sid]
        if a["level"] != b["level"]:
            out.append(f"{sid}: level {a['level']} vs md {b['level']}")
        if a["school"] != b["school"]:
            out.append(f"{sid}: school {a['school']} vs md {b['school']}")
        if a["classes"] != b["classes"]:
            out.append(f"{sid}: classes {a['classes']} vs md {b['classes']}")
        for key in ("castingTime", "range", "duration"):
            if key not in b:
                out.append(f"{sid}: md has no {key}")
            elif not same(a[key]["en"], b[key]):
                out.append(f"{sid}: {key} {a[key]['en']!r} vs md {b[key]!r}")
        if "components" not in b:
            out.append(f"{sid}: md has no components")
        elif not same(components_text(a), b["components"]):
            out.append(f"{sid}: components {components_text(a)!r} vs md {b['components']!r}")
    return out


if __name__ == "__main__":
    problems = check()
    for p in problems:
        print(p)
    print(f"{len(problems)} discrepancies")
    sys.exit(1 if problems else 0)
