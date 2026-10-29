"""Stat blocks (SRD 5.2.1 "Monsters A–Z" EN pages 258-344 / FR 272-360, "Animals" EN 344-364 / FR 360-380, and the four
creatures embedded in spells: Animated Object, Otherworldly Steed, Giant Insect, Draconic Spirit) -> src/data/srd/creatures.json
(CreatureDef[]).

The extractor keeps a stat block as raw lines: `p` "**Name**" (the name, set in Optima-Bold; an h1 above it names the
monster or its group, e.g. "Angels" for Deva, Planetar, Solar), then `stat` lines with `font`, `x` (left edge) and `f`
(fragments [x, text]) and `stat-h` section headings. Layout (SRD p. 254-257 "Monsters"):
  - Optima-Italic: "*Size Type (Tags), Alignment*" (wrapped over two lines in French for long types);
  - Optima-Bold fields: AC, Initiative (own line, x ≈ 166/417), HP, Speed, Skills, Resistances, Vulnerabilities, Immunities,
    Gear, Senses, Languages, CR (FR: CA, Initiative, Pv, Vitesse, Compétences, Résistances, Vulnérabilités, Immunités,
    Équipement, Sens, Langues, FP); continuation lines are indented (x ≈ 70/321);
  - the ability table (GillSans "MOD SAVE" / "MOD JS" headers, GillSans-SemiBold-SC700 rows): the fragments form the token
    stream  Str 16 +3 +6  Dex 17 +3 +3  Con …  Int …  Wis …  Cha …  (FR For/Sag), read in order; a negative value comes as
    its own GillSans line ("−2", U+2212) but keeps its place in the stream;
  - sections (stat-h "Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions"): an entry starts with an
    Optima-BoldItalic run-in "**Name.** text" at the column edge (x 63 / 313, FR also 314); continuation lines are
    Optima-Regular / Optima-Italic (italic when the line starts inside an italic run); a line indented by ~7 pt or an
    Optima-Bold sub-label ("**At Will:**", "**Sunlight.**") starts a new paragraph of the same entry (kept with <br>);
    an Optima-Bold line whose bold run does not end with "." or ":" is an inline bold word ("… rises as a **Shadow**") and
    continues the paragraph; the italic lines before the first Legendary Action are the "Legendary Action Uses" preamble
    (`legendaryActionsIntro`); hyphenation at a line end is undone when the next line starts with a lowercase letter.
Entries are alphabetical in each language (Multiattack first), so EN and FR entries are paired by their numbers (dice,
DCs, bonuses, uses; distances excluded since feet become metres), then by a dictionary of entry names learnt from the
unambiguous pairs, and last by position (logged).

Extraction defects worked around here (logged with note(), not patched in srd_pdf.py): an ability row classified as a
`p` block (EN p. 109 "**D****ex**10 +0 +0", p. 340 "**Con**22 +6").

English <-> French alignment: the chapters are alphabetical in their own language, so stat blocks are paired by a
language-independent signature (AC, HP average and dice, the six ability scores, CR, initiative, speeds with feet × 0.3 =
metres, section entry counts), ties broken by the dice expressions of the text, and by hand in
tools/fr_overrides_creatures.csv (id,en,fr_guess,status; `ok` rows win, unmatched blocks are appended as `todo`).

Spanish (SP_SRD_CC_v5.2.1.pdf "Monstruos de la A a la Z" pp. 283–375, "Animales" pp. 376–398): same layout and pairing,
with the Spanish keys (CA, Iniciativa, PG, Velocidad, Habilidades, …, VD; abilities Fue Des Con Int Sab Car; sections
Atributos, Acciones, Acciones adicionales, Reacciones, Acciones legendarias) and tools/es_overrides_creatures.csv. A word
cut at a line end by a soft hyphen (Spanish PDF) is joined back without a space.
"""
from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter, defaultdict

import common  # noqa: E402
from common import (LEVEL, OUT_SRD, ROOT, i18n, kebab, md_inline, norm, note, num, parse_distance_pair, parse_number,
                    plain, source, write_json)

OVERRIDES = common.overrides_path("creatures")

CHAPTERS = {
    "en": {"monsters a–z": "monsters", "animals": "animals", "spells": "spells"},
    "fr": {"monstres de a a z": "monsters", "animaux": "animals", "sorts": "spells"},  # keys are norm()ed: no accents
    "es": {"monstruos de la a a la z": "monsters", "animales": "animals", "conjuros": "spells"},
}
SECTION_NAMES = {"monsters": "Monsters A–Z", "animals": "Animals"}
KEYS = {
    "en": {"ac": "ac", "initiative": "initiative", "hp": "hp", "speed": "speed", "skills": "skills",
           "resistances": "resistances", "vulnerabilities": "vulnerabilities", "immunities": "immunities", "gear": "gear",
           "senses": "senses", "languages": "languages", "cr": "cr"},
    "fr": {"ca": "ac", "initiative": "initiative", "pv": "hp", "vitesse": "speed", "competences": "skills",
           "resistances": "resistances", "vulnerabilites": "vulnerabilities", "immunites": "immunities",
           "equipement": "gear", "sens": "senses", "langues": "languages", "fp": "cr"},
    "es": {"ca": "ac", "iniciativa": "initiative", "pg": "hp", "velocidad": "speed", "habilidades": "skills",
           "resistencias": "resistances", "vulnerabilidades": "vulnerabilities", "inmunidades": "immunities",
           "equipo": "gear", "sentidos": "senses", "idiomas": "languages", "vd": "cr"},
}
SECTIONS = {
    "en": {"traits": "traits", "actions": "actions", "bonus actions": "bonusActions", "reactions": "reactions",
           "legendary actions": "legendaryActions"},
    "fr": {"traits": "traits", "actions": "actions", "actions bonus": "bonusActions", "reactions": "reactions",
           "actions legendaires": "legendaryActions"},
    "es": {"atributos": "traits", "acciones": "actions", "acciones adicionales": "bonusActions", "reacciones": "reactions",
           "acciones legendarias": "legendaryActions"},
}
SECTION_ORDER = ["traits", "actions", "bonusActions", "reactions", "legendaryActions"]

