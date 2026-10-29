"""Find a phrase in the SRD 5.2.1 PDFs (English and French) and print the pages it appears on.

Run:  C:/Users/le_re/miniforge3/python.exe tools/srd_find.py "Unarmored Defense" [--fr] [--context]
Every citation in the data and the docs must come from here (page numbers of SRD_CC_v5.2.1.pdf / FR_SRD_CC_v5.2.1.pdf).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF_EN = ROOT / "sources" / "SRD_CC_v5.2.1.pdf"
PDF_FR = ROOT / "sources" / "FR_SRD_CC_v5.2.1.pdf"


def norm(s: str) -> str:
    """Case-insensitive, hyphenation and whitespace tolerant comparison key."""
    s = s.replace("\u00ad", "").replace("-\n", "").replace("’", "'")
    return re.sub(r"\s+", " ", s).lower()


def find(pdf: Path, phrase: str, context: bool) -> list[int]:
    doc = fitz.open(pdf)
    key = norm(phrase)
    pages = []
    for i, page in enumerate(doc):
        text = norm(page.get_text())
        if key in text:
            pages.append(i + 1)
            if context:
                j = text.index(key)
                print(f"  p.{i + 1}: …{text[max(0, j - 80): j + len(key) + 80]}…")
    return pages


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    phrase = " ".join(args)
    context = "--context" in argv
    for label, pdf in (("EN", PDF_EN), ("FR", PDF_FR)):
        if "--fr" in argv and label == "EN":
            continue
        if "--en" in argv and label == "FR":
            continue
        pages = find(pdf, phrase, context)
        print(f"{label} {pdf.name}: {phrase!r} on pages {pages or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
