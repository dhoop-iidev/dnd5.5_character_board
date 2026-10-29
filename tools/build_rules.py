"""Core rules tables, skills, conditions and the Rules Glossary -> src/data/srd/rules.json, skills.json, conditions.json,
glossary.json.

Sources: "Playing the Game" (SRD 5.2.1 pp. 5–18), "Character Creation" (pp. 19–27), "Rules Glossary" (pp. 176–191).
"""
from __future__ import annotations

import re

import common
from common import Section, blocks_html, i18n, kebab, norm, note, parse_number, source, write_json

# Official French skill names (FR_SRD_CC_v5.2.1.pdf, table "Compétences" p. 9), checked against the table at build time.
SKILLS_FR = {
    "acrobatics": "Acrobaties", "animal-handling": "Dressage", "arcana": "Arcanes", "athletics": "Athlétisme",
    "deception": "Tromperie", "history": "Histoire", "insight": "Intuition", "intimidation": "Intimidation",
    "investigation": "Investigation", "medicine": "Médecine", "nature": "Nature", "perception": "Perception",
    "performance": "Représentation", "persuasion": "Persuasion", "religion": "Religion", "sleight-of-hand": "Escamotage",
    "stealth": "Discrétion", "survival": "Survie",
}
# Official French condition names (Rules Glossary, "[État]" entries), checked at build time.
CONDITIONS_FR = {
    "blinded": "Aveuglé", "charmed": "Charmé", "deafened": "Assourdi", "exhaustion": "Épuisement", "frightened": "Effrayé",
    "grappled": "Agrippé", "incapacitated": "Neutralisé", "invisible": "Invisible", "paralyzed": "Paralysé",
    "petrified": "Pétrifié", "poisoned": "Empoisonné", "prone": "À terre", "restrained": "Entravé", "stunned": "Étourdi",
    "unconscious": "Inconscient",
}
TAGS_FR = {"Action": "Action", "Condition": "État", "Hazard": "Danger", "Area of Effect": "Zone d’effet", "Attitude": "Attitude"}
# Spanish (SP_SRD_CC_v5.2.1.pdf, table "Habilidades" p. 9 and the "Glosario de reglas" headings pp. 194–210).
SKILLS_ES = {
    "acrobatics": "Acrobacias", "animal-handling": "Trato con animales", "arcana": "Conocimiento arcano",
    "athletics": "Atletismo", "deception": "Engaño", "history": "Historia", "insight": "Perspicacia",
    "intimidation": "Intimidación", "investigation": "Investigación", "medicine": "Medicina", "nature": "Naturaleza",
    "perception": "Percepción", "performance": "Interpretación", "persuasion": "Persuasión", "religion": "Religión",
    "sleight-of-hand": "Juego de manos", "stealth": "Sigilo", "survival": "Supervivencia",
}
CONDITIONS_ES = {
    "blinded": "Cegado", "charmed": "Hechizado", "deafened": "Ensordecido", "exhaustion": "Cansancio",
    "frightened": "Asustado", "grappled": "Agarrado", "incapacitated": "Incapacitado", "invisible": "Invisible",
    "paralyzed": "Paralizado", "petrified": "Petrificado", "poisoned": "Envenenado", "prone": "Derribado",
    "restrained": "Apresado", "stunned": "Aturdido", "unconscious": "Inconsciente",
}
TAGS_ES = {"Action": "Acción", "Condition": "Estado", "Hazard": "Peligro", "Area of Effect": "Área de efecto",
           "Attitude": "Actitud"}


def _table(sec: Section, title: str) -> dict:
    t = sec.table(title)
    if t is None:
        raise KeyError(f"table {title!r} not found under {sec.title!r}")
    return t


def _int(s: str) -> int:
    v = parse_number(s)
    if v is None:
        raise ValueError(f"not a number: {s!r}")
    return int(v)