# Misprints of the SRD 5.2.1 PDF corrected after the 2024 Monster Manual (docs/rules/rulings-data.md D1). Each entry:
# path of the field, value as printed (checked), corrected value, bilingual note (stored in `errata`, shown in the app).
CORRECTIONS = {
    "young-white-dragon": [
        (("abilities", "int", "save"), 2, -2,
         "The SRD 5.2.1 (p. 340) prints the Intelligence saving throw as “2”, without a sign; the 2024 Monster Manual "
         "prints −2 (Intelligence 6, no saving-throw proficiency, like every other dragon). Corrected to −2.",
         "Le SRD 5.2.1 (p. 286 FR) imprime le jet de sauvegarde d’Intelligence « 2 », sans signe ; le Monster Manual "
         "2024 imprime −2 (Intelligence 6, pas de maîtrise du JS, comme tous les autres dragons). Corrigé en −2.",
         "El SRD 5.2.1 (p. 340) imprime la tirada de salvación de Inteligencia como «2», sin signo; el Monster Manual de "
         "2024 imprime −2 (Inteligencia 6, sin competencia en la salvación, como todos los demás dragones). Corregido a −2."),
    ],
    "gray-ooze": [
        (("initiative", "score"), 13, 8,
         "The SRD 5.2.1 (p. 293) prints Initiative −2 (13); the 2024 Monster Manual on D&D Beyond prints −2 (8), "
         "that is 10 + the modifier (SRD p. 254: the score replaces a roll). Corrected to 8.",
         "Le SRD 5.2.1 (p. 358 FR) imprime Initiative −2 (13) ; le Monster Manual 2024 sur D&D Beyond imprime −2 (8), "
         "soit 10 + le modificateur (SRD p. 254 : la valeur remplace un jet). Corrigé en 8.",
         "El SRD 5.2.1 (p. 293) imprime Iniciativa −2 (13); el Monster Manual de 2024 en D&D Beyond imprime −2 (8), "
         "es decir, 10 + el modificador (SRD p. 254: la puntuación sustituye a la tirada). Corregido a 8."),
    ],
}


def apply_corrections(d: dict) -> None:
    for path, printed, fixed, en, fr, es in CORRECTIONS.get(d["id"], []):
        node = d
        for key in path[:-1]:
            node = node[key]
        if node[path[-1]] != printed:
            note(f"creatures {d['id']}: correction of {'.'.join(path)} expected the printed value {printed!r}, "
                 f"found {node[path[-1]]!r} — not applied")
            continue
        node[path[-1]] = fixed
        d.setdefault("errata", []).append(i18n(en, common.L(fr=fr, es=es)))

ABILITIES = {"str": "str", "dex": "dex", "con": "con", "int": "int", "wis": "wis", "cha": "cha", "for": "str", "sag": "wis",
             "fue": "str", "des": "dex", "sab": "wis", "car": "cha"}
ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"]
SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"]
SIZE_RE = re.compile(r"^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan|Smaller|Larger))?\s+(.+)$")
FR_SIZE_RE = re.compile(r"\s*de taille\s*(Gig|TG|TP|G|P|M)(?:\s+ou\s+(inférieure|supérieure|Gig|TG|TP|G|P|M))?")
_ES_SIZE = r"(?:Diminut[oa]|Pequeñ[oa]|Median[oa]|Grande|Enorme|Gargantuesc[oa])"
ES_SIZE_RE = re.compile(r"\s+" + _ES_SIZE + r"(?:\s+[ou]\s+(?:más pequeñ[oa]|más grande|" + _ES_SIZE + r"))?(?=\s|$|\()")
TOKEN_RE = re.compile(r"Str|Dex|Con|Int|Wis|Cha|For|Sag|Fue|Des|Sab|Car|[+−–-]\s?\d+|\d+")  # − U+2212, – U+2013 (French PDF)
NAME_RE = re.compile(r"^\*\*([^*]+)\*\*\s*$")
ABILITY_P_RE = re.compile(r"^(Str|Dex|Con|Int|Wis|Cha|For|Sag|Fue|Des|Sab|Car)\s*\d+")
SPEED_EN_RE = re.compile(r"^(?:(Fly|Swim|Climb|Burrow)\s+)?(\d+)\s*ft\.?(?:\s*\((.*)\))?$", re.I)
SPEED_FR_RE = re.compile(r"^(?:(vol|nage|escalade|fouissement)\s+)?(\d+(?:,\d+)?)\s*m(?:\s*\((.*)\))?$", re.I)
MODES_FR = {"vol": "fly", "nage": "swim", "escalade": "climb", "fouissement": "burrow"}
SPEED_ES_RE = re.compile(r"^(?:(volar|nadar|trepar|excavar)\s+)?(\d+(?:,\d+)?)\s*m(?:\s*\((.*)\))?$", re.I)
MODES_ES = {"volar": "fly", "nadar": "swim", "trepar": "climb", "excavar": "burrow"}
DIST_RE = re.compile(r"\d+(?:[.,]\d+)?\s*-?\s*(?:ft\b\.?|feet\b|foot\b|miles?\b|m\b\.?|km\b|mètres?\b)")
MINUS = "−"


