"""Equipment chapter (SRD 5.2.1 EN p. 89-103, FR p. 95-110) -> weapons.json, armor.json, gear.json, weapon-properties.json.

Shapes: WeaponDef, ArmorDef, GearDef, WeaponPropertyDef in src/data/types.ts.

Alignment EN <-> FR: the chapter's h1 sections come in the same fixed order in both PDFs (Coins, Weapons, Armor, Tools,
Adventuring Gear, Mounts and Vehicles, Lifestyle, Food, Hirelings, Spellcasting...), but every alphabetical list is sorted
in its own language (the French tools start with "Matériel d'alchimiste", the French gear with "Acide, Antidote, Beaux
habits"...). Rows and entries are therefore matched by content: printed cost, printed weight (kg = lb / 2), ability, the
numbers in the text (feet converted to metres, 1.5 m per 5 ft), with `tools/fr_overrides_equipment.csv` for the leftovers
(`id,en,fr_guess,status`: `ok` rows win, unresolved entries are written back as `todo` with the best guess).

Property and mastery names are translated by a fixed table (checked against the French h3 headings): the French
"Propriétés" and "Propriétés botte" sub-sections are alphabetical in French too.

Spanish (SP_SRD_CC_v5.2.1.pdf pp. 97–113): same content matching, with Spanish vocabularies (PROPERTY_ES, MASTERY_ES, table
titles, field names) and Spanish coins: "pp" is the silver piece in Spanish (pieza de plata) but the platinum piece in
French, platinum is "ppt" in Spanish.
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
from common import (  # noqa: E402
    OUT_SRD, Section, ability_id, blocks_html, chapter, field_value, i18n, kebab, md_inline, norm, note, num,
    parse_cost, parse_number, parse_weight_pair, plain, source, split_sections, write_json,
)

OVERRIDES = common.overrides_path("equipment")

# ---------- fixed vocabularies (French names as printed in FR_SRD_CC_v5.2.1.pdf, asserted against the headings) ----------

PROPERTY_FR = {
    "Ammunition": "Munitions", "Finesse": "Finesse", "Heavy": "Lourde", "Light": "Légère", "Loading": "Chargement",
    "Range": "Portée", "Reach": "Allonge", "Thrown": "Lancer", "Two-Handed": "Deux mains", "Versatile": "Polyvalente",
}
MASTERY_FR = {
    "Cleave": "Enchaînement", "Graze": "Écorchure", "Nick": "Coup double", "Push": "Poussée", "Sap": "Sape",
    "Slow": "Ralentissement", "Topple": "Renversement", "Vex": "Ouverture",
}
PROPERTY_ES = {
    "Ammunition": "Munición", "Finesse": "Sutil", "Heavy": "Pesada", "Light": "Ligera", "Loading": "Recarga",
    "Range": "Alcance", "Reach": "Gran alcance", "Thrown": "Arrojadiza", "Two-Handed": "A dos manos", "Versatile": "Versátil",
}
MASTERY_ES = {
    "Cleave": "Hender", "Graze": "Rozar", "Nick": "Mellar", "Push": "Empujar", "Sap": "Debilitar", "Slow": "Ralentizar",
    "Topple": "Derribar", "Vex": "Molestar",
}
# Coin abbreviations of the translation (EN GP/SP/CP/EP/PP): FR po/pa/pc/pe/pp, ES po/pp/pc/pe/ppt.
COINS_FR = {"po": 1, "pa": 0.1, "pc": 0.01, "pe": 0.5, "pp": 10}
COINS_ES = {"po": 1, "pp": 0.1, "pc": 0.01, "pe": 0.5, "ppt": 10}
DAMAGE_TYPES = {"bludgeoning", "piercing", "slashing"}
# EN h1 order of the chapter; the French chapter has the same h1 sequence.
H1_WEAPONS, H1_ARMOR, H1_TOOLS, H1_GEAR, H1_MOUNTS, H1_LIFESTYLE, H1_FOOD, H1_HIRELINGS, H1_SPELLCASTING = (
    "Weapons", "Armor", "Tools", "Adventuring Gear", "Mounts and Vehicles", "Lifestyle Expenses",
    "Food, Drink, and Lodging", "Hirelings", "Spellcasting")

STATS: dict[str, int] = {}  # matching statistics, printed by build()


# ---------- numbers signature (shared with build_magic_items) ----------

_NUM_RE = re.compile(r"(?<![\w/])(\d+d\d+|\d+(?:[.,]\d+)?(?:[  ]\d{3})*)(?![\w/])")


def number_tokens(text: str, lang: str) -> list[str]:
    """Dice and numbers in a text, as comparable tokens. English feet become metres (x 0.3), pounds become kg (/ 2),
    miles become km (x 1.5): the French SRD prints those conversions."""
    text = plain(text).replace(" ", " ").replace(" ", " ")
    out: list[str] = []
    for m in _NUM_RE.finditer(text):
        tok = m.group(1)
        if "d" in tok:
            out.append(tok)
            continue
        v = parse_number(tok)
        if v is None:
            continue
        if lang == "en":
            tail = text[m.end(): m.end() + 12].lower()
            if re.match(r"\s*(-?)(feet|foot|ft\b)", tail):
                v = v * 0.3
            elif re.match(r"\s*(-?)(pounds?|lb\b)", tail):
                v = v / 2
            elif re.match(r"\s*(-?)(miles?|mph)", tail):
                v = v * 1.5
            elif re.match(r"\s*(-?)(inch|inches)", tail):
                v = v * 2.5
        out.append(str(num(v)))
    return out


def signature_score(a: list[str], b: list[str]) -> float:
    """Jaccard similarity of two token multisets (1.0 when both are empty)."""
    if not a and not b:
        return 1.0
    ca, cb = {}, {}
    for t in a:
        ca[t] = ca.get(t, 0) + 1
    for t in b:
        cb[t] = cb.get(t, 0) + 1
    inter = sum(min(ca[t], cb.get(t, 0)) for t in ca)
    union = sum(ca.values()) + sum(cb.values()) - inter
    return inter / union if union else 1.0


def greedy_match(en_items: list, fr_items: list, score, what: str, forced: dict[int, int] | None = None,
                 min_gap: float = 0.001) -> tuple[dict[int, int], set[int]]:
    """Assign each EN index to a FR index by descending score (ties and near-ties are flagged as uncertain).
    `score(i, j)` returns None when the pair is impossible. Returns (mapping, uncertain EN indices)."""
    mapping: dict[int, int] = dict(forced or {})
    used = set(mapping.values())
    pairs = []
    for i in range(len(en_items)):
        if i in mapping:
            continue
        for j in range(len(fr_items)):
            if j in used:
                continue
            s = score(i, j)
            if s is not None:
                pairs.append((s, i, j))
    pairs.sort(key=lambda p: -p[0])
    best: dict[int, list[float]] = {}
    for s, i, j in pairs:
        best.setdefault(i, []).append(s)
    uncertain: set[int] = set()
    for s, i, j in pairs:
        if i in mapping or j in used:
            continue
        mapping[i] = j
        used.add(j)
        scores = best[i]
        if len(scores) > 1 and scores[0] - scores[1] < min_gap:
            uncertain.add(i)
    missing = [i for i in range(len(en_items)) if i not in mapping]
    if missing:
        note(f"{what}: {len(missing)} EN entries without a French match")
    return mapping, uncertain


# ---------- overrides CSV ----------

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


def resolve_names(ids: list[str], en_names: list[str], fr_names: list[str], mapping: dict[int, int],
                  uncertain: set[int], overrides: dict[str, dict], fr_pool: list[str], what: str) -> dict[int, int]:
    """Apply `ok` overrides (by French name) and record uncertain matches as `todo` rows. Returns the final mapping."""
    fr_index = {norm(n): k for k, n in enumerate(fr_names)}
    final = dict(mapping)
    auto = 0
    for i, id_ in enumerate(ids):
        row = overrides.get(id_)
        if row and row.get("status") == "ok":
            k = fr_index.get(norm(row["fr_guess"]))
            if k is None:
                note(f"{what}: override {id_!r} -> {row['fr_guess']!r} not found among the French names")
            else:
                final[i] = k
                continue
        if i in final and i not in uncertain:
            auto += 1
        else:
            guess = fr_names[final[i]] if i in final else ""
            overrides[id_] = {"id": id_, "en": en_names[i], "fr_guess": guess, "status": "todo"}
            note(f"{what}: {en_names[i]!r} matched uncertainly -> {guess!r} (todo in {OVERRIDES.name})")
    # two EN entries must not share one FR entry
    seen: dict[int, str] = {}
    for i, k in final.items():
        if k in seen:
            note(f"{what}: {en_names[i]!r} and {seen[k]!r} both map to {fr_names[k]!r}")
        seen[k] = en_names[i]
    STATS[f"{what} auto-matched"] = auto
    STATS[f"{what} total"] = len(ids)
    return final


# ---------- helpers ----------

def heading_name_cost(title: str) -> tuple[str, str | None]:
    """'Alchemist’s Supplies (50 GP)' -> ('Alchemist’s Supplies', '50 GP'); 'Gaming Set (Varies)' -> (name, None)."""
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", title)
    if not m:
        return title.strip(), None
    inner = m.group(2).strip()
    if re.search(r"\d", inner):
        return m.group(1).strip(), inner
    return m.group(1).strip(), None


def section_rows(table: dict) -> list[tuple[str, list[str]]]:
    """Rows of a table with the current '§ ' section title (empty when none)."""
    out, cur = [], ""
    for r in table["rows"]:
        if r and r[0].startswith("§ "):
            cur = r[0][2:].strip()
            continue
        out.append((cur, r))
    return out


def coins() -> dict[str, float]:
    return {"GP": 1, "SP": 0.1, "CP": 0.01, "EP": 0.5, "PP": 10, **common.L(fr=COINS_FR, es=COINS_ES)}


def cost_gp(text: str) -> float | None:
    """Printed cost in GP, English ('25 GP') or translated ('25 po', '2 pa', '5 pc'; Spanish '2 pp' = 2 SP)."""
    text = text.replace(" ", " ")
    rate = coins()
    m = re.search(r"([\d,. ]+)\s*(" + "|".join(sorted(rate, key=len, reverse=True)) + r")\b", text)
    if not m:
        return None
    v = parse_number(m.group(1).strip())
    if v is None:
        return None
    return num(v * rate[m.group(2)])


def weight_of(text: str, lang: str) -> float | None:
    """Printed weight as a comparable number in kg (EN lb / 2)."""
    text = text.replace(" ", " ")
    if lang == "en":
        m = re.search(r"([\d½¼/., ]+)\s*lb", text)
        if not m:
            return None
        return _frac(m.group(1)) / 2
    m = re.search(r"([\d,./ ]+)\s*kg", text)
    if m:
        return _frac(m.group(1))
    m = re.search(r"([\d,./ ]+)\s*g\b", text)
    if m:
        return _frac(m.group(1)) / 1000
    return None


def _frac(s: str) -> float:
    s = s.strip().replace("½", " 1/2").replace("¼", " 1/4").strip()
    total = 0.0
    for part in s.split():
        v = parse_number(part)
        if v is not None:
            total += v
    return total


def fix_weight_text(s: str) -> str:
    """'1½ lb.' / '58½ lb.' / '1/4 lb.' -> '1.5 lb.' / '58.5 lb.' / '0.25 lb.': common.parse_number reads neither the ½
    glyph nor a mixed number, so the printed fraction is written as a decimal before parse_weight_pair."""
    s = re.sub(r"(\d*)½", lambda m: (m.group(1) + " " if m.group(1) else "") + "1/2", s).replace("¼", "1/4")
    return re.sub(r"(?:(\d+) )?(\d+)/(\d+)", lambda m: str(num((int(m.group(1) or 0)) + int(m.group(2)) / int(m.group(3)))), s)


def weight_pair(en: str, fr: str, label: str) -> dict | None:
    en_, fr_ = fix_weight_text(en), fr
    if not re.search(r"\d", en_) and not re.search(r"\d", fr_):
        return None
    return parse_weight_pair(en_, fr_, label)


def h3_entries(section: Section) -> list[Section]:
    """All h3 sub-sections of an h1 section, whatever the h2 they sit under."""
    return split_sections(section.blocks, "h3")


def merge_split_paragraphs(blocks: list[dict]) -> list[dict]:
    """A paragraph cut by a column or page break (EN p. 218 "cast-off" / "scales", FR p. 103-104 "Abaisser la" /
    "capote") is rejoined when the first part ends without sentence punctuation and the second starts in lowercase."""
    out: list[dict] = []
    for b in blocks:
        if (b["kind"] == "p" and out and out[-1]["kind"] == "p" and not b["text"].startswith("*")
                and b["text"][:1].islower() and not out[-1]["text"].rstrip().endswith(tuple(".!?:»”)*"))):
            prev = dict(out[-1])
            prev["text"] = prev["text"].rstrip()[:-1] + b["text"] if prev["text"].rstrip().endswith("-") \
                else prev["text"].rstrip() + " " + b["text"]
            out[-1] = prev
            continue
        out.append(b)
    return out


def entry_html(sec: Section, exclude: list[dict] = ()) -> str:
    """Verbatim HTML of an h3 entry. `exclude` lists table blocks that belong to the section, not to the entry (the wide
    Adventuring Gear table of EN p. 95 is ordered inside the 'Ammunition (Varies)' entry that precedes it)."""
    return blocks_html(merge_split_paragraphs([b for b in sec.blocks if not any(b is x for x in exclude)]))


def clean_name(s: str) -> str:
    return s.replace(" ", " ").strip()


def hyphen_join(a: str, b: str) -> str:
    return a[:-1] + b if a.endswith("-") else a + " " + b


# ---------- weapons ----------

_NOTED: set[str] = set()


def note_once(msg: str) -> None:
    if msg not in _NOTED:
        _NOTED.add(msg)
        note(msg)


def parse_properties_en(cell: str) -> dict:
    out: dict = {"properties": [], "versatile": None, "range": None, "ammunition": None}
    if cell.strip() in ("—", ""):
        return out
    for part in re.split(r",\s*(?![^()]*\))", cell):
        part = part.strip()
        m = re.match(r"^([A-Za-z-]+)(?:\s*\((.*)\))?", part)
        if not m:
            note(f"weapon property not parsed: {part!r}")
            continue
        name, arg = m.group(1), m.group(2)
        pid = kebab(name)
        if pid not in {kebab(k) for k in PROPERTY_FR}:  # (English keys, the same in PROPERTY_ES)
            note(f"unknown weapon property {name!r} in {cell!r}")
        out["properties"].append(pid)
        if arg:
            if pid == "versatile":
                out["versatile"] = arg.strip()
            else:
                rm = re.match(r"Range (\d+)/(\d+)(?:;\s*(\w+))?", arg)
                if rm:
                    out["range"] = (int(rm.group(1)), int(rm.group(2)))
                    if rm.group(3):
                        out["ammunition"] = kebab(rm.group(3))
                    if "range" not in out["properties"]:
                        out["properties"].append("range")  # "A Range weapon has a range in parentheses" (p. 90)
                elif pid == "two-handed":
                    note_once(f"weapon property qualifier kept out of the data: {part!r} (WeaponDef has no field for it)")
                else:
                    note(f"weapon property argument not parsed: {part!r}")
    return out


def parse_range_fr(cell: str) -> tuple[float, float] | None:
    m = re.search(r"(?:portée|alcance)\s*([\d,]+)/([\d,]+)", cell.replace(" ", " "), re.I)
    if not m:
        return None
    return parse_number(m.group(1)), parse_number(m.group(2))


def build_weapons(en_sec: Section, fr_sec: Section) -> list[dict]:
    t_en, t_fr = en_sec.table("Weapons"), fr_sec.table(common.L(fr="Armes", es="Armas"))
    rows_en, rows_fr = section_rows(t_en), section_rows(t_fr)
    fr_props = {norm(v): k for k, v in common.L(fr=PROPERTY_FR, es=PROPERTY_ES).items()}
    fr_mast = {norm(v): k for k, v in common.L(fr=MASTERY_FR, es=MASTERY_ES).items()}

    def fr_prop_set(cell: str) -> frozenset:
        names = re.findall(r"([A-Za-zÀ-ÿ ]+?)(?:\s*\([^)]*\))?(?:,|$)", cell.replace(" ", " "))
        ids = set()
        for n in names:
            n = n.strip()
            if not n or n == "—":
                continue
            k = fr_props.get(norm(n))
            if k:
                ids.add(kebab(k))
        return frozenset(ids)

    def sig_en(r):
        dice = r[1].split()[0]
        p = parse_properties_en(r[2])
        return (dice, frozenset(x for x in p["properties"] if x != "range"), kebab(r[3]), weight_of(r[4], "en"), cost_gp(r[4 + 1]))

    def sig_fr(r):
        dice = r[1].replace(" ", " ").split()[0]
        return (dice, fr_prop_set(r[2]), kebab(fr_mast.get(norm(r[3]), "?")), weight_of(r[4], "fr"), cost_gp(r[5].replace(" ", " ")))

    def score(i, j):
        a, b = sig_en(rows_en[i][1]), sig_fr(rows_fr[j][1])
        s = sum(1 for x, y in zip(a, b) if x == y)
        return s / 5 if s >= 3 else None

    mapping, uncertain = greedy_match(rows_en, rows_fr, score, "weapons")
    ids = [kebab(r[0]) for _, r in rows_en]
    names_en = [r[0] for _, r in rows_en]
    names_fr = [r[1][0] for r in rows_fr]
    overrides = read_overrides()
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "weapons")
    write_overrides(overrides)

    out = []
    for i, (sec_title, r) in enumerate(rows_en):
        fr_r = rows_fr[mapping[i]][1] if i in mapping else [r[0]] + [""] * 5
        name, dmg, props, mastery, weight, cost = r
        p = parse_properties_en(props)
        dm = re.match(r"^(\d+(?:d\d+)?)\s+(\w+)$", dmg.strip())
        damage = damage_type = None
        if name.strip() != "Net":
            if dm and dm.group(2).lower() in DAMAGE_TYPES:
                damage, damage_type = dm.group(1), dm.group(2).lower()
            else:
                note(f"weapon {name}: damage {dmg!r} not parsed")
        w = {
            "id": kebab(name),
            "name": i18n(name, fr_r[0]),
            "category": "simple" if "Simple" in sec_title else "martial",
            "kind": "melee" if "Melee" in sec_title else "ranged",
            "damage": damage,
            "damageType": damage_type,
            "properties": p["properties"],
        }
        if p["versatile"]:
            w["versatile"] = p["versatile"]
        if p["range"]:
            fr_range = parse_range_fr(fr_r[2]) if fr_r[2] else None
            if not fr_range:
                note(f"weapon {name}: French range missing, metres computed")
                fr_range = (p["range"][0] * 0.3, p["range"][1] * 0.3)
            elif abs(fr_range[0] - p["range"][0] * 0.3) > 0.01 or abs(fr_range[1] - p["range"][1] * 0.3) > 0.01:
                note(f"weapon {name}: range EN {p['range']} ft / FR {fr_range} m (not 0.3 m per ft) — stored as printed")
            w["range"] = {"normal": {"ft": p["range"][0], "m": num(fr_range[0])},
                          "long": {"ft": p["range"][1], "m": num(fr_range[1])}}
        if p["ammunition"]:
            w["ammunition"] = p["ammunition"]
        w["mastery"] = kebab(mastery)
        wp = weight_pair(weight, fr_r[4], f"weapon {name}")
        w["weight"] = wp or {"lb": 0, "kg": 0}
        if wp is None:
            note(f"weapon {name}: no printed weight ({weight!r}), stored as 0")
        w["cost"] = parse_cost(cost, fr_r[5].replace(" ", " "))
        w["source"] = source(t_en, t_fr, "Weapons")
        out.append(w)
    return out


# ---------- weapon properties ----------

def build_weapon_properties(en_sec: Section, fr_sec: Section) -> list[dict]:
    out = []
    tables = common.L(fr=(PROPERTY_FR, MASTERY_FR), es=(PROPERTY_ES, MASTERY_ES))
    for h2_en, table, kind in (("Properties", tables[0], "property"), ("Mastery Properties", tables[1], "mastery")):
        en_h2 = next(s for s in en_sec.sub("h2") if norm(s.title) == norm(h2_en))
        fr_h2 = fr_sec.sub("h2")[[norm(s.title) for s in en_sec.sub("h2")].index(norm(h2_en))]
        fr_h3 = {norm(s.title): s for s in fr_h2.sub("h3")}
        for s in en_h2.sub("h3"):
            fr_name = table.get(s.title)
            if fr_name is None or norm(fr_name) not in fr_h3:
                note(f"weapon property {s.title!r}: French heading {fr_name!r} not found")
                continue
            f = fr_h3[norm(fr_name)]
            out.append({
                "id": kebab(s.title),
                "name": i18n(s.title, f.title),
                "kind": kind,
                "text": i18n(blocks_html(s.own()), blocks_html(f.own())),
                "source": source(s.heading, f.heading, s.title),
            })
    return out


# ---------- armor ----------

def don_doff(sec_title: str, lang: str) -> tuple[str, str]:
    """'Light Armor (1 Minute to Don or Doff)' -> ('1 Minute', '1 Minute'); French: 's’enfile en 5 minutes, se retire
    en 1 minute' -> ('5 minutes', '1 minute')."""
    t = sec_title.replace(" ", " ")
    m = re.search(r"\((.*)\)", t)
    inner = m.group(1) if m else t
    if lang == "en":
        m = re.match(r"^(.*?) to Don and (.*?) to Doff$", inner)
        if m:
            return m.group(1), m.group(2)
        m = re.match(r"^(.*?) to Don or Doff$", inner)
        if m:
            return m.group(1), m.group(1)
    elif common.LANG == "es":  # '5 minutos para ponérselas y 1 minuto para quitárselas'
        m = re.match(r"^(.*?) para ponérsel\w* y (.*?) para quitársel\w*$", inner)
        if m:
            return m.group(1), m.group(2)
        m = re.match(r"^(.*?) para ponérsel\w* o quitársel\w*$", inner)
        if m:
            return m.group(1), m.group(1)
    else:
        m = re.match(r"^s’enfile en (.*?), se retire en (.*)$", inner)
        if m:
            return m.group(1), m.group(2)
        m = re.match(r"^s’enfile ou se retire (?:en |au prix de )(.*)$", inner)
        if m:
            return m.group(1), m.group(1)
    note(f"armor don/doff not parsed: {sec_title!r}")
    return inner, inner


