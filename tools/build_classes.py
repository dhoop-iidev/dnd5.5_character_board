"""The 12 classes -> src/data/srd/classes.json (ClassDef[]): core traits, class table, features, subclass, options,
spell lists. Source: SRD 5.2.1 "Classes" (EN pp. 28–82, FR pp. 30–86).

French: the classes are in French alphabetical order, so they are paired by name (CLASS_FR); inside a class the features
appear in the same order as in English and are paired by position (counts are checked).
Spanish (SP_SRD_CC_v5.2.1.pdf pp. 32–88): classes paired by name (CLASS_ES); the features of one level are printed in
Spanish alphabetical order, so features are paired level by level, and inside a level with several features by a
language-independent signature of their text (numbers with feet in metres, paragraph / list / table counts, length).
"""
from __future__ import annotations

import re

import common
from common import Section, blocks_html, i18n, kebab, norm, note, parse_number, source, write_json

CLASS_FR = {
    "barbarian": "Barbare", "bard": "Barde", "cleric": "Clerc", "druid": "Druide", "fighter": "Guerrier", "monk": "Moine",
    "paladin": "Paladin", "ranger": "Rôdeur", "rogue": "Roublard", "sorcerer": "Ensorceleur", "warlock": "Occultiste",
    "wizard": "Magicien",
}
CLASS_ES = {
    "barbarian": "Bárbaro", "bard": "Bardo", "cleric": "Clérigo", "druid": "Druida", "fighter": "Guerrero", "monk": "Monje",
    "paladin": "Paladín", "ranger": "Explorador", "rogue": "Pícaro", "sorcerer": "Hechicero", "warlock": "Brujo",
    "wizard": "Mago",
}
CASTER_KIND = {"bard": "full", "cleric": "full", "druid": "full", "sorcerer": "full", "wizard": "full", "paladin": "half",
               "ranger": "half", "warlock": "pact"}
COLUMN_IDS = {
    "rages": "rages", "rage damage": "rageDamage", "weapon mastery": "weaponMastery", "bardic die": "bardicDie",
    "cantrips": "cantrips", "prepared spells": "preparedSpells", "channel divinity": "channelDivinity",
    "wild shape": "wildShape", "second wind": "secondWind", "martial arts": "martialArts", "focus points": "focusPoints",
    "unarmored movement": "unarmoredMovement", "favored enemy": "favoredEnemy", "sneak attack": "sneakAttack",
    "sorcery points": "sorceryPoints", "eldritch invocations": "invocations", "spell slots": "pactSlots",
    "slot level": "pactLevel",
}
ARMOR_WORDS = {"light": "light", "medium": "medium", "heavy": "heavy", "shields": "shield", "shield": "shield"}


def _rows(table: dict) -> dict[str, str]:
    """Key/value table (Core Traits) -> {normalised key: value}. A row with an empty key continues the value above (a
    wrapped cell extracted as its own row, Spanish p. 32)."""
    out: dict[str, str] = {}
    for r in table["rows"]:
        if len(r) < 2:
            continue
        if not r[0].strip() and out:
            last = list(out)[-1]
            out[last] = f"{out[last]} {r[1]}".strip()
        else:
            out[norm(r[0])] = r[1]
    return out


def _value(v) -> int | str | None:
    v = v.strip()
    if v in ("", "—", "–"):
        return None
    n = parse_number(v.replace("−", "-"))
    if n is not None and n == int(n):
        return int(n)
    return v