def signed(s: str) -> str:
    """'−2' (U+2212) / '–2' (U+2013, French PDF) / '+ 3' -> '-2' / '-2' / '+3'."""
    return s.replace(MINUS, "-").replace("–", "-").replace("\xa0", "").replace(" ", "")


# ---------- collecting the raw stat blocks ----------

def collect(blocks: list[dict], lang: str) -> tuple[list[dict], dict[str, list[dict]]]:
    """Raw stat blocks (name, lines, h1 group, chapter, spell) and the descriptive paragraphs under each h1 (flavour)."""
    items: list[dict] = []
    flavour: dict[str, list[dict]] = defaultdict(list)
    chap = group = spell = None
    cur: dict | None = None
    for i, b in enumerate(blocks):
        k = b["kind"]
        if k == "chapter":
            chap = CHAPTERS[lang].get(norm(b["text"]))
            cur = group = spell = None
            continue
        if chap is None:
            continue
        if k == "h1":
            group, cur = b["text"], None
            continue
        if k == "h3" and chap == "spells":
            spell, cur = b["text"], None
            continue
        if k in LEVEL or k in ("table", "aside", "li", "field"):
            cur = None
            continue
        nxt = blocks[i + 1] if i + 1 < len(blocks) else None
        is_name = (k == "p" or (k == "stat" and b["font"] == "Optima-Bold")) and NAME_RE.match(b["text"])
        if is_name and nxt and nxt["kind"] == "stat" and nxt["font"] == "Optima-Italic":
            cur = {"lang": lang, "name": NAME_RE.match(b["text"]).group(1).strip(), "page": b["page"], "chapter": chap,
                   "group": group if chap != "spells" else None, "spell": spell if chap == "spells" else None, "lines": []}
            items.append(cur)
            continue
        if cur is not None:
            if k in ("stat", "stat-h"):
                cur["lines"].append(b)
                continue
            if k == "p" and ABILITY_P_RE.match(plain(b["text"]).replace("\xa0", " ")):
                note(f"creatures {lang} p.{b['page']} {cur['name']!r}: ability row {plain(b['text'])!r} extracted as a "
                     f"paragraph — read as a table row")
                cur["lines"].append({**b, "kind": "stat", "font": "GillSans-SemiBold-SC700", "x": None, "f": None})
                continue
            cur = None
        if chap in ("monsters", "animals") and k == "p":
            flavour[group].append(b)
    return items, flavour


# ---------- parsing one stat block ----------

def join_lines(a: str, b: str) -> str:
    """Append a wrapped line: one bold or italic run across the break, hyphenation undone before a lowercase letter."""
    if not a:
        return b
    m = re.search(r"\u00ad(\**)$", a)
    if m:  # word cut by a soft hyphen (Spanish PDF): joined without a space, one markup run across the break
        head, mk = a[: m.start()], m.group(1)
        return head + b[len(mk):] if mk and b.startswith(mk) else head + mk + b
    if a.endswith("**") and b.startswith("**"):
        return a[:-2] + " " + b[2:]
    if a.endswith("*") and not a.endswith("**") and b.startswith("*") and not b.startswith("**"):
        return a[:-1] + " " + b[1:]
    if a.endswith("-") and plain(b)[:1].islower():
        return a[:-1] + b
    return a + " " + b


def column_x(x: int | None) -> int:
    return 63 if x is None or x < 300 else 313


def indented(b: dict) -> bool:
    x = b.get("x")
    return x is not None and x - column_x(x) >= 5


def ability_tokens(b: dict) -> list[str]:
    texts = [t for _, t in b["f"]] if b.get("f") else [plain(b["text"])]
    out: list[str] = []
    for t in texts:
        out += TOKEN_RE.findall(t.replace("\xa0", " "))
    return out


def parse_abilities(tokens: list[str], where: str) -> dict[str, dict] | None:
    abil: dict[str, dict] = {}
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.lower() not in ABILITIES:
            note(f"creatures {where}: unexpected token {t!r} in the ability table {tokens}")
            i += 1
            continue
        key = ABILITIES[t.lower()]
        vals = tokens[i + 1:i + 4]
        if len(vals) < 3 or not re.fullmatch(r"\d+", vals[0]) or any(v.lower() in ABILITIES for v in vals[1:]):
            note(f"creatures {where}: ability {key} row not understood {tokens}")
            return None
        for v in vals[1:]:
            if not re.match(r"[+−–-]", v):  # the PDF prints "2" for the Young White Dragon's Int save (p. 340)
                note(f"creatures {where}: {key} modifier/save {v!r} printed without a sign — stored as printed")
        score = int(vals[0])
        mod = int(signed(vals[1]))
        save = int(signed(vals[2]))
        if mod != math.floor((score - 10) / 2):
            note(f"creatures {where}: {key} {score} printed with modifier {mod:+d}")
        abil[key] = {"score": score, "mod": mod, "save": save}
        i += 4
    if set(abil) != set(ABILITY_ORDER):
        note(f"creatures {where}: abilities found {sorted(abil)} from {tokens}")
        return None
    return {k: abil[k] for k in ABILITY_ORDER}


