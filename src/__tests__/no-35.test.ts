// Guard against D&D 3.5 and 2014 (SRD 5.1) vocabulary leaking into the 2024 (SRD 5.2.1) playboard.
// Scans src/ and docs/ (English and French). A legitimate hit is allowed by ending the line with `no35-ok`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const SCAN = ['src', 'docs', 'examples', 'README.md']
// Generated SRD data (src/data/srd) is verbatim SRD 5.2.1 text and may legitimately use these words ("Undead Fortitude",
// "attaque d'Opportunité"); it is checked by tools/validate_data.py instead.
const SKIP = (f: string) =>
  /node_modules/.test(f) ||
  f.endsWith('no-35.test.ts') ||
  /docs[\\/]reviews/.test(f) ||
  /src[\\/]data[\\/]srd[\\/]/.test(f)

// Word-boundary, case-insensitive. Each pattern names a mechanic that does not exist in the 2024 rules.
const FORBIDDEN: { re: RegExp; why: string }[] = [
  // 3.5 (English)
  { re: /\bbase attack bonus\b|\bBAB\b/i, why: '3.5: no base attack bonus; 2024 uses the Proficiency Bonus' },
  { re: /\bFortitude\b|\bReflex sav|\bWill sav/i, why: '3.5 saves; 2024 saving throws are the six abilities' },
  { re: /\bskill ranks?\b|\bcross-class\b/i, why: '3.5 skills; 2024 uses proficiency and Expertise' },
  { re: /\biterative attacks?\b/i, why: '3.5; 2024 has Extra Attack' },
  { re: /\battacks? of opportunity\b/i, why: '3.5; 2024 has Opportunity Attacks' },
  { re: /\btouch AC\b|\bflat-footed\b/i, why: '3.5; no touch or flat-footed AC in 2024' },
  {
    re: /\barmor check penalty\b|\bmax(imum)? Dex(terity)? bonus\b/i,
    why: '3.5; 2024 armor has a Dex cap and Stealth Disadvantage',
  },
  { re: /\barcane spell failure\b|\bcaster level\b|\bspells per day\b/i, why: '3.5 spellcasting' },
  {
    re: /\bmetamagic feats?\b|\b0-level\b|\bprestige class/i,
    why: '3.5; 2024 Metamagic are sorcerer options, cantrips are level 0 spells',
  },
  { re: /\bfavored class\b|\bgrapple check\b/i, why: '3.5' },
  {
    re: /\b(enhancement|dodge|deflection|morale|competence|insight|luck|sacred|profane|circumstance|resistance) bonus(es)?\b/i,
    why: '3.5 typed bonuses; 2024 has none',
  },
  { re: /\bbonus types?\b/i, why: '3.5 stacking; 2024: same-named effects do not stack' },
  { re: /d20srd/i, why: '3.5 source site' },
  // 2014 (SRD 5.1) terms replaced in 2024
  { re: /\braces?\b(?! condition)|\bracial\b|\bsubrace/i, why: '2014 "race"; 2024 says species' },
  {
    re: /(?<!Heroic |Bardic |Font of )\bInspiration\b(?! (héroïque|bardique))/,
    why: '2014 Inspiration; 2024 is Heroic Inspiration',
  },
  { re: /\bki points?\b/i, why: '2014 monk; 2024 has Focus Points' },
  { re: /\bhalf-elf\b|\bhalf-orc\b/i, why: 'not in SRD 5.2.1' },
  // 3.5 (French)
  { re: /bonus de base à l['’]attaque|\bBBA\b/i, why: '3.5 FR' },
  {
    re: /\bVigueur\b(?! fiélonne)|\bRéflexes\b|\bVolonté\b/,
    why: '3.5 FR saves; 2024 FR: jets de sauvegarde par caractéristique',
  },
  { re: /degrés? de maîtrise|compétences? de classe|hors de classe/i, why: '3.5 FR skills' },
  { re: /CA de contact|pris au dépourvu/i, why: '3.5 FR (touch AC, flat-footed); 2024 has neither' },
  {
    re: /malus d['’]armure|échec des sorts profanes|sorts par jour|dons? de métamagie|classe de prestige|classe de prédilection/i,
    why: '3.5 FR',
  },
  { re: /bonus d['’](altération|esquive|parade|moral|aptitude|intuition|chance)/i, why: '3.5 FR typed bonuses' },
  { re: /\bracial(e|es|aux)?\b/i, why: '2014 FR; 2024 FR says espèce' },
]

function* walk(p: string): Generator<string> {
  const st = statSync(p)
  if (st.isDirectory()) for (const f of readdirSync(p)) yield* walk(join(p, f))
  else if (/\.(ts|svelte|json|md|css|html|py)$/.test(p)) yield p
}

describe('no 3.5 / 2014 vocabulary', () => {
  it('src/, docs/ and examples/ use 2024 (SRD 5.2.1) terms only', () => {
    const hits: string[] = []
    for (const top of SCAN) {
      let abs = join(ROOT, top)
      try {
        statSync(abs)
      } catch {
        continue
      }
      for (const file of walk(abs)) {
        if (SKIP(file)) continue
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (/no35-ok/.test(line)) return
          for (const { re, why } of FORBIDDEN)
            if (re.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 100)}  ← ${why}`)
        })
      }
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})
