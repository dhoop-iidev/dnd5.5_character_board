"""Spells chapter (SRD 5.2.1, EN pages 104-175 / FR pages 111-186) -> src/data/srd/spells.json (SpellDef[]).

Each spell is an h3 under "Spell Descriptions" / "Description des sorts": an italic line "*Level 2 Evocation (Wizard)*"
("*Évocation du 2e niveau (Magicien)*", cantrips "*Evocation Cantrip (…)*" / "*Évocation mineure (…)*"), four `field`
blocks (Casting Time, Range, Components, Duration) and the description paragraphs; an optional last paragraph "**Using a
Higher-Level Spell Slot.**" / "**Cantrip Upgrade.**" (FR "**Emplacement de niveau supérieur.**" / "**Amélioration de sort
mineur.**") goes to `upcast`. Embedded creature stat blocks (Animate Objects, Find Steed, Giant Insect, Summon Dragon) are
cut out of `text` (the creatures builder handles them).

Work-arounds for extraction defects (logged with note(), not patched in srd_pdf.py):
  - "Acid Splash" heading extracted as an empty `aside` (EN p. 107) -> treated as an h3;
  - wrapped italic header lines split in two `p` blocks -> merged;
  - 12 spells print "Component:" (singular) in the PDF, which FIELD_RE doesn't know -> an empty table -> field;
  - "Chill Touch" (EN p. 115) fields extracted as `p` -> field;
  - paragraphs split at a column/page break (next block starts with a lowercase letter or a bold word) -> merged;
  - "Control Weather": the "Wind" table title became an h4 and its rows were appended to "Temperature" -> split;
  - the hyphen of "10-foot" / "100-foot" lost when the line broke after it (EN, 4 spells) -> restored (the Markdown has it).

English <-> French alignment: both lists are alphabetical in their own language, so spells are paired by a
language-independent signature (level, school, classes, components, concentration, ritual, casting kind, numbers of the
range/duration/casting time in metres, upcast presence), ties broken by the dice expressions and paragraph count of the
text, and finally by hand in tools/fr_overrides_spells.csv (id,en,fr_guess,status; `ok` rows win, unmatched spells are
appended as `todo` with the best guess).

Spanish (SP_SRD_CC_v5.2.1.pdf pp. 118–193): header "*Evocación de nivel 3 (hechicero, mago)*", cantrips "*Truco de
evocación (…)*" (Illusion is "Ilusionismo"), fields Tiempo de lanzamiento / Alcance / Componentes / Duración, upcast
"**Con un espacio de conjuro de nivel superior.**" / "**Mejora de truco.**"; aligned with the same signature, overrides in
tools/es_overrides_spells.csv. The parsing functions take `lang` = "en", "fr" or "es".
"""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict

import common  # noqa: E402
from common import (OUT_SRD, ROOT, Section, blocks_html, chapter, field_value, i18n, kebab, norm, note, plain,
                    source, split_sections, write_json)

OVERRIDES = common.overrides_path("spells")
SECTION = "Spells"

SCHOOLS_EN = {s: s for s in ("abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion",
                             "necromancy", "transmutation")}
SCHOOLS_FR = {"abjuration": "abjuration", "invocation": "conjuration", "divination": "divination",
              "enchantement": "enchantment", "evocation": "evocation", "illusion": "illusion",
              "necromancie": "necromancy", "transmutation": "transmutation"}
SCHOOLS_ES = {"abjuracion": "abjuration", "conjuracion": "conjuration", "adivinacion": "divination",
              "encantamiento": "enchantment", "evocacion": "evocation", "ilusionismo": "illusion", "ilusion": "illusion",
              "nigromancia": "necromancy", "transmutacion": "transmutation"}
CLASSES_EN = {c: c for c in ("bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard")}
CLASSES_FR = {"barde": "bard", "clerc": "cleric", "druide": "druid", "paladin": "paladin", "rodeur": "ranger",
              "ensorceleur": "sorcerer", "occultiste": "warlock", "magicien": "wizard"}
CLASSES_ES = {"bardo": "bard", "clerigo": "cleric", "druida": "druid", "paladin": "paladin", "explorador": "ranger",
              "hechicero": "sorcerer", "brujo": "warlock", "mago": "wizard"}