def parse_core(table: dict, fr_table: dict, cid: str) -> dict:
    en = _rows(table)
    fr = _rows(fr_table)
    fr_vals = list(fr.values())
    en_vals = list(en.values())
    if len(fr_vals) != len(en_vals):
        note(f"{cid}: core traits rows EN {len(en_vals)} vs FR {len(fr_vals)}")

    def get(key: str, idx: int) -> tuple[str, str]:
        return en.get(key, ""), fr_vals[idx] if idx < len(fr_vals) else ""

    primary = [common.ability_id(a) for a in re.split(r"\s*(?:,|and|or)\s*", en["primary ability"]) if common.ability_id(a)]
    primary_any = bool(re.search(r"\bor\b", en["primary ability"]))  # Fighter "Strength or Dexterity" (SRD p. 47)
    hit = int(re.search(r"D(\d+)", en["hit point die"]).group(1))
    saves = [common.ability_id(a) for a in re.split(r"\s*(?:,|and)\s*", en["saving throw proficiencies"]) if common.ability_id(a)]
    sk = en["skill proficiencies"]
    m = re.match(r"^Choose (\d+)\s*:\s*(.+)$", sk)
    if m:
        skills = {"count": int(m.group(1)), "from": [common.skill_id(x) for x in re.split(r",\s*(?:or\s+)?|\s+or\s+", m.group(2)) if common.skill_id(x)]}
    else:
        m = re.match(r"^Choose any (\d+)", sk)
        skills = {"count": int(m.group(1)), "from": "any"}
    weapons = []
    wp = en["weapon proficiencies"]
    for w in ("simple", "martial"):
        if re.search(w, wp, re.I):
            weapons.append(w)
    if re.search(r"Martial weapons that have the Finesse or Light property", wp):
        weapons = ["simple", "martial:finesse-or-light"]  # Rogue (SRD p. 61)
    elif re.search(r"Martial weapons that have the Light property", wp):
        weapons = ["simple", "martial:light"]  # Monk (SRD p. 49)
    armor = []
    for word, aid in ARMOR_WORDS.items():
        if re.search(r"\b" + word + r"\b", en.get("armor training", ""), re.I) and aid not in armor:
            armor.append(aid)
    keys = list(en.keys())
    out = {
        "primaryAbility": primary,
        "_primary_any": primary_any,
        "hitDie": hit,
        "saveProficiencies": saves,
        "skillChoices": skills,
        "weaponProficiencies": weapons,
        "armorTraining": armor,
        "startingEquipment": i18n(en["starting equipment"], fr_vals[keys.index("starting equipment")] if "starting equipment" in keys else ""),
    }
    if "tool proficiencies" in en:
        out["toolProficiencies"] = i18n(en["tool proficiencies"], fr_vals[keys.index("tool proficiencies")])
    return out


def parse_table(table: dict, cid: str) -> tuple[list[dict], list[dict]]:
    header = table["header"]
    assert header[:3] == ["Level", "Proficiency Bonus", "Class Features"], (cid, header)
    columns = []
    col_ids: list[str | None] = [None, None, None]
    for h in header[3:]:
        if re.fullmatch(r"[1-9]", h):
            col_ids.append(f"slot{h}")
        else:
            cid_col = COLUMN_IDS.get(norm(h))
            if cid_col is None:
                cid_col = re.sub(r"\s+(\w)", lambda m: m.group(1).upper(), norm(h))
                note(f"{cid}: unknown class table column {h!r} -> {cid_col}")
            col_ids.append(cid_col)
            columns.append({"id": cid_col, "name": i18n(h, "")})
    rows = []
    for r in table["rows"]:
        level = int(r[0])
        feats = [] if r[2].strip() in ("—", "–", "") else [i18n(f.strip(), "") for f in r[2].split(",")]
        row: dict = {"level": level, "pb": int(parse_number(r[1])), "features": feats, "resources": {}}
        slots: dict[int, int] = {}
        for h, cidc, v in zip(header[3:], col_ids[3:], r[3:]):
            val = _value(v)
            if cidc and cidc.startswith("slot"):
                slots[int(cidc[4:])] = int(val or 0)
            elif cidc and val is not None:
                row["resources"][cidc] = val
        if slots:
            row["slots"] = [slots.get(i, 0) for i in range(1, max(slots) + 1)]
        if "pactSlots" in row["resources"]:
            row["pact"] = {"slots": row["resources"].pop("pactSlots"), "level": row["resources"].pop("pactLevel")}
        rows.append(row)
    assert [r["level"] for r in rows] == list(range(1, 21)), (cid, [r["level"] for r in rows])
    return rows, columns


def feature_name(title: str) -> tuple[int | None, str]:
    m = re.match(r"^(?:Level|Niveau|Nivel)\s*(\d+)\s*:\s*(.+)$", title.replace(" ", " "))
    if m:
        return int(m.group(1)), m.group(2).strip()
    return None, title.strip()