def split_top(s: str) -> list[str]:
    """Split on ", " outside parentheses (a French decimal "1,50 m" has no space after its comma)."""
    out, depth, cur = [], 0, ""
    for i, ch in enumerate(s):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0 and s[i + 1:i + 2].isspace():
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip()]


def parse_speed(text: str, lang: str, where: str) -> dict:
    """'30 ft., Fly 90 ft. (hover)' / '9 m, vol 27 m (stationnaire)' -> {mode: {"value": number, "raw": chunk}, hover}."""
    out: dict = {"modes": {}, "hover": False, "text": re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()}
    rx = {"en": SPEED_EN_RE, "fr": SPEED_FR_RE, "es": SPEED_ES_RE}[lang]
    for chunk in split_top(out["text"]):
        chunk = chunk.strip()
        m = rx.match(chunk) or rx.match(chunk.rstrip("."))
        if not m:
            note(f"creatures {where}: speed part {chunk!r} kept in text only")
            continue
        mode_raw, val, paren = m.group(1), m.group(2), m.group(3)
        mode = "walk" if not mode_raw else (mode_raw.lower() if lang == "en" else {"fr": MODES_FR, "es": MODES_ES}[lang][mode_raw.lower()])
        if paren and re.search(r"hover|stationnaire|levitar", paren, re.I):
            out["hover"] = True
        if mode in out["modes"]:
            note(f"creatures {where}: second {mode} speed {chunk!r} kept in text only")
            continue
        out["modes"][mode] = {"value": parse_number(val), "raw": chunk.strip()}
    return out


def parse_cr(text: str, lang: str, where: str) -> dict:
    t = text.replace("\xa0", " ").strip()
    m = re.match(r"^(\S+)\s*\((.*)\)\s*$", t)
    out: dict = {"cr": None, "xp": None, "xpInLair": None, "pb": None, "text": t}
    if not m:
        note(f"creatures {where}: CR {t!r} not understood")
        return out
    cr_tok, inner = m.group(1), m.group(2)
    if cr_tok.lower() not in ("none", "aucun", "ninguno"):
        out["cr"] = parse_number(cr_tok)
    xp = (re.search(r"XP\s*(\d[\d,]*\d|\d)|(\d[\d,]*\d|\d)\s*XP", inner) if lang == "en"
          else re.search(r"PX\s*(\d[\d ]*\d|\d)|(\d[\d ]*\d|\d)\s*PX", inner))
    if xp:
        out["xp"] = parse_number((xp.group(1) or xp.group(2)).strip())
    lair = (re.search(r"or (\d[\d,]*\d) in lair", inner) if lang == "en"
            else re.search(r"ou (\d[\d ]*\d) dans son antre", inner) if lang == "fr"
            else re.search(r"\b[ou] (\d[\d ]*\d) en la guarida", inner))
    if lair:
        out["xpInLair"] = parse_number(lair.group(1).strip())
    pb = re.search(r"(?:PB|BM|BC)\s*\+(\d+)", inner)
    if pb:
        out["pb"] = int(pb.group(1))
    if out["xp"] is None or (out["pb"] is None and not re.search(r"equals|égal|igual", inner)):
        note(f"creatures {where}: CR {t!r} partly understood")
    return out


def parse_typeline(text: str, lang: str, where: str) -> dict:
    t = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
    head, _, alignment = t.rpartition(",")
    if not head:
        head, alignment = t, ""
        note(f"creatures {where}: type line {t!r} without an alignment")
    out = {"alignment": alignment.strip(), "sizes": None, "type": head.strip()}
    if lang == "en":
        m = SIZE_RE.match(head.strip())
        if not m:
            note(f"creatures {where}: size not understood in {t!r}")
        else:
            a, b, typ = m.group(1).lower(), (m.group(2) or "").lower(), m.group(3).strip()
            i = SIZES.index(a)
            if b == "smaller":
                sizes = SIZES[:i + 1]
            elif b == "larger":
                sizes = SIZES[i:]
            elif b:
                sizes = sorted({a, b}, key=SIZES.index)
            else:
                sizes = [a]
            out["sizes"], out["type"] = sizes, typ
    else:
        out["type"] = {"fr": FR_SIZE_RE, "es": ES_SIZE_RE}[lang].sub("", head.strip(), count=1).strip()
    return out


