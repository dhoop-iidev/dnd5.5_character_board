"""Build a content pack (house rule #7, docs/packs.md) from its source folder.

    python tools/build_pack.py <source folder> [<output folder>]

The source folder (kept outside this repository: packs hold book text) has a `pack.json` with the pack's metadata
(`id`, `book`) and any number of other `*.json` files (subfolders included), each a partial pack: lists `species`,
`backgrounds`, `feats`, `spells`, `subclasses`, `classOptions`, `magicItems`, `effects` and a `summaries` object.
They are merged into `<output folder>/<id>.pack.json` (default: `<source folder>/../dist`), with `version` = today.
Duplicate ids are an error. The app checks the result when it loads it; `PACKS_DIR=<folder> npm test` runs the full
checks of src/__tests__/packs-content.test.ts on every pack of a folder.
"""

import datetime
import json
import pathlib
import sys

LISTS = ["species", "backgrounds", "feats", "spells", "subclasses", "classOptions", "magicItems", "effects"]


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    out_dir = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else src.parent / "dist"
    meta = json.loads((src / "pack.json").read_text(encoding="utf-8"))
    pack = {"kind": "content-pack", "format": 1, "id": meta["id"], "book": meta["book"],
            "version": meta.get("version") or datetime.date.today().isoformat()}
    seen: dict[str, str] = {}
    summaries: dict[str, object] = {}
    errors: list[str] = []
    for f in sorted(src.rglob("*.json")):
        if f.name == "pack.json" or f.name.endswith(".pack.json") or "dist" in f.relative_to(src).parts:
            continue
        try:
            part = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{f}: {e}")
            continue
        for k in part:
            if k not in LISTS and k != "summaries":
                errors.append(f"{f}: unknown key {k}")
        for k in LISTS:
            for e in part.get(k, []):
                key = f"{k}:{e.get('id')}"
                if key in seen:
                    errors.append(f"{f}: duplicate {key} (also in {seen[key]})")
                seen[key] = f.name
                pack.setdefault(k, []).append(e)
        for k, v in part.get("summaries", {}).items():
            if k in summaries:
                errors.append(f"{f}: duplicate summary {k}")
            summaries[k] = v
    if summaries:
        pack["summaries"] = summaries
    if errors:
        sys.exit("\n".join(errors))
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{meta['id']}.pack.json"
    out.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = ", ".join(f"{len(pack[k])} {k}" for k in LISTS if pack.get(k))
    print(f"{out}: {counts}, {len(summaries)} summaries")


if __name__ == "__main__":
    main()