def build_armor(en_sec: Section, fr_sec: Section) -> list[dict]:
    t_en, t_fr = en_sec.table("Armor"), fr_sec.table(common.L(fr="Armures", es="Armaduras"))
    rows_en, rows_fr = section_rows(t_en), section_rows(t_fr)

    def sig(r, lang):
        ac = tuple(re.findall(r"\d+", r[1]))
        return (ac, weight_of(r[4], lang), cost_gp(r[5].replace(" ", " ")))

    def score(i, j):
        a, b = sig(rows_en[i][1], "en"), sig(rows_fr[j][1], "fr")
        s = sum(1 for x, y in zip(a, b) if x == y)
        return s / 3 if s >= 2 else None

    mapping, uncertain = greedy_match(rows_en, rows_fr, score, "armor")
    ids = [kebab(r[0]) for _, r in rows_en]
    names_en = [r[0] for _, r in rows_en]
    names_fr = [r[1][0] for r in rows_fr]
    overrides = read_overrides()
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "armor")
    write_overrides(overrides)

    fr_sections = {}
    for sec_title, r in rows_fr:
        fr_sections[r[0]] = sec_title
    out = []
    for i, (sec_title, r) in enumerate(rows_en):
        fr_r = rows_fr[mapping[i]][1]
        fr_title = rows_fr[mapping[i]][0]
        name, ac, strength, stealth, weight, cost = r
        cat = "light" if sec_title.startswith("Light") else "medium" if sec_title.startswith("Medium") else \
            "heavy" if sec_title.startswith("Heavy") else "shield"
        a: dict = {"id": kebab(name), "name": i18n(name, fr_r[0]), "category": cat}
        if cat == "shield":
            a["bonus"] = int(re.search(r"\+(\d+)", ac).group(1))
            a["dex"] = "none"
        else:
            m = re.match(r"^(\d+)(\s*\+\s*Dex modifier)?(\s*\(max (\d+)\))?$", ac.strip())
            if not m:
                note(f"armor {name}: AC {ac!r} not parsed")
            a["baseAc"] = int(m.group(1))
            a["dex"] = "none" if not m.group(2) else ("max2" if m.group(4) == "2" else "full")
            if m.group(4) and m.group(4) != "2":
                note(f"armor {name}: Dex cap {m.group(4)} is not 2")
        sm = re.search(r"\d+", strength)
        if sm:
            a["strength"] = int(sm.group())
        a["stealthDisadvantage"] = "Disadvantage" in stealth
        don_en, doff_en = don_doff(sec_title, "en")
        don_fr, doff_fr = don_doff(fr_title, "fr")
        a["don"] = i18n(don_en, don_fr)
        a["doff"] = i18n(doff_en, doff_fr)
        a["weight"] = weight_pair(weight, fr_r[4], f"armor {name}") or {"lb": 0, "kg": 0}
        a["cost"] = parse_cost(cost, fr_r[5].replace(" ", " "))
        a["source"] = source(t_en, t_fr, "Armor")
        out.append(a)
    return out