FIELD_KEYS = {
    "en": {"time": "Casting Time", "range": "Range", "components": "Components", "duration": "Duration"},
    "fr": {"time": "Temps d'incantation", "range": "Portée", "components": "Composantes", "duration": "Durée"},
    "es": {"time": "Tiempo de lanzamiento", "range": "Alcance", "components": "Componentes", "duration": "Duración"},
}
UPCAST_RE = {
    "en": re.compile(r"^\*\*(Using a Higher-Level Spell Slot|Cantrip Upgrade)\.\*\*"),
    "fr": re.compile(r"^\*\*(Emplacement de niveau supérieur|Amélioration de sort mineur)\.\*\*"),
    "es": re.compile(r"^\*\*(Con un espacio de conjuro de nivel superior|Mejora de truco)\.\*\*"),
}
P_FIELD_RE = re.compile(r"^\*\*(Casting Time|Range|Components?|Duration|Temps d[’']incantation|Portée|Composantes|Durée"
                        r"|Tiempo de lanzamiento|Alcance|Componentes?|Duración)\s*:\*\*")
TABLE_FIELD_RE = re.compile(r"^(Components?|Componentes?)\s*:\s*(.*)$", re.S)
END_PUNCT = tuple(".!?:»”)")


# ---------- block repairs ----------

def fix_blocks(blocks: list[dict], lang: str) -> list[dict]:
    out = []
    for b in blocks:
        k = b["kind"]
        if k == "aside" and not b["lines"]:
            note(f"spells {lang} p.{b['page']}: heading {b['title']!r} extracted as an empty sidebar — treated as an h3")
            out.append({"kind": "h3", "page": b["page"], "text": b["title"]})
        elif k == "table" and not b["rows"] and len(b["header"]) == 1 and TABLE_FIELD_RE.match(b["header"][0]):
            m = TABLE_FIELD_RE.match(b["header"][0])
            note(f"spells {lang} p.{b['page']}: {m.group(1)!r} line extracted as an empty table — treated as a field")
            key = "Componentes" if m.group(1).startswith("Componente") else "Components"
            out.append({"kind": "field", "page": b["page"], "text": f"**{key}:** {m.group(2).strip()}"})
        elif k == "field" and b["text"].startswith("**Component:**"):
            out.append({**b, "text": "**Components:**" + b["text"][len("**Component:**"):]})
        elif k == "field" and b["text"].startswith("**Componente:**"):
            out.append({**b, "text": "**Componentes:**" + b["text"][len("**Componente:**"):]})
        elif k == "p" and P_FIELD_RE.match(b["text"]):
            note(f"spells {lang} p.{b['page']}: field {b['text'][:30]!r} extracted as a paragraph — treated as a field")
            out.append({**b, "kind": "field"})
        else:
            out.append(b)
    return out


def merge_continuations(blocks: list[dict]) -> list[dict]:
    """Join a paragraph split at a column or page break: the previous paragraph has no final punctuation and the next
    one starts with a lowercase letter, an italic run (wrapped header line) or a bold word that isn't a run-in heading."""
    out: list[dict] = []
    for b in blocks:
        prev = out[-1] if out else None
        if (prev is not None and prev["kind"] == "p" and b["kind"] == "p"
                and not plain(prev["text"]).rstrip().endswith(END_PUNCT) and _continues(b["text"])):
            if prev["text"].endswith("-") and b["text"][:1].islower():
                prev["text"] = prev["text"][:-1] + b["text"]  # hyphenation at the break
            elif prev["text"].endswith("**") and b["text"].startswith("**"):
                prev["text"] = prev["text"][:-2] + " " + b["text"][2:]  # one bold run
            elif prev["text"].endswith("*") and b["text"].startswith("*"):
                prev["text"] = prev["text"][:-1] + " " + b["text"][1:]  # one italic run
            else:
                prev["text"] = prev["text"] + " " + b["text"]
            continue
        out.append(dict(b))
    return out


def _continues(text: str) -> bool:
    if text[:1].islower() or text.startswith("*") and not text.startswith("**"):
        return True
    m = re.match(r"^\*\*([^*]+)\*\*", text)
    return bool(m) and not m.group(1).rstrip().endswith((".", ":"))


