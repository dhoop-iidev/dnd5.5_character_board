"""Feats -> src/data/srd/feats.json (FeatDef[]). Source: SRD 5.2.1 "Feats" (EN pp. 87–88, FR pp. 92–94).
Feats are alphabetical in each language: paired by a fixed name map, checked against the French headings and categories.
"""
from __future__ import annotations

import re

import common
from common import Section, blocks_html, i18n, kebab, norm, note, source, write_json

CATEGORY = {"Origin Feats": "origin", "General Feats": "general", "Fighting Style Feats": "fighting-style", "Epic Boon Feats": "epic-boon"}
CATEGORY_FR = {"origin": "Dons d’origines", "general": "Dons généraux", "fighting-style": "Dons de Style de combat", "epic-boon": "Dons de faveur épique"}
CATEGORY_ES = {"origin": "Dotes de origen", "general": "Dotes generales", "fighting-style": "Dotes de estilo de combate",
               "epic-boon": "Dotes de don épico"}
FEATS_ES = {  # SP_SRD_CC_v5.2.1.pdf "Descripciones de dotes" (pp. 94–96)
    "alert": "Alerta", "magic-initiate": "Iniciado en la magia", "savage-attacker": "Atacante salvaje", "skilled": "Habilidoso",
    "ability-score-improvement": "Mejora de característica", "grappler": "Apresador",
    "archery": "Tiro con arco", "defense": "Defensa", "great-weapon-fighting": "Combate con armas a dos manos",
    "two-weapon-fighting": "Combate con dos armas",
    "boon-of-combat-prowess": "Don de la pericia en combate", "boon-of-dimensional-travel": "Don del viaje dimensional",
    "boon-of-fate": "Don del destino", "boon-of-irresistible-offense": "Don del ataque imparable",
    "boon-of-spell-recall": "Don del recuerdo de conjuros", "boon-of-the-night-spirit": "Don del espíritu de la noche",
    "boon-of-truesight": "Don de la visión verdadera",
}
FEATS_FR = {
    "alert": "Vigilant", "magic-initiate": "Initié à la magie", "savage-attacker": "Sauvagerie martiale", "skilled": "Doué",
    "ability-score-improvement": "Amélioration de caractéristique", "grappler": "Empoigneur",
    "archery": "Archerie", "defense": "Défense", "great-weapon-fighting": "Armes à deux mains", "two-weapon-fighting": "Combat à deux armes",
    "boon-of-combat-prowess": "Faveur de prouesse martiale", "boon-of-dimensional-travel": "Faveur de déplacement dimensionnel",
    "boon-of-fate": "Faveur du destin", "boon-of-irresistible-offense": "Faveur d’attaque irrésistible",
    "boon-of-spell-recall": "Faveur de mémoire magique", "boon-of-the-night-spirit": "Faveur de l’esprit nocturne",
    "boon-of-truesight": "Faveur de Vision lucide",
}


def head_and_body(blocks: list[dict]) -> tuple[str, list[dict]]:
    """The italic category line(s) at the start of a feat (possibly split over two paragraphs) and the rest."""
    head = []
    rest = list(blocks)
    while rest and rest[0]["kind"] == "p" and re.fullmatch(r"\*[^*]+\*", rest[0]["text"].strip()):
        head.append(rest.pop(0)["text"].strip("*").strip())
    return " ".join(head), rest


def parse_prereq(head: str) -> dict | None:
    m = re.search(r"\(Prerequisite:\s*(.+)\)", head)
    if not m:
        return None
    txt = m.group(1).strip()
    out: dict = {"text": i18n(txt, "")}
    lm = re.search(r"Level (\d+)\+", txt)
    if lm:
        out["level"] = int(lm.group(1))
    am = re.search(r"((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\s+or\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*)\s+(\d+)\+", txt)
    if am:
        out["abilities"] = {"any": [common.ability_id(a) for a in re.split(r"\s+or\s+", am.group(1))], "min": int(am.group(2))}
    fm = re.search(r"(Fighting Style) Feature", txt)
    if fm:
        out["feature"] = "fighting-style"
    if re.search(r"Spellcasting(?: or Pact Magic)? Feature", txt):  # Boon of Spell Recall: "Spellcasting Feature" (p. 88)
        out["feature"] = "spellcasting"
    return out


def ability_increase(body: list[dict]) -> list[str] | str | None:
    for b in body:
        m = re.match(r"^\*\*Ability Score Increase\.\*\*\s*(.*)$", b.get("text", ""), re.S)
        if m:
            t = common.plain(m.group(1))
            if re.search(r"one ability score of your choice", t):
                return "any"
            abil = [common.ability_id(a) for a in re.findall(r"Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma", t)]
            return abil or "any"
    return None


def build(en: list[dict], fr: list[dict]) -> dict[str, int]:
    en_ch = common.chapter(en, "Feats")
    fr_ch = common.chapter(fr, common.L(fr="Dons", es="Dotes"))
    cat_names, feat_names = common.L(fr=(CATEGORY_FR, FEATS_FR), es=(CATEGORY_ES, FEATS_ES))
    fr_by_cat: dict[str, dict[str, Section]] = {}
    for h2 in fr_ch.sub("h1")[0].sub("h2"):
        fr_by_cat[norm(h2.title)] = {norm(s.title): s for s in h2.sub("h3")}
    feats = []
    for h2 in en_ch.sub("h1")[0].sub("h2"):
        cat = CATEGORY.get(h2.title)
        if not cat:
            continue
        fr_cat = fr_by_cat.get(norm(cat_names[cat]), {})
        for s in h2.sub("h3"):
            fid = kebab(s.title)
            fr = fr_cat.get(norm(feat_names.get(fid, "")))
            if fr is None:
                note(f"feat {fid}: {common.LANG.upper()} entry {feat_names.get(fid)!r} not found in {cat_names[cat]!r} ({list(fr_cat)})")
            head, body = head_and_body(s.blocks)
            fr_head, fr_body = head_and_body(fr.blocks) if fr else ("", [])
            prereq = parse_prereq(head)
            if prereq and fr_head:
                m = re.search(r"\((?:prérequis|condition|requisitos?)\s*:\s*(.+)\)", fr_head, re.I)
                if m:
                    prereq["text"]["fr"] = m.group(1).strip()
            entry = {
                "id": fid,
                "name": i18n(s.title, fr.title if fr else ""),
                "category": cat,
                "categoryText": i18n(head, fr_head),
                "text": i18n(blocks_html(body), blocks_html(fr_body)),
                "source": source(s.heading, fr.heading if fr else None, f"Feats > {h2.title} > {s.title}"),
            }
            if prereq:
                entry["prereq"] = prereq
            if any(re.match(r"^\*\*Repeatable\.\*\*", b.get("text", "")) for b in body):
                entry["repeatable"] = True
            inc = ability_increase(body)
            if inc:
                entry["abilityIncrease"] = inc
            feats.append(entry)
    write_json(common.OUT_SRD / "feats.json", feats)
    return {"feats.json": len(feats)}