# ---------- tools ----------

def tool_fields(sec: Section, lang: str) -> dict:
    blocks = sec.own()
    # EN p. 94: the Musical Instrument "Variants" line is hyphenated ("dul-") and its tail was read as a headerless
    # one-cell table; glue such a tail back to the field before it.
    fixed: list[dict] = []
    for b in blocks:
        if (b["kind"] == "table" and not b.get("title") and not b.get("header") and len(b["rows"]) == 1
                and len(b["rows"][0]) == 1 and fixed and fixed[-1]["kind"] == "field"):
            prev = dict(fixed[-1])
            prev["text"] = hyphen_join(prev["text"], b["rows"][0][0])
            fixed[-1] = prev
            note(f"tool {sec.title}: a table fragment was glued back to the {'Variants' if 'ariant' in prev['text'] else 'field'} line")
            continue
        fixed.append(b)
    keys = common.L(
        fr={"ability": ("Ability", "Caractéristique"), "weight": ("Weight", "Poids"), "utilize": ("Utilize", "Utilisation"),
            "craft": ("Craft", "Artisanat"), "variants": ("Variants", "Variantes")},
        es={"ability": ("Ability", "Característica"), "weight": ("Weight", "Peso"), "utilize": ("Utilize", "Utilizar"),
            "craft": ("Craft", "Fabricar"), "variants": ("Variants", "Variantes")})
    out = {}
    for k, (en_k, fr_k) in keys.items():
        out[k] = field_value_md(fixed, en_k if lang == "en" else fr_k)
    return out