def parse_block(raw: dict) -> dict:
    lang, L = raw["lang"], raw["lines"]
    where = f"{lang} p.{raw['page']} {raw['name']!r}"
    i = 0
    type_lines: list[str] = []
    while i < len(L) and L[i]["kind"] == "stat" and L[i]["font"] == "Optima-Italic":
        type_lines.append(plain(L[i]["text"]).strip())
        i += 1
    fields: dict[str, str] = {}
    tokens: list[str] = []
    last_key: str | None = None
    while i < len(L) and L[i]["kind"] != "stat-h":
        b = L[i]
        i += 1
        if b["font"].startswith("GillSans"):
            tokens += ability_tokens(b)
            continue
        m = re.match(r"^\*\*([^*]+?)\*\*\s*(.*)$", b["text"], re.S)
        # the key is the bold run-in, whatever the line font (Camel's and Zombie's Initiative lines are "Optima-Regular")
        key = KEYS[lang].get(norm(m.group(1).rstrip(" :"))) if m else None  # Spanish: "**CA:**"
        if key:
            if key in fields:
                note(f"creatures {where}: field {key} repeated")
            fields[key] = m.group(2).strip()
            last_key = key
        elif last_key:
            fields[last_key] = join_lines(fields[last_key], b["text"].strip())
        else:
            note(f"creatures {where}: header line {b['text'][:50]!r} not understood")
    sections: dict[str, dict] = {}
    sec: dict | None = None
    entry: dict | None = None
    while i < len(L):
        b = L[i]
        i += 1
        txt = b["text"].strip()
        if b["kind"] == "stat-h":
            key = SECTIONS[lang].get(norm(txt))
            if key is None:
                note(f"creatures {where}: section heading {txt!r} unknown")
                key = norm(txt)
            sec = sections.setdefault(key, {"intro": "", "entries": []})
            entry = None
            continue
        if sec is None:
            note(f"creatures {where}: line {txt[:50]!r} before any section")
            continue
        if b["font"] == "Optima-BoldItalic" and not indented(b):
            if entry is not None and re.fullmatch(r"\*\*[^*]*\*\*", entry["raw"]) and not re.search(r"[.:]\*\*$", entry["raw"]):
                entry["raw"] = join_lines(entry["raw"], txt)  # the run-in name wrapped onto a second line
            else:
                entry = {"raw": txt}
                sec["entries"].append(entry)
            continue
        if entry is None:
            sec["intro"] = join_lines(sec["intro"], txt)
            continue
        if indented(b) or (b["font"] == "Optima-Bold" and re.match(r"^\*\*[^*]*[.:]\s*\*\*", txt)):
            entry["raw"] += "\n" + txt
        else:
            entry["raw"] = join_lines(entry["raw"], txt)
    abilities = parse_abilities(tokens, where)
    typ = parse_typeline(" ".join(type_lines), lang, where)
    out = {**raw, "where": where, "typeline": " ".join(type_lines), **typ, "fields": fields, "abilities": abilities}
    out["ac"] = int(fields["ac"]) if re.fullmatch(r"\d+", fields.get("ac", "").replace("\xa0", " ").strip()) else None
    hp = fields.get("hp", "").replace("\xa0", " ").strip()
    m = re.fullmatch(r"(\d+)\s*\((\d+d\d+[^)]*)\)", hp)  # "150 (20d10 + 40)"; a formula ("5 + 10 per spell level") stays text
    out["hp"] = {"average": int(m.group(1)), "dice": re.sub(r"\s+", " ", m.group(2)).strip()} if m else None
    ini = signed(fields.get("initiative", "")).strip()
    m = re.fullmatch(r"([+-]?\d+)\((\d+)\)", ini)
    out["initiative"] = {"mod": int(m.group(1)), "score": int(m.group(2))} if m else None
    if ini and not m:
        note(f"creatures {where}: initiative {ini!r} not understood")
    out["speed"] = parse_speed(fields.get("speed", ""), lang, where)
    out["cr"] = parse_cr(fields.get("cr", ""), lang, where)
    pp = re.search(r"(?:Passive Perception|Perception passive|Percepción pasiva)\s*(\d+)", fields.get("senses", "").replace("\xa0", " "))
    out["passivePerception"] = int(pp.group(1)) if pp else None
    if pp is None:
        note(f"creatures {where}: no Passive Perception in {fields.get('senses')!r}")
    for k in ("ac", "hp", "speed", "senses", "languages", "cr"):
        if k not in fields:
            note(f"creatures {where}: field {k} missing")
    out["sections"] = {k: {"intro": v["intro"], "entries": [split_entry(e["raw"], where) for e in v["entries"]]}
                       for k, v in sections.items()}
    return out


def split_entry(raw: str, where: str) -> dict:
    m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", raw, re.S)
    if not m:
        note(f"creatures {where}: entry without a run-in name {raw[:50]!r}")
        return {"name": "", "text": raw, "raw": raw}
    name = m.group(1).strip()
    name = name[:-1].strip() if name.endswith(".") else name
    return {"name": name, "text": m.group(2).strip(), "raw": raw}


def entry_html(text: str) -> str:
    return "<br>".join(md_inline(p.strip()) for p in text.split("\n") if p.strip())


# ---------- alignment of stat blocks ----------

def speeds_m(c: dict) -> tuple:
    f = 0.3 if c["lang"] == "en" else 1.0
    return tuple(sorted((mode, round(v["value"] * f, 2)) for mode, v in c["speed"]["modes"].items() if v["value"] is not None))


def signature(c: dict) -> tuple:
    ab = c["abilities"]
    scores = tuple(ab[k]["score"] for k in ABILITY_ORDER) if ab else ()
    hp = c["hp"]
    return (c["ac"], hp["average"] if hp else None, hp["dice"].replace(" ", "") if hp else None, scores, c["cr"]["cr"],
            c["initiative"]["mod"] if c["initiative"] else None, speeds_m(c),
            tuple((k, len(v["entries"])) for k, v in sorted(c["sections"].items())))


def all_text(c: dict) -> str:
    return " ".join(e["text"] for s in c["sections"].values() for e in s["entries"])


