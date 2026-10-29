"""SRD 5.2.1 PDF -> ordered blocks (headings, paragraphs, bullets, fields, tables, sidebars, stat-block lines).

Both PDFs (English `SRD_CC_v5.2.1.pdf`, official French `FR_SRD_CC_v5.2.1.pdf`) share one InDesign layout:
  - headings: GillSans-SemiBold 26 (chapter), 18 (h1), 14 (h2), 12 (h3), 10.5 (h4 / table title);
  - tables: header cells GillSans-SemiBold 9.2 (or 9.5), body cells GillSans 9.5 (Italic 9.5 = section row);
  - key: value lines in the table font (spell "Casting Time:", species "Creature Type:") are "field" blocks, not tables;
  - body text: Cambria (EN 10 pt, FR 9.5 pt); run-in sub-headings Cambria-Bold / Cambria-BoldItalic; italics Cambria-Italic;
  - sidebars: GillSans 9 with a GillSans-Bold-SC700 small-caps title;
  - stat blocks (Monsters, Animals): Optima fonts and a small-caps ability table (kept as raw "stat" lines with their x).
Pages have two columns (x < 300 / x >= 313); a wide table or heading spans both and splits the page into bands.
Lines are ordered by their baseline (span "origin": the bbox of headings is offset by the font metrics).
Text is rebuilt with light markup: **bold** for run-in headings, *italic* for italics; hyphenation at line ends is undone
when the next line starts with a lowercase letter. A new paragraph starts at a tab/indent/bullet/bold run-in, or after a
short line that ends with sentence punctuation; bullets and run-in paragraphs have a hanging indent.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDFS = {"en": ROOT / "sources" / "SRD_CC_v5.2.1.pdf", "fr": ROOT / "sources" / "FR_SRD_CC_v5.2.1.pdf", "es": ROOT / "sources" / "SP_SRD_CC_v5.2.1.pdf"}

COL_SPLIT = 300  # x of the gutter between the two columns
COL_X0 = (63, 313)  # left edge of each column
COL_X1 = (291, 542)  # right edge of each column
FOOTER_Y = 735
HEADING_SIZES = {26.0: "chapter", 18.0: "h1", 14.0: "h2", 12.0: "h3", 10.5: "h4"}
HEADING_PITCH = {"chapter": 36, "h1": 25, "h2": 20, "h3": 17, "h4": 15}
ROW_GAP = 13.5  # baseline gap: >= new table row, < continuation line of a multi-line cell
COL_CLUSTER = 25  # x0 values closer than this (chained) belong to the same table column
END_PUNCT = tuple(".!?:»”)")
# Spell headers (and similar key: value lines) are set in the table font but are not tables.
FIELD_RE = re.compile(r"^(Casting Time|Range|Components?|Duration|Ability|Utilize|Craft|Weight|Variants"
                      r"|Temps d[’']incantation|Portée|Composantes|Durée|Caractéristique|Utilisation|Artisanat|Poids|Variantes"
                      r"|Tiempo de lanzamiento|Alcance|Componentes?|Duración|Característica|Utilizar|Fabricar|Peso|Variantes)\s*:")


@dataclass
class Span:
    font: str
    size: float
    text: str
    x0: float
    x1: float


@dataclass
class Line:
    page: int
    x0: float
    x1: float
    yb: float  # baseline
    spans: list[Span]
    kind: str = ""  # chapter h1 h2 h3 h4 th td field field-cont body aside aside-title stat stat-h figure skip

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def col(self) -> int:
        return 0 if self.x0 < COL_SPLIT else 1

    @property
    def wide(self) -> bool:
        return self.x0 < COL_SPLIT and self.x1 > COL_SPLIT + 20

    @property
    def italic(self) -> bool:
        return all("Italic" in s.font for s in self.spans if s.text.strip())

    def frags(self) -> list[tuple[float, str, float]]:
        """Cell fragments (x0, text, x1): runs of adjacent spans (a font change inside a cell doesn't split it)."""
        out: list[tuple[float, str, float]] = []
        for s in self.spans:
            t = s.text.replace("\t", "")
            if not t.strip():
                continue
            if out and s.x0 - out[-1][2] < 7 and not out[-1][1].rstrip().endswith("—") and not t.lstrip().startswith("—"):
                out[-1] = (out[-1][0], out[-1][1] + t, s.x1)
            else:
                out.append((s.x0, t, s.x1))
        return [(x, t.strip(), x1) for x, t, x1 in out]


@dataclass
class Block:
    kind: str  # chapter h1 h2 h3 h4 p li field table aside stat stat-h
    text: str = ""
    page: int = 0
    title: str = ""
    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    lines: list[str] = field(default_factory=list)
    font: str = ""
    x: int = 0
    table: "Table | None" = None
    seeds: list = field(default_factory=list)
    frags: list = field(default_factory=list)

    def to_json(self) -> dict:
        d = {"kind": self.kind, "page": self.page}
        if self.kind == "table":
            d.update(title=self.title, header=self.header, rows=self.rows)
        elif self.kind == "aside":
            d.update(title=self.title, lines=self.lines)
        else:
            d["text"] = self.text
            if self.font:
                d["font"] = self.font
                d["x"] = self.x
                d["f"] = self.frags
        return d


# ---------- 1. lines ----------

def classify(line: Line) -> str:
    s = line.spans[0]
    f, sz = s.font, round(s.size, 1)
    text = line.text.strip()
    if line.yb > FOOTER_Y + 10:
        return "skip"
    if f == "GillSans-SemiBold" and sz in HEADING_SIZES:
        return HEADING_SIZES[sz]
    if sz == 11.0 and f in ("GillSans-SemiBold", "GillSans"):
        return "skip"  # page number and running title
    if f.startswith("GillSans") and sz in (9.2, 9.5) and "SC700" not in f and FIELD_RE.match(text):
        return "field"
    if f == "GillSans-SemiBold" and sz in (9.2, 9.5):
        return "th"
    if f.startswith("GillSans") and sz == 9.5 and "SC700" not in f:
        return "td"
    if f.startswith("Cambria"):
        return "body"
    if "SC700" in f and sz >= 10.5:
        return "aside-title"
    if f.startswith("GillSans") and sz == 9.0 and "SC700" not in f:
        return "aside"
    if f.startswith("Optima") or ("SC700" in f and sz < 10.5) or (f == "GillSans" and sz in (6.0, 9.8)):
        return "stat"
    if f == "GillSans" and sz == 12.0:
        return "stat-h"
    if f in ("GillSans", "GillSans-SemiBold") and sz == 10.0:
        return "field" if ":" in text else "figure"
    return "body"


def page_lines(page: fitz.Page, pno: int) -> list[Line]:
    out: list[Line] = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            raw = [s for s in l["spans"] if s["text"]]
            if not raw or not "".join(s["text"] for s in raw).strip():
                continue
            spans = [Span(s["font"], s["size"], s["text"], s["bbox"][0], s["bbox"][2]) for s in raw]
            x0, _, x1, _ = l["bbox"]
            ln = Line(pno, x0, x1, raw[0]["origin"][1], spans)
            ln.kind = classify(ln)
            if ln.kind != "skip":
                out.append(ln)
    # A table-font line just under a field line (same column, same left edge) continues that field's value.
    fields = [l for l in out if l.kind == "field"]
    changed = True
    while changed:
        changed = False
        for l in out:
            if l.kind in ("td", "figure") and any(0 < l.yb - f.yb < 14 and abs(l.x0 - f.x0) < 25 for f in fields):
                l.kind = "field-cont"
                fields.append(l)
                changed = True
    return out


# ---------- 2. tables from th/td lines ----------

@dataclass
class Table:
    page: int
    x0: float
    x1: float
    y0: float
    y1: float
    cells: list[Line]
    title: str = ""

    @property
    def wide(self) -> bool:
        return self.x0 < COL_SPLIT and self.x1 > COL_SPLIT + 20

    @property
    def col(self) -> int:
        return 0 if self.x0 < COL_SPLIT else 1


def group_tables(lines: list[Line]) -> tuple[list[Table], list[Line]]:
    """Baseline rows of th/td cells are chained into tables. A row is wide when a cell crosses the gutter or a header row has
    cells in both columns; wide rows open or continue a wide table. Other rows are split by column, each part joining the
    open table of its column (or an open wide table just above) when no text line lies between and the gap is small, so
    two tables side by side with aligned baselines stay apart."""
    cells = [l for l in lines if l.kind in ("th", "td")]
    rest = [l for l in lines if l.kind not in ("th", "td")]
    rows: list[tuple[float, list[Line]]] = []
    for c in sorted(cells, key=lambda l: l.yb):
        if rows and abs(rows[-1][0] - c.yb) < 4:
            rows[-1][1].append(c)
        else:
            rows.append((c.yb, [c]))

    def text_between(y0: float, y1: float, reg: str) -> bool:
        for l in rest:
            if y0 < l.yb < y1 and l.kind != "figure":
                if reg == "wide" or (l.x0 < COL_SPLIT) == (reg == "0") or l.wide:
                    return True
        return False

    open_tables: dict[str, list[tuple[float, list[Line]]]] = {}
    tables: list[list[tuple[float, list[Line]]]] = []

    def attach(reg: str, y: float, ls: list[Line], max_gap: float = 40) -> None:
        target = open_tables.get(reg)
        if target is None or y - target[-1][0] >= max_gap or text_between(target[-1][0], y, reg):
            target = []
            if reg == "wide":
                # A header line of the wide table may sit in one column alone (e.g. "Proficiency" above "Bonus"):
                # absorb a header-only column table just above.
                for c in ("0", "1"):
                    t = open_tables.pop(c, None)
                    if t and y - t[-1][0] < 16 and all(l.kind == "th" for _, row in t for l in row):
                        tables.remove(t)
                        target.extend(t)
            else:
                open_tables.pop("wide", None)
            tables.append(target)
            open_tables[reg] = target
        target.append((y, ls))

    for y, ls in rows:
        parts = {"0": [l for l in ls if l.x0 < COL_SPLIT], "1": [l for l in ls if l.x0 >= COL_SPLIT]}
        crossing = any(l.x0 < COL_SPLIT < l.x1 - 20 for l in ls)
        # A header row with cells in both columns is one wide table, unless each column has its own table title just
        # above (two tables that happen to start at the same baseline).
        titled = [any(l.kind == "h4" and 0 < y - l.yb < 22 and (l.x0 < COL_SPLIT) == (c == "0") for l in rest) for c in ("0", "1")]
        wide_header = all(l.kind == "th" for l in ls) and parts["0"] and parts["1"] and not all(titled)
        w = open_tables.get("wide")
        if crossing or wide_header:
            attach("wide", y, ls)
        elif w and y - w[-1][0] < 16 and not text_between(w[-1][0], y, "wide"):
            w.append((y, ls))  # plain row of a wide table (no cell happens to cross the gutter)
        else:
            for reg, part in parts.items():
                if part:
                    attach(reg, y, part)
    out: list[Table] = []
    for t in tables:
        ls = [l for _, row in t for l in row]
        out.append(Table(ls[0].page, min(l.x0 for l in ls), max(l.x1 for l in ls), min(l.yb for l in ls) - 9,
                         max(l.yb for l in ls) + 3, ls))
    out.sort(key=lambda t: (t.y0, t.x0))
    return out, rest


def table_cells(t: Table, seeds: list | None = None) -> tuple[list[str], list[list[str]], list]:
    """Columns = header cells (or chained clusters of the cells' x0, or the `seeds` of the table this one continues);
    header = leading all-th rows; a body row is new when the baseline gap is >= ROW_GAP; a single italic cell is a section
    row, marked "§ ". A table whose header repeats (two halves side by side) is read left half then right half."""
    th_all = [f for l in t.cells if l.kind == "th" for f in l.frags()]
    labels = [f[1] for f in sorted(th_all, key=lambda f: f[0])]
    if len(labels) >= 4 and len(labels) % 2 == 0 and labels[: len(labels) // 2] == labels[len(labels) // 2:]:
        half = len(labels) // 2
        xs_sorted = sorted(f[0] for f in th_all)
        mid = (xs_sorted[half - 1] + xs_sorted[half]) / 2
        left = [l for l in t.cells if l.x0 < mid]
        right = [l for l in t.cells if l.x0 >= mid]
        if left and right:
            lt = Table(t.page, t.x0, mid, t.y0, t.y1, left)
            rt = Table(t.page, mid, t.x1, t.y0, t.y1, right)
            h1, r1, s1 = table_cells(lt)
            h2, r2, _ = table_cells(rt)
            return h1 or h2, r1 + r2, s1
    # Column seeds: the header cells when there is a header row (matched by left edge or by centre, so both left-aligned
    # text and centred numbers land in the right column); otherwise chained clusters of every cell's left edge.
    def spanning(f):
        return sum(1 for g in th_all if g is not f and g[0] < f[2] - 2 and g[2] > f[0] + 2 and abs(g[0] - f[0]) > 6) >= 2

    th_frags = [f for f in th_all if not spanning(f)]
    # Header seeds only when the table has a header row (a baseline row made of th cells only); a key/value table
    # (th keys beside td values) is clustered like a header-less one.
    y_top = min(l.yb for l in t.cells)
    has_header_row = all(l.kind == "th" for l in t.cells if abs(l.yb - y_top) < 4)
    if seeds:
        pass
    elif th_frags and has_header_row:
        groups: list[list[tuple[float, str, float]]] = []
        for f in sorted(th_frags, key=lambda f: f[0]):
            if groups and (abs(f[0] - groups[-1][0][0]) < 14 or f[0] < max(g[2] for g in groups[-1]) - 4):
                groups[-1].append(f)
            else:
                groups.append([f])
        seeds = [(min(f[0] for f in g), sum((f[0] + f[2]) / 2 for f in g) / len(g)) for g in groups]
    else:
        xs = sorted({round(x) for l in t.cells for x, _, _ in l.frags()})
        clusters: list[list[int]] = []
        for x in xs:
            if clusters and x - clusters[-1][-1] <= COL_CLUSTER:
                clusters[-1].append(x)
            else:
                clusters.append([x])
        seeds = [(c[0], sum(c) / len(c)) for c in clusters]
    ncol = len(seeds)

    def col_of(x0: float, x1: float) -> int:
        c = (x0 + x1) / 2
        return min(range(ncol), key=lambda i: min(abs(seeds[i][0] - x0), abs(seeds[i][1] - c)))

    brows: list[tuple[float, list[Line]]] = []
    for l in sorted(t.cells, key=lambda l: (l.yb, l.x0)):
        if brows and abs(brows[-1][0] - l.yb) < 4:
            brows[-1][1].append(l)
        else:
            brows.append((l.yb, [l]))
    header = [""] * ncol
    rows: list[list[str]] = []
    in_header = True
    prev_y: float | None = None
    for y, lines in brows:
        only_th = all(l.kind == "th" for l in lines)
        cells: dict[int, str] = {}
        for l in lines:
            for x, txt, x1 in l.frags():
                c = col_of(x, x1)
                cells[c] = dehyphen(cells[c], txt) if cells.get(c) else txt
        if in_header and only_th and not rows:
            cells = {}
            for l in lines:
                for f in l.frags():
                    if spanning(f) if th_all else False:
                        continue
                    c = col_of(f[0], f[2])
                    cells[c] = dehyphen(cells[c], f[1]) if cells.get(c) else f[1]
            for c, v in cells.items():
                header[c] = dehyphen(header[c], v) if header[c] else v
            prev_y = y
            continue
        in_header = False
        new_row = prev_y is None or (y - prev_y) >= ROW_GAP or not rows
        section = len(cells) == 1 and len(lines) == 1 and lines[0].italic and new_row
        if section:
            rows.append(["§ " + next(iter(cells.values()))] + [""] * (ncol - 1))
        elif prev_y is None or (y - prev_y) >= ROW_GAP or not rows or rows[-1][0].startswith("§ "):
            rows.append([cells.get(i, "") for i in range(ncol)])
        else:
            for i, v in cells.items():
                rows[-1][i] = dehyphen(rows[-1][i], v) if rows[-1][i] else v
        prev_y = y
    header = [fix_text(h) for h in header]
    if not any(header):
        header = []
    return header, [[fix_text(c) for c in r] for r in rows], seeds


# ---------- 3. text helpers ----------

def fix_text(s: str) -> str:
    # Soft hyphens (U+00AD): the Spanish PDF marks its line-end hyphenation with them (no visible hyphen). One at the end
    # of a line is kept for dehyphen() (the word goes on at the next line); the others are dropped. _strip_soft() removes
    # any left over in the final blocks.
    s = re.sub(r"\u00ad(?!\**$)", "", s.replace("\t", ""))
    s = s.replace("ﬁ", "fi").replace("ﬂ", "fl")
    return re.sub(r"[ ]{2,}", " ", s).strip()


def dehyphen(prev: str, nxt: str) -> str:
    """Join two lines of one paragraph: undo end-of-line hyphenation when the next line starts in lowercase."""
    if not prev:
        return nxt
    if not nxt:
        return prev
    m = re.search(r"\u00ad(\**)$", prev)
    if m:  # soft hyphen at the end of the line (Spanish PDF): the word goes on without a space
        head, mk = prev[: m.start()], m.group(1)
        if mk and nxt.startswith(mk):
            return head + nxt[len(mk):]
        return head + mk + nxt
    if prev.endswith("-") and nxt[:1].islower() and not re.search(r"\d-$", prev):
        return prev[:-1] + nxt  # "Blud-" + "geoning"; but "10-" + "foot" keeps its hyphen
    if nxt[:1] in ")],.;:" or prev.endswith(("—", "–", "(", "’", "'")):
        return prev + nxt
    return prev + " " + nxt


def spans_markup(spans: list[Span]) -> str:
    """Rebuild a line with **bold** / *italic* markup from the font names."""
    out = ""
    for s in spans:
        t = s.text.replace("\t", "")
        if not t:
            continue
        f = s.font
        if "BoldItalic" in f or f.endswith("-Bold") or "Bold-SC" in f or f == "GillSans-SemiBold":
            mark = "**"
        elif "Italic" in f:
            mark = "*"
        else:
            mark = ""
        if mark and t.strip():
            lead = t[: len(t) - len(t.lstrip())]
            trail = t[len(t.rstrip()):]
            out += f"{lead}{mark}{t.strip()}{mark}{trail}"
        else:
            out += t
    out = re.sub(r"\*\*([^*]+)\*\*(\s+)\*\*", r"**\1\2", out)
    out = re.sub(r"(?<!\*)\*([^*]+)\*(\s+)\*(?!\*)", r"*\1\2", out)
    return out


# ---------- 4. page -> ordered elements -> blocks ----------

def page_blocks(page: fitz.Page, pno: int, state: dict) -> list[Block]:
    lines = page_lines(page, pno)
    tables, rest = group_tables(lines)
    for t in tables:  # table titles: an h4 just above the table
        cands = [l for l in rest if l.kind == "h4" and t.y0 - 26 < l.yb <= t.y0 + 4 and abs(l.x0 - t.x0) < 60]
        if cands:
            ttl = max(cands, key=lambda l: l.yb)
            t.title = fix_text(ttl.text)
            rest.remove(ttl)
            above = [l for l in rest if l.kind == "h4" and 0 < ttl.yb - l.yb < 15 and abs(l.x0 - ttl.x0) < 20]
            if above:
                t.title = fix_text(above[0].text + " " + t.title)
                rest.remove(above[0])
    wide_elems: list[tuple[float, object]] = [(t.y0, t) for t in tables if t.wide]
    wide_elems += [(l.yb - 10, l) for l in rest if l.wide and l.kind in ("chapter", "h1", "h2", "h3")]
    wide_elems.sort(key=lambda e: e[0])
    bounds = [e[0] for e in wide_elems] + [1e9]

    def band_of(y: float) -> int:
        return next(i for i, b in enumerate(bounds) if y < b)

    items: list[tuple[int, int, float, object]] = []
    wide_ids = {id(e[1]) for e in wide_elems}
    for l in rest:
        if id(l) not in wide_ids:
            items.append((band_of(l.yb), l.col, l.yb, l))
    for t in tables:
        if id(t) not in wide_ids:
            items.append((band_of(t.y0), t.col, t.y0 + 9, t))
    for i, e in enumerate(wide_elems):
        items.append((i, 2, e[0], e[1]))
    items.sort(key=lambda it: (it[0], it[1], it[2]))

    blocks: list[Block] = []
    for _, col, _, el in items:
        if isinstance(el, Table):
            header, rows, seeds = table_cells(el)
            blocks.append(Block("table", page=pno, title=el.title, header=header, rows=rows, table=el, seeds=seeds))
            state["para"] = None
            continue
        l: Line = el
        k = l.kind
        if k in ("chapter", "h1", "h2", "h3", "h4"):
            last = state.get("last_heading")
            if last is not None and blocks and blocks[-1] is last[0] and last[0].kind == k and 0 < l.yb - last[1] < HEADING_PITCH[k]:
                last[0].text = fix_text(dehyphen(last[0].text, fix_text(l.text)))
            else:
                blocks.append(Block(k, fix_text(l.text), pno))
            state["last_heading"] = (blocks[-1], l.yb)
            state["para"] = None
            continue
        state["last_heading"] = None
        if k == "aside-title":
            a = blocks[-1] if blocks and blocks[-1].kind == "aside" and not blocks[-1].lines and blocks[-1].page == pno else None
            if a is None:
                a = Block("aside", page=pno)
                blocks.append(a)
            a.title = fix_text(a.title + l.text) if a.title and not l.text.startswith(" ") else fix_text(a.title + " " + l.text)
            state["para"] = None
            continue
        if k == "aside":
            if not blocks or blocks[-1].kind != "aside":
                blocks.append(Block("aside", page=pno))
            a = blocks[-1]
            txt = fix_text(spans_markup(l.spans))
            ended = state.get("aside_short", False)
            indented = l.x0 > (72 if col == 0 else 322) + 4
            if a.lines and not ended and not indented:
                a.lines[-1] = dehyphen(a.lines[-1], txt)
            else:
                a.lines.append(txt)
            state["aside_short"] = l.x1 < COL_X1[col] - 40 and txt.endswith(END_PUNCT)
            continue
        if k in ("field", "field-cont"):
            txt = fix_text(spans_markup(l.spans))
            if k == "field-cont" and blocks and blocks[-1].kind == "field":
                blocks[-1].text = dehyphen(blocks[-1].text, txt)
            else:
                blocks.append(Block("field", txt, pno))
            state["para"] = None
            continue
        if k in ("stat", "stat-h"):
            blocks.append(Block(k, fix_text(spans_markup(l.spans)), pno, font=l.spans[0].font, x=round(l.x0),
                                frags=[[round(x), fix_text(t)] for x, t, _ in l.frags()]))
            state["para"] = None
            continue
        if k == "figure":
            continue
        # body text: paragraphs and bullets flow across columns and pages
        txt = spans_markup(l.spans)
        is_li = txt.lstrip().startswith("•")
        first = l.spans[0].text
        indented = l.x0 > COL_X0[col] + 4
        para: Block | None = state.get("para")
        if para is not None and (not blocks or blocks[-1] is not para):
            para = None
        bold_start = txt.lstrip().startswith("**")
        tab = first.startswith("\t")
        soft = para is not None and re.search(r"\u00ad\**$", para.text) is not None  # word cut by a soft hyphen
        if soft and not is_li:
            start = False  # the line finishes the word (even a bold run-in: "**…tormen-**" / "**tas).**", ES p. 92)
        elif para is None or is_li or tab or bold_start or state.get("para_ended"):
            start = True
        elif state.get("para_hanging"):
            start = not indented  # hanging indent (bullets, run-in paragraphs): a line back at the margin is new
        else:
            start = indented  # normal paragraphs: the first line is indented (tab in EN, +8 pt in FR)
        if not start and para is not None:
            para.text = dehyphen(para.text, fix_text(txt))
        else:
            b = Block("li" if is_li else "p", fix_text(txt.lstrip().lstrip("•").lstrip()), pno)
            blocks.append(b)
            state["para"] = b
            state["para_hanging"] = (is_li or bold_start) and not indented and not tab
        plain = fix_text(txt).rstrip("*")
        italic_line = re.fullmatch(r"\*[^*]+\*", fix_text(txt)) is not None
        state["para_ended"] = (l.x1 < COL_X1[col] - 40 and plain.endswith(END_PUNCT)) or italic_line
    return blocks


def extract(lang: str, pages: range | None = None) -> list[dict]:
    doc = fitz.open(PDFS[lang])
    state: dict = {"para": None, "last_heading": None, "para_ended": False}
    out: list[Block] = []
    rng = pages or range(1, doc.page_count + 1)
    for pno in rng:
        out.extend(page_blocks(doc[pno - 1], pno, state))
    final: list[Block] = []
    for b in out:
        if final and final[-1].kind == "h4" and b.kind == "table" and not b.title:
            b.title = final.pop().text
        final.append(b)
    merged: list[Block] = []  # tables continued on the next page: same header (or none) and no title
    for b in final:
        prev = merged[-1] if merged else None
        if (b.kind == "table" and prev is not None and prev.kind == "table" and not b.title and prev.header
                and b.page in (prev.page, prev.page + 1) and (b.header == prev.header or not b.header)):
            if not b.header and b.table is not None and prev.seeds:
                _, rows, _ = table_cells(b.table, seeds=prev.seeds)  # same columns as the table it continues
            else:
                rows = b.rows
            # a wrapped cell continued at the top of the page: no cell in the first column
            if rows and prev.rows and not rows[0][0] and any(rows[0]):
                prev.rows[-1] = [dehyphen(a, c) if c else a for a, c in zip(prev.rows[-1], rows[0])]
                rows = rows[1:]
            prev.rows.extend(rows)
        else:
            merged.append(b)
    # stat-block lines keep a line-end soft hyphen: the creatures builder joins their lines itself
    return [b.to_json() if b.kind in ("stat", "stat-h") else _strip_soft(b.to_json()) for b in merged]


def _strip_soft(x):
    """Soft hyphens left in a block (a line-end one with no continuation) are removed."""
    if isinstance(x, str):
        return x.replace("\u00ad", "")
    if isinstance(x, list):
        return [_strip_soft(v) for v in x]
    if isinstance(x, dict):
        return {k: _strip_soft(v) for k, v in x.items()}
    return x
