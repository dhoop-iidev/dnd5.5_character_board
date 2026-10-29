"""Species and backgrounds -> src/data/srd/species.json, backgrounds.json.
Source: SRD 5.2.1 "Character Origins" (EN pp. 83–86, FR pp. 87–91). Species and backgrounds are paired by name (fixed
French names checked against the French headings); traits inside a species are paired by position.
"""
from __future__ import annotations

import re

import common
from common import Section, blocks_html, i18n, kebab, norm, note, source, write_json

SPECIES_FR = {"dragonborn": "Drakéide", "dwarf": "Nain", "elf": "Elfe", "gnome": "Gnome", "goliath": "Goliath",
              "halfling": "Halfelin", "human": "Humain", "orc": "Orc", "tiefling": "Tieffelin"}
BACKGROUNDS_FR = {"acolyte": "Acolyte", "criminal": "Criminel", "sage": "Sage", "soldier": "Soldat"}
SPECIES_ES = {"dragonborn": "Dracónido", "dwarf": "Enano", "elf": "Elfo", "gnome": "Gnomo", "goliath": "Goliat",
              "halfling": "Mediano", "human": "Humano", "orc": "Orco", "tiefling": "Tiefling"}
BACKGROUNDS_ES = {"acolyte": "Acólito", "criminal": "Criminal", "sage": "Erudito", "soldier": "Soldado"}
SIZE_WORDS = {"tiny": "tiny", "small": "small", "medium": "medium", "large": "large"}
# Official French trait names (FR_SRD_CC_v5.2.1.pdf pp. 88–91); the French lists traits alphabetically, so they are
# paired by name. Checked at build time: a name missing from the French entry is reported.
TRAITS_FR = {
    "darkvision": "Vision dans le noir", "breath-weapon": "Souffle", "damage-resistance": "Résistance aux dégâts",
    "draconic-ancestry": "Ascendance draconique", "draconic-flight": "Vol draconique", "dwarven-resilience": "Résistance naine",
    "dwarven-toughness": "Ténacité naine", "stonecunning": "Connaissance de la pierre", "elven-lineage": "Lignage elfique",
    "fey-ancestry": "Ascendance féerique", "keen-senses": "Sens aiguisés", "trance": "Transe", "gnomish-cunning": "Ruse gnome",
    "gnomish-lineage": "Lignage gnome", "forest-gnome": "Gnome des forêts", "rock-gnome": "Gnome des roches",
    "giant-ancestry": "Ascendance gigante", "clouds-jaunt": "Saut des nuées", "fires-burn": "Brûlure ignée",
    "frosts-chill": "Froid mordant", "hills-tumble": "Renversement des coteaux", "stones-endurance": "Endurance de la pierre",
    "storms-thunder": "Tonnerre des cieux", "large-form": "Forme de géant", "powerful-build": "Forte carrure", "brave": "Brave",
    "halfling-nimbleness": "Agilité halfeline", "luck": "Chance", "naturally-stealthy": "Discrétion naturelle",
    "resourceful": "Ingénieux", "skillful": "Compétent", "versatile": "Polyvalent", "adrenaline-rush": "Poussée d’adrénaline",
    "relentless-endurance": "Acharnement", "fiendish-legacy": "Héritage fiélon", "otherworldly-presence": "Présence d’outre-monde",
}


# Spanish trait names (SP_SRD_CC_v5.2.1.pdf pp. 90–93), alphabetical in Spanish too: paired by name, checked at build time.
TRAITS_ES = {
    "darkvision": "Visión en la oscuridad", "breath-weapon": "Ataque de aliento", "damage-resistance": "Resistencia al daño",
    "draconic-ancestry": "Linaje dracónico", "draconic-flight": "Vuelo dracónico", "dwarven-resilience": "Resistencia enana",
    "dwarven-toughness": "Aguante enano", "stonecunning": "Afinidad con la piedra", "elven-lineage": "Linaje élfico",
    "fey-ancestry": "Linaje feérico", "keen-senses": "Sentidos agudos", "trance": "Trance", "gnomish-cunning": "Astucia gnoma",
    "gnomish-lineage": "Linaje gnomo", "forest-gnome": "Gnomo de los bosques", "rock-gnome": "Gnomo de las rocas",
    "giant-ancestry": "Linaje gigante", "clouds-jaunt": "Excursión de las nubes", "fires-burn": "Abrasión del fuego",
    "frosts-chill": "Frío de la escarcha", "hills-tumble": "Caída de las colinas", "stones-endurance": "Resistencia de la piedra",
    "storms-thunder": "Trueno de la tormenta", "large-form": "Forma grande", "powerful-build": "Constitución poderosa",
    "brave": "Valiente", "halfling-nimbleness": "Agilidad de mediano", "luck": "Fortuna",
    "naturally-stealthy": "Sigiloso por naturaleza", "resourceful": "Ingenioso", "skillful": "Diestro", "versatile": "Versátil",
    "adrenaline-rush": "Descarga de adrenalina", "relentless-endurance": "Aguante incansable",
    "fiendish-legacy": "Legado infernal", "otherworldly-presence": "Presencia sobrenatural",
}