def build_rules_tables(en_play: Section, en_create: Section, fr_create: Section, fr_play: Section) -> dict:
    adv = _table(en_create, "Character Advancement")
    xp, pb = [], []
    for level, exp, bonus in adv["rows"]:
        assert _int(level) == len(xp) + 1
        xp.append(_int(exp))
        pb.append(_int(bonus))
    multi = _table(en_create, "Multiclass Spellcaster")
    slots = []
    for row in multi["rows"]:
        assert _int(row[0]) == len(slots) + 1
        slots.append([int(parse_number(c) or 0) for c in row[1:10]])
    assert len(slots) == 20 and len(slots[0]) == 9, slots
    costs = {_int(r[0]): _int(r[1]) for r in _table(en_create, "Ability Score Point Costs")["rows"]}
    mods = _table(en_play, "Ability Modifiers")
    modifiers = []
    for score, mod in mods["rows"]:
        m = re.match(r"^(\d+)(?:–(\d+))?$", score.replace("-", "–"))
        lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
        modifiers.append({"from": lo, "to": hi, "mod": int(parse_number(mod.replace("−", "-")))})
    array = _table(en_create, "Standard Array by Class")
    array_fr = _table(fr_create, common.L(fr="Valeurs standard par classe", es="Conjunto estándar por clase"))
    by_class = {}
    for row in array["rows"]:
        by_class[kebab(row[0])] = {a: _int(v) for a, v in zip(("str", "dex", "con", "int", "wis", "cha"), row[1:7])}
    if len(array_fr["rows"]) != 12:
        note("Standard Array by Class: FR table has a different row count")
    dcs = _table(en_play, "Typical Difficulty Classes")
    # Spanish task names from the Spanish table, by position; the French ones are not filled yet (French pass: "").
    dcs_fr = fr_play.table("Clases de dificultad típicas") if common.LANG == "es" else None
    tasks_fr = [r[0] for r in dcs_fr["rows"]] if dcs_fr and len(dcs_fr["rows"]) == len(dcs["rows"]) else []
    return {
        "proficiencyBonus": pb,
        "xpByLevel": xp,
        "multiclassSlots": slots,
        "standardArray": [15, 14, 13, 12, 10, 8],
        "standardArrayByClass": by_class,
        "pointCost": costs,
        "abilityModifiers": modifiers,
        "typicalDcs": [{"task": {"en": r[0], "fr": tasks_fr[i] if tasks_fr else ""}, "dc": _int(r[1])} for i, r in enumerate(dcs["rows"])],
        "source": {"page": adv["page"], "section": "Character Advancement"},
    }


def build_skills(en_play: Section, fr_play: Section) -> list[dict]:
    t = _table(en_play, "Skills")
    tf = _table(fr_play, common.L(fr="Compétences", es="Habilidades"))
    fr_rows = {norm(r[0]): r for r in tf["rows"]}
    out = []
    for name, ability, uses in t["rows"]:
        sid = common.skill_id(name)
        if not sid:
            raise KeyError(name)
        fr_name = common.L(fr=SKILLS_FR, es=SKILLS_ES)[sid]
        fr_row = fr_rows.get(norm(fr_name))
        if fr_row is None:
            note(f"skill {sid}: French name {fr_name!r} not found in the French Skills table")
            fr_row = ["", "", ""]
        out.append({
            "id": sid,
            "name": i18n(name, fr_name),
            "ability": common.ability_id(ability),
            "text": i18n(uses, fr_row[2]),
            "source": source(t, tf, "Skills"),
        })
    return out


def _entries(sec: Section) -> list[Section]:
    return [h3 for h1 in sec.sub("h1") for h3 in h1.sub("h3")]