def secondary(a: dict, b: dict) -> float:
    da, db = Counter(re.findall(r"\b\d+d\d+\b", all_text(a))), Counter(re.findall(r"\b\d+d\d+\b", all_text(b)))
    union = sum((da | db).values())
    score = (sum((da & db).values()) / union if union else 0.5) * 3
    score -= abs(len(a["fields"]) - len(b["fields"]))
    score += 1 if a["chapter"] == b["chapter"] else -3
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
    overrides = read_overrides()
    fr_by_name = defaultdict(list)
    for f in fr:
        fr_by_name[norm(f["name"])].append(f)
    matched: dict[str, dict] = {}
    stats: Counter = Counter()
    for c in en:
        o = overrides.get(c["id"])
        if o and o["status"] == "ok":
            cands = fr_by_name.get(norm(o["fr_guess"]), [])
            if not cands:
                note(f"creatures override {c['id']}: French name {o['fr_guess']!r} not found")
                continue
            f = min(cands, key=lambda f: -secondary(c, f))
            matched[c["id"]] = f
            stats["override"] += 1
    used = {id(f) for f in matched.values()}
    groups_en: dict[tuple, list] = defaultdict(list)
    groups_fr: dict[tuple, list] = defaultdict(list)
    for c in en:
        if c["id"] not in matched:
            groups_en[signature(c)].append(c)
    for f in fr:
        if id(f) not in used:
            groups_fr[signature(f)].append(f)
    leftover: list[dict] = []
    for sig, es in groups_en.items():
        fs = groups_fr.get(sig, [])
        if len(es) == 1 and len(fs) == 1:
            matched[es[0]["id"]] = fs[0]
            stats["signature"] += 1
            continue
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
        guess = max(free_fr, key=lambda f: (signature(f)[3] == signature(e)[3], secondary(e, f)), default=None)
        row = overrides.get(e["id"]) or {"id": e["id"], "en": e["name"], "fr_guess": "", "status": "todo"}
        if row["status"] != "ok":
            row["fr_guess"] = guess["name"] if guess else ""
            row["status"] = "todo"
        overrides[e["id"]] = row
        todo += 1
        note(f"creatures: {e['name']!r} (p.{e['page']}) not aligned — best guess {row['fr_guess']!r} written as `todo` "
             f"in {OVERRIDES.name}")
    stats["todo"] = todo
    for k in [k for k, r in overrides.items() if r["status"] == "todo" and k in matched]:
        del overrides[k]
    if free_fr:
        note(f"creatures: {len(free_fr)} French stat blocks left unmatched: {[(f['name'], f['page']) for f in free_fr]}")
    write_overrides(overrides)
    return matched, dict(stats)


# ---------- alignment of the entries inside one stat block ----------

def numbers(text: str) -> Counter:
    t = DIST_RE.sub(" ", plain(text).replace("\xa0", " "))
    return Counter(re.findall(r"\d+d\d+|\d+", t))


def cognates(e: dict, g: dict) -> float:
    """Number of English words (6+ letters) of an entry that share their first 5 letters with a French word of the other."""
    we = {w for w in re.findall(r"[a-z]{6,}", norm(e["name"] + " " + e["text"]))}
    wf = {w[:5] for w in re.findall(r"[a-z]{6,}", norm(g["name"] + " " + g["text"]))}
    return float(sum(1 for w in we if w[:5] in wf))


