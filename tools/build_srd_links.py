"""Map every `source.section` of the data to a paragraph of https://5e24srd.com (SRD 5.2.1 as HTML, CC-BY-4.0).

Popups show "SRD 5.2.1 p. 29 / FR p. 31" with a link to the matching heading of 5e24srd.com (src/ui/SourceLink.svelte,
resolved by src/data/links.ts). This script:

1. crawls the site politely (sequential requests, a delay, at most MAX_PAGES pages) and caches the HTML under
   sources/5e24srd/ (gitignored); later runs read the cache (`--refresh` downloads again);
2. collects the heading ids and texts of every page;
3. collects every distinct `source.section` of src/data/srd/*.json, src/data/custom/**/*.json and the engine `SRC_*`
   constants (`section: '...'` in src/engine), plus "<section> > <entity name>" for entries whose section is only a
   chapter ("Spells", "Weapons", "Rules Glossary"...: the popup passes the entry's English name), plus "p. <page>"
   for entries without a section;
4. maps each to the best URL: the exact heading inside the right page, else the deepest parent heading found, else the
   page; chapters the site doesn't cover (Rules Glossary, monsters, animals) go to the closest page that exists or get
   no URL;
5. writes src/data/srd/links.json { "<key>": "<relative url#anchor>" } and prints a coverage report.

Usage: python tools/build_srd_links.py [--refresh]
"""

from __future__ import annotations

import glob
import html
import json
import re
import sys
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "sources" / "5e24srd"
OUT = ROOT / "src" / "data" / "srd" / "links.json"
SITE = "https://5e24srd.com/"
FOLDERS = ["playing-the-game", "character-creation", "character-origins", "classes", "equipment", "feats", "spells"]
MAX_PAGES = 60
DELAY = 1.0
UA = "dnd5.5-playboard link builder (personal, one-off crawl)"


# ---------------------------------------------------------------- crawl


