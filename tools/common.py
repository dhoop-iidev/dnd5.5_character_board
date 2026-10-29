"""Shared helpers for the data pipeline: extracted blocks, sections, bilingual alignment, text -> HTML, units, output.

The pipeline reads `sources/extracted/{en,fr,es}.json` (made by extract_srd.py from the three SRD 5.2.1 PDFs) and writes
`src/data/srd/*.json` shaped as `src/data/types.ts`. Every entry carries `source: {page, frPage, esPage, section}`.

Languages: the builders are written as English + one translation (the "foreign" side, historically named `fr` in the
code). build_data.py runs every builder twice: once with LANG = "fr" (French blocks), once with LANG = "es" (Spanish
blocks), and merges the Spanish pass into the French one (each I18n gets `es`, each source `esPage`). Language-specific
vocabularies are picked with `L(fr=..., es=...)`.
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACTED = ROOT / "sources" / "extracted"
OUT_SRD = ROOT / "src" / "data" / "srd"
OUT_CUSTOM = ROOT / "src" / "data" / "custom"

NOTES: list[str] = []  # modelling notes and mismatches, printed by build_data.py
LANG = "fr"  # the translation built by the current pass ("fr" or "es"); set by build_data.py
CAPTURE: dict[str, object] | None = None  # when set, write_json() stores the data here (file name -> data) instead of writing


def L(**by_lang):
    """The value for the current translation: L(fr="Sorts", es="Conjuros")."""
    return by_lang[LANG]


def overrides_path(kind: str) -> Path:
    """Hand-checked name pairings of one translation: tools/fr_overrides_<kind>.csv, tools/es_overrides_<kind>.csv."""
    return ROOT / "tools" / f"{LANG}_overrides_{kind}.csv"


def note(msg: str) -> None:
    NOTES.append(msg)


# ---------- blocks ----------

def load_blocks(lang: str) -> list[dict]:
    return json.loads((EXTRACTED / f"{lang}.json").read_text(encoding="utf-8"))


def kebab(name: str) -> str:
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("’", "").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def i18n(en: str, fr: str) -> dict:
    return {"en": en, "fr": fr}


def source(en_block: dict | None, fr_block: dict | None, section: str) -> dict:
    s: dict = {}
    if en_block:
        s["page"] = en_block["page"]
    if fr_block:
        s["frPage"] = fr_block["page"]
    if section:
        s["section"] = section
    return s


@dataclass
class Section:
    """A heading and the blocks under it, up to the next heading of the same or a higher level."""
    heading: dict
    blocks: list[dict] = field(default_factory=list)

    @property
    def title(self) -> str:
        return self.heading["text"]

    @property
    def level(self) -> int:
        return LEVEL[self.heading["kind"]]

    @property
    def page(self) -> int:
        return self.heading["page"]

    def sub(self, kind: str) -> list["Section"]:
        """Direct sub-sections of a heading kind (e.g. 'h3' under an 'h2')."""
        return split_sections(self.blocks, kind)

    def own(self) -> list[dict]:
        """Blocks before the first sub-heading."""
        out = []
        for b in self.blocks:
            if b["kind"] in LEVEL and LEVEL[b["kind"]] > self.level:
                break
            out.append(b)
        return out

    def tables(self) -> list[dict]:
        return [b for b in self.blocks if b["kind"] == "table"]

    def table(self, title_part: str) -> dict | None:
        for t in self.tables():
            if norm(title_part) in norm(t["title"]):
                return t
        return None


LEVEL = {"chapter": 0, "h1": 1, "h2": 2, "h3": 3, "h4": 4}


def split_sections(blocks: list[dict], kind: str) -> list[Section]:
    """Cut a block list at every heading of `kind`; blocks before the first one are dropped. A heading of a higher level
    (e.g. an h2 while cutting at h3) closes the current section too."""
    lvl = LEVEL[kind]
    out: list[Section] = []
    cur: Section | None = None
    for b in blocks:
        k = b["kind"]
        if k == kind:
            cur = Section(b)
            out.append(cur)
        elif k in LEVEL and LEVEL[k] < lvl:
            cur = None
        elif cur is not None:
            cur.blocks.append(b)
    return out


def chapter(blocks: list[dict], title_part: str) -> Section:
    for s in split_sections(blocks, "chapter"):
        if norm(title_part) in norm(s.title):
            return s
    raise KeyError(title_part)


def norm(s: str) -> str:
    """Comparison key: lowercase, accents and apostrophes removed, spaces collapsed."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip().lower()


