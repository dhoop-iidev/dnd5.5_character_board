"""Cross-check classes.json against the independent Markdown SRD (sources/dnd-5e-srd-markdown/classes.md):
class table numbers (Proficiency Bonus, class features, resources, spell slots) and feature headings."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MD = ROOT / "sources" / "dnd-5e-srd-markdown" / "classes.md"


def md_tables(text: str) -> list[tuple[str, list[str], list[list[str]]]]:
    """Tables of the Markdown SRD (written as HTML <table> blocks) with the nearest preceding heading or bold caption."""
    out = []
    pos = 0
    for m in re.finditer(r"<table>(.*?)</table>", text, re.S):
        before = text[pos:m.start()]
        pos = m.end()
        titles = re.findall(r"^(?:#{1,6} (.+)|\*\*([^*]+)\*\*\s*)$", before, re.M)
        title = ""
        if titles:
            a, b = titles[-1]
            title = (a or b).strip()
        rows = []
        for tr in re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S):
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
            rows.append(cells)
        if not rows:
            continue
        # a two-row header (a spanning "Spell Slots per Spell Level" label above the slot numbers): keep the row that
        # names the columns, i.e. the last row made of <th> cells
        n_head = len(re.findall(r"<tr>", re.search(r"<thead>(.*?)</thead>", m.group(1), re.S).group(1))) if "<thead>" in m.group(1) else 1
        header, body = rows[n_head - 1], rows[n_head:]
        out.append((title, header, body))
    return out


def norm_cell(s: str) -> str:
    s = re.sub(r"[*_]", "", s).replace("—", "").replace("–", "").replace("-", "").replace("’", "'").strip()
    s = re.sub(r"^\+(\d)", r"\1", s)
    return re.sub(r"\s+", " ", s)


def check() -> list[str]:
    out: list[str] = []
    classes = json.loads((ROOT / "src/data/srd/classes.json").read_text(encoding="utf-8"))
    text = MD.read_text(encoding="utf-8")
    tables = md_tables(text)
    headings = re.findall(r"^#{3,5} (.+)$", text, re.M)
    for c in classes:
        name = c["name"]["en"]
        t = next((t for t in tables if t[0].lower().startswith(name.lower()) and "features" in t[0].lower() and len(t[2]) == 20), None)
        if t is None:
            out.append(f"{name}: no '{name} Features' table in classes.md")
            continue
        title, header, rows = t
        hdr = [norm_cell(h) for h in header]
        slot_cols = [i for i, h in enumerate(hdr) if re.fullmatch(r"[1-9]", h)]
        for row, md_row in zip(c["table"], rows):
            lvl = row["level"]
            if str(lvl) != norm_cell(md_row[0]):
                out.append(f"{name} level {lvl}: md row level {md_row[0]!r}")
                continue
            if str(row["pb"]) != norm_cell(md_row[1]).replace(" ", ""):
                out.append(f"{name} level {lvl}: PB {row['pb']} vs md {md_row[1]!r}")
            feats = norm_cell(md_row[2])
            ours = ", ".join(f["en"] for f in row["features"]) or ""
            if norm_cell(ours).lower() != feats.lower():
                out.append(f"{name} level {lvl}: features {ours!r} vs md {md_row[2]!r}")
            # resources: compare every non-slot column by header name
            for i, h in enumerate(hdr[3:], start=3):
                if i in slot_cols or i >= len(md_row):
                    continue
                col = next((col for col in c["columns"] if norm_cell(col["name"]["en"]).lower() == h.lower()), None)
                if col is None:
                    if h and lvl == 1:
                        out.append(f"{name}: md column {h!r} not in our columns {[x['name']['en'] for x in c['columns']]}")
                    continue
                ours_v = row["resources"].get(col["id"])
                if col["id"] == "pactSlots":
                    ours_v = row.get("pact", {}).get("slots")
                elif col["id"] == "pactLevel":
                    ours_v = row.get("pact", {}).get("level")
                md_v = norm_cell(md_row[i])
                if norm_cell(str(ours_v) if ours_v is not None else "").lower().replace(" ", "") != md_v.lower().replace(" ", ""):
                    out.append(f"{name} level {lvl}: {h} {ours_v!r} vs md {md_row[i]!r}")
            if slot_cols:
                md_slots = [int(norm_cell(md_row[i]) or 0) for i in slot_cols if i < len(md_row)]
                ours_slots = row.get("slots", [])
                if "pact" in row:
                    continue
                if [x for x in md_slots] != ours_slots + [0] * (len(md_slots) - len(ours_slots)):
                    out.append(f"{name} level {lvl}: slots {ours_slots} vs md {md_slots}")
        # feature headings
        for f in c["features"]:
            h = f"Level {f['level']}: {f['name']['en']}"
            if h.replace("’", "'") not in [x.replace("’", "'") for x in headings]:
                out.append(f"{name}: feature heading {h!r} not found in classes.md")
    return out


if __name__ == "__main__":
    import sys
    msgs = check()
    for m in msgs:
        print(m)
    print(f"{len(msgs)} discrepancies")
    sys.exit(1 if msgs else 0)