def fetch(rel: str, refresh: bool) -> str:
    path = CACHE / rel
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")
    req = urllib.request.Request(SITE + rel, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    time.sleep(DELAY)
    return text


def crawl(refresh: bool) -> dict[str, str]:
    """{ 'classes/barbarian.html': html } for the section indexes and every page they list."""
    pages: dict[str, str] = {}
    for folder in FOLDERS:
        rel = f"{folder}/index.html"
        pages[rel] = fetch(rel, refresh)
        for href in sorted(set(re.findall(r'href="([a-z0-9-]+\.html)"', pages[rel]))):
            if href == "index.html":
                continue
            sub = f"{folder}/{href}"
            if sub not in pages and len(pages) < MAX_PAGES:
                pages[sub] = fetch(sub, refresh)
    return pages


# ---------------------------------------------------------------- headings


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", html.unescape(s)).lower()
    s = re.sub(r"\(.*?\)", "", s)  # "Backpack (2 GP)", "Stone of Good Luck (Luckstone)"
    return re.sub(r"[^a-z0-9]+", "", s)


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


class Page:
    """Headings of one page [(id, text, normalized)] and its table cells / bold runs [(index of the heading above,
    normalized text)]."""

    def __init__(self, url: str, page_html: str):
        self.url = url
        self.heads: list[tuple[str, str, str]] = []
        marks: list[tuple[int, str]] = []
        for m in re.finditer(r'<h([1-6])[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>', page_html, re.S):
            text = strip_tags(m.group(3))
            self.heads.append((m.group(2), text, norm(text)))
            marks.append((m.start(), m.group(2)))
        # Weapons, armor, mounts, food, rarities, actions are table rows or bold run-in terms on the site.
        self.terms: list[tuple[int, str]] = []
        for m in re.finditer(r"<(td|strong|em|b)>(.*?)</\1>", page_html, re.S):
            above = [i for i, (pos, _) in enumerate(marks) if pos < m.start()]
            n = norm(strip_tags(m.group(2)))
            if above and n:
                self.terms.append((above[-1], n))

    def term(self, n: str, after: int) -> str | None:
        """Heading id above the first cell / bold run reading `n` (or its plural) under heading index `after`."""
        for i, t in self.terms:
            if i >= after and t in (n, n + "s"):
                return self.heads[i][0]
        return None


# ---------------------------------------------------------------- sources in the data


page_hint: dict[str, str] = {}


def collect() -> tuple[Counter, dict[str, int]]:
    """Counter of link keys (with how many data entries use each) and the page of each key (for the page fallback)."""
    keys: Counter = Counter()
    page_of: dict[str, int] = {}

    def add(key: str, page) -> None:
        keys[key] += 1
        if page and key not in page_of:
            page_of[key] = page

    def walk(o) -> None:
        if isinstance(o, dict):
            s = o.get("source")
            if isinstance(s, dict) and not s.get("houseRule"):
                sec, page = s.get("section"), s.get("page")
                if sec:
                    add(sec, page)
                    name = o.get("name")
                    if isinstance(name, dict) and isinstance(name.get("en"), str) and " > " not in sec:
                        add(f"{sec} > {name['en']}", page)
                elif page:
                    add(f"p. {page}", page)
                    pfile[f"p. {page}"][stem] += 1
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    files = glob.glob(str(ROOT / "src/data/srd/*.json")) + glob.glob(str(ROOT / "src/data/custom/**/*.json"), recursive=True)
    pfile: dict[str, Counter] = defaultdict(Counter)  # "p. 86" -> { file stem: count }
    for f in files:
        stem = Path(f).stem
        if Path(f).name == "links.json":
            continue
        walk(json.loads(Path(f).read_text(encoding="utf-8")))
    for f in glob.glob(str(ROOT / "src/engine/**/*.ts"), recursive=True):
        text = Path(f).read_text(encoding="utf-8")
        for m in re.finditer(r"page:\s*(\d+)[^}]*?section:\s*'([^']+)'", text, re.S):
            add(m.group(2), int(m.group(1)))
        for m in re.finditer(r"section:\s*'([^']+)'", text):
            if m.group(1) not in keys:
                add(m.group(1), None)
    # A page shared by two chapters (p. 86: species and feats; p. 88: feats and equipment): the file of the entries
    # without section tells which one ("p. 86" entries are species traits in effects/species.json).
    for key, stems in pfile.items():
        chapter = {"species": "character-origins/character-species.html", "feats": "feats/index.html"}
        top = stems.most_common(1)[0][0]
        if top in chapter:
            page_hint[key] = chapter[top]
    return keys, page_of


# ---------------------------------------------------------------- mapping

CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer",
           "warlock", "wizard"]

# First path component (SRD chapter or equipment table) -> the pages where its headings live.
CHAPTER_PAGES: dict[str, list[str]] = {
    "playing the game": ["playing-the-game/*"],
    "character creation": ["character-creation/*"],
    "character advancement": ["character-creation/level-advancement.html"],
    "character origins": ["character-origins/*"],
    "skills": ["playing-the-game/proficiency.html", "playing-the-game/the-six-abilities.html"],
    "feats": ["feats/index.html"],
    "spells": ["spells/spell-descriptions.html", "spells/gaining-and-casting-spells.html"],
    "weapons": ["equipment/weapons.html"],
    "armor": ["equipment/armor.html"],
    "equipment": ["equipment/*"],
    "ammunition": ["equipment/adventuring-gear.html", "equipment/weapons.html"],
    "mounts and other animals": ["equipment/mounts-and-vehicles.html"],
    "tack, harness, and drawn vehicles": ["equipment/mounts-and-vehicles.html"],
    "airborne and waterborne vehicles": ["equipment/mounts-and-vehicles.html"],
    "food, drink, and lodging": ["equipment/food-drink-and-lodging.html"],
    "lifestyle expenses": ["equipment/lifestyle-expenses.html"],
    "hirelings": ["equipment/hirelings-and-spellcasting-services.html"],
    "spellcasting": ["equipment/hirelings-and-spellcasting-services.html"],
    "magic items": ["equipment/magic-items.html"],
    "magic item rarities and values": ["equipment/magic-items.html"],
    # Not on the site (checked against its sitemap.xml, 2026-10-26): the Rules Glossary, the Gameplay Toolbox, the
    # magic-item catalog, the monsters and animals. A glossary term is looked for in "Playing the Game" (many terms
    # have a heading or a bold run-in there); otherwise it gets the closest page below.
    "rules glossary": ["playing-the-game/*", "spells/gaining-and-casting-spells.html"],
    "monsters a–z": [],
    "animals": [],
}
CLOSEST_PAGE = {"rules glossary": "playing-the-game/index.html", "magic items": "equipment/magic-items.html"}