def parse_features(en_sec: Section, fr_sec: Section | None, cid: str, prefix: str, subclass: str | None = None) -> list[dict]:
    en_f = en_sec.sub("h3")
    fr_f = fr_sec.sub("h3") if fr_sec else []
    if fr_sec and len(en_f) != len(fr_f):
        note(f"{prefix}: {len(en_f)} EN features vs {len(fr_f)} FR — French texts paired by position up to the shorter list")
    out = []
    seen: set[str] = set()
    paired = pair_features(en_f, fr_f, prefix)
    for i, f in enumerate(en_f):
        level, name = feature_name(f.title)
        g = paired[i]
        fr_level, fr_name = feature_name(g.title) if g else (None, "")
        if g and fr_level != level:
            note(f"{prefix}: feature {name!r} level {level} vs FR {fr_name!r} level {fr_level}")
        own = [b for b in f.blocks if not (b["kind"] == "table" and re.search(r"(Features|Aptitudes d[ue]) ?", b["title"] or "") and len(b["rows"]) == 20)]
        own_fr = [b for b in g.blocks if not (b["kind"] == "table" and len(b["rows"]) == 20)] if g else []
        fid = f"{prefix}:{kebab(name)}"
        if fid in seen:  # same feature name at two levels (Barbarian Improved Brutal Strike 13 and 17)
            fid = f"{fid}-{level}"
        seen.add(fid)
        entry = {
            "id": fid,
            "level": level or 0,
            "name": i18n(name, fr_name),
            "text": i18n(blocks_html(own), blocks_html(own_fr) if g else ""),
            "source": source(f.heading, g.heading if g else None, f"Classes > {en_sec.title} > {f.title}"),
        }
        if subclass:
            entry["subclass"] = subclass
        out.append(entry)
    return out


def _feature_sig(sec: Section, lang: str) -> tuple[list[float], tuple[int, int, int], int]:
    html = blocks_html(sec.blocks)
    return _numbers(html, lang), (html.count("<p"), html.count("<li"), html.count("<table")), len(re.sub(r"<[^>]+>", "", html))


def pair_features(en_f: list[Section], fr_f: list[Section], prefix: str) -> list[Section | None]:
    """The translated feature of each English one. French: by position. Spanish: the features of one level are sorted in
    Spanish, so they are paired level by level; inside a level, by the best signature match (numbers, structure, length)."""
    if common.LANG == "fr" or len(en_f) != len(fr_f):
        return [fr_f[i] if i < len(fr_f) else None for i in range(len(en_f))]
    out: list[Section | None] = [None] * len(en_f)
    i = 0
    while i < len(en_f):
        lvl = feature_name(en_f[i].title)[0]
        j = i
        while j < len(en_f) and feature_name(en_f[j].title)[0] == lvl:
            j += 1
        group_en, group_fr = list(range(i, j)), list(range(i, j))
        if any(feature_name(fr_f[k].title)[0] != lvl for k in group_fr):
            note(f"{prefix}: level {lvl} features differ in level between EN and {common.LANG.upper()} — paired by position")
            for k in group_en:
                out[k] = fr_f[k]
        elif len(group_en) == 1:
            out[i] = fr_f[i]
        else:
            sig_en = {k: _feature_sig(en_f[k], "en") for k in group_en}
            sig_fr = {k: _feature_sig(fr_f[k], common.LANG) for k in group_fr}

            def score(a: int, b: int) -> float:
                (na, sa, la), (nb, sb, lb) = sig_en[a], sig_fr[b]
                ca, cb = set(na), set(nb)
                jac = len(ca & cb) / len(ca | cb) if ca | cb else 1.0
                struct = -sum(abs(x - y) for x, y in zip(sa, sb))
                ratio = (lb / la) if la else 1.0
                return 3 * jac + struct - 2 * abs(ratio - 1.15)

            pairs = sorted(((score(a, b), a, b) for a in group_en for b in group_fr), reverse=True)
            used_a, used_b = set(), set()
            for sc, a, b in pairs:
                if a in used_a or b in used_b:
                    continue
                out[a] = fr_f[b]
                used_a.add(a)
                used_b.add(b)
            MATCHED_GROUPS.append((prefix, lvl, [(en_f[a].title, out[a].title) for a in group_en]))
        i = j
    return out


MATCHED_GROUPS: list[tuple[str, int | None, list[tuple[str, str]]]] = []  # Spanish level groups paired by signature