def pair_sections(en: list[Section], fr: list[Section], what: str) -> list[tuple[Section, Section]]:
    """Align two section lists by position (the two PDFs share one structure). Logs a note when the counts differ."""
    if len(en) != len(fr):
        note(f"{what}: {len(en)} EN sections vs {len(fr)} FR sections — aligned by position up to the shorter list")
    return list(zip(en, fr))


# ---------- text ----------

def md_inline(s: str) -> str:
    """**bold** / *italic* markup (from srd_pdf) -> <strong> / <em>, with HTML escaping."""
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", s)
    return s


def plain(s: str) -> str:
    """Markup removed."""
    return re.sub(r"\*+", "", s)


def blocks_html(blocks: list[dict], skip_tables: bool = False) -> str:
    """Body blocks (p, li, field, table, aside) -> HTML. Headings are rendered as <h4>."""
    out: list[str] = []
    li: list[str] = []

    def flush_li():
        if li:
            out.append("<ul>" + "".join(f"<li>{x}</li>" for x in li) + "</ul>")
            li.clear()

    for b in blocks:
        k = b["kind"]
        if k == "li":
            li.append(md_inline(b["text"]))
            continue
        flush_li()
        if k == "p":
            out.append(f"<p>{md_inline(b['text'])}</p>")
        elif k == "field":
            out.append(f"<p class=\"field\">{md_inline(b['text'])}</p>")
        elif k in ("h3", "h4", "h2", "h1"):
            out.append(f"<h4>{md_inline(b['text'])}</h4>")
        elif k == "table" and not skip_tables:
            out.append(table_html(b))
        elif k == "aside":
            inner = "".join(f"<p>{md_inline(x)}</p>" for x in b["lines"])
            out.append(f"<aside><h4>{md_inline(b['title'])}</h4>{inner}</aside>")
    flush_li()
    return "".join(out)


def table_html(t: dict) -> str:
    parts = ["<table>"]
    if t.get("title"):
        parts.append(f"<caption>{md_inline(t['title'])}</caption>")
    if t.get("header"):
        parts.append("<thead><tr>" + "".join(f"<th>{md_inline(h)}</th>" for h in t["header"]) + "</tr></thead>")
    parts.append("<tbody>")
    for r in t["rows"]:
        if r and r[0].startswith("§ "):
            parts.append(f"<tr class=\"section\"><th colspan=\"{len(r)}\">{md_inline(r[0][2:])}</th></tr>")
        else:
            parts.append("<tr>" + "".join(f"<td>{md_inline(c)}</td>" for c in r) + "</tr>")
    parts.append("</tbody></table>")
    return "".join(parts)


def field_value(blocks: list[dict], key_en: str, key_fr: str | None = None) -> str | None:
    """The value of a `field` block "Key: value" (markup removed)."""
    keys = [norm(key_en)] + ([norm(key_fr)] if key_fr else [])
    for b in blocks:
        if b["kind"] != "field":
            continue
        txt = plain(b["text"])
        m = re.match(r"^([^:]+?)\s*:\s*(.*)$", txt, re.S)
        if m and norm(m.group(1)) in keys:
            return m.group(2).strip()
    return None


def runin_paragraphs(blocks: list[dict]) -> dict[str, str]:
    """Paragraphs starting with a bold run-in heading ("**Rage Damage.** text") -> {heading: text (markup kept)}."""
    out: dict[str, str] = {}
    for b in blocks:
        if b["kind"] != "p":
            continue
        m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", b["text"], re.S)
        if m:
            out[m.group(1).rstrip(".").rstrip(" :").strip()] = m.group(2)
    return out


# ---------- numbers and units ----------

def num(x: float) -> float | int:
    x = round(float(x), 4)
    return int(x) if x == int(x) else x


def parse_number(s: str) -> float | None:
    """'1,500', '1 500', '0,5', '1/4', '+3', '—' -> number or None."""
    s = s.strip().replace(" ", " ").replace(" ", " ")
    if s in ("", "—", "–", "-"):
        return None
    m = re.fullmatch(r"\+?(-?\d+)/(\d+)", s)
    if m:
        return int(m.group(1)) / int(m.group(2))
    s2 = s.replace(" ", "")
    if re.fullmatch(r"\+?-?\d{1,3}(,\d{3})+(\.\d+)?", s2):  # English thousands
        s2 = s2.replace(",", "")
    elif re.fullmatch(r"\+?-?\d+,\d+", s2):  # French decimal
        s2 = s2.replace(",", ".")
    m = re.fullmatch(r"\+?(-?\d+(?:\.\d+)?)", s2)
    return float(m.group(1)) if m else None


