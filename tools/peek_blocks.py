import sys, json; sys.path.insert(0, 'tools')
import srd_pdf
lang = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3])
for blk in srd_pdf.extract(lang, range(a, b + 1)):
    if blk['kind'] == 'table':
        print(f"[table p{blk['page']}] {blk['title']!r} header={blk['header']}")
        for r in blk['rows'][:4]: print("    ", r)
        print(f"     ... {len(blk['rows'])} rows")
    elif blk['kind'] == 'aside':
        print(f"[aside p{blk['page']}] {blk['title']!r} {len(blk['lines'])} paras: {blk['lines'][0][:80] if blk['lines'] else ''}")
    else:
        print(f"[{blk['kind']} p{blk['page']}] {blk['text'][:120]}")