def parse_spell_list(sec: Section) -> list[dict]:
    out = []
    for t in sec.tables():
        m = re.match(r"^Level (\d) ", t["title"]) or (re.match(r"^Cantrips", t["title"]) and re.match(r"^(C)", "0"))
        level = int(m.group(1)) if m and m.group(1).isdigit() else 0
        spells = [kebab(r[0]) for r in t["rows"] if r and r[0] and not r[0].startswith("§ ")]
        out.append({"level": level, "spells": spells})
    return out


def _spell_level_tables(sec: Section) -> list[dict]:
    return [t for t in sec.tables() if t["header"] and len(t["header"]) == 2 and re.search(r"Level$", t["header"][0])]


def _rows_of(t: dict) -> list[dict]:
    out = []
    for r in t["rows"]:
        lvl = parse_number(r[0])
        if lvl is None:
            continue
        spells = [kebab(x.strip()) for x in re.split(r",\s*", common.plain(r[1])) if x.strip()]
        out.append({"level": int(lvl), "spells": spells})
    return out


def parse_subclass_spells(sec: Section) -> list[dict] | None:
    """The subclass spell table when there is exactly one (Life Domain Spells, Fiend Spells…)."""
    tables = _spell_level_tables(sec)
    if len(tables) == 1:
        return _rows_of(tables[0])
    return None


def parse_subclass_spell_choices(sec: Section, fr: Section | None) -> dict | None:
    """Several "<Choice> Level" tables (Circle of the Land: Arid Land, Polar Land, Temperate Land, Tropical Land; the land
    is chosen on each Long Rest, SRD p. 46). Keyed by the first word of the table title ('arid', 'polar'…); French names
    from the French tables in the same order."""
    tables = _spell_level_tables(sec)
    if len(tables) < 2:
        return None
    fr_tables = common.L(fr=lambda: _spell_level_tables(fr) if fr else [],  # (no French header ends in "Level": names empty)
                         es=lambda: [t for t in fr.tables() if len(t["header"]) == 2 and t["header"][0].startswith("Nivel de")]
                         if fr else [])()
    options = {}
    for i, t in enumerate(tables):
        title = t.get("title") or t["header"][0]
        key = kebab(title.split()[0])
        fr_title = (fr_tables[i].get("title") or fr_tables[i]["header"][0]) if i < len(fr_tables) else ""
        options[key] = {"name": i18n(title, fr_title), "spells": _rows_of(t)}
    return {"name": i18n("Land type", common.L(fr="Type d’environnement", es="Tipo de terreno")), "options": options}


def spellcasting_def(cid: str, features: list[dict], prep_change: dict[str, str], texts: list[dict]) -> dict | None:
    kind = CASTER_KIND.get(cid)
    if not kind:
        return None
    feat = next((f for f in features if f["name"]["en"] in ("Spellcasting", "Pact Magic")), None)
    if feat is None:
        note(f"{cid}: no Spellcasting feature found")
        return None
    text = common.plain(re.sub(r"<[^>]+>", " ", feat["text"]["en"]))
    m = re.search(r"\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+is\s+(?:your|the)\s+spellcasting\s+ability", text)
    if not m:
        note(f"{cid}: spellcasting ability sentence not found")
    return {
        "ability": common.ability_id(m.group(1)) if m else "cha",
        "kind": kind,
        "list": cid,
        "spellbook": cid == "wizard",
        "ritual": bool(re.search(r"\bRitual\b", text)),
        "change": prep_change.get(cid, "long-rest"),
        "source": feat["source"],
    }


def prep_changes(en: list[dict]) -> dict[str, str]:
    sp = common.chapter(en, "Spells")
    t = sp.table("Spell Preparation by Class")
    out = {}
    if t:
        for r in t["rows"]:
            out[kebab(r[0])] = "level" if "level" in r[1].lower() else "long-rest"
    return out


