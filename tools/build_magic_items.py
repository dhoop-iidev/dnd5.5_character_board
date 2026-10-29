"""Magic Items chapter (SRD 5.2.1 EN p. 204-253, FR p. 215-266) -> magic-items.json, magic-item-rarity.json.

Shape: MagicItemDef in src/data/types.ts. Only the "Magic Item Rarities and Values" table of the rules part is kept
(magic-item-rarity.json); the item descriptions ("Magic Items A-Z") become one entry per h3.

Each item is an h3 followed by an italic line ("*Wondrous Item, Rare (Requires Attunement)*", sometimes wrapped over two
paragraphs) giving kind, rarity, attunement and the base item, then verbatim paragraphs, lists and tables.

Alignment EN <-> FR: both lists are alphabetical in their own language, so items are matched by signature (kind, rarity,
attunement, paragraph/list/table counts, numbers in the text with feet converted to metres) and the leftovers by
`tools/fr_overrides_magic_items.csv` (`id,en,fr_guess,status`; `ok` rows win, uncertain matches are written as `todo`).
Spanish (SP_SRD_CC_v5.2.1.pdf pp. 223–277): same matching with the Spanish header words ("*Objeto maravilloso, muy raro
(requiere sintonización)*", rarities in both genders) and tools/es_overrides_magic_items.csv. Functions taking `lang`
read "en" as English and anything else as the current translation (common.LANG).
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
from common import (  # noqa: E402
    OUT_SRD, Section, blocks_html, chapter, i18n, kebab, md_inline, norm, note, num, parse_number, plain, source,
    split_sections, table_html, write_json,
)
from build_equipment import greedy_match, merge_split_paragraphs, number_tokens, signature_score  # noqa: E402

OVERRIDES = common.overrides_path("magic_items")

KIND_EN = {"armor": "armor", "potion": "potion", "ring": "ring", "rod": "rod", "scroll": "scroll", "staff": "staff",
           "wand": "wand", "weapon": "weapon", "wondrous item": "wondrous"}
KIND_FR = {"armure": "armor", "potion": "potion", "anneau": "ring", "sceptre": "rod", "parchemin": "scroll",
           "baton": "staff", "baguette": "wand", "arme": "weapon", "objet merveilleux": "wondrous"}
RARITY_EN = {"common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "very-rare",
             "legendary": "legendary", "artifact": "artifact"}
RARITY_FR = {"courant": "common", "courante": "common", "peu courant": "uncommon", "peu courante": "uncommon",
             "rare": "rare", "tres rare": "very-rare", "legendaire": "legendary", "artefact": "artifact"}
RARITY_RE_EN = r"(Very Rare|Uncommon|Common|Rare|Legendary|Artifact)"
RARITY_RE_FR = r"(très rare|peu courante?|courante?|rare|légendaire|artefact)"
KIND_ES = {"armadura": "armor", "pocion": "potion", "anillo": "ring", "vara": "rod", "pergamino": "scroll",
           "baston": "staff", "varita": "wand", "arma": "weapon", "objeto maravilloso": "wondrous"}
RARITY_ES = {"comun": "common", "infrecuente": "uncommon", "raro": "rare", "rara": "rare", "muy raro": "very-rare",
             "muy rara": "very-rare", "legendario": "legendary", "legendaria": "legendary", "artefacto": "artifact"}
RARITY_RE_ES = r"(muy rar[oa]|infrecuente|común|rar[oa]|legendari[oa]|artefacto)"


def kinds() -> dict[str, str]:
    return common.L(fr=KIND_FR, es=KIND_ES)


def rarities() -> dict[str, str]:
    return common.L(fr=RARITY_FR, es=RARITY_ES)

STATS: dict[str, int] = {}


# ---------- italic header line ----------

def header_line(blocks: list[dict]) -> tuple[str, list[dict]]:
    """Join the italic paragraph(s) right after the heading; return (text without stars, remaining blocks)."""
    parts, k = [], 0
    while k < len(blocks) and blocks[k]["kind"] == "p":
        t = blocks[k]["text"].strip()
        if t.startswith("*") and not t.startswith("**") and t.endswith("*"):
            parts.append(t.strip("*").strip())
            k += 1
        else:
            break
    return " ".join(parts), blocks[k:]


def parse_header(line: str, lang: str) -> dict:
    """'Armor (Any Light, Medium, or Heavy), Rare (+1), Very Rare (+2), or Legendary (+3)' -> kind, base, rarity,
    attunement, attunementBy, variant list [(label, rarity)]."""
    txt = line.replace(" ", " ").strip()
    out: dict = {"kind": None, "base": None, "rarity": None, "attunement": False, "attunementBy": None, "variants": []}
    # attunement
    if lang == "en":
        m = re.search(r"\((Requires Attunement(?: by (.+?))?)\)\s*$", txt)
    elif common.LANG == "es":
        m = re.search(r"\((requiere sintonización(?: (?:por parte de|por|con) (.+?))?)\)\s*$", txt, re.I)
    else:
        m = re.search(r"\((Harmonisation requise(?: (?:avec|par) (.+?))?)\)\s*$", txt)
    if m:
        out["attunement"] = True
        if m.group(2):
            # as printed after the attunement words: "by a Cleric or Paladin" / "avec un Clerc ou Paladin"
            prefix = "Requires Attunement " if lang == "en" else common.L(fr="Harmonisation requise ", es="requiere sintonización ")
            out["attunementBy"] = m.group(1)[len(prefix):].strip()
        txt = txt[: m.start()].strip().rstrip(",").strip()
    # kind and base item
    m = re.match(r"^([^,(]+)\s*(?:\(([^)]*)\))?\s*,?\s*(.*)$", txt)
    if not m:
        note(f"magic item header not parsed ({lang}): {line!r}")
        return out
    kind_txt, base, rest = m.group(1).strip(), m.group(2), m.group(3).strip()
    table = KIND_EN if lang == "en" else kinds()
    out["kind"] = table.get(norm(kind_txt))
    if out["kind"] is None:
        note(f"magic item kind not recognised ({lang}): {kind_txt!r} in {line!r}")
    out["base"] = base.strip() if base else None
    # rarities: "Rare", "Rarity Varies", "Rare (+1), Very Rare (+2), or Legendary (+3)", "Rare (Silver or Brass), ..."
    rr = RARITY_RE_EN if lang == "en" else common.L(fr=RARITY_RE_FR, es=RARITY_RE_ES)
    rtable = RARITY_EN if lang == "en" else rarities()
    found = [(norm(a), b) for a, b in re.findall(rr + r"(?:\s*\(([^)]*)\))?", rest, re.I)]
    if re.search(r"Rarity Varies|rareté variable|rareza variable", rest, re.I):
        out["rarity"] = "varies"
    elif len(found) == 1 and not found[0][1]:
        out["rarity"] = rtable.get(found[0][0])
    elif found:
        out["rarity"] = "varies"
        out["variants"] = [(lab.strip(), rtable.get(r_)) for r_, lab in found]
    if out["rarity"] is None:
        note(f"magic item rarity not parsed ({lang}): {rest!r} in {line!r}")
    return out


# ---------- text and tables ----------

def stat_html(lines: list[dict]) -> str:
    """Stat-block lines of a creature embedded in an item (Giant Fly, Avatar of Death): kept verbatim as an aside."""
    inner = []
    for b in lines:
        if b["kind"] == "stat-h":
            inner.append(f"<h4>{md_inline(b['text'])}</h4>")
        else:
            inner.append(f"<p>{md_inline(b['text'])}</p>")
    return "<aside class=\"stat-block\">" + "".join(inner) + "</aside>"


def item_html(blocks: list[dict]) -> str:
    blocks = merge_split_paragraphs(blocks)
    out, run, stat = [], [], []

    def flush():
        if run:
            out.append(blocks_html(run))
            run.clear()
        if stat:
            out.append(stat_html(stat))
            stat.clear()

    for b in blocks:
        if b["kind"] in ("stat", "stat-h"):
            if run:
                out.append(blocks_html(run))
                run.clear()
            stat.append(b)
        else:
            if stat:
                out.append(stat_html(stat))
                stat.clear()
            run.append(b)
    flush()
    return "".join(out)


def fix_fr_tables(items: list[Section]) -> None:
    """Work-arounds for two French extraction defects (reported in the build notes):
    - p. 225: the two-column "Dragon / Résistance" table (Dragon Scale Mail, laid out as two side-by-side halves) and the
      "1d10 / Type de dégâts" table (Armor of Resistance, also two halves) were read as one 8-column, 5-row table under
      "Armure de résistance";
    - p. 227: the "Sort / Coût en charges" table of "Baguette de terreur" and the first row of the "Effets de baguette des
      merveilles" table were read as one 4-column row; the Wand of Wonder table lost its header and was split by the page
      break (p. 228)."""
    by_title = {norm(s.title): s for s in items}
    # p. 225
    for s in items:
        for k, b in enumerate(list(s.blocks)):
            if b["kind"] == "table" and len(b.get("header", [])) == 8 and b["header"][:2] == b["header"][2:4] \
                    and b["header"][4:6] == b["header"][6:8]:
                halves = []
                for c in (0, 4):
                    rows = [r[c:c + 2] for r in b["rows"]] + [r[c + 2:c + 4] for r in b["rows"]]
                    halves.append({"kind": "table", "page": b["page"], "title": "", "header": b["header"][c:c + 2], "rows": rows})
                s.blocks[k:k + 1] = [halves[1]]
                # the first half belongs to the item whose header the first column names ("Dragon")
                target = by_title.get(norm("Armure d’écailles de dragon"))
                if target is not None:
                    target.blocks.append(halves[0])
                    note(f"magic items FR p. {b['page']}: split a merged 8-column table into "
                         f"{halves[0]['header']} (moved to {target.title!r}) and {halves[1]['header']} (kept in {s.title!r})")
    # p. 227-228
    wonder = by_title.get(norm("Baguette des merveilles"))
    fear = by_title.get(norm("Baguette de terreur"))
    if wonder and fear:
        merged = next((b for b in fear.blocks if b["kind"] == "table" and len(b.get("header", [])) == 4), None)
        parts = [b for b in wonder.blocks if b["kind"] == "table"]
        if merged and parts:
            row = merged["rows"][0]
            spells, costs = row[0], row[1].split()
            # "injonction (...) terreur (Cône de 18 m)" / "1 3" -> two rows, split after a closing parenthesis
            cells = [c.strip() for c in re.split(r"(?<=\))\s+(?=\S)", spells) if c.strip()]
            if len(cells) == len(costs):
                merged["rows"] = [[a, c] for a, c in zip(cells, costs)]
            else:
                note("magic items FR p. 227: Wand of Fear spell rows could not be separated")
            merged["header"] = merged["header"][:2]
            first_text = row[3]
            tail = parts[0]["rows"][0]
            if tail[0] == "":
                first_text = (first_text[:-1] + tail[1]) if first_text.endswith("-") else first_text + " " + tail[1]
                parts[0]["rows"] = parts[0]["rows"][1:]
            header = next((p["header"] for p in parts if p.get("header")), ["1d100", "Effet"])
            rows = [[row[2], first_text]] + [r for p in parts for r in p["rows"]]
            new = {"kind": "table", "page": parts[0]["page"], "title": parts[0].get("title", ""), "header": header, "rows": rows}
            wonder.blocks = [b for b in wonder.blocks if b["kind"] != "table"] + [new]
            note(f"magic items FR p. 227-228: rebuilt the {new['title']!r} table ({len(rows)} rows) and the "
                 f"'Baguette de terreur' spell table from a merged 4-column table")


def reattach_tables(items: list[Section]) -> None:
    """A wide table printed at the foot of a page can be ordered under the wrong item; a titled table whose title
    starts with another item's name is moved to that item (EN p. 210: 'Apparatus of the Crab Levers')."""
    names = sorted(((norm(s.title), s) for s in items), key=lambda x: -len(x[0]))
    for s in items:
        for b in list(s.blocks):
            if b["kind"] != "table" or not b.get("title"):
                continue
            t = norm(b["title"])
            for n, target in names:
                if t.startswith(n) and target is not s and not t.startswith(norm(s.title)):
                    s.blocks.remove(b)
                    target.blocks.append(b)
                    note(f"magic items: table {b['title']!r} (p. {b['page']}) moved from {s.title!r} to {target.title!r}")
                    break