def split_side_by_side_tables(blocks: list[dict]) -> list[dict]:
    """An h4 followed by a table whose row numbering restarts: the h4 is the title of the second half of the table
    (two tables set side by side, e.g. Control Weather's Wind table under Temperature)."""
    out: list[dict] = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b["kind"] == "h4" and i + 1 < len(blocks) and blocks[i + 1]["kind"] == "table":
            t = blocks[i + 1]
            starts = [j for j, r in enumerate(t["rows"]) if r and r[0].strip() == "1"]
            if len(starts) == 2 and starts[0] == 0:
                cut = starts[1]
                out.append({**t, "rows": t["rows"][:cut]})
                out.append({**t, "title": b["text"], "rows": t["rows"][cut:]})
                note(f"spells p.{b['page']}: table {b['text']!r} was merged into {t['title']!r} — split on the restart of the numbering")
                i += 2
                continue
        out.append(b)
        i += 1
    return out


# ---------- parsing one spell ----------

def spell_sections(blocks: list[dict], lang: str) -> list[Section]:
    ch = chapter(blocks, {"en": "Spells", "fr": "Sorts", "es": "Conjuros"}[lang])
    want = {"en": "Spell Descriptions", "fr": "Description des sorts", "es": "Descripciones de conjuros"}[lang]
    desc = next(s for s in ch.sub("h1") if norm(want) in norm(s.title))
    return split_sections(fix_blocks(desc.blocks, lang), "h3")


def parse_header(line: str, lang: str) -> tuple[int, str, list[str]]:
    txt = re.sub(r"\s+", " ", plain(line).replace("\xa0", " ")).strip()
    if lang == "en":
        m = re.fullmatch(r"Level (\d) (\w+) \((.+)\)", txt)
        if m:
            level, school, classes = int(m.group(1)), m.group(2), m.group(3)
        else:
            m = re.fullmatch(r"(\w+) Cantrip \((.+)\)", txt)
            if not m:
                raise ValueError(f"spell header not understood: {txt!r}")
            level, school, classes = 0, m.group(1), m.group(2)
        school_id = SCHOOLS_EN[norm(school)]
        class_ids = [CLASSES_EN[norm(c)] for c in classes.split(",")]
    elif lang == "es":
        m = re.fullmatch(r"(\S+) de nivel (\d) \((.+)\)", txt)
        if m:
            level, school, classes = int(m.group(2)), m.group(1), m.group(3)
        else:
            m = re.fullmatch(r"Truco de (\S+) \((.+)\)", txt)
            if not m:
                raise ValueError(f"spell header not understood: {txt!r}")
            level, school, classes = 0, m.group(1), m.group(2)
        school_id = SCHOOLS_ES[norm(school)]
        class_ids = [CLASSES_ES[norm(c)] for c in classes.split(",")]
    else:
        m = re.fullmatch(r"(\S+) du (\d)(?:er|e) niveau \((.+)\)", txt)
        if m:
            level, school, classes = int(m.group(2)), m.group(1), m.group(3)
        else:
            m = re.fullmatch(r"(\S+) mineure? \((.+)\)", txt)
            if not m:
                raise ValueError(f"spell header not understood: {txt!r}")
            level, school, classes = 0, m.group(1), m.group(2)
        school_id = SCHOOLS_FR[norm(school)]
        class_ids = [CLASSES_FR[norm(c)] for c in classes.split(",")]
    return level, school_id, sorted(class_ids)


def parse_components(value: str) -> dict:
    letters, material = value, None
    m = re.match(r"^([^(]*)\((.*)\)\s*$", value, re.S)
    if m:
        letters, material = m.group(1), m.group(2).strip()
    found = {x.strip().upper() for x in letters.split(",")}
    comp: dict = {"v": "V" in found, "s": "S" in found}
    if "M" in found:
        comp["m"] = material or ""
    return comp


def casting_kind(value: str, lang: str) -> str:
    v = norm(value)
    if lang == "en":
        if v.startswith("bonus action"):
            return "bonus-action"
        if v.startswith("reaction"):
            return "reaction"
        if v.startswith("action"):
            return "action"
    elif lang == "es":
        if v.startswith("accion adicional"):
            return "bonus-action"
        if v.startswith("reaccion"):
            return "reaction"
        if v.startswith("accion"):
            return "action"
    else:
        if v.startswith("action bonus"):
            return "bonus-action"
        if v.startswith("reaction"):
            return "reaction"
        if v.startswith("action"):
            return "action"
    return "time"


