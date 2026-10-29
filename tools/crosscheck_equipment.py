"""Cross-check weapons.json, armor.json and magic-items.json against sources/dnd-5e-srd-markdown/equipment.md and
magic-items.md (CC-BY-4.0, an independent English parse of the same SRD 5.2.1): damage, properties, mastery, weight and
cost of every weapon; AC, Strength, Stealth, weight and cost of every armor; kind, rarity and attunement of every magic
item, plus the item lists themselves.

Run:  C:/Users/le_re/miniforge3/python.exe tools/crosscheck_equipment.py
check() returns the discrepancies as strings (empty list = the two parses agree).
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT_SRD, ROOT, kebab, norm  # noqa: E402

MD_EQUIP = ROOT / "sources" / "dnd-5e-srd-markdown" / "equipment.md"
MD_MAGIC = ROOT / "sources" / "dnd-5e-srd-markdown" / "magic-items.md"
RARITY = {"common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "very-rare", "legendary": "legendary",
          "artifact": "artifact"}
KIND = {"armor": "armor", "potion": "potion", "ring": "ring", "rod": "rod", "scroll": "scroll", "staff": "staff",
        "wand": "wand", "weapon": "weapon", "wondrous item": "wondrous"}


def md_table(text: str, title: str) -> list[list[str]]:
    """Rows of the HTML table that follows the bold title `**Title**` in the Markdown; section rows as ['§ name']."""
    k = text.find(f"**{title}**\n")
    if k < 0:
        raise KeyError(title)
    k = text.find("<table>", k)
    end = text.find("</table>", k)
    body = text[k:end]
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        if "<th colspan" in tr:
            rows.append(["§ " + html.unescape(re.sub(r"<[^>]+>", "", tr).strip())])
        else:
            cells = [html.unescape(re.sub(r"<[^>]+>", "", c).strip()) for c in re.findall(r"<td>(.*?)</td>", tr, re.S)]
            if cells:
                rows.append(cells)
    return rows


def key(s: str) -> str:
    return norm(s).replace("’", "'").replace("'", "").replace("½", " 1/2").replace("  ", " ")


def same_props(a: str, b: str) -> bool:
    return sorted(key(x) for x in a.split(",")) == sorted(key(x) for x in b.split(","))


def check() -> list[str]:
    out: list[str] = []
    text = MD_EQUIP.read_text(encoding="utf-8")
    weapons = {w["id"]: w for w in json.loads((OUT_SRD / "weapons.json").read_text(encoding="utf-8"))}
    armor = {a["id"]: a for a in json.loads((OUT_SRD / "armor.json").read_text(encoding="utf-8"))}
    magic = {m["id"]: m for m in json.loads((OUT_SRD / "magic-items.json").read_text(encoding="utf-8"))}

    # ---- weapons: Name, Damage, Properties, Mastery, Weight, Cost
    seen = set()
    for r in md_table(text, "Weapons"):
        if r[0].startswith("§ "):
            continue
        name, dmg, props, mastery, weight, cost = r
        wid = kebab(name)
        seen.add(wid)
        w = weapons.get(wid)
        if not w:
            out.append(f"weapon {name!r}: in the Markdown, not in weapons.json")
            continue
        md_dmg = "—" if dmg.strip() == "—" else dmg
        ours = f"{w['damage']} {w['damageType'].capitalize()}" if w["damage"] else "—"
        if key(md_dmg) != key(ours):
            out.append(f"weapon {name}: damage MD {dmg!r} vs JSON {ours!r}")
        # properties: rebuild the printed list from the JSON
        parts = []
        for p in w["properties"]:
            if p == "range":
                continue
            label = {"two-handed": "Two-Handed"}.get(p, p.capitalize())
            if p == "versatile":
                label += f" ({w['versatile']})"
            elif p in ("thrown", "ammunition") and "range" in w:
                rng = f"Range {w['range']['normal']['ft']}/{w['range']['long']['ft']}"
                if p == "ammunition":
                    rng += f"; {w['ammunition'].capitalize()}"
                label += f" ({rng})"
            parts.append(label)
        md_props = re.sub(r"\s*\(unless mounted\)", "", props)
        if not same_props(md_props if md_props != "—" else "", ", ".join(parts)):
            out.append(f"weapon {name}: properties MD {props!r} vs JSON {', '.join(parts)!r}")
        if key(mastery) != key(w["mastery"]):
            out.append(f"weapon {name}: mastery MD {mastery!r} vs JSON {w['mastery']!r}")
        md_w = md_weight(weight)
        if md_w is not None and abs(md_w - w["weight"]["lb"]) > 0.001 or md_w is None and w["weight"]["lb"] != 0:
            out.append(f"weapon {name}: weight MD {weight!r} vs JSON {w['weight']['lb']} lb")
        if key(cost) != key(w["cost"]["text"]["en"]):
            out.append(f"weapon {name}: cost MD {cost!r} vs JSON {w['cost']['text']['en']!r}")
    for wid in weapons.keys() - seen:
        out.append(f"weapon {wid!r}: in weapons.json, not in the Markdown")

    # ---- armor: Armor, AC, Strength, Stealth, Weight, Cost
    seen = set()
    for r in md_table(text, "Armor"):
        if r[0].startswith("§ "):
            continue
        name, ac, strength, stealth, weight, cost = r
        aid = kebab(name)
        seen.add(aid)
        a = armor.get(aid)
        if not a:
            out.append(f"armor {name!r}: in the Markdown, not in armor.json")
            continue
        if a["category"] == "shield":
            ours = f"+{a['bonus']}"
        else:
            ours = str(a["baseAc"]) + {"full": " + Dex modifier", "max2": " + Dex modifier (max 2)", "none": ""}[a["dex"]]
        if key(ac) != key(ours):
            out.append(f"armor {name}: AC MD {ac!r} vs JSON {ours!r}")
        md_str = int(re.search(r"\d+", strength).group()) if re.search(r"\d+", strength) else None
        if md_str != a.get("strength"):
            out.append(f"armor {name}: Strength MD {strength!r} vs JSON {a.get('strength')!r}")
        if ("Disadvantage" in stealth) != a["stealthDisadvantage"]:
            out.append(f"armor {name}: Stealth MD {stealth!r} vs JSON {a['stealthDisadvantage']}")
        md_w = md_weight(weight)
        if md_w is None or abs(md_w - a["weight"]["lb"]) > 0.001:
            out.append(f"armor {name}: weight MD {weight!r} vs JSON {a['weight']['lb']} lb")
        if key(cost) != key(a["cost"]["text"]["en"]):
            out.append(f"armor {name}: cost MD {cost!r} vs JSON {a['cost']['text']['en']!r}")
    for aid in armor.keys() - seen:
        out.append(f"armor {aid!r}: in armor.json, not in the Markdown")

    # ---- magic items: "#### Name" then "_Kind (base), Rarity (Requires Attunement...)_"
    mtext = MD_MAGIC.read_text(encoding="utf-8").split("## Magic Items A–Z", 1)[1]
    seen = set()
    cur = None
    for line in mtext.splitlines():
        line = line.strip()
        if line.startswith("#### "):
            cur = line[5:].strip()
            continue
        if cur and line.startswith("_") and line.endswith("_") and "," in line:
            hdr = line.strip("_")
            mid = kebab(cur)
            cur = None
            kind_txt = re.match(r"^([^,(]+)", hdr).group(1).strip().lower()
            kind = KIND.get(kind_txt)
            if kind is None:
                continue  # a creature stat block inside an item (Giant Fly, Avatar of Death), not an item
            m = magic.get(mid)
            if not m:
                out.append(f"magic item {mid!r}: in the Markdown, not in magic-items.json")
                continue
            seen.add(mid)
            if kind != m["kind"]:
                out.append(f"magic item {m['name']['en']}: kind MD {kind_txt!r} vs JSON {m['kind']!r}")
            attune = "Requires Attunement" in hdr
            if attune != m["attunement"]:
                out.append(f"magic item {m['name']['en']}: attunement MD {attune} vs JSON {m['attunement']}")
            rest = re.sub(r"\(Requires Attunement[^)]*\)", "", hdr)
            rest = re.sub(r"^[^,(]+(\([^)]*\))?,?", "", rest)
            found = re.findall(r"(Very Rare|Uncommon|Common|Rare|Legendary|Artifact)(\s*\([^)]*\))?", rest)
            if "Rarity Varies" in rest or len(found) > 1 or (found and found[0][1]):
                rar = "varies"
            elif found:
                rar = RARITY[found[0][0].lower()]
            else:
                rar = None
            if rar != m["rarity"]:
                out.append(f"magic item {m['name']['en']}: rarity MD {rest.strip()!r} vs JSON {m['rarity']!r}")
        elif cur and line.startswith("#### "):
            cur = None
    for mid in magic.keys() - seen:
        out.append(f"magic item {mid!r}: in magic-items.json, not in the Markdown")
    return out


def md_weight(s: str) -> float | None:
    s = s.replace("½", " 1/2").replace("¼", " 1/4")
    m = re.search(r"([\d ./]+)\s*lb", s)
    if not m:
        return None
    total = 0.0
    for part in m.group(1).split():
        if "/" in part:
            a, b = part.split("/")
            total += int(a) / int(b)
        else:
            total += float(part)
    return total


if __name__ == "__main__":
    problems = check()
    for p in problems:
        print(p)
    print(f"{len(problems)} discrepancy(ies)")
    sys.exit(1 if problems else 0)