# ---------- charges and variants ----------

def charges_of(blocks: list[dict], lang: str) -> dict | None:
    text = " ".join(plain(b["text"]).replace(" ", " ") for b in blocks if b["kind"] in ("p", "li"))
    dice = r"\d+d\d+(?:\s*[−+-]\s*\d+)?|\d+"
    if lang == "en":
        m = re.search(r"\bhas (" + dice + r") charges", text)
    elif common.LANG == "es":
        m = re.search(r"\b(?:tiene|tienen|posee|poseen) (" + dice + r") cargas", text)
    else:
        m = re.search(r"(?:dispose de|possède|a) (" + dice + r") charges", text)
    if not m:
        return None  # "has no charges" and prose counts are not charges
    mx = m.group(1).replace("−", "-")
    max_ = int(mx) if mx.isdigit() else mx
    sentences = re.split(r"(?<=[.!?])\s+", text)
    rec = next((s for s in sentences if re.search(r"regains? .*charges|récupère .*charges|recuperan? .*cargas", s)), None)
    return {"max": max_, "recharge": rec.strip() if rec else None}


def table_variants(blocks: list[dict], lang: str) -> list[dict] | None:
    """Rows of an embedded table with a Rarity column -> [{name, rarity}]."""
    key = "rarity" if lang == "en" else common.L(fr="rarete", es="rareza")
    rtable = RARITY_EN if lang == "en" else rarities()
    for b in blocks:
        if b["kind"] != "table" or not b.get("header"):
            continue
        cols = [norm(h) for h in b["header"]]
        if key in cols:
            rc = cols.index(key)
            nc = 1 if cols[0] in ("1d100", "1d20", "1d10") and len(cols) > 2 else 0
            out = []
            for r in b["rows"]:
                if r and r[0].startswith("§ "):
                    continue
                rar = rtable.get(norm(r[rc]))
                if rar is None:
                    note(f"magic item variant rarity not parsed ({lang}): {r[rc]!r}")
                out.append({"name": r[nc].replace(" ", " "), "rarity": rar})
            return out
    return None