def expand(pats: list[str], all_pages: list[str]) -> list[str]:
    out: list[str] = []
    for pat in pats:
        if pat.endswith("/*"):
            out += [p for p in all_pages if p.startswith(pat[:-1]) and p not in out]
        elif pat not in out:
            out.append(pat)
    return out


def split_key(key: str, page: int | None, all_pages: list[str]) -> tuple[str, list[str], list[str]]:
    """(chapter, pages to search, path components to find in them)."""
    parts = [p.strip() for p in key.split(" > ")]
    head = parts[0].lower()
    if head == "classes" and len(parts) > 1:
        cls = parts[1].replace(" Class Features", "")
        page_ = f"classes/{cls.lower()}.html"
        return head, ([page_] if cls.lower() in CLASSES else expand(["classes/*"], all_pages)), [cls] + parts[2:]
    if head.startswith("spells: "):  # stat block of a summoning spell: "Spells: Find Steed"
        return "spells", ["spells/spell-descriptions.html"], [parts[0][len("spells: "):]] + parts[1:]
    if head in CHAPTER_PAGES:
        return head, expand(CHAPTER_PAGES[head], all_pages), parts[1:]
    # A lone item name used as section (adventuring gear, magic items, weapon properties).
    if page and page >= 204:
        return "magic items", expand(["equipment/*"], all_pages), parts
    return "", all_pages, parts


def match_heads(pg: Page, comps: list[str]) -> tuple[int, int]:
    """Deepest component found as a heading, each one searched after the previous match (so 'Path of the
    Berserker > Level 3: Frenzy' finds the subclass's heading, not a homonym above it)."""
    start, depth_found = 0, -1
    for depth, comp in enumerate(comps):
        n = norm(comp)
        if not n:
            continue
        for i in range(start, len(pg.heads)):
            hid, text, hn = pg.heads[i]
            # Exact, plural ("Critical Hit" / "Critical Hits"), or "Barbarian Subclass: Path of the Berserker".
            # The site sometimes glues words to a heading ("Fighter Subclass: Champion Pursue"): long prefixes match.
            if (hn in (n, n + "s") or n == hn + "s" or (len(n) > 5 and ":" in text and hn.endswith(n))
                    or (len(n) >= 12 and hn.startswith(n))):
                start, depth_found = i + 1, depth
                break
    return depth_found, start - 1  # (deepest component found, index of its heading; -1 when none)