# French headings of the other Rules Glossary entries (FR_SRD_CC_v5.2.1.pdf "Glossaire", pp. 187–201): the two lists are
# alphabetical in each language, so the pairing is by name. The 15 conditions are in CONDITIONS_FR.
GLOSSARY_FR = {
    "Ability Check": "Test de caractéristique",
    "Ability Score and Modifier": "Valeur et modificateur de caractéristique",
    "Action": "Action",
    "Advantage": "Avantage",
    "Adventure": "Aventure",
    "Alignment": "Alignement",
    "Ally": "Allié",
    "Area of Effect": "Zone d’effet",
    "Armor Class": "Classe d’armure",
    "Armor Training": "Formation aux armures",
    "Attack": "Attaque",
    "Attack Roll": "Jet d’attaque",
    "Attitude": "Attitude",
    "Attunement": "Harmonisation",
    "Blindsight": "Vision aveugle",
    "Bloodied": "En péril",
    "Bonus Action": "Action Bonus",
    "Breaking Objects": "Bris des objets",
    "Bright Light": "Lumière vive",
    "Burning": "Embrasement",
    "Burrow Speed": "Vitesse de fouissement",
    "Campaign": "Campagne",
    "Cantrip": "Sort mineur",
    "Carrying Capacity": "Capacité de charge",
    "Challenge Rating": "Facteur de puissance",
    "Character Sheet": "Fiche de personnage",
    "Climbing": "Escalade",
    "Climb Speed": "Vitesse d’escalade",
    "Concentration": "Concentration",
    "Condition": "État",
    "Cone": "Cône",
    "Cover": "Abris",
    "Crawling": "Reptation",
    "Creature": "Créature",
    "Creature Type": "Type de créature",
    "Critical Hit": "Coup critique",
    "Cube": "Cube",
    "Curses": "Malédictions",
    "Cylinder": "Cylindre",
    "D20 Test": "Test d20",
    "Damage": "Dégâts",
    "Damage Roll": "Jet de dégâts",
    "Damage Threshold": "Seuil de dégâts",
    "Damage Types": "Types de dégâts",
    "Darkness": "Ténèbres",
    "Darkvision": "Vision dans le noir",
    "Dash": "Pointe",
    "Dead": "Mort",
    "Death Saving Throw": "Jet de sauvegarde contre la mort",
    "Dehydration": "Déshydratation",
    "Difficult Terrain": "Terrain difficile",
    "Difficulty Class": "Degré de difficulté",
    "Dim Light": "Lumière faible",
    "Disadvantage": "Désavantage",
    "Disengage": "Désengagement",
    "Dodge": "Esquive",
    "Emanation": "Émanation",
    "Encounter": "Rencontre",
    "Enemy": "Ennemi",
    "Experience Points": "Points d’expérience",
    "Expertise": "Expertise",
    "Falling": "Chute",
    "Flying": "Vol",
    "Fly Speed": "Vitesse de vol",
    "Friendly": "Amical",
    "Grappling": "Lutte",
    "Hazard": "Danger",
    "Healing": "Soins",
    "Heavily Obscured": "Visibilité nulle",
    "Help": "Soutien",
    "Heroic Inspiration": "Inspiration héroïque",
    "Hide": "Furtivité",
    "High Jump": "Saut en hauteur",
    "Hit Point Dice": "Dés de vie",
    "Hit Points": "Points de vie",
    "Hostile": "Hostile",
    "Hover": "Vol stationnaire",
    "Illusions": "Illusions",
    "Immunity": "Immunité",
    "Improvised Weapons": "Armes improvisées",
    "Indifferent": "Indifférent",
    "Influence": "Influence",
    "Initiative": "Initiative",
    "Jumping": "Saut",
    "Knocking Out a Creature": "Assommer une créature",
    "Lightly Obscured": "Visibilité réduite",
    "Line": "Ligne",
    "Long Jump": "Saut en longueur",
    "Long Rest": "Repos long",
    "Magic": "Magie",
    "Magical Effect": "Effet magique",
    "Malnutrition": "Malnutrition",
    "Monster": "Monstre",
    "Nonplayer Character": "Personnage non-joueur",
    "Object": "Objet",
    "Occupied Space": "Espace occupé",
    "Opportunity Attacks": "Attaques d’Opportunité",
    "Passive Perception": "Perception passive",
    "Per Day": "Par jour",
    "Player Character": "Personnage-joueur",
    "Possession": "Possession",
    "Proficiency": "Maîtrise",
    "Reach": "Allonge",
    "Reaction": "Réaction",
    "Ready": "Intention",
    "Resistance": "Résistance",
    "Ritual": "Rituel",
    "Round Down": "Arrondis à l’inférieur",
    "Save": "JS",
    "Saving Throw": "Jet de sauvegarde",
    "Search": "Observation",
    "Shape-Shifting": "Métamorphes",
    "Short Rest": "Repos court",
    "Simultaneous Effects": "Effets simultanés",
    "Size": "Cat. de taille",
    "Skill": "Compétence",
    "Speed": "Vitesse",
    "Spell": "Sort",
    "Spell Attack": "Attaque de sort",
    "Spellcasting Focus": "Focaliseur d’incantation",
    "Sphere": "Sphère",
    "Stable": "Stabilisé",
    "Stat Block": "Profil",
    "Study": "Étude",
    "Suffocation": "Asphyxie",
    "Surprise": "Surprise",
    "Swimming": "Nage",
    "Swim Speed": "Vitesse de nage",
    "Target": "Cible",
    "Telepathy": "Télépathie",
    "Teleportation": "Téléportation",
    "Temporary Hit Points": "Points de vie temporaires",
    "Tremorsense": "Perception des vibrations",
    "Truesight": "Vision lucide",
    "Unarmed Strike": "Attaque à mains nues",
    "Unoccupied Space": "Espace inoccupé",
    "Utilize": "Utilisation",
    "Vulnerability": "Vulnérabilité",
    "Weapon": "Arme",
    "Weapon Attack": "Attaque d’arme",
}
GLOSSARY_ES = {
    "Ability Check": "Prueba de característica", "Ability Score and Modifier": "Puntuación de característica y modificador",
    "Action": "Acción", "Advantage": "Ventaja", "Adventure": "Aventura", "Alignment": "Alineamiento", "Ally": "Aliado",
    "Area of Effect": "Área de efecto", "Armor Class": "Clase de armadura", "Armor Training": "Entrenamiento con armaduras",
    "Attack": "Atacar", "Attack Roll": "Tirada de ataque", "Attitude": "Actitud", "Attunement": "Sintonización",
    "Blindsight": "Visión ciega", "Bloodied": "Maltrecho", "Bonus Action": "Acción adicional",
    "Breaking Objects": "Romper objetos", "Bright Light": "Luz brillante", "Burning": "Fuego",
    "Burrow Speed": "Velocidad excavando", "Campaign": "Campaña", "Cantrip": "Truco", "Carrying Capacity": "Capacidad de carga",
    "Challenge Rating": "Valor de desafío", "Character Sheet": "Hoja de personaje", "Climbing": "Trepar",
    "Climb Speed": "Velocidad trepando", "Concentration": "Concentración", "Condition": "Estado", "Cone": "Cono",
    "Cover": "Cobertura", "Crawling": "Arrastrarse", "Creature": "Criatura", "Creature Type": "Tipo de criatura",
    "Critical Hit": "Crítico", "Cube": "Cubo", "Curses": "Maldiciones", "Cylinder": "Cilindro", "D20 Test": "Prueba con d20",
    "Damage": "Daño", "Damage Roll": "Tirada de daño", "Damage Threshold": "Umbral de daño", "Damage Types": "Tipos de daño",
    "Darkness": "Oscuridad", "Darkvision": "Visión en la oscuridad", "Dash": "Correr", "Dead": "Muerto",
    "Death Saving Throw": "Tirada de salvación contra muerte", "Dehydration": "Deshidratación",
    "Difficult Terrain": "Terreno difícil", "Difficulty Class": "Clase de dificultad", "Dim Light": "Luz tenue",
    "Disadvantage": "Desventaja", "Disengage": "Destrabarse", "Dodge": "Esquivar", "Emanation": "Emanación",
    "Encounter": "Encuentro", "Enemy": "Enemigo", "Experience Points": "Puntos de experiencia", "Expertise": "Pericia",
    "Falling": "Caídas", "Flying": "Volar", "Fly Speed": "Velocidad volando", "Friendly": "Amistosa", "Grappling": "Agarrar",
    "Hazard": "Peligro", "Healing": "Curación", "Heavily Obscured": "Muy oscuro", "Help": "Ayudar",
    "Heroic Inspiration": "Inspiración heroica", "Hide": "Esconderse", "High Jump": "Salto de altura",
    "Hit Point Dice": "Dados de puntos de golpe", "Hit Points": "Puntos de golpe", "Hostile": "Hostil", "Hover": "Levitar",
    "Illusions": "Ilusiones", "Immunity": "Inmunidad", "Improvised Weapons": "Armas improvisadas",
    "Indifferent": "Indiferente", "Influence": "Influir", "Initiative": "Iniciativa", "Jumping": "Saltar",
    "Knocking Out a Creature": "Noquear a una criatura", "Lightly Obscured": "Ligeramente oscuro", "Line": "Línea",
    "Long Jump": "Salto de longitud", "Long Rest": "Descanso largo", "Magic": "Magia", "Magical Effect": "Efecto mágico",
    "Malnutrition": "Desnutrición", "Monster": "Monstruo", "Nonplayer Character": "Personaje no jugador", "Object": "Objeto",
    "Occupied Space": "Espacio ocupado", "Opportunity Attacks": "Ataques de oportunidad",
    "Passive Perception": "Percepción pasiva", "Per Day": "Al día", "Player Character": "Personaje jugador",
    "Possession": "Posesión", "Proficiency": "Competencia", "Reach": "Alcance", "Reaction": "Reacción",
    "Ready": "Preparar una acción", "Resistance": "Resistencia", "Ritual": "Ritual", "Round Down": "Redondear hacia abajo",
    "Save": "Salvación", "Saving Throw": "Tirada de salvación", "Search": "Buscar", "Shape-Shifting": "Cambio de forma",
    "Short Rest": "Descanso corto", "Simultaneous Effects": "Efectos simultáneos", "Size": "Tamaño", "Skill": "Habilidad",
    "Speed": "Velocidad", "Spell": "Conjuro", "Spell Attack": "Ataque de conjuro", "Spellcasting Focus": "Canalizador mágico",
    "Sphere": "Esfera", "Stable": "Estable", "Stat Block": "Perfil", "Study": "Estudiar", "Suffocation": "Asfixia",
    "Surprise": "Sorpresa", "Swimming": "Nadar", "Swim Speed": "Velocidad nadando", "Target": "Objetivo",
    "Telepathy": "Telepatía", "Teleportation": "Teletransporte", "Temporary Hit Points": "Puntos de golpe temporales",
    "Tremorsense": "Sentir vibraciones", "Truesight": "Visión verdadera", "Unarmed Strike": "Ataque sin armas",
    "Unoccupied Space": "Espacio sin ocupar", "Utilize": "Utilizar", "Vulnerability": "Vulnerabilidad", "Weapon": "Arma",
    "Weapon Attack": "Ataque con arma",
}