def runin_tokens(blocks: list[dict], name: str, lang: str) -> list[str]:
    """Numbers of the run-in paragraph '**Name (Rarity).** ...' describing a variant."""
    key = norm(name)
    for b in blocks:
        if b["kind"] == "p":
            m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", b["text"], re.S)
            if m and norm(re.sub(r"\s*\(.*\)\.?$", "", m.group(1))) == key:
                return number_tokens(m.group(2), lang)
    return []


def align_variants(en_v: list[dict], fr_v: list[dict], en_body: list[dict], fr_body: list[dict], what: str) -> list[dict]:
    toks_en = [runin_tokens(en_body, v["name"], "en") for v in en_v]
    toks_fr = [runin_tokens(fr_body, v["name"], "fr") for v in fr_v]

    def score(i, j):
        if en_v[i]["rarity"] != fr_v[j]["rarity"]:
            return None
        return signature_score(toks_en[i], toks_fr[j])

    mapping, uncertain = greedy_match(en_v, fr_v, score, f"variants of {what}")
    if uncertain or len(mapping) != len(en_v):
        note(f"magic item {what}: variant alignment uncertain for {[en_v[i]['name'] for i in uncertain]}")
    return [fr_v[mapping[i]] if i in mapping else {"name": "", "rarity": en_v[i]["rarity"]} for i in range(len(en_v))]