def _entries(ch: Section, h1_part: str, h2_part: str) -> list[Section]:
    h1 = next(s for s in ch.sub("h1") if norm(h1_part) in norm(s.title))
    h2 = next(s for s in h1.sub("h2") if norm(h2_part) in norm(s.title))
    return h2.sub("h3")


def _fields(blocks: list[dict]) -> dict[str, str]:
    """`field` blocks and run-in paragraphs "**Key:** value" -> {normalised key: value (markup removed)}."""
    out = {}
    for b in blocks:
        if b["kind"] not in ("field", "p"):
            continue
        m = re.match(r"^\*\*(.+?)\s*:?\*\*\s*:?\s*(.*)$", b["text"], re.S)
        if m:
            out[norm(m.group(1).rstrip(":"))] = common.plain(m.group(2)).strip()
    return out


def split_traits(blocks: list[dict]) -> tuple[list[dict], list[list[dict]]]:
    """Blocks of a species: the intro (fields and the "As a X, you have these special traits." line) and one block list
    per trait, each starting with a run-in paragraph "**Name.** text"."""
    intro: list[dict] = []
    traits: list[list[dict]] = []
    for b in blocks:
        if b["kind"] == "p" and re.match(r"^\*\*[^*]+\.\*\*", b["text"]):
            traits.append([b])
        elif traits:
            traits[-1].append(b)
        else:
            intro.append(b)
    return intro, traits


def trait_name(block: dict) -> tuple[str, str]:
    m = re.match(r"^\*\*(.+?)\.?\*\*\s*(.*)$", block["text"], re.S)
    return m.group(1).strip(), m.group(2)


def build_species(en_ch: Section, fr_ch: Section) -> list[dict]:
    en_list = _entries(en_ch, "Character Species", "Species Descriptions")
    fr_list = {norm(s.title): s for s in common.L(fr=lambda: _entries(fr_ch, "Espèces", "Description des espèces"),
                                                   es=lambda: _entries(fr_ch, "Especies de personaje", "Descripciones de las especies"))()}
    names, traits_names = common.L(fr=(SPECIES_FR, TRAITS_FR), es=(SPECIES_ES, TRAITS_ES))
    out = []
    for s in en_list:
        sid = kebab(s.title)
        fr = fr_list.get(norm(names.get(sid, "")))
        if fr is None:
            note(f"species {sid}: {common.LANG.upper()} entry {names.get(sid)!r} not found")
        fields = _fields(s.blocks)
        fr_fields = _fields(fr.blocks) if fr else {}
        intro, traits = split_traits(s.blocks)
        fr_intro, fr_traits = split_traits(fr.blocks) if fr else ([], [])
        if fr and len(traits) != len(fr_traits):
            note(f"species {sid}: {len(traits)} EN traits vs {len(fr_traits)} FR")
        fr_by_name = {norm(re.sub(r"\s*\(.*\)$", "", trait_name(tb[0])[0])): tb for tb in fr_traits}
        size_text = fields.get("size", "")
        sizes = [v for w, v in SIZE_WORDS.items() if re.search(r"\b" + w + r"\b", size_text, re.I)]
        speed = common.parse_distance_pair(fields.get("speed", ""), fr_fields.get(common.L(fr="vitesse", es="velocidad"), ""),
                                           f"species {sid} speed")
        entry = {
            "id": sid,
            "name": i18n(s.title, fr.title if fr else ""),
            "creatureType": i18n(fields.get("creature type", ""), fr_fields.get(common.L(fr="type de creature", es="tipo de criatura"), "")),
            "size": sizes,
            "sizeText": i18n(size_text, fr_fields.get("categorie de taille", fr_fields.get("cat. de taille", fr_fields.get("tamano", "")))),
            "speed": speed or {"ft": 30, "m": 9},
            "traits": [],
            "text": i18n(blocks_html([b for b in intro if b["kind"] == "p"]), blocks_html([b for b in fr_intro if b["kind"] == "p"])),
            "source": source(s.heading, fr.heading if fr else None, f"Character Origins > Species Descriptions > {s.title}"),
        }
        for i, tb in enumerate(traits):
            name, first = trait_name(tb[0])
            base = re.sub(r"\s*\(.*\)$", "", name)
            ftb = fr_by_name.get(norm(traits_names.get(kebab(base), "")))
            if ftb is None:
                note(f"species {sid}: trait {name!r}: {common.LANG.upper()} name {traits_names.get(kebab(base))!r} not found in {list(fr_by_name)}")
            fr_name, fr_first = trait_name(ftb[0]) if ftb else ("", "")
            en_blocks = [{"kind": "p", "text": first, "page": tb[0]["page"]}] + tb[1:]
            fr_blocks = ([{"kind": "p", "text": fr_first, "page": ftb[0]["page"]}] + ftb[1:]) if ftb else []
            entry["traits"].append({
                "id": f"{sid}:{kebab(name)}",
                "name": i18n(name, fr_name),
                "text": i18n(blocks_html(en_blocks), blocks_html(fr_blocks)),
                "source": source(tb[0], ftb[0] if ftb else None, f"Character Origins > {s.title} > {name}"),
            })
        out.append(entry)
    return out