def parse_spell(sec: Section, lang: str) -> dict:
    blocks = split_side_by_side_tables(merge_continuations(sec.blocks))
    i = 0
    if not (blocks and blocks[i]["kind"] == "p" and blocks[i]["text"].startswith("*")):
        raise ValueError(f"{sec.title}: no italic header line")
    level, school, classes = parse_header(blocks[i]["text"], lang)
    i += 1
    fields = []
    while i < len(blocks) and blocks[i]["kind"] == "field":
        fields.append(blocks[i])
        i += 1
    if len(fields) != 4:
        note(f"spells {lang} {sec.title!r} p.{sec.page}: {len(fields)} header fields instead of 4")
    keys = FIELD_KEYS[lang]
    vals = {k: field_value(fields, keys[k], keys[k]) for k in keys}
    for k, v in vals.items():
        if v is None:
            raise ValueError(f"{sec.title}: missing field {k}")
    body = blocks[i:]
    body, stat = cut_stat_block(body)
    for b in body:
        if b["kind"] == "p" and re.search(r"\b\d+foot\b", b["text"]):
            note(f"spells {lang} {sec.title!r} p.{b['page']}: hyphen lost at a line break in "
                 f"{re.findall(r'\b\d+foot\b', b['text'])} — restored")
            b["text"] = re.sub(r"\b(\d+)foot\b", r"\1-foot", b["text"])
    upcast = None
    hits = [j for j, b in enumerate(body) if b["kind"] == "p" and UPCAST_RE[lang].match(b["text"])]
    if hits:
        if hits[-1] != len(body) - 1:
            note(f"spells {lang} {sec.title!r}: the upcast paragraph is followed by "
                 f"{plain(body[-1]['text'])[:60]!r} — kept in text")
        upcast = body.pop(hits[-1])
    ct = vals["time"]
    duration = vals["duration"]
    return {
        "lang": lang,
        "title": sec.title,
        "page": sec.page,
        "level": level,
        "school": school,
        "classes": classes,
        "castingTime": ct,
        "castingKind": casting_kind(ct, lang),
        "ritual": bool(re.search(r"\b(or Ritual|ou rituel|o (?:un )?ritual)\b", ct, re.I)),
        "range": vals["range"],
        "components": parse_components(vals["components"]),
        "duration": duration,
        "concentration": norm(duration).startswith(("concentration", "concentracion")),
        "text": blocks_html(body),
        "upcast": blocks_html([upcast]) if upcast else None,
        "body": body,
        "hasStat": stat,
    }


def cut_stat_block(body: list[dict]) -> tuple[list[dict], bool]:
    """Drop an embedded creature stat block: from the bold-only paragraph naming it (followed by `stat` lines) on."""
    for j, b in enumerate(body):
        if b["kind"] in ("stat", "stat-h"):
            start = j
            if j > 0 and body[j - 1]["kind"] == "p" and re.fullmatch(r"\*\*[^*]+\*\*", body[j - 1]["text"].strip()):
                start = j - 1
            tail = [x for x in body[start:] if x["kind"] not in ("stat", "stat-h")]
            odd = [x["text"][:40] for x in tail[1:] if not re.match(r"^\*\*\w\*\*\*\*\w\w\*\*", x["text"])]
            if odd:
                note(f"spells: blocks after the stat block were dropped: {odd}")
            return body[:start], True
    return body, False


# ---------- alignment ----------

def _numbers(s: str) -> list[float]:
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", s.replace("\xa0", " ").replace(" ", ""))]


def range_key(value: str, lang: str) -> tuple:
    v = norm(value)
    words = {"en": {"self": "self", "touch": "touch", "special": "special", "sight": "sight", "unlimited": "unlimited"},
             "fr": {"personnelle": "self", "contact": "touch", "speciale": "special", "champ de vision": "sight",
                    "illimitee": "unlimited"},
             "es": {"lanzador": "self", "toque": "touch", "especial": "special", "vista": "sight",
                    "ilimitado": "unlimited"}}[lang]
    if v in words:
        return (words[v],)
    nums = _numbers(value)
    if lang == "en":
        factor = 1.5 if "mile" in v else 0.3  # 5 feet = 1,5 m; 1 mile = 1,5 km in the French SRD
    else:
        factor = 1.0
    return ("dist", tuple(round(n * factor, 2) for n in nums))