# ---------- rarity table ----------

def build_rarity(en_ch: Section, fr_ch: Section) -> list[dict]:
    t_en = en_ch.table("Magic Item Rarities and Values")
    t_fr = fr_ch.table(common.L(fr="Rareté et valeur des objets magiques", es="Rareza y valor de objetos mágicos"))
    out = []
    for r_en, r_fr in zip(t_en["rows"], t_fr["rows"]):
        rid = RARITY_EN.get(norm(r_en[0]))
        if rid is None:
            note(f"rarity row not recognised: {r_en}")
            continue
        if rarities().get(norm(r_fr[0])) != rid:
            note(f"rarity table: EN {r_en[0]!r} vs FR {r_fr[0]!r} at the same position")
        v = parse_number(re.sub(r"\s*GP$", "", r_en[1]))
        out.append({"id": rid, "name": i18n(r_en[0], r_fr[0]), "value": num(v) if v is not None else None,
                    "text": i18n(r_en[1], r_fr[1].replace(" ", " ")), "source": source(t_en, t_fr, t_en["title"])})
    # footnote paragraph right after the table
    for ch, lang in ((en_ch, "en"), (fr_ch, "fr")):
        blocks = ch.blocks
        t = t_en if lang == "en" else t_fr
        k = next((i for i, b in enumerate(blocks) if b is t), None)
        if k is not None and k + 1 < len(blocks) and blocks[k + 1]["kind"] == "p" and blocks[k + 1]["text"].startswith("*"):
            for e in out:
                e.setdefault("footnote", {})[lang] = md_inline(blocks[k + 1]["text"].lstrip("*").strip())
    return out