def field_value_md(blocks: list[dict], key: str) -> str | None:
    """Like common.field_value but keeps the inline markup of the value (italic item names)."""
    for b in blocks:
        if b["kind"] != "field":
            continue
        m = re.match(r"^\*\*([^*]+?)\s*:?\*\*\s*:?\s*(.*)$", b["text"], re.S)
        if m and norm(m.group(1).rstrip(" :")) == norm(key):
            return m.group(2).strip()
    return None


def build_tools(en_sec: Section, fr_sec: Section) -> list[dict]:
    en_entries, fr_entries = h3_entries(en_sec), h3_entries(fr_sec)
    en_f = [tool_fields(s, "en") for s in en_entries]
    fr_f = [tool_fields(s, "fr") for s in fr_entries]

    def sig(sec, f, lang):
        name, cost = heading_name_cost(sec.title)
        toks = number_tokens((f["utilize"] or "") + " " + (f["variants"] or ""), lang)
        craft_n = len((plain(f["craft"] or "")).split(",")) if f["craft"] else 0
        return (cost_gp(cost) if cost else None, weight_of(f["weight"] or "", lang), ability_id(f["ability"] or ""), toks, craft_n)

    sig_en = [sig(s, f, "en") for s, f in zip(en_entries, en_f)]
    sig_fr = [sig(s, f, "fr") for s, f in zip(fr_entries, fr_f)]

    def score(i, j):
        a, b = sig_en[i], sig_fr[j]
        if a[0] != b[0] or a[2] != b[2]:
            return None
        s = 2.0 + (1.0 if a[1] == b[1] else 0.0) + signature_score(a[3], b[3]) + (0.5 if a[4] == b[4] else 0.0)
        return s

    mapping, uncertain = greedy_match(en_entries, fr_entries, score, "tools")
    names_en = [heading_name_cost(s.title)[0] for s in en_entries]
    names_fr = [heading_name_cost(s.title)[0] for s in fr_entries]
    ids = [kebab(n) for n in names_en]
    overrides = read_overrides()
    mapping = resolve_names(ids, names_en, [s.title for s in fr_entries], mapping, uncertain, overrides, names_fr, "tools")
    write_overrides(overrides)

    out = []
    for i, s in enumerate(en_entries):
        f = en_f[i]
        fs = fr_entries[mapping[i]]
        ff = fr_f[mapping[i]]
        name_en, cost_en = heading_name_cost(s.title)
        name_fr, cost_fr = heading_name_cost(fs.title)
        g: dict = {"id": kebab(name_en), "name": i18n(name_en, name_fr), "kind": "tool"}
        wp = weight_pair(f["weight"] or "", ff["weight"] or "", f"tool {name_en}")
        if wp:
            g["weight"] = wp
        if cost_en:
            g["cost"] = parse_cost(cost_en, cost_fr or "")
        ab = ability_id(f["ability"] or "")
        if not ab:
            note(f"tool {name_en}: ability {f['ability']!r} not parsed")
        tool = {"ability": ab, "utilize": i18n(md_inline(f["utilize"] or ""), md_inline(ff["utilize"] or ""))}
        if f["craft"]:
            tool["craft"] = i18n(md_inline(f["craft"]), md_inline(ff["craft"] or ""))
        if f["variants"]:
            tool["variants"] = i18n(md_inline(f["variants"]), md_inline(ff["variants"] or ""))
        g["tool"] = tool
        g["source"] = source(s.heading, fs.heading, s.title)
        out.append(g)
    return out