def build(en: list[dict], fr: list[dict]) -> dict[str, int]:
    en_ch = common.chapter(en, "Classes")
    fr_ch = common.chapter(fr, common.L(fr="Classes", es="Clases"))
    fr_classes = {norm(s.title): s for s in fr_ch.sub("h1")}
    changes = prep_changes(en)
    classes = []
    for cls in en_ch.sub("h1"):
        cid = kebab(cls.title)
        cname = common.L(fr=CLASS_FR, es=CLASS_ES)[cid]
        frc = fr_classes.get(norm(cname))
        if frc is None:
            note(f"{cid}: {common.LANG.upper()} class {cname!r} not found")
        core = cls.table("Core ")
        core_fr = frc.table(common.L(fr="Traits de base", es="Atributos básicos")) if frc else None
        if core is None or core_fr is None:
            raise KeyError(f"{cid}: core traits table missing")
        c = {"id": cid, "name": i18n(cls.title, frc.title if frc else "")}
        c.update(parse_core(core, core_fr, cid))
        en_h2 = cls.sub("h2")
        fr_h2 = frc.sub("h2") if frc else []
        if len(en_h2) != len(fr_h2):
            note(f"{cid}: {len(en_h2)} EN h2 sections vs {len(fr_h2)} FR")

        def fr_of(i: int) -> Section | None:
            return fr_h2[i] if i < len(fr_h2) else None

        features: list[dict] = []
        subclasses: list[dict] = []
        options: dict[str, list[dict]] = {}
        spell_list = None
        table_rows, columns = None, None
        multiclass = {"armor": [], "weapons": [], "text": i18n("", "")}
        for i, h2 in enumerate(en_h2):
            frh = fr_of(i)
            t = h2.title
            if t.startswith("Becoming"):
                mc = next((s for s in h2.sub("h3") if "Multiclass" in s.title), None)
                mcf = next((s for s in frh.sub("h3") if "multiclas" in norm(s.title)), None) if frh else None
                if mc:
                    txt = " ".join(common.plain(b["text"]) for b in mc.blocks if b["kind"] in ("p", "li"))
                    multiclass["text"] = i18n(blocks_html(mc.blocks), blocks_html(mcf.blocks) if mcf else "")
                    for word, aid in ARMOR_WORDS.items():
                        if re.search(r"\b" + word + r"\b", txt, re.I) and aid not in multiclass["armor"]:
                            multiclass["armor"].append(aid)
                    for w in ("simple", "martial"):
                        if re.search(r"\b" + w + r" weapons", txt, re.I):
                            multiclass["weapons"].append(w)
                    ms = re.search(r"proficiency in (one|two|three) skills?", txt, re.I)
                    if ms:
                        multiclass["skills"] = {"one": 1, "two": 2, "three": 3}[ms.group(1).lower()]
                    # Tools granted to a multiclass character: Rogue "proficiency with Thieves' Tools" (p. 61), Bard "one
                    # Musical Instrument of your choice" (p. 32).
                    tools = re.findall(r"proficiency with ((?:one |a )?[A-Z][\w’' ]+?(?:Tools|Instrument[s]?)(?: of your choice)?)", txt)
                    if tools:
                        multiclass["tools"] = [i18n(t.strip(), "") for t in tools]
                c["text"] = i18n(blocks_html(h2.blocks), blocks_html(frh.blocks) if frh else "")
            elif t.endswith("Class Features"):
                ft = h2.table(f"{cls.title} Features")
                if ft is None:
                    raise KeyError(f"{cid}: features table missing")
                table_rows, columns = parse_table(ft, cid)
                # the Spanish features table can sit before the first h2 (Bard, ES p. 35): looked up in the whole class
                ftf = common.L(fr=lambda: frh.table("Aptitudes d") if frh else None,
                               es=lambda: frc.table(f"Rasgos de {cname.lower()}") if frc else None)()
                if ftf and len(ftf["rows"]) == 20:
                    for row, fr_row in zip(table_rows, ftf["rows"]):
                        fr_feats = [x.strip() for x in fr_row[2].split(",")]
                        # same count: pair the printed feature names; the French column lists them alphabetically
                        if len(fr_feats) == len(row["features"]):
                            for f_en in row["features"]:
                                f_en["fr"] = ""
                    for col, h in zip(columns, [h for h in ftf["header"][3:] if not re.fullmatch(r"[1-9]", h)]):
                        col["name"]["fr"] = h
                features = parse_features(h2, frh, cid, cid)
            elif t.endswith("Spell List"):
                spell_list = parse_spell_list(h2)
            elif " Subclass: " in t:
                sub_name = t.split(" Subclass: ", 1)[1].strip()
                fr_sub = frh.title.split(":", 1)[1].strip() if frh and ":" in frh.title else ""
                sid = kebab(sub_name)
                sub = {
                    "id": f"{cid}:{sid}",
                    "name": i18n(sub_name, fr_sub),
                    "text": i18n(blocks_html(h2.own()), blocks_html(frh.own()) if frh else ""),
                    "features": parse_features(h2, frh, cid, f"{cid}:{sid}", subclass=f"{cid}:{sid}"),
                    "source": source(h2.heading, frh.heading if frh else None, f"Classes > {cls.title} > {t}"),
                }
                sp = parse_subclass_spells(h2)
                if sp:
                    sub["spells"] = sp
                spc = parse_subclass_spell_choices(h2, frh)
                if spc:
                    sub["spellChoices"] = spc
                subclasses.append(sub)
            elif t.endswith("Options"):
                key = kebab(t.replace(" Options", ""))
                opts = []
                fr_opts = frh.sub("h3") if frh else []
                en_opts = h2.sub("h3")
                # options are alphabetical in each language: pair by position only when a prerequisite line matches; else leave
                # the French name empty (filled by the French option list in fr_overrides later)
                for j, o in enumerate(en_opts):
                    g = fr_opts[j] if j < len(fr_opts) else None
                    opt = {
                        "id": f"{cid}:{key}:{kebab(o.title)}",
                        "name": i18n(o.title, ""),
                        "text": i18n(blocks_html(o.blocks), ""),
                        "source": source(o.heading, None, f"Classes > {cls.title} > {t}"),
                    }
                    pm = re.search(r"Prerequisite:\s*(.+)", common.plain(o.blocks[0]["text"])) if o.blocks and o.blocks[0]["kind"] == "p" else None
                    if pm:
                        opt["prereq"] = i18n(pm.group(1).strip("* "), "")
                    opts.append(opt)
                options[key] = opts
                if fr_opts and len(fr_opts) != len(en_opts):
                    note(f"{cid}: {t}: {len(en_opts)} EN options vs {len(fr_opts)} FR")
                c.setdefault("_fr_options", {})[key] = [(o.title, blocks_html(o.blocks), o.heading) for o in fr_opts]
            else:
                note(f"{cid}: unexpected section {t!r}")
        # French names of the features in the class table rows: from the French feature headings
        fr_names = {norm(f["name"]["en"]): f["name"]["fr"] for f in features if f["name"]["fr"]}
        for sub in subclasses:
            for f in sub["features"]:
                if f["name"]["fr"]:
                    fr_names[norm(f["name"]["en"])] = f["name"]["fr"]
        fr_names.update(common.L(
            fr={norm("Ability Score Improvement"): "Amélioration de caractéristique", norm("Epic Boon"): "Faveur épique",
                norm("Subclass feature"): "Aptitude de sous-classe", norm(f"{cls.title} Subclass"): f"Sous-classe de {cname}"},
            es={norm("Ability Score Improvement"): "Mejora de característica", norm("Epic Boon"): "Don épico",
                norm("Subclass feature"): "Rasgo de subclase", norm(f"{cls.title} Subclass"): f"Subclase de {cname.lower()}"}))
        fr_table = common.L(fr=lambda: (frc.sub("h2")[1].table("Aptitudes d") if frc and len(frc.sub("h2")) > 1 else None),
                            es=lambda: frc.table(f"Rasgos de {cname.lower()}") if frc else None)()
        for row in table_rows or []:
            fr_row_feats = []
            if fr_table and len(fr_table["rows"]) == 20:
                fr_row_feats = [x.strip() for x in fr_table["rows"][row["level"] - 1][2].split(",")]
            for f_en in row["features"]:
                base = re.sub(r"\s*\(.*\)$", "", f_en["en"])
                fr_base = fr_names.get(norm(base), "")
                if base != f_en["en"] and fr_base:
                    # "Action Surge (one use)": take the French table entry that starts with the French base name
                    cand = [x for x in fr_row_feats if norm(x).startswith(norm(fr_base))]
                    f_en["fr"] = cand[0] if len(cand) == 1 else fr_base
                else:
                    f_en["fr"] = fr_base
                if not f_en["fr"]:
                    note(f"{cid}: no French name for table feature {f_en['en']!r}")
        c["multiclass"] = multiclass
        c["table"] = table_rows
        c["columns"] = columns
        c["features"] = features
        c["subclasses"] = subclasses
        c["asiLevels"] = [r["level"] for r in table_rows if any(f["en"] == "Ability Score Improvement" for f in r["features"])]
        if c.get("_primary_any"):
            c["primaryAbilityAny"] = True
        c.pop("_primary_any", None)
        if options:
            c["options"] = options
            fr_opt = c.pop("_fr_options", {})
            for key, opts in options.items():
                match_options(opts, fr_opt.get(key, []), cid, key)
        if spell_list:
            c["spellList"] = spell_list
        sc = spellcasting_def(cid, features, changes, [])
        if sc:
            c["spellcasting"] = sc
        c.setdefault("text", i18n("", ""))
        c["source"] = source(cls.heading, frc.heading if frc else None, f"Classes > {cls.title}")
        classes.append(c)
    write_json(common.OUT_SRD / "classes.json", classes)
    return {"classes.json": len(classes)}


