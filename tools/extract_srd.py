"""Extract the three SRD 5.2.1 PDFs into ordered blocks: sources/extracted/{en,fr,es}.json (gitignored, rebuilt on demand).

Run:  C:/Users/le_re/miniforge3/python.exe tools/extract_srd.py
Then compare the heading structure of the French and Spanish extractions with the English one (counts per chapter) and print mismatches.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import srd_pdf  # noqa: E402

OUT = srd_pdf.ROOT / "sources" / "extracted"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    data = {}
    for lang in ("en", "fr", "es"):
        blocks = srd_pdf.extract(lang)
        tmp = OUT / f"{lang}.json.tmp"  # written aside, then swapped in: other scripts may be reading the file
        tmp.write_text(json.dumps(blocks, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(OUT / f"{lang}.json")
        data[lang] = blocks
        c = Counter(b["kind"] for b in blocks)
        print(lang, dict(sorted(c.items())))
    # structure comparison per chapter
    def chapters(blocks):
        out, cur = [], None
        for b in blocks:
            if b["kind"] == "chapter":
                cur = {"title": b["text"], "page": b["page"], "counts": Counter()}
                out.append(cur)
            elif cur is not None:
                cur["counts"][b["kind"]] += 1
        return out
    ce = chapters(data["en"])
    for other in ("fr", "es"):
        cf = chapters(data[other])
        o = other.upper()
        print(f"\n{'EN chapter':28} {'p':>4} | {o + ' chapter':34} {'p':>4} | h1 h2 h3 h4 tables (EN/{o})")
        for e, f in zip(ce, cf):
            cells = " ".join(f"{e['counts'][k]}/{f['counts'][k]}" for k in ("h1", "h2", "h3", "h4", "table"))
            flag = "" if all(e["counts"][k] == f["counts"][k] for k in ("h1", "h2", "h3", "table")) else "  <-- differs"
            print(f"{e['title'][:28]:28} {e['page']:>4} | {f['title'][:34]:34} {f['page']:>4} | {cells}{flag}")
        if len(ce) != len(cf):
            print("chapter counts differ:", len(ce), len(cf))
    return 0


if __name__ == "__main__":
    sys.exit(main())
