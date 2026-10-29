"""Cross-check src/data/srd/creatures.json against sources/dnd-5e-srd-markdown/monsters-A-Z.md and animals.md (CC-BY-4.0,
an independent parse of the same SRD 5.2.1, English only): AC, HP, CR, the six ability scores (plus modifiers and saves)
and the number of entries per section (Traits, Actions, Bonus Actions, Reactions, Legendary Actions) of every creature.

Run:  C:/Users/le_re/miniforge3/python.exe tools/crosscheck_creatures.py
check() returns the discrepancies as strings (empty list = the two parses agree). The four spell-summoned creatures are
not in these two Markdown files and are skipped.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT, kebab, parse_number  # noqa: E402

MD_FILES = [ROOT / "sources" / "dnd-5e-srd-markdown" / "monsters-A-Z.md",
            ROOT / "sources" / "dnd-5e-srd-markdown" / "animals.md"]
SECTIONS = {"traits": "traits", "actions": "actions", "bonus actions": "bonusActions", "reactions": "reactions",
            "legendary actions": "legendaryActions"}
ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]


def parse_md() -> dict[str, dict]:
    """kebab(name) -> {name, ac, hp, cr, abilities{str: (score, mod, save)}, sections{key: count}}."""
    blocks: dict[str, dict] = {}
    for path in MD_FILES:
        lines = path.read_text(encoding="utf-8").splitlines()
        cur: dict | None = None
        sec: str | None = None
        cells: list[str] = []
        for i, line in enumerate(lines):
            s = line.strip()
            if s.startswith("#"):
                title = s.lstrip("#").strip()
                nxt = next((x.strip() for x in lines[i + 1:i + 4] if x.strip()), "")
                if re.fullmatch(r"_[^_]+_", nxt):  # a heading followed by the italic size line = a stat block
                    cur = {"name": title, "abilities": {}, "sections": {}, "file": path.name}
                    blocks[kebab(title)] = cur
                    sec = None
                elif cur is not None and title.lower() in SECTIONS:
                    sec = SECTIONS[title.lower()]
                    cur["sections"][sec] = 0
                else:
                    cur, sec = None, None
                continue
            if cur is None:
                continue
            m = re.match(r"\*\*AC\*\*\s*(\d+)", s)
            if m:
                cur["ac"] = int(m.group(1))
            m = re.match(r"\*\*HP\*\*\s*(\d+)\s*\(([^)]*)\)", s)
            if m:
                cur["hp"] = int(m.group(1))
                cur["dice"] = re.sub(r"\s+", " ", m.group(2)).strip()
            m = re.match(r"\*\*CR\*\*\s*(\S+)", s)
            if m:
                cur["cr"] = None if m.group(1).lower() == "none" else parse_number(m.group(1))
            m = re.match(r"<td>(.*)</td>", s)
            if m:
                # a cell sometimes holds two values ("+10 +10"): split every cell into tokens
                for tok in re.sub(r"<[^>]+>", "", m.group(1)).replace("−", "-").replace("–", "-").split():
                    if tok.lower() in ABILITIES:
                        cells = [tok]  # a new row: an incomplete previous row is dropped
                    elif cells and re.fullmatch(r"[+-]?\d+", tok):
                        cells.append(tok)
                    if len(cells) == 4:
                        cur["abilities"][cells[0].lower()] = tuple(int(x) for x in cells[1:4])
                        cells = []
                continue
            if s.startswith("**_") and sec:
                cur["sections"][sec] += 1
    return blocks


def check() -> list[str]:
    out: list[str] = []
    data = json.loads((OUT_SRD / "creatures.json").read_text(encoding="utf-8"))
    md = parse_md()
    ours = {c["id"]: c for c in data if not c["source"]["section"].startswith("Spells: ")}
    for cid in sorted(set(md) - set(ours)):
        out.append(f"{cid}: in the Markdown ({md[cid]['file']}) but not in creatures.json")
    for cid in sorted(set(ours) - set(md)):
        out.append(f"{cid}: in creatures.json but not in the Markdown")
    for cid in sorted(set(md) & set(ours)):
        c, m = ours[cid], md[cid]
        if c["ac"] != m.get("ac"):
            out.append(f"{cid}: AC {c['ac']} vs Markdown {m.get('ac')}")
        hp = c["hp"]["average"] if c["hp"] else None
        if hp != m.get("hp"):
            out.append(f"{cid}: HP {hp} vs Markdown {m.get('hp')}")
        elif c["hp"] and c["hp"]["dice"].replace("−", "-") != m.get("dice", "").replace("−", "-"):
            out.append(f"{cid}: HP dice {c['hp']['dice']!r} vs Markdown {m.get('dice')!r}")
        if c["cr"] != m.get("cr"):
            out.append(f"{cid}: CR {c['cr']} vs Markdown {m.get('cr')}")
        for k in ABILITIES:
            a = c["abilities"][k]
            mine = (a["score"], a["mod"], a["save"])
            theirs = m["abilities"].get(k)
            if theirs is None:
                out.append(f"{cid}: {k} missing in the Markdown table")
            elif mine[0] != theirs[0]:
                out.append(f"{cid}: {k} score {mine[0]} vs Markdown {theirs[0]}")
            elif mine != theirs:
                out.append(f"{cid}: {k} modifier/save {mine[1:]} vs Markdown {theirs[1:]}")
        for sec in ("traits", "actions", "bonusActions", "reactions", "legendaryActions"):
            n_mine = len(c.get(sec, []))
            n_md = m["sections"].get(sec, 0)
            if n_mine != n_md:
                out.append(f"{cid}: {n_mine} {sec} vs Markdown {n_md}")
    out.append(f"info compared {len(set(md) & set(ours))} creatures with {len(md)} Markdown stat blocks")
    return out


if __name__ == "__main__":
    problems = check()
    for p in problems:
        print(p)
    sys.exit(1 if [p for p in problems if not p.startswith("info")] else 0)
