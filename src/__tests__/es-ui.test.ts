// Every interface string carries its Spanish text: an object literal (or type) with `en` and `fr` keys must also have an
// `es` key. Scans src/ui, src/App.svelte and src/i18n with a tolerant brace scanner (single- and multi-line `{ … }` spans;
// keys inside nested braces belong to the inner span), and lists file:line of each offender.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const SCAN = ['src/ui', 'src/App.svelte', 'src/i18n']

function walk(p: string): string[] {
  if (statSync(p).isFile()) return [p]
  return readdirSync(p).flatMap((f) => {
    const full = join(p, f)
    if (statSync(full).isDirectory()) return f === '__tests__' ? [] : walk(full)
    return /\.(svelte|ts)$/.test(f) ? [full] : []
  })
}

const key = (k: string) => new RegExp(`(^|[\\s,{(])${k}\\??\\s*:`)

/** Line numbers of the `{ … }` spans that have `en:` and `fr:` keys of their own but no `es:` key. */
export function missingEs(src: string): number[] {
  const stack: { start: number; own: string[] }[] = [{ start: 0, own: [] }]
  const out: number[] = []
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '{') {
      stack.push({ start: i, own: [] })
      continue
    }
    if (c === '}' && stack.length > 1) {
      const f = stack.pop()!
      const own = f.own.join('')
      if (key('en').test(own) && key('fr').test(own) && !key('es').test(own))
        out.push(src.slice(0, f.start).split('\n').length)
      stack[stack.length - 1].own.push('#')
      continue
    }
    stack[stack.length - 1].own.push(c)
  }
  return out
}

describe('Spanish UI strings', () => {
  it('the scanner flags an object with en and fr but no es', () => {
    expect(missingEs("x = { en: 'A', fr: 'B' }")).toEqual([1])
    expect(missingEs("x = {\n  en: `${a}`,\n  fr: 'B',\n}")).toEqual([1])
    expect(missingEs("x = { en: 'A', fr: 'B', es: 'C' }")).toEqual([])
    expect(missingEs("x = { en: 'A', fr: 'B', es: `${y.es ?? y.en}` }")).toEqual([])
    expect(missingEs('type T = { en: string; fr: string; es?: string }')).toEqual([])
  })

  it('every { en, fr } in the interface has an es', () => {
    const offenders: string[] = []
    for (const s of SCAN)
      for (const f of walk(join(ROOT, s))) {
        const src = readFileSync(f, 'utf8')
        for (const line of missingEs(src)) offenders.push(`${relative(ROOT, f).replace(/\\/g, '/')}:${line}`)
      }
    expect(offenders).toEqual([])
  })
})