def pair_entries(c: dict, f: dict, names: dict[str, str], learn: bool, stats: Counter) -> dict[str, list[tuple[dict, dict | None]]]:
    """Pair the entries of every section of an EN stat block with those of its French counterpart. Entries are
    alphabetical in each language (Multiattack first), so position means nothing; the signals, in order:
      1. numbers of the name and text (dice, DCs, bonuses, uses; distances excluded): Jaccard >= 0.5 and no rival;
      2. the dictionary of entry names learnt from the unambiguous pairs of other stat blocks;
      3. cross-references to entries already paired in this block ("The mummy uses Dreadful Glare");
      4. a single entry left on each side; else, same counts: pairing by text length order (logged for checking)."""
    where = c["where"]
    secs = [s for s in SECTION_ORDER if s in c["sections"] or s in f["sections"]]
    E = {s: c["sections"].get(s, {"entries": []})["entries"] for s in secs}
    F = {s: f["sections"].get(s, {"entries": []})["entries"] for s in secs}
    pairs: dict[str, dict[int, int]] = {s: {} for s in secs}
    taken: dict[str, set[int]] = {s: set() for s in secs}
    local: dict[str, str] = {}

    def accept(s: str, i: int, j: int, how: str) -> None:
        pairs[s][i] = j
        taken[s].add(j)
        stats[how] += 1
        a, b = norm(E[s][i]["name"]), norm(F[s][j]["name"])
        local[a] = b
        if learn and how in ("numbers", "singleton", "reference", "cognates"):
            names[a] = b

    def best_pairs(s: str, scored: list[tuple[float, int, int]], how: str, floor: float) -> bool:
        """Accept the mutual best scores (no rival as good) among the still unpaired entries of a section."""
        got = False
        for score, i, j in sorted(scored, reverse=True):
            if i in pairs[s] or j in taken[s] or score < floor:
                continue
            rivals = [sc for sc, i2, j2 in scored if (i2 == i or j2 == j) and (i2, j2) != (i, j)
                      and i2 not in pairs[s] and j2 not in taken[s]]
            if rivals and max(rivals) >= score:
                continue
            accept(s, i, j, how)
            got = True
        return got

    for s in secs:
        if s not in c["sections"] or s not in f["sections"]:
            if not learn:
                note(f"creatures {where}: section {s} only on one side")
            continue
        scored = []
        for i, e in enumerate(E[s]):
            ne = numbers(e["name"] + " " + e["text"])
            for j, g in enumerate(F[s]):
                nf = numbers(g["name"] + " " + g["text"])
                union = sum((ne | nf).values())
                if union:
                    scored.append((sum((ne & nf).values()) / union, i, j))
        best_pairs(s, scored, "numbers", 0.5)
        for i, e in enumerate(E[s]):
            want = names.get(norm(e["name"]))
            if i in pairs[s] or not want:
                continue
            for j, g in enumerate(F[s]):
                if j not in taken[s] and norm(g["name"]) == want:
                    accept(s, i, j, "dictionary")
                    break
    changed = True
    while changed:
        changed = False
        for s in secs:
            rest_e = [i for i in range(len(E[s])) if i not in pairs[s]]
            rest_f = [j for j in range(len(F[s])) if j not in taken[s]]
            if not rest_e or not rest_f or s not in c["sections"] or s not in f["sections"]:
                continue
            scored = []
            for i in rest_e:
                te = norm(E[s][i]["text"])
                for j in rest_f:
                    tf = norm(F[s][j]["text"])
                    hits = sum(1 for a, b in local.items() if a in te and b in tf)
                    if hits:
                        scored.append((float(hits), i, j))
            if best_pairs(s, scored, "reference", 1.0):
                changed = True
    for s in secs:  # cognates (words sharing a 5-letter prefix once accents are removed: Telepathy / Télépathie)
        if s not in c["sections"] or s not in f["sections"]:
            continue
        rest_e = [i for i in range(len(E[s])) if i not in pairs[s]]
        rest_f = [j for j in range(len(F[s])) if j not in taken[s]]
        scored = [(cognates(E[s][i], F[s][j]), i, j) for i in rest_e for j in rest_f]
        best_pairs(s, [x for x in scored if x[0] > 0], "cognates", 1.0)
    for s in secs:
        if s not in c["sections"] or s not in f["sections"]:
            continue
        rest_e = [i for i in range(len(E[s])) if i not in pairs[s]]
        rest_f = [j for j in range(len(F[s])) if j not in taken[s]]
        if len(rest_e) == 1 and len(rest_f) == 1:
            accept(s, rest_e[0], rest_f[0], "singleton")
        elif len(rest_e) != len(rest_f):
            if not learn:
                note(f"creatures {where}: {s}: {len(E[s])} EN entries vs {len(F[s])} FR entries — unpaired "
                     f"EN {[E[s][i]['name'] for i in rest_e]} / FR {[F[s][j]['name'] for j in rest_f]}")
        elif rest_e:
            order_e = sorted(rest_e, key=lambda i: len(E[s][i]["text"]))
            order_f = sorted(rest_f, key=lambda j: len(F[s][j]["text"]))
            for i, j in zip(order_e, order_f):
                accept(s, i, j, "length")
            if not learn:
                note(f"creatures {where}: {s} entries paired by text length — check: "
                     f"{[(E[s][i]['name'], F[s][j]['name']) for i, j in zip(order_e, order_f)]}")
    return {s: [(e, F[s][pairs[s][i]] if i in pairs[s] else None) for i, e in enumerate(E[s])] for s in secs}



# ---------- build ----------