INVOCATIONS_FR = {  # FR_SRD_CC_v5.2.1.pdf "Options de Manifestations occultes"; checked against the French headings
    "agonizing-blast": "Décharge déchirante", "armor-of-shadows": "Armure d’ombres", "ascendant-step": "Pas aérien",
    "devils-sight": "Vision du diable", "devouring-blade": "Lame dévorante", "eldritch-mind": "Esprit occulte",
    "eldritch-smite": "Frappe occulte", "eldritch-spear": "Lance occulte", "fiendish-vigor": "Vigueur fiélonne",
    "gaze-of-two-minds": "Perception transférée", "gift-of-the-depths": "Présent des profondeurs",
    "gift-of-the-protectors": "Présent des sauveurs", "investment-of-the-chain-master": "Engagement du maître des chaînes",
    "lessons-of-the-first-ones": "Enseignement des Premiers-Nés", "lifedrinker": "Buveuse de vie",
    "mask-of-many-faces": "Mille visages", "master-of-myriad-forms": "Maître des formes", "misty-visions": "Visions embrumées",
    "one-with-shadows": "Maître des ombres", "otherworldly-leap": "Saut d’outre-monde", "pact-of-the-blade": "Pacte de la lame",
    "pact-of-the-chain": "Pacte de la chaîne", "pact-of-the-tome": "Pacte du grimoire", "repelling-blast": "Décharge répulsive",
    "thirsting-blade": "Lame assoiffée", "visions-of-distant-realms": "Royaumes lointains",
    "whispers-of-the-grave": "Murmures de la tombe", "witch-sight": "Vision sorcière",
}
INVOCATIONS_ES = {  # SP_SRD_CC_v5.2.1.pdf "Opciones de invocación sobrenatural" (pp. 42–44)
    "agonizing-blast": "Descarga agónica", "armor-of-shadows": "Armadura de sombras", "ascendant-step": "Paso ascendente",
    "devils-sight": "Vista del diablo", "devouring-blade": "Hoja devoradora", "eldritch-mind": "Mente sobrenatural",
    "eldritch-smite": "Castigo arcano", "eldritch-spear": "Lanza sobrenatural", "fiendish-vigor": "Vigor infernal",
    "gaze-of-two-minds": "Mirada de las dos mentes", "gift-of-the-depths": "Don de las profundidades",
    "gift-of-the-protectors": "Don de los protectores", "investment-of-the-chain-master": "Inversión del amo de las cadenas",
    "lessons-of-the-first-ones": "Lecciones de los primeros", "lifedrinker": "Devorador de vida",
    "mask-of-many-faces": "Máscara de los mil rostros", "master-of-myriad-forms": "Maestro de las formas innumerables",
    "misty-visions": "Visiones brumosas", "one-with-shadows": "Uno con las sombras", "otherworldly-leap": "Salto sobrenatural",
    "pact-of-the-blade": "Pacto del filo", "pact-of-the-chain": "Pacto de la cadena", "pact-of-the-tome": "Pacto del grimorio",
    "repelling-blast": "Descarga ahuyentadora", "thirsting-blade": "Filo sediento",
    "visions-of-distant-realms": "Visiones de reinos remotos", "whispers-of-the-grave": "Susurros del sepulcro",
    "witch-sight": "Visión bruja",
}
METAMAGIC_ES = {  # SP_SRD_CC_v5.2.1.pdf "Opciones de metamagia" (pp. 67–68)
    "careful-spell": "Conjuro cuidadoso", "distant-spell": "Conjuro distante", "empowered-spell": "Conjuro potenciado",
    "extended-spell": "Conjuro extendido", "heightened-spell": "Conjuro intensificado", "quickened-spell": "Conjuro acelerado",
    "seeking-spell": "Conjuro buscador", "subtle-spell": "Conjuro sutil", "transmuted-spell": "Conjuro transmutado",
    "twinned-spell": "Conjuro gemelo",
}
METAMAGIC_FR = {  # FR_SRD_CC_v5.2.1.pdf "Options de Métamagie"
    "careful-spell": "Sort prévenant", "distant-spell": "Sort ample", "empowered-spell": "Sort renforcé",
    "extended-spell": "Sort étendu", "heightened-spell": "Sort intensifié", "quickened-spell": "Sort accéléré",
    "seeking-spell": "Sort chercheur", "subtle-spell": "Sort subtil", "transmuted-spell": "Sort transmuté",
    "twinned-spell": "Sort jumeau",
}