# ---------- adventuring gear ----------

def build_gear(en_sec: Section, fr_sec: Section) -> list[dict]:
    t_en, t_fr = en_sec.table("Adventuring Gear"), fr_sec.table(common.L(fr="Matériel d’aventurier", es="Equipo de aventureros"))
    rows_en = [r for _, r in section_rows(t_en)]
    rows_fr = [r for _, r in section_rows(t_fr)]
    en_desc = {s.title: s for s in h3_entries(en_sec)}
    fr_desc = {s.title: s for s in h3_entries(fr_sec)}

    def find_desc(descs: dict[str, Section], row_name: str) -> Section | None:
        key = norm(row_name)
        for title, s in descs.items():
            nm, _ = heading_name_cost(title)
            if norm(nm) == key:
                return s
        # 'Spell Scroll (Cantrip)' row <- 'Spell Scroll (Cantrip, 30 GP; Level 1, 50 GP)' heading
        base = norm(re.sub(r"\s*\(.*\)$", "", row_name))
        for title, s in descs.items():
            if norm(title).startswith(base + " (") and base != key:
                return s
        return None

    en_d = [find_desc(en_desc, r[0]) for r in rows_en]
    fr_d = [find_desc(fr_desc, r[0]) for r in rows_fr]
    for r, d in zip(rows_en, en_d):
        if d is None:
            note(f"gear {r[0]!r}: no English description found")

    def sig(rows, descs, lang):
        out = []
        for r, d in zip(rows, descs):
            toks = number_tokens(" ".join(plain(b.get("text", "")) for b in d.blocks if b["kind"] in ("p", "li")), lang) if d else []
            tables = [len(b["rows"]) for b in d.blocks if b["kind"] == "table"] if d else []
            out.append((weight_of(r[1], lang), cost_gp(r[2].replace(" ", " ")), toks, tables))
        return out

    sig_en, sig_fr = sig(rows_en, en_d, "en"), sig(rows_fr, fr_d, "fr")

    def score(i, j):
        a, b = sig_en[i], sig_fr[j]
        if a[1] != b[1]:
            return None
        s = 1.0 + (1.0 if a[0] == b[0] else 0.0) + signature_score(a[2], b[2]) + (0.5 if a[3] == b[3] else 0.0)
        return s

    mapping, uncertain = greedy_match(rows_en, rows_fr, score, "gear", min_gap=0.05)
    names_en = [r[0] for r in rows_en]
    names_fr = [r[0] for r in rows_fr]
    ids = [kebab(n) for n in names_en]
    overrides = read_overrides()
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "gear")
    write_overrides(overrides)

    out = []
    for i, r in enumerate(rows_en):
        fr_r = rows_fr[mapping[i]]
        d_en, d_fr = en_d[i], fr_d[mapping[i]]
        g: dict = {"id": kebab(r[0]), "name": i18n(clean_name(r[0]), clean_name(fr_r[0])), "kind": "gear"}
        wp = weight_pair(r[1], fr_r[1], f"gear {r[0]}")
        if wp:
            g["weight"] = wp
        c = parse_cost(r[2], fr_r[2].replace(" ", " "))
        if c:
            g["cost"] = c
        if d_en:
            g["text"] = i18n(entry_html(d_en, [t_en]), entry_html(d_fr, [t_fr]) if d_fr else "")
            if not d_fr:
                note(f"gear {r[0]!r}: no French description found")
        g["source"] = source(d_en.heading if d_en else t_en, d_fr.heading if d_fr else t_fr, d_en.title if d_en else "Adventuring Gear")
        out.append(g)

    # ammunition table (inside the "Ammunition (Varies)" description)
    a_en = next((b for b in en_sec.blocks if b["kind"] == "table" and norm(b.get("title", "")) == "ammunition"), None)
    a_fr = next((b for b in fr_sec.blocks if b["kind"] == "table" and norm(b.get("title", "")) == common.L(fr="munitions", es="municion")), None)
    if a_en and a_fr:
        rows_en, rows_fr = a_en["rows"], a_fr["rows"]

        def ascore(i, j):
            a, b = rows_en[i], rows_fr[j]
            s = (a[1] == b[1]) + (weight_of(a[3], "en") == weight_of(b[3], "fr")) + (cost_gp(a[4]) == cost_gp(b[4].replace(" ", " ")))
            return s / 3 if s >= 2 else None

        mapping, uncertain = greedy_match(rows_en, rows_fr, ascore, "ammunition")
        names_en = [r[0] for r in rows_en]
        names_fr = [r[0] for r in rows_fr]
        ids = [kebab(n) for n in names_en]
        overrides = read_overrides()
        mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "ammunition")
        write_overrides(overrides)
        for i, r in enumerate(rows_en):
            fr_r = rows_fr[mapping[i]]
            g = {"id": kebab(r[0]), "name": i18n(r[0], fr_r[0]), "kind": "ammunition"}
            wp = weight_pair(r[3], fr_r[3], f"ammunition {r[0]}")
            if wp:
                g["weight"] = wp
            g["cost"] = parse_cost(r[4], fr_r[4].replace(" ", " "))
            # Amount and storage as printed, labelled with the table headers.
            sep = common.L(fr=" : ", es=": ")
            g["text"] = i18n(f"<p>{md_inline(a_en['header'][1])}: {md_inline(r[1])}. {md_inline(a_en['header'][2])}: {md_inline(r[2])}.</p>",
                             f"<p>{md_inline(a_fr['header'][1])}{sep}{md_inline(fr_r[1])}. {md_inline(a_fr['header'][2])}{sep}{md_inline(fr_r[2])}.</p>")
            g["source"] = source(a_en, a_fr, "Ammunition")
            out.append(g)
    else:
        note("ammunition table not found")
    return out