def build(en_blocks: list[dict], fr_blocks: list[dict]) -> dict[str, int]:
    raw_en, flavour_en = collect(en_blocks, "en")
    raw_fr, flavour_fr = collect(fr_blocks, common.LANG)
    en = [parse_block(r) for r in raw_en]
    fr = [parse_block(r) for r in raw_fr]
    for c in en:
        c["id"] = kebab(c["name"])
    dup = [k for k, v in Counter(c["id"] for c in en).items() if v > 1]
    if dup:
        note(f"creatures: duplicate ids {dup}")
    matched, stats = align(en, fr)
    note(f"creatures alignment: {len(en)} EN / {len(fr)} FR stat blocks — " + ", ".join(f"{k} {v}" for k, v in stats.items()))
    for grp, ps in list(flavour_en.items()) + list(flavour_fr.items()):
        note(f"creatures: {len(ps)} descriptive paragraph(s) under {grp!r} (p.{ps[0]['page']})")

    # entry dictionary: first pass learns names from unambiguous pairs, second pass applies it
    names: dict[str, str] = {}
    for learn in (True, False):
        estats: Counter = Counter()
        for c in en:
            f = matched.get(c["id"])
            if f:
                c["pairs"] = pair_entries(c, f, names, learn, estats)
    note("creatures entries paired: " + ", ".join(f"{k} {v}" for k, v in sorted(estats.items())))

    out = []
    for c in en:
        f = matched.get(c["id"])
        if f is None:
            note(f"creatures: {c['name']!r} has no French counterpart — French fields left empty")
            f = {"name": "", "type": "", "alignment": "", "fields": {}, "speed": {"modes": {}, "text": ""}, "page": None,
                 "group": None, "cr": {"text": ""}, "sections": {}}
            c["pairs"] = {sec: [(e, None) for e in s["entries"]] for sec, s in c["sections"].items()}
        else:
            for k in ("ac", "hp", "abilities", "initiative"):
                if c[k] != f[k]:
                    note(f"creatures {c['name']!r} / {f['name']!r}: {k} differs EN {c[k]!r} / FR {f[k]!r}")
        d: dict = {
            "id": c["id"],
            "name": i18n(c["name"], f["name"]),
        }
        if c["group"] and norm(c["group"]) != norm(c["name"]):
            d["group"] = i18n(c["group"], f.get("group") or "")
        d["size"] = c["sizes"] or []
        d["type"] = i18n(c["type"], f["type"])
        d["tags"] = type_tags(c["type"])
        d["alignment"] = i18n(c["alignment"], f["alignment"])
        d["ac"] = c["ac"]
        if c["ac"] is None:
            d["acText"] = i18n(c["fields"].get("ac", ""), f["fields"].get("ac", ""))
        if c["initiative"]:
            d["initiative"] = c["initiative"]
        d["hp"] = c["hp"]
        if c["hp"] is None:
            d["hpText"] = i18n(c["fields"].get("hp", ""), f["fields"].get("hp", ""))
        d["speed"] = build_speed(c, f)
        d["abilities"] = c["abilities"]
        for k in ("skills", "resistances", "vulnerabilities", "immunities", "gear"):
            if k in c["fields"] or k in f["fields"]:
                d[k] = i18n(clean(c["fields"].get(k, "")), clean(f["fields"].get(k, "")))
        d["senses"] = i18n(clean(c["fields"].get("senses", "")), clean(f["fields"].get("senses", "")))
        d["passivePerception"] = c["passivePerception"]
        d["languages"] = i18n(clean(c["fields"].get("languages", "")), clean(f["fields"].get("languages", "")))
        d["cr"] = num(c["cr"]["cr"]) if c["cr"]["cr"] is not None else None
        d["xp"] = num(c["cr"]["xp"]) if c["cr"]["xp"] is not None else None
        if c["cr"]["xpInLair"] is not None:
            d["xpInLair"] = num(c["cr"]["xpInLair"])
        d["pb"] = c["cr"]["pb"]
        if c["cr"]["cr"] is None or c["cr"]["pb"] is None:
            d["crText"] = i18n(c["cr"]["text"], f["cr"]["text"])
        for sec in SECTION_ORDER:
            pairs = c["pairs"].get(sec)
            if pairs is None:
                if sec in ("traits", "actions"):
                    d[sec] = []
                continue
            d[sec] = [{"name": i18n(e["name"], fe["name"] if fe else ""),
                       "text": i18n(entry_html(e["text"]), entry_html(fe["text"]) if fe else "")} for e, fe in pairs]
            if sec == "legendaryActions":
                intro_en = c["sections"][sec]["intro"]
                intro_fr = f["sections"].get(sec, {}).get("intro", "")
                if intro_en or intro_fr:
                    d["legendaryActionsIntro"] = i18n(md_inline(intro_en), md_inline(intro_fr))
        if c["chapter"] in flavour_en and c["group"] and flavour_en.get(c["group"]):
            pass
        fl_en = flavour_en.get(c["group"]) if c["group"] else None
        if fl_en:
            fl_fr = flavour_fr.get(f.get("group")) if f.get("group") else None
            d["flavour"] = i18n(" ".join(md_inline(p["text"]) for p in fl_en),
                                " ".join(md_inline(p["text"]) for p in (fl_fr or [])))
        section = SECTION_NAMES.get(c["chapter"]) or f"Spells: {c['spell']}"
        d["source"] = source({"page": c["page"]}, {"page": f["page"]} if f.get("page") else None, section)
        apply_corrections(d)
        out.append(d)
    out = json.loads(json.dumps(out).replace("\\u00ad", ""))  # soft hyphens left at an entry end (Spanish PDF)
    write_json(OUT_SRD / "creatures.json", out)
    return {"creatures.json": len(out)}


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", plain(s).replace("\xa0", " ")).strip()


def type_tags(type_en: str) -> list[str]:
    """'Fiend (Devil)' -> ['fiend', 'devil']; 'Swarm of Tiny Beasts' -> ['swarm', 'beast'];
    'Celestial, Fey, or Fiend (Your Choice)' -> ['celestial', 'fey', 'fiend', 'your-choice']."""
    tags: list[str] = []
    base = re.sub(r"\(([^)]*)\)", "", type_en)
    for w in re.split(r",|\bor\b|\bof\b", base):
        w = w.strip()
        if not w:
            continue
        first = kebab(w.split()[0])
        if first == "tiny" and len(w.split()) > 1:  # "Swarm of Tiny Beasts"
            first = kebab(w.split()[1]).rstrip("s")
        if first and first not in tags:
            tags.append(first)
    for p in re.findall(r"\(([^)]*)\)", type_en):
        for t in re.split(r",|\bor\b", p):
            t = kebab(t.strip())
            if t and "-" not in t and t not in tags:  # "(Your Choice)" is not a tag
                tags.append(t)
    return tags


def build_speed(c: dict, f: dict) -> dict:
    out: dict = {}
    fr_modes = f["speed"]["modes"]
    for mode, v in c["speed"]["modes"].items():
        fv = fr_modes.get(mode)
        if fv:
            pair = parse_distance_pair(v["raw"], fv["raw"], f"creatures {c['name']} {mode}")
        else:
            if f.get("name"):
                note(f"creatures {c['name']!r} / {f['name']!r}: {mode} speed missing in French {f['speed']['text']!r}")
            pair = parse_distance_pair(v["raw"], "", f"creatures {c['name']} {mode}")
        if pair:
            out[mode] = pair
    for mode in fr_modes:
        if mode not in c["speed"]["modes"]:
            note(f"creatures {c['name']!r} / {f['name']!r}: French {mode} speed without an English one")
    if c["speed"]["hover"]:
        out["hover"] = True
    out["text"] = i18n(c["speed"]["text"], f["speed"]["text"])
    return out


if __name__ == "__main__":
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import common

    counts = build(common.load_blocks("en"), common.load_blocks("fr"))
    print(counts)
    for n in common.NOTES:
        print(" -", n)