def _spell_names_fr() -> dict[str, str]:
    import json
    p = common.OUT_SRD / "spells.json"
    if not p.exists():
        return {}
    # Spanish pass: the `es` names of the previous build (empty on the very first build: matching by numbers only)
    return {norm(sp["name"]["en"]): norm(sp["name"].get(common.LANG, "")) for sp in json.loads(p.read_text(encoding="utf-8"))
            if sp["name"].get(common.LANG)}


def _numbers(html: str, lang: str) -> list[float]:
    """Numbers of a text, distances turned into metres so that both languages compare (5 feet = 1,5 m)."""
    txt = re.sub(r"<[^>]+>", " ", html).replace("\u00a0", " ").replace("\u202f", " ")
    if lang == "en":
        txt2 = re.sub(r"(\d+(?:\.\d+)?)\s*(?:feet|foot|ft\.?)\b", lambda m: str(float(m.group(1)) * 0.3), txt)
        txt2 = re.sub(r"(\d+(?:\.\d+)?)\s*miles?\b", lambda m: str(float(m.group(1)) * 1.5), txt2)
    else:
        txt2 = re.sub(r"(\d),(\d)", r"\1.\2", txt)
    return sorted(round(float(n), 2) for n in re.findall(r"\d+(?:\.\d+)?", txt2))