def best(key: str, page: int | None, pages: dict[str, Page]) -> tuple[str | None, str]:
    if key.startswith("p. "):
        return None, "none"  # page fallback only
    all_pages = list(pages)
    head, cands, comps = split_key(key, page, all_pages)
    # "Acid (25 GP) > Acid": the entry name repeats its section.
    comps = [c for i, c in enumerate(comps) if i == 0 or norm(c) != norm(comps[i - 1])]
    if not comps:  # the chapter itself
        if cands:
            return (cands[0] if len(cands) <= 2 else f"{cands[0].split('/')[0]}/index.html"), "page"
        return None, "none"
    hit: tuple[int, str, int] | None = None  # (depth, url, heading index)
    for url in cands:
        depth, i = match_heads(pages[url], comps)
        if depth >= 0 and (hit is None or depth > hit[0]):
            hit = (depth, url, i)
    if hit and hit[0] == len(comps) - 1:
        return f"{hit[1]}#{pages[hit[1]].heads[hit[2]][0]}", "exact"
    # The last component as a table row or bold run-in term, under the parent heading found (the paragraph is the
    # heading above it): "Weapons > Longsword" -> Martial Melee Weapons, "Elf > Trance" -> Elf.
    n = norm(comps[-1])
    for url in ([hit[1]] if hit else cands):
        hid = pages[url].term(n, hit[2] if hit else 0)
        if hid:
            return f"{url}#{hid}", "parent"
    if hit:
        return f"{hit[1]}#{pages[hit[1]].heads[hit[2]][0]}", "parent"
    if head == "rules glossary" and len(comps) == 1:
        # A term with no heading of its own: a heading starting with it, else naming it as a whole word
        # ("Resistance" -> "Resistance and Vulnerability", "Prone" -> "Dropping Prone", "Unconscious" -> "Falling
        # Unconscious"): the nearest paragraph the site has (it has no glossary).
        term = " " + re.sub(r"[^a-z]+", " ", comps[0].lower()).strip() + " "
        if len(term) >= 7:
            for test in (lambda t: t.startswith(term), lambda t: term in t):
                for url in cands:
                    for hid, text, _ in pages[url].heads:
                        if test(" " + re.sub(r"[^a-z]+", " ", text.lower()).strip() + " "):
                            return f"{url}#{hid}", "parent"
    if head in CLOSEST_PAGE:
        return CLOSEST_PAGE[head], "page"
    if head and cands:
        return (cands[0] if len(cands) <= 2 else f"{cands[0].split('/')[0]}/index.html"), "page"
    return None, "none"


def page_fallback(page: int) -> str | None:
    """SRD 5.2.1 English PDF page -> site page, from the chapter bookmarks of SRD_CC_v5.2.1.pdf."""
    ranges = [
        (5, "playing-the-game/index.html"),
        (19, "character-creation/index.html"),
        (28, "classes/index.html"),
        (82, "character-origins/index.html"),
        (83, "character-origins/character-backgrounds.html"),
        (84, "character-origins/character-species.html"),
        (86, "feats/index.html"),
        (88, "equipment/index.html"),
        (103, "spells/index.html"),
        (176, CLOSEST_PAGE["rules glossary"]),  # Rules Glossary: not on the site
        (192, None),  # Gameplay Toolbox: not on the site
        (204, "equipment/magic-items.html"),  # Magic Items: the site has the rules, not the catalog
        (254, None),  # Monsters, Monsters A–Z, Animals: not on the site
    ]
    url = None
    for first, u in ranges:
        if page >= first:
            url = u
    return url


def main() -> None:
    refresh = "--refresh" in sys.argv
    pages = {url: Page(url, text) for url, text in crawl(refresh).items()}
    print(f"{len(pages)} pages, {sum(len(p.heads) for p in pages.values())} headings")
    keys, page_of = collect()
    links: dict[str, str] = {}
    stats: Counter = Counter()
    entries: Counter = Counter()
    listed: dict[str, list[str]] = defaultdict(list)
    for key in sorted(keys):
        url, kind = best(key, page_of.get(key), pages)
        if url is None and key in page_of:
            url = page_hint.get(key) or page_fallback(page_of[key])
            kind = "page" if url else "none"
        stats[kind] += 1
        entries[kind] += keys[key]
        if url:
            links[key] = url
        listed[kind].append(f"{key} -> {url}")
    OUT.write_text(json.dumps(links, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(links)} links")
    print("coverage (distinct keys / data entries using them):")
    for kind in ("exact", "parent", "page", "none"):
        print(f"  {kind:6} {stats[kind]:5} / {entries[kind]}")
    for kind in ("page", "none"):
        by_head = Counter(k.split(" -> ")[0].split(" > ")[0] for k in listed[kind])
        print(f"{kind}, by first component:", dict(by_head.most_common(12)))
    if "-v" in sys.argv:
        for kind in ("parent", "page", "none"):
            for k in listed[kind]:
                print(f"  [{kind}] {k}")


if __name__ == "__main__":
    main()