def build_glossary(en_gl: Section, fr_gl: Section) -> tuple[list[dict], list[dict]]:
    en_entries = _entries(en_gl)
    fr_entries = _entries(fr_gl)
    fr_by_norm = {}
    for s in fr_entries:
        name = re.sub(r"\s*\[.+?\]\s*$", "", s.title).strip()
        fr_by_norm[norm(name)] = s
    conditions, glossary = [], []
    matched = 0
    # Terms whose French name is known from the data itself: conditions (hand list), skills, abilities.
    known_fr = {norm(k): v for k, v in common.L(fr={**GLOSSARY_FR, **CONDITIONS_FR}, es={**GLOSSARY_ES, **CONDITIONS_ES}).items()}
    for s in en_entries:
        m = re.match(r"^(.+?)\s*\[(.+?)\]\s*$", s.title)
        name, tag = (m.group(1).strip(), m.group(2).strip()) if m else (s.title.strip(), None)
        eid = kebab(name)
        fr_name = known_fr.get(norm(name)) or known_fr.get(eid) or ""
        fr_sec = fr_by_norm.get(norm(fr_name)) if fr_name else None
        if fr_sec is None and fr_name:
            note(f"glossary {eid}: French entry {fr_name!r} not found")
        if fr_sec is not None:
            matched += 1
        entry = {
            "id": eid,
            "name": i18n(name, fr_name),
            "text": i18n(blocks_html(s.blocks), blocks_html(fr_sec.blocks) if fr_sec else ""),
            "source": source(s.heading, fr_sec.heading if fr_sec else None, "Rules Glossary"),
        }
        if tag:
            entry["tag"] = i18n(tag, common.L(fr=TAGS_FR, es=TAGS_ES).get(tag, tag))
        glossary.append(entry)
        if tag == "Condition":
            conditions.append({
                "id": eid,
                "name": entry["name"],
                "text": entry["text"],
                "source": entry["source"],
            })
    note(f"glossary: {matched}/{len(en_entries)} entries have their {common.LANG.upper()} text")
    if len(conditions) != 15:
        note(f"glossary: {len(conditions)} conditions found, expected 15")
    return conditions, glossary


def build(en: list[dict], fr: list[dict]) -> dict[str, int]:
    en_play = common.chapter(en, "Playing the Game")
    fr_play = common.chapter(fr, common.L(fr="Comment jouer", es="Cómo jugar"))
    en_create = common.chapter(en, "Character Creation")
    fr_create = common.chapter(fr, common.L(fr="Création de personnage", es="Creación de personajes"))
    en_gl = common.chapter(en, "Rules Glossary")
    fr_gl = common.chapter(fr, common.L(fr="Glossaire", es="Glosario de reglas"))
    rules = build_rules_tables(en_play, en_create, fr_create, fr_play)
    skills = build_skills(en_play, fr_play)
    conditions, glossary = build_glossary(en_gl, fr_gl)
    write_json(common.OUT_SRD / "rules.json", rules)
    write_json(common.OUT_SRD / "skills.json", skills)
    write_json(common.OUT_SRD / "conditions.json", conditions)
    write_json(common.OUT_SRD / "glossary.json", glossary)
    return {"rules.json": 1, "skills.json": len(skills), "conditions.json": len(conditions), "glossary.json": len(glossary)}