def time_key(value: str) -> tuple:
    return tuple(_numbers(re.sub(r"\([^)]*\)", "", value)))


def signature(sp: dict) -> tuple:
    c = sp["components"]
    return (sp["level"], sp["school"], tuple(sp["classes"]), c["v"], c["s"], "m" in c, sp["concentration"],
            sp["ritual"], sp["castingKind"], time_key(sp["castingTime"]) if sp["castingKind"] == "time" else (),
            range_key(sp["range"], sp["lang"]),
            time_key(sp["duration"]), sp["upcast"] is not None)


def secondary(a: dict, b: dict) -> float:
    """Similarity of two spells' texts beyond the signature: dice expressions, paragraph/list/table counts, stat block."""
    ta, tb = plain(" ".join(x["text"] for x in a["body"] if "text" in x)), plain(" ".join(x["text"] for x in b["body"] if "text" in x))
    da, db = Counter(re.findall(r"\b\d+d\d+\b", ta)), Counter(re.findall(r"\b\d+d\d+\b", tb))
    inter = sum((da & db).values())
    union = sum((da | db).values())
    score = (inter / union if union else 0.5) * 3
    for kind in ("p", "li", "table"):
        na, nb = sum(1 for x in a["body"] if x["kind"] == kind), sum(1 for x in b["body"] if x["kind"] == kind)
        score -= abs(na - nb) * (0.5 if kind == "p" else 1.0)
    score += 1 if a["hasStat"] == b["hasStat"] else -2
    return score


def read_overrides() -> dict[str, dict]:
    if not OVERRIDES.exists():
        return {}
    with OVERRIDES.open(encoding="utf-8", newline="") as f:
        return {r["id"]: r for r in csv.DictReader(f)}


def write_overrides(rows: dict[str, dict]) -> None:
    with OVERRIDES.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "en", "fr_guess", "status"], lineterminator="\n")
        w.writeheader()
        for r in sorted(rows.values(), key=lambda r: r["id"]):
            w.writerow({k: r.get(k, "") for k in w.fieldnames})


def align(en: list[dict], fr: list[dict]) -> tuple[dict[str, dict], dict[str, int]]:
    """EN spell id -> FR spell. Steps: hand overrides, unique signature, tie-break by text similarity, hand `todo`."""
    overrides = read_overrides()
    fr_by_title = {norm(f["title"]): f for f in fr}
    matched: dict[str, dict] = {}
    stats = Counter()
    for sp in en:
        o = overrides.get(sp["id"])
        if o and o["status"] == "ok":
            f = fr_by_title.get(norm(o["fr_guess"]))
            if f is None:
                note(f"spells override {sp['id']}: French title {o['fr_guess']!r} not found")
                continue
            matched[sp["id"]] = f
            stats["override"] += 1
    used = {id(f) for f in matched.values()}
    rest_en = [s for s in en if s["id"] not in matched]
    rest_fr = [f for f in fr if id(f) not in used]
    groups_en: dict[tuple, list] = defaultdict(list)
    groups_fr: dict[tuple, list] = defaultdict(list)
    for s in rest_en:
        groups_en[signature(s)].append(s)
    for f in rest_fr:
        groups_fr[signature(f)].append(f)
    leftover: list[dict] = []
    for sig, es in groups_en.items():
        fs = groups_fr.get(sig, [])
        if len(es) == 1 and len(fs) == 1:
            matched[es[0]["id"]] = fs[0]
            stats["signature"] += 1
            continue
        # tie-break inside the group by text similarity: accept only a strict, mutual best
        pairs = sorted(((secondary(e, f), i, j) for i, e in enumerate(es) for j, f in enumerate(fs)), reverse=True)
        taken_e, taken_f = set(), set()
        for score, i, j in pairs:
            if i in taken_e or j in taken_f:
                continue
            others = [sc for sc, i2, j2 in pairs if (i2 == i or j2 == j) and (i2, j2) != (i, j)
                      and i2 not in taken_e and j2 not in taken_f]
            if not others or score - max(others) >= 1.0:
                matched[es[i]["id"]] = fs[j]
                taken_e.add(i)
                taken_f.add(j)
                stats["tie-break"] += 1
        leftover += [e for i, e in enumerate(es) if i not in taken_e]
    used = {id(f) for f in matched.values()}
    free_fr = [f for f in fr if id(f) not in used]
    todo = 0
    for e in leftover:
        guess = max(free_fr, key=lambda f: (signature(f)[:3] == signature(e)[:3], secondary(e, f)), default=None)
        row = overrides.get(e["id"]) or {"id": e["id"], "en": e["title"], "fr_guess": "", "status": "todo"}
        if row["status"] != "ok":
            row["fr_guess"] = guess["title"] if guess else ""
            row["status"] = "todo"
        overrides[e["id"]] = row
        todo += 1
        note(f"spells: {e['title']!r} not aligned — best guess {row['fr_guess']!r} written as `todo` in {OVERRIDES.name}")
    stats["todo"] = todo
    for k in [k for k, r in overrides.items() if r["status"] == "todo" and k in matched]:
        del overrides[k]
    if free_fr:
        note(f"spells: {len(free_fr)} French spells left unmatched: {[f['title'] for f in free_fr]}")
    write_overrides(overrides)
    return matched, dict(stats)