def build_backgrounds(en_ch: Section, fr_ch: Section) -> list[dict]:
    en_list = _entries(en_ch, "Character Backgrounds", "Background Descriptions")
    fr_list = {norm(s.title): s for s in common.L(fr=lambda: _entries(fr_ch, "Historiques", "Description des historiques"),
                                                   es=lambda: _entries(fr_ch, "Trasfondos de personaje", "Descripciones de trasfondos"))()}
    names = common.L(fr=BACKGROUNDS_FR, es=BACKGROUNDS_ES)
    out = []
    for s in en_list:
        bid = kebab(s.title)
        fr = fr_list.get(norm(names.get(bid, "")))
        if fr is None:
            note(f"background {bid}: {common.LANG.upper()} entry {names.get(bid)!r} not found")
        f = _fields(s.blocks)
        ff = _fields(fr.blocks) if fr else {}
        abilities = [common.ability_id(a) for a in re.split(r",\s*(?:and\s+)?|\s+and\s+", f.get("ability scores", "")) if common.ability_id(a)]
        feat_text = f.get("feat", "")
        feat = kebab(re.sub(r"\s*\(.*\)$", "", feat_text))
        skills = [common.skill_id(x) for x in re.split(r",\s*(?:and\s+)?|\s+and\s+", f.get("skill proficiencies", "")) if common.skill_id(x)]
        out.append({
            "id": bid,
            "name": i18n(s.title, fr.title if fr else ""),
            "abilities": abilities,
            "feat": feat,
            "featText": i18n(feat_text, ff.get(common.L(fr="don", es="dote"), "")),
            "skills": skills,
            "tool": i18n(f.get("tool proficiency", ""), ff.get("maitrise d'outils", ff.get("maitrise d'outil", ff.get("competencia con herramientas", "")))),
            "equipment": i18n(f.get("equipment", ""), ff.get(common.L(fr="equipement", es="equipo"), "")),
            "text": i18n(blocks_html(s.blocks), blocks_html(fr.blocks) if fr else ""),
            "source": source(s.heading, fr.heading if fr else None, f"Character Origins > Background Descriptions > {s.title}"),
        })
        if len(abilities) != 3 or not feat or len(skills) != 2:
            note(f"background {bid}: parsed abilities {abilities}, feat {feat!r}, skills {skills} — check")
    return out


def build(en: list[dict], fr: list[dict]) -> dict[str, int]:
    en_ch = common.chapter(en, "Character Origins")
    fr_ch = common.chapter(fr, common.L(fr="Origines des personnages", es="Orígenes de personaje"))
    species = build_species(en_ch, fr_ch)
    backgrounds = build_backgrounds(en_ch, fr_ch)
    write_json(common.OUT_SRD / "species.json", species)
    write_json(common.OUT_SRD / "backgrounds.json", backgrounds)
    return {"species.json": len(species), "backgrounds.json": len(backgrounds)}
