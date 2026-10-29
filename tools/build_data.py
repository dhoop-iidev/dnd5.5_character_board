"""Regenerate src/data/srd/*.json from the extracted SRD 5.2.1 blocks (sources/extracted/{en,fr,es}.json).

Run:  C:/Users/le_re/miniforge3/python.exe tools/extract_srd.py   # once, after a change to srd_pdf.py
      C:/Users/le_re/miniforge3/python.exe tools/build_data.py     # idempotent
Each build_<kind>.py exposes build(en_blocks, foreign_blocks) -> dict[str, int] (file -> entry count) and writes its JSON
with common.write_json. The builders pair English with one translation (`common.LANG`), so they run twice:
  1. LANG = "fr" with the French blocks;
  2. LANG = "es" with the Spanish blocks (modules reloaded so that module-level vocabularies follow LANG);
then the Spanish pass is merged into the French one: wherever an I18n {en, fr} of the French pass has a twin with the same
English text in the Spanish pass, the twin's translation becomes `es`; each `source` gets `esPage`. A twin whose English
text differs (the two passes disagree on the structure) is reported, never merged. Prints a Spanish coverage report.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

BUILDERS = [
    "build_rules",      # proficiency bonus, XP, multiclass slots, ability scores, skills, conditions/glossary
    "build_classes",    # 12 classes, subclasses, class spell lists
    "build_origins",    # species, backgrounds
    "build_feats",
    "build_equipment",  # weapons, armor, tools, gear, mounts
    "build_spells",
    "build_magic_items",
    "build_creatures",  # animals (beasts) and monsters
]


def run_pass(lang: str, en: list[dict], only: list[str] | None = None) -> tuple[dict[str, object], dict[str, str], list[str]]:
    common.LANG = lang
    common.CAPTURE = {}
    common.NOTES.clear()
    foreign = common.load_blocks(lang)
    counts: dict[str, str] = {}
    for name in BUILDERS:
        if only and name not in only:
            continue
        mod = importlib.reload(importlib.import_module(name))
        c = mod.build(en, foreign)
        counts[name] = ", ".join(f"{k} {v}" for k, v in c.items())
    out, notes = common.CAPTURE, list(common.NOTES)
    common.CAPTURE = None
    common.LANG = "fr"
    return out, counts, notes


def is_i18n(v) -> bool:
    return (isinstance(v, dict) and "en" in v and "fr" in v and set(v) <= {"en", "fr", "es"}
            and all(isinstance(x, str) for x in v.values()))


class Merge:
    def __init__(self) -> None:
        self.total = 0  # I18n with a non-empty English text
        self.filled = 0  # ... that received a Spanish text
        self.mismatch: list[str] = []
        self.missing: list[str] = []
        self.suspect: list[str] = []  # Spanish text equal to the English one (a fallback?) or to the French one

    def walk(self, fr, es, path: str) -> None:
        if is_i18n(fr):
            if not fr["en"].strip():
                return
            self.total += 1
            if is_i18n(es) and es["en"] == fr["en"]:
                if es["fr"].strip():
                    fr["es"] = es["fr"]
                    self.filled += 1
                    t = es["fr"]
                    if sum(c.isalpha() for c in t) >= 4 and ((t == fr["en"] != fr["fr"]) or (t == fr["fr"] != fr["en"])):
                        self.suspect.append(f"{path}: {t[:60]!r} (same as {'EN' if t == fr['en'] else 'FR'})")
                else:
                    self.missing.append(path)
            else:
                other = es.get("en") if isinstance(es, dict) else es
                self.mismatch.append(f"{path}: {fr['en'][:50]!r} vs {str(other)[:50]!r}")
            return
        if isinstance(fr, dict):
            if not isinstance(es, dict):
                es = {}
            if path.split(".")[-1] == "source" and "frPage" in es:
                fr["esPage"] = es["frPage"]
            for k, v in list(fr.items()):
                self.walk(v, es.get(k), f"{path}.{k}" if path else k)
            return
        if isinstance(fr, list):
            es = es if isinstance(es, list) else []
            if fr and all(isinstance(x, dict) and "id" in x for x in fr):
                by_id = {x.get("id"): x for x in es if isinstance(x, dict)}
                for x in fr:
                    self.walk(x, by_id.get(x["id"]), f"{path}[{x['id']}]")
            else:
                for i, x in enumerate(fr):
                    self.walk(x, es[i] if i < len(es) else None, f"{path}[{i}]")


def main(argv: list[str]) -> int:
    only = [a for a in argv if a.startswith("build_")] or None  # e.g. `build_data.py build_feats`: those builders only
    verbose = "-v" in argv
    en = common.load_blocks("en")
    fr_out, fr_counts, fr_notes = run_pass("fr", en, only)
    for name, c in fr_counts.items():
        print(f"{name}: {c}")
    es_out, _, es_notes = run_pass("es", en, only)
    report = []
    for fname, data in fr_out.items():
        m = Merge()
        m.walk(data, es_out.get(fname), "")
        common.write_json(common.OUT_SRD / fname, data)
        report.append((fname, m))
    for title, notes in (("French pass", fr_notes), ("Spanish pass", es_notes)):
        if notes:
            print(f"\n{len(notes)} notes ({title}):")
            for n in notes:
                print(" -", n)
    print("\nSpanish coverage (I18n fields with an English text that have `es`):")
    for fname, m in report:
        pct = 100 * m.filled / m.total if m.total else 100
        print(f"  {fname:24} {m.filled:6} / {m.total:6}  {pct:5.1f} %   "
              f"(no Spanish text {len(m.missing)}, structure mismatch {len(m.mismatch)}, same as EN/FR {len(m.suspect)})")
        for x in (m.mismatch + m.missing + m.suspect) if verbose else (m.mismatch[:3] + m.missing[:3] + m.suspect[:3]):
            print("      ", x)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