# ---------- mounts and vehicles ----------

def labelled_text(header: list[str], row: list[str], cols: list[int], lang: str) -> str:
    sep = " : " if lang == "fr" and common.LANG == "fr" else ": "
    parts = [f"{md_inline(header[c].replace(chr(160), ' '))}{sep}{md_inline(row[c].replace(chr(160), ' ').rstrip('.'))}"
             for c in cols if c < len(row) and row[c] not in ("", "—")]
    return "<p>" + ". ".join(parts) + ".</p>" if parts else ""


def build_mounts(en_sec: Section, fr_sec: Section, fr_ch: Section) -> list[dict]:
    out = []
    overrides = read_overrides()

    def fr_table(title: str) -> dict:
        t = fr_sec.table(title)
        if t is None:
            # FR p. 107: the wide "Véhicules aériens et bateaux" table at the foot of the page was ordered after the
            # next h1 ("Train de vie"); look it up in the whole chapter.
            t = fr_ch.table(title)
            note(f"mounts: French table {title!r} found outside its section (extraction order)")
        return t

    # Mounts and Other Animals: Item, Carrying Capacity, Cost
    t_en, t_fr = en_sec.table("Mounts and Other Animals"), fr_table(common.L(fr="Montures et autres animaux", es="Monturas y otros animales"))
    rows_en, rows_fr = t_en["rows"], t_fr["rows"]

    def mscore(i, j):
        a, b = rows_en[i], rows_fr[j]
        s = (weight_of(a[1], "en") == weight_of(b[1], "fr")) + (cost_gp(a[2]) == cost_gp(b[2].replace(" ", " ")))
        return s / 2 if s >= 1 else None

    mapping, uncertain = greedy_match(rows_en, rows_fr, mscore, "mounts")
    names_en, names_fr = [r[0] for r in rows_en], [r[0] for r in rows_fr]
    ids = [kebab(n) for n in names_en]
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "mounts")
    for i, r in enumerate(rows_en):
        fr_r = rows_fr[mapping[i]]
        out.append({
            "id": kebab(r[0]), "name": i18n(r[0], fr_r[0]), "kind": "mount",
            "cost": parse_cost(r[2], fr_r[2].replace(" ", " ")),
            "text": i18n(labelled_text(t_en["header"], r, [1], "en"), labelled_text(t_fr["header"], fr_r, [1], "fr")),
            "source": source(t_en, t_fr, t_en["title"]),
        })

    # Tack, Harness, and Drawn Vehicles: Item, Weight, Cost (section "Saddle")
    t_en, t_fr = en_sec.table("Tack, Harness"), fr_table(common.L(fr="Harnachement", es="Arreos, arneses"))
    rows_en, rows_fr = section_rows(t_en), section_rows(t_fr)

    def tscore(i, j):
        a, b = rows_en[i][1], rows_fr[j][1]
        s = (weight_of(a[1], "en") == weight_of(b[1], "fr")) + (cost_gp(a[2]) == cost_gp(b[2].replace(" ", " ")))
        return s / 2 if s >= 1 else None

    mapping, uncertain = greedy_match(rows_en, rows_fr, tscore, "tack")

    # The "Saddle" sub-group covers only the rows printed under it (lowercase in French: "d’équitation, exotique,
    # militaire"); the alphabetical list then resumes (Sled, Stabling, Wagon) although no new § row marks it.
    # Spanish: the group rows are capitalised ("De monta, Exótica, Militar"); a row that sorts after the group title
    # ("Trineo" > "Silla") is back in the outer alphabetical list.
    fr_in_group = common.L(fr=lambda: [bool(s) and r[0][:1].islower() for s, r in rows_fr],
                           es=lambda: [bool(s) and norm(r[0]) < norm(s) for s, r in rows_fr])()
    rows_fr = [(s if g else "", r) for (s, r), g in zip(rows_fr, fr_in_group)]
    rows_en = [(s if (i in mapping and fr_in_group[mapping[i]]) else "", r) for i, (s, r) in enumerate(rows_en)]

    def full_name(sec, r):
        return f"{sec} ({r[0]})" if sec else r[0]

    names_en = [full_name(s, r) for s, r in rows_en]
    names_fr = [full_name(s, r) for s, r in rows_fr]
    ids = [kebab(n) for n in names_en]
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "tack")
    vehicles = {"carriage", "cart", "chariot", "sled", "wagon"}
    for i, (sec, r) in enumerate(rows_en):
        fr_sec_, fr_r = rows_fr[mapping[i]]
        name_en, name_fr = full_name(sec, r), full_name(fr_sec_, fr_r)
        id_ = kebab(name_en)
        kind = "vehicle" if id_ in vehicles else "service" if "per day" in r[0].lower() and weight_of(r[1], "en") is None else "tack"
        g: dict = {"id": id_, "name": i18n(name_en, name_fr), "kind": kind}
        wp = weight_pair(r[1], fr_r[1], f"tack {name_en}")
        if wp:
            g["weight"] = wp
        g["cost"] = parse_cost(r[2], fr_r[2].replace(" ", " "))
        g["source"] = source(t_en, t_fr, t_en["title"])
        out.append(g)

    # Airborne and Waterborne Vehicles: Ship, Speed, Crew, Passengers, Cargo (Tons), AC, HP, Damage Threshold, Cost
    t_en, t_fr = en_sec.table("Airborne and Waterborne"), fr_table(common.L(fr="Véhicules aériens", es="Vehículos acuáticos y aéreos"))
    rows_en, rows_fr = t_en["rows"], t_fr["rows"]

    def vscore(i, j):
        a, b = rows_en[i], rows_fr[j]
        s = sum(1 for c in (2, 3, 4, 5, 6, 7) if a[c].replace(",", "") == b[c].replace(" ", "").replace(",", "")) \
            + (cost_gp(a[8]) == cost_gp(b[8].replace(" ", " ")))
        return s / 7 if s >= 4 else None

    mapping, uncertain = greedy_match(rows_en, rows_fr, vscore, "ships")
    names_en, names_fr = [r[0] for r in rows_en], [r[0] for r in rows_fr]
    ids = [kebab(n) for n in names_en]
    mapping = resolve_names(ids, names_en, names_fr, mapping, uncertain, overrides, names_fr, "ships")
    for i, r in enumerate(rows_en):
        fr_r = rows_fr[mapping[i]]
        out.append({
            "id": kebab(r[0]), "name": i18n(r[0], fr_r[0]), "kind": "vehicle",
            "cost": parse_cost(r[8], fr_r[8].replace(" ", " ")),
            "text": i18n(labelled_text(t_en["header"], r, [1, 2, 3, 4, 5, 6, 7], "en"),
                         labelled_text(t_fr["header"], fr_r, [1, 2, 3, 4, 5, 6, 7], "fr")),
            "source": source(t_en, t_fr, t_en["title"]),
        })
    write_overrides(overrides)
    return out