# ---------- overrides ----------

def read_overrides() -> dict[str, dict]:
    if not OVERRIDES.exists():
        return {}
    with OVERRIDES.open(encoding="utf-8", newline="") as f:
        return {r["id"]: r for r in csv.DictReader(f)}


def write_overrides(rows: dict[str, dict]) -> None:
    with OVERRIDES.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "en", "fr_guess", "status"])
        w.writeheader()
        for k in sorted(rows):
            w.writerow(rows[k])


# ---------- entry point ----------

def build(en_blocks: list[dict], fr_blocks: list[dict]) -> dict[str, int]:
    STATS.clear()
    en_ch, fr_ch = chapter(en_blocks, "Magic Items"), chapter(fr_blocks, common.L(fr="Objets magiques", es="Objetos mágicos"))
    rarity = build_rarity(en_ch, fr_ch)
    rarity_value = {r["id"]: r["value"] for r in rarity}

    en_az = next(s for s in en_ch.sub("h1") if norm(s.title).startswith("magic items a"))
    fr_az = next(s for s in fr_ch.sub("h1") if norm(s.title).startswith(common.L(fr="objets magiques de a", es="objetos magicos de la a")))
    en_items, fr_items = en_az.sub("h3"), fr_az.sub("h3")
    if len(en_items) != len(fr_items):
        note(f"magic items: {len(en_items)} EN vs {len(fr_items)} FR descriptions")
    fix_fr_tables(fr_items)
    reattach_tables(en_items)
    reattach_tables(fr_items)

    def analyse(items: list[Section], lang: str) -> list[dict]:
        out = []
        for s in items:
            line, body = header_line(s.blocks)
            if not line:
                note(f"magic item {s.title!r} ({lang}): no italic kind line")
            h = parse_header(line, lang)
            text_blocks = [b for b in body if b["kind"] in ("p", "li")]
            toks = number_tokens(" ".join(b["text"] for b in text_blocks) + " " + line, lang)
            # add the numbers of the table cells (dice ranges, DCs)
            for b in body:
                if b["kind"] == "table":
                    toks += number_tokens(" ".join(c for r in b["rows"] for c in r), lang)
            out.append({"sec": s, "line": line, "body": body, "h": h, "toks": toks,
                        "np": sum(1 for b in body if b["kind"] == "p"), "nli": sum(1 for b in body if b["kind"] == "li"),
                        "nt": sum(1 for b in body if b["kind"] == "table"),
                        "nstat": sum(1 for b in body if b["kind"] in ("stat", "stat-h"))})
        return out

    A, B = analyse(en_items, "en"), analyse(fr_items, "fr")

    def score(i, j):
        a, b = A[i], B[j]
        if a["h"]["kind"] != b["h"]["kind"] or a["h"]["attunement"] != b["h"]["attunement"]:
            return None
        if a["h"]["rarity"] != b["h"]["rarity"]:
            return None
        s = signature_score(a["toks"], b["toks"])
        s += 0.3 if a["np"] == b["np"] else 0.0
        s += 0.2 if a["nt"] == b["nt"] else 0.0
        s += 0.1 if a["nli"] == b["nli"] else 0.0
        s += 0.1 if (a["nstat"] > 0) == (b["nstat"] > 0) else 0.0
        s += 0.2 if bool(a["h"]["attunementBy"]) == bool(b["h"]["attunementBy"]) else 0.0
        return s

    overrides = read_overrides()
    fr_index = {norm(s.title): k for k, s in enumerate(fr_items)}
    ids = [kebab(s.title) for s in en_items]
    forced = {}
    for i, id_ in enumerate(ids):
        row = overrides.get(id_)
        if row and row.get("status") == "ok":
            k = fr_index.get(norm(row["fr_guess"]))
            if k is None:
                note(f"magic items: override {id_!r} -> {row['fr_guess']!r} not found among the French headings")
            else:
                forced[i] = k
    mapping, uncertain = greedy_match(en_items, fr_items, score, "magic items", forced=forced, min_gap=0.08)
    auto = 0
    for i, s in enumerate(en_items):
        if i in forced:
            continue
        if i in mapping and i not in uncertain:
            auto += 1
        else:
            guess = fr_items[mapping[i]].title if i in mapping else ""
            overrides[ids[i]] = {"id": ids[i], "en": s.title, "fr_guess": guess, "status": "todo"}
    write_overrides(overrides)
    STATS["items"] = len(en_items)
    STATS["forced by csv"] = len(forced)
    STATS["auto-matched (certain)"] = auto
    STATS["uncertain (todo)"] = len(en_items) - len(forced) - auto
    used = {}
    for i, k in mapping.items():
        if k in used:
            note(f"magic items: {en_items[i].title!r} and {used[k]!r} both map to {fr_items[k].title!r}")
        used[k] = en_items[i].title

    # weapon / armor ids for baseItem
    import json
    base_ids = set()
    for f in ("weapons.json", "armor.json"):
        p = OUT_SRD / f
        if p.exists():
            base_ids |= {x["id"] for x in json.loads(p.read_text(encoding="utf-8"))}

    out = []
    for i, a in enumerate(A):
        b = B[mapping[i]] if i in mapping else None
        h, hf = a["h"], (b["h"] if b else {})
        s_en, s_fr = a["sec"], (b["sec"] if b else None)
        item: dict = {
            "id": ids[i],
            "name": i18n(s_en.title, s_fr.title if s_fr else ""),
            "kind": h["kind"],
            "rarity": h["rarity"],
            "attunement": h["attunement"],
        }
        if h["attunementBy"]:
            item["attunementBy"] = i18n(h["attunementBy"], hf.get("attunementBy") or "")
        if h["base"]:
            bid = kebab(h["base"])
            if bid in base_ids:
                item["baseItem"] = bid
        variants = table_variants(a["body"], "en")
        fr_variants = table_variants(b["body"], "fr") if b else None
        if variants is None and h["variants"]:
            variants = [{"name": lab, "rarity": r_} for lab, r_ in h["variants"]]
            fr_variants = [{"name": lab, "rarity": r_} for lab, r_ in hf.get("variants", [])] if b else None
        if variants:
            if fr_variants and len(fr_variants) == len(variants):
                if [v["rarity"] for v in variants] != [v["rarity"] for v in fr_variants]:
                    # the French table is sorted in French (Feather Tokens): match the rows by rarity and by the
                    # numbers of the run-in paragraph that describes each variant
                    fr_variants = align_variants(variants, fr_variants, a["body"], b["body"], s_en.title)
                for v, vf in zip(variants, fr_variants):
                    if v["rarity"] != vf["rarity"]:
                        note(f"magic item {s_en.title}: variant rarity EN {v['rarity']} vs FR {vf['rarity']} ({v['name']})")
                    v["name"] = i18n(v["name"], vf["name"])
            else:
                note(f"magic item {s_en.title}: French variants missing or of a different count")
                for v in variants:
                    v["name"] = i18n(v["name"], "")
            for v in variants:
                if v["rarity"] and rarity_value.get(v["rarity"]) is not None:
                    v["value"] = rarity_value[v["rarity"]]
            item["variants"] = variants
        item["text"] = i18n(item_html(a["body"]), item_html(b["body"]) if b else "")
        ch_en = charges_of(a["body"], "en")
        if ch_en:
            ch_fr = charges_of(b["body"], "fr") if b else None
            if ch_fr and ch_fr["max"] != ch_en["max"]:
                note(f"magic item {s_en.title}: charges EN {ch_en['max']} vs FR {ch_fr['max']}")
            item["charges"] = {"max": ch_en["max"],
                               "recharge": i18n(ch_en["recharge"] or "", (ch_fr or {}).get("recharge") or "")}
        item["source"] = source(s_en.heading, s_fr.heading if s_fr else None, s_en.title)
        out.append(item)

    write_json(OUT_SRD / "magic-items.json", out)
    write_json(OUT_SRD / "magic-item-rarity.json", rarity)
    for k, v in STATS.items():
        note(f"magic items matching: {k} = {v}")
    return {"magic-items.json": len(out), "magic-item-rarity.json": len(rarity)}


if __name__ == "__main__":
    import common
    print(build(common.load_blocks("en"), common.load_blocks("fr")))
    for n in common.NOTES:
        print(" -", n)