# ---------- build ----------

def build(en_blocks: list[dict], fr_blocks: list[dict]) -> dict[str, int]:
    lang = common.LANG
    en = [parse_spell(s, "en") for s in spell_sections(en_blocks, "en")]
    fr = [parse_spell(s, lang) for s in spell_sections(fr_blocks, lang)]
    for sp in en:
        sp["id"] = kebab(sp["title"])
    ids = Counter(sp["id"] for sp in en)
    for k, v in ids.items():
        if v > 1:
            note(f"spells: duplicate id {k}")
    matched, stats = align(en, fr)
    note(f"spells alignment: {len(en)} EN / {len(fr)} FR — " + ", ".join(f"{k} {v}" for k, v in stats.items()))
    with_stat = [sp["title"] for sp in en if sp["hasStat"]]
    if with_stat:
        note(f"spells with an embedded stat block (left to the creatures builder): {with_stat}")
    out = []
    for sp in en:
        f = matched.get(sp["id"])
        if f is None:
            note(f"spells: {sp['title']!r} has no French counterpart — French fields left empty")
            f = {"title": "", "castingTime": "", "range": "", "duration": "", "text": "", "upcast": None,
                 "components": {}, "page": None}
        else:
            for k in ("level", "school", "classes", "concentration", "ritual", "castingKind"):
                if sp[k] != f[k]:
                    note(f"spells {sp['title']!r} / {f['title']!r}: {k} differs EN {sp[k]!r} / FR {f[k]!r}")
            if ("m" in sp["components"]) != ("m" in f["components"]):
                note(f"spells {sp['title']!r} / {f['title']!r}: material component differs")
        comp: dict = {"v": sp["components"]["v"], "s": sp["components"]["s"]}
        if "m" in sp["components"]:
            comp["m"] = i18n(sp["components"]["m"], f["components"].get("m", ""))
        d = {
            "id": sp["id"],
            "name": i18n(sp["title"], f["title"]),
            "level": sp["level"],
            "school": sp["school"],
            "classes": sp["classes"],
            "castingTime": i18n(sp["castingTime"], f["castingTime"]),
            "castingKind": sp["castingKind"],
            "ritual": sp["ritual"],
            "range": i18n(sp["range"], f["range"]),
            "components": comp,
            "duration": i18n(sp["duration"], f["duration"]),
            "concentration": sp["concentration"],
            "text": i18n(sp["text"], f["text"]),
        }
        if sp["upcast"] or f["upcast"]:
            d["upcast"] = i18n(sp["upcast"] or "", f["upcast"] or "")
        d["source"] = source({"page": sp["page"]}, {"page": f["page"]} if f["page"] else None, SECTION)
        # Misprint of the English PDF (p. 168): Telekinesis's last sentence stops at a comma; the official French and
        # Spanish translations end it after "simple tool", so the English does too.
        if d["id"] == "telekinesis":
            d["text"]["en"] = d["text"]["en"].replace("manipulating a simple tool,</p>", "manipulating a simple tool.</p>")
        out.append(d)
    write_json(OUT_SRD / "spells.json", out)
    return {"spells.json": len(out)}


if __name__ == "__main__":
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import common

    counts = build(common.load_blocks("en"), common.load_blocks("fr"))
    print(counts)
    for n in common.NOTES:
        print(" -", n)