# ---------- services (lifestyle, food and lodging, hirelings, spellcasting) ----------

def service_cost(en: str, fr: str) -> dict:
    c = parse_cost(en, fr)
    if c:
        return c
    if norm(en) in ("free", "(free)"):
        return {"gp": 0, "text": i18n(en.strip(), fr.strip())}
    note(f"service cost not parsed: {en!r}")
    return {"gp": 0, "text": i18n(en.strip(), fr.strip())}


def build_services(en_ch: Section, fr_ch: Section, en_h1: dict[str, Section], fr_h1: list[Section], en_order: list[str]) -> list[dict]:
    out = []

    def fr_of(h1_title: str) -> Section:
        return fr_h1[en_order.index(norm(h1_title))]

    # Lifestyle expenses: one h2 per lifestyle, same (non-alphabetical) order in both languages; the cost is checked.
    en_s, fr_s = en_h1[norm(H1_LIFESTYLE)], fr_of(H1_LIFESTYLE)
    en_l, fr_l = en_s.sub("h2"), fr_s.sub("h2")
    if len(en_l) != len(fr_l):
        note(f"lifestyles: {len(en_l)} EN vs {len(fr_l)} FR")
    for a, b in zip(en_l, fr_l):
        name_en, cost_en = heading_name_cost(a.title)
        name_fr, cost_fr = heading_name_cost(b.title)
        if cost_en is None:  # "(Free)" / "(gratuit)"
            cost_en = re.search(r"\((.*)\)", a.title).group(1)
            cost_fr = re.search(r"\((.*)\)", b.title).group(1)
        c = service_cost(cost_en, cost_fr)
        if parse_cost(cost_en, cost_fr) and cost_gp(cost_fr) is not None and parse_cost(cost_en, "")["gp"] != cost_gp(cost_fr):
            note(f"lifestyle {name_en}: EN cost {cost_en!r} vs FR {cost_fr!r}")
        out.append({
            "id": "lifestyle-" + kebab(name_en), "name": i18n(name_en, name_fr), "kind": "service", "cost": c,
            "text": i18n(blocks_html(a.own()), blocks_html(b.own())),
            "source": source(a.heading, b.heading, H1_LIFESTYLE),
        })
    STATS["lifestyles"] = len(en_l)

    # Food, Drink, and Lodging: sections (Inn Stay per Day, Meal, Wine) + top-level rows; matched by section cost sets.
    en_s, fr_s = en_h1[norm(H1_FOOD)], fr_of(H1_FOOD)
    t_en, t_fr = en_s.tables()[0], fr_s.tables()[0]
    rows_fr = [(s, r) for s, r in section_rows(t_fr) if r[1].strip()]  # drops the wrapped '(par jour)' row
    groups_en: dict[str, list] = {}
    for s, r in section_rows(t_en):
        groups_en.setdefault(s, []).append(r)
    groups_fr: dict[str, list] = {}
    for s, r in rows_fr:
        groups_fr.setdefault(s, []).append(r)

    def costs(rows):
        return sorted(cost_gp(r[1].replace(" ", " ")) or 0 for r in rows)

    if common.LANG == "es":
        # ES p. 110: the rows after the "Estancia en posada por día" group (Pan, Queso) carry no § marker and one Meal
        # cost is misprinted (Lujosa 3 po for 3 SP). Groups are paired by the most shared costs, a group longer than its
        # English twin gives its extra rows back to the top level, and rows inside a § group (same quality order in
        # both languages) are paired by position.
        def shared(a: list, b: list) -> int:
            ca = [cost_gp(r[1].replace(" ", " ")) for r in a]
            return sum(1 for r in b if cost_gp(r[1]) in ca)

        sec_map = {}
        for s_en, rs in groups_en.items():
            if not s_en:
                continue
            best = max((s_fr for s_fr in groups_fr if s_fr), key=lambda s_fr: shared(groups_fr[s_fr], rs), default=None)
            if best is not None:
                sec_map[s_en] = best
                extra = groups_fr[best][len(rs):]
                groups_fr[best] = groups_fr[best][: len(rs)]
                groups_fr.setdefault("", []).extend(extra)
        sec_map[""] = ""
    else:
        sec_map = {}
        for s_en, rs in groups_en.items():
            cands = [s_fr for s_fr, rf in groups_fr.items() if costs(rf) == costs(rs)]
            if len(cands) != 1:
                note(f"food table: section {s_en!r} matched {cands}")
            if cands:
                sec_map[s_en] = cands[0]
    for s_en, rs in groups_en.items():
        s_fr = sec_map.get(s_en)
        rf = groups_fr.get(s_fr, []) if s_fr is not None else []
        prefix = kebab(re.sub(r"\(.*\)|per Day", "", s_en)) if s_en else "food"
        for k, r in enumerate(rs):
            m = [x for x in rf if cost_gp(x[1].replace(" ", " ")) == cost_gp(r[1])]
            if common.LANG == "es" and s_en and len(rf) == len(rs):
                m = [rf[k]]
            fr_r = m[0] if len(m) == 1 else [r[0], r[1]]
            if len(m) != 1:
                note(f"food table: {r[0]!r} ({s_en}) without a unique {common.LANG.upper()} row")
            name_en = f"{s_en} ({r[0]})" if s_en else r[0]
            name_fr = f"{s_fr} ({fr_r[0]})" if s_fr else fr_r[0]
            out.append({
                "id": f"{prefix}-{kebab(r[0])}", "name": i18n(name_en, name_fr), "kind": "service",
                "cost": parse_cost(r[1], fr_r[1].replace(" ", " ")),
                "source": source(t_en, t_fr, H1_FOOD),
            })
    STATS["food and lodging"] = sum(len(v) for v in groups_en.values())

    # Hirelings: 3 rows, matched by cost.
    en_s, fr_s = en_h1[norm(H1_HIRELINGS)], fr_of(H1_HIRELINGS)
    t_en, t_fr = en_s.tables()[0], fr_s.tables()[0]
    for r in t_en["rows"]:
        m = [x for x in t_fr["rows"] if cost_gp(x[1].replace(" ", " ")) == cost_gp(r[1])]
        fr_r = m[0] if len(m) == 1 else [r[0], r[1]]
        if len(m) != 1:
            note(f"hirelings: {r[0]!r} without a unique French row")
        out.append({
            "id": "hireling-" + kebab(r[0]), "name": i18n(r[0], fr_r[0]), "kind": "service",
            "cost": parse_cost(r[1], fr_r[1].replace(" ", " ")),
            "source": source(t_en, t_fr, H1_HIRELINGS),
        })
    STATS["hirelings"] = len(t_en["rows"])

    # Spellcasting services: matched by the spell level column.
    en_s, fr_s = en_h1[norm(H1_SPELLCASTING)], fr_of(H1_SPELLCASTING)
    t_en, t_fr = en_s.tables()[0], fr_s.tables()[0]
    for k, r in enumerate(t_en["rows"]):
        lvl = r[0]
        m = [x for x in t_fr["rows"] if x[0] == lvl] or ([t_fr["rows"][k]] if k < len(t_fr["rows"]) and not lvl[0].isdigit() else [])
        fr_r = m[0] if len(m) == 1 else [r[0], r[1], r[2]]
        if len(m) != 1:
            note(f"spellcasting services: level {lvl!r} without a unique French row")
        out.append({
            "id": "spellcasting-" + kebab(f"level {lvl}" if lvl[0].isdigit() else lvl),
            "name": i18n(f"{t_en['title']} ({t_en['header'][0]} {lvl})", f"{t_fr['title']} ({t_fr['header'][0].replace(chr(160), ' ')} {fr_r[0]})"),
            "kind": "service",
            "cost": parse_cost(r[2], fr_r[2].replace(" ", " ")),
            "text": i18n(labelled_text(t_en["header"], r, [1], "en"), labelled_text(t_fr["header"], fr_r, [1], "fr")),
            "source": source(t_en, t_fr, H1_SPELLCASTING),
        })
    STATS["spellcasting services"] = len(t_en["rows"])
    return out