def match_options(opts: list[dict], fr_opts: list[tuple[str, str, dict]], cid: str, key: str) -> None:
    """Metamagic / Eldritch Invocation options are alphabetical in each language: match by the numbers in the text (feet
    converted to metres), the italic spell names (through spells.json) and the paragraph count; Metamagic also has a fixed
    name map. What stays ambiguous is reported."""
    spells_fr = _spell_names_fr()

    def sig(html: str, lang: str) -> tuple:
        names = [norm(x) for x in re.findall(r"<em>(.+?)</em>", html)]
        if lang == "en":
            names = [spells_fr.get(n, n) for n in names]
        return tuple(_numbers(html, lang)), tuple(sorted(set(names))), html.count("<p")

    pool = list(fr_opts)
    for o in opts:
        maps = common.L(fr=(METAMAGIC_FR, INVOCATIONS_FR), es=(METAMAGIC_ES, INVOCATIONS_ES))
        fr_name = (maps[0] if key == "metamagic" else maps[1] if key == "eldritch-invocation" else {}).get(kebab(o["name"]["en"]))
        cands = [f for f in pool if fr_name and norm(f[0]) == norm(fr_name)]
        if not cands:
            s_en = sig(o["text"]["en"], "en")
            cands = [f for f in pool if sig(f[1], "fr") == s_en]
            if len(cands) != 1:
                cands = [f for f in pool if sig(f[1], "fr")[:2] == s_en[:2]]
        if len(cands) == 1:
            f = cands[0]
            o["name"]["fr"], o["text"]["fr"] = f[0], f[1]
            o["source"]["frPage"] = f[2]["page"]
            if "prereq" in o:
                pm = re.search(r"(?:Prérequis|Condition|Requisitos?)\s*:\s*(.+?)</", f[1], re.I)
                if pm:
                    o["prereq"]["fr"] = re.sub(r"<[^>]+>", "", pm.group(1)).strip()
            pool.remove(f)
    left = [o["name"]["en"] for o in opts if not o["name"]["fr"]]
    if left:
        note(f"{cid}: {key}: {len(left)} options without {common.LANG.upper()} match: {left}; left: {[f[0] for f in pool]}")