def parse_weight_pair(en: str, fr: str, label: str = "") -> dict | None:
    """'2 lb.' and '1 kg' -> {lb, kg} as printed; '—' -> None. Logs a note when the printed pair is not kg = lb / 2."""
    lb = _unit(en, ("lb",))
    kg = _unit(fr, ("kg",))
    g = _unit(fr, ("g",))
    if kg is None and g is not None:
        kg = g / 1000
    if lb is None and kg is None:
        return None
    if lb is None or kg is None:
        note(f"weight {label}: EN {en!r} / FR {fr!r} — one side missing")
        return {"lb": num(lb or 0), "kg": num(kg if kg is not None else (lb or 0) / 2)}
    if abs(kg - lb / 2) > 0.01:
        note(f"weight {label}: EN {lb} lb / FR {kg} kg (not lb/2) — stored as printed")
    return {"lb": num(lb), "kg": num(kg)}


def _unit(s: str, units: tuple[str, ...]) -> float | None:
    s = s.replace(" ", " ").replace(" ", " ")
    for u in units:
        m = re.search(r"([\d][\d ,./]*?)\s*" + u + r"\b", s)
        if m:
            return parse_number(m.group(1).strip().rstrip("."))
    return None


def parse_distance_pair(en: str, fr: str, label: str = "") -> dict | None:
    """'30 feet' / '9 m' -> {ft, m} as printed (the French SRD uses 1,5 m per 5 feet)."""
    ft = _unit(en, ("feet", "foot", "ft"))
    m_ = _unit(fr, ("m", "mètres", "mètre", "metros", "metro"))
    if ft is None and m_ is None:
        return None
    if ft is not None and m_ is not None and abs(m_ - ft * 0.3) > 0.01:
        note(f"distance {label}: EN {ft} ft / FR {m_} m (not 0.3 m per ft) — stored as printed")
    return {"ft": num(ft if ft is not None else m_ / 0.3), "m": num(m_ if m_ is not None else ft * 0.3)}


def parse_cost(en: str, fr: str) -> dict | None:
    """'25 GP' / '25 po' -> {gp, text{en, fr}}; '—' -> None."""
    m = re.search(r"([\d,. ]+)\s*(GP|SP|CP|EP|PP)\b", en.replace(" ", " "))
    if not m:
        return None
    v = parse_number(m.group(1).strip())
    if v is None:
        return None
    gp = v * {"GP": 1, "SP": 0.1, "CP": 0.01, "EP": 0.5, "PP": 10}[m.group(2)]
    return {"gp": num(gp), "text": i18n(en.strip(), fr.strip())}


ABILITY_EN = {"strength": "str", "dexterity": "dex", "constitution": "con", "intelligence": "int", "wisdom": "wis", "charisma": "cha"}
ABILITY_FR = {"force": "str", "dexterite": "dex", "constitution": "con", "intelligence": "int", "sagesse": "wis", "charisme": "cha"}
ABILITY_ES = {"fuerza": "str", "destreza": "dex", "constitucion": "con", "inteligencia": "int", "sabiduria": "wis", "carisma": "cha"}


def ability_id(name: str) -> str | None:
    n = norm(name)
    return ABILITY_EN.get(n) or ABILITY_FR.get(n) or ABILITY_ES.get(n)


SKILLS_EN = {
    "acrobatics": "acrobatics", "animal handling": "animal-handling", "arcana": "arcana", "athletics": "athletics",
    "deception": "deception", "history": "history", "insight": "insight", "intimidation": "intimidation",
    "investigation": "investigation", "medicine": "medicine", "nature": "nature", "perception": "perception",
    "performance": "performance", "persuasion": "persuasion", "religion": "religion", "sleight of hand": "sleight-of-hand",
    "stealth": "stealth", "survival": "survival",
}


def skill_id(name: str) -> str | None:
    return SKILLS_EN.get(norm(name))


# ---------- output ----------

def write_json(path: Path, data) -> None:
    if isinstance(data, list) and data and isinstance(data[0], dict) and "id" in data[0]:
        data = sorted(data, key=lambda d: d["id"])
    if CAPTURE is not None:
        CAPTURE[path.name] = json.loads(json.dumps(data))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