# ---------- entry point ----------

def build(en_blocks: list[dict], fr_blocks: list[dict]) -> dict[str, int]:
    STATS.clear()
    en_ch, fr_ch = chapter(en_blocks, "Equipment"), chapter(fr_blocks, common.L(fr="Équipement", es="Equipo"))
    en_h1_list, fr_h1_list = en_ch.sub("h1"), fr_ch.sub("h1")
    if len(en_h1_list) != len(fr_h1_list):
        note(f"equipment: {len(en_h1_list)} EN h1 vs {len(fr_h1_list)} FR h1 sections")
    en_order = [norm(s.title) for s in en_h1_list]
    en_h1 = {norm(s.title): s for s in en_h1_list}

    def fr_of(title: str) -> Section:
        return fr_h1_list[en_order.index(norm(title))]

    weapons = build_weapons(en_h1[norm(H1_WEAPONS)], fr_of(H1_WEAPONS))
    props = build_weapon_properties(en_h1[norm(H1_WEAPONS)], fr_of(H1_WEAPONS))
    armor = build_armor(en_h1[norm(H1_ARMOR)], fr_of(H1_ARMOR))
    gear = build_tools(en_h1[norm(H1_TOOLS)], fr_of(H1_TOOLS))
    gear += build_gear(en_h1[norm(H1_GEAR)], fr_of(H1_GEAR))
    gear += build_mounts(en_h1[norm(H1_MOUNTS)], fr_of(H1_MOUNTS), fr_ch)
    gear += build_services(en_ch, fr_ch, en_h1, fr_h1_list, en_order)

    ids = [g["id"] for g in gear]
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        note(f"gear: duplicate ids {sorted(dup)}")

    write_json(OUT_SRD / "weapons.json", weapons)
    write_json(OUT_SRD / "weapon-properties.json", props)
    write_json(OUT_SRD / "armor.json", armor)
    write_json(OUT_SRD / "gear.json", gear)
    for k, v in STATS.items():
        note(f"equipment matching: {k} = {v}")
    return {"weapons.json": len(weapons), "weapon-properties.json": len(props), "armor.json": len(armor), "gear.json": len(gear)}


if __name__ == "__main__":
    import common
    print(build(common.load_blocks("en"), common.load_blocks("fr")))
    for n in common.NOTES:
        print(" -", n)
