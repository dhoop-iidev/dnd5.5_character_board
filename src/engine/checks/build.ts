// Build legality: ability scores, background, levels, feats, subclass, skills, multiclass prerequisites, expertise, Weapon
// Mastery, the choices every feature asks for.
// SRD 5.2.1: p. 20 (ability scores, background), p. 23 (level advancement), p. 24 (multiclass prerequisites), p. 87 (feats:
// "If you're instructed to choose a feat and no category is specified, you can choose from any category"; each class's
// Ability Score Improvement: "the Ability Score Improvement feat or another feat of your choice for which you qualify").
import type { AbilityId } from '../../data/types'
import { ABILITIES } from '../../data/types'
import { backgroundDef, CUSTOM_BACKGROUND } from '../../model/customBackground'
import { choiceKey } from '../sheet/build'
import { ABILITY_NAMES } from '../sheet/common'
import { resolveCount } from '../sheet/modifiers'
import { grantedSkills } from '../sheet/skills'
import type { CheckContext } from './common'
import { esOf, w } from './common'
import { FEAT_CATEGORY_NAMES } from '../../model/customFeats'
import { languageOf, SRC_LANGUAGES, STARTING_LANGUAGES } from '../../model/languages'

/** Feat categories as the Spanish SRD names them ("Dote de origen", "Dote general"…). */
const FEAT_CATEGORY_ES: Record<string, string> = {
  origin: 'de origen',
  general: 'general',
  'fighting-style': 'de estilo de combate',
  'epic-boon': 'de don épico',
}

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : [])

export function checkBuild(ctx: CheckContext) {
  const { char, rules, now, out } = ctx
  // Ability scores: 1–20 at creation; the Standard Array / Point Cost give 8–15 (SRD p. 20).
  for (const id of ABILITIES) {
    const v = char.baseAbilities?.[id]
    if (v === undefined || v < 1 || v > 20)
      out.push(
        w(
          `ability-${id}`,
          'error',
          'abilities',
          `${ABILITY_NAMES[id].en} base score ${v}: scores run from 1 to 20 (3–18 before the background).`,
          `Valeur de base de ${ABILITY_NAMES[id].fr} ${v} : les valeurs vont de 1 à 20 (3 à 18 avant l’historique).`,
          `Puntuación base de ${esOf(ABILITY_NAMES[id])} ${v}: las puntuaciones van de 1 a 20 (3–18 antes del trasfondo).`,
          { source: { page: 20, frPage: 21 }, actionable: true },
        ),
      )
  }
  // Background: +2/+1 or +1/+1/+1 among its three abilities; its feat; two skills (SRD p. 20, p. 82).
  const bg = backgroundDef(char.background, rules)
  if (!bg) {
    out.push(
      w(
        'background',
        'error',
        'abilities',
        'No background chosen.',
        'Aucun historique choisi.',
        'No se ha elegido trasfondo.',
        {
          source: { page: 82, frPage: 87 },
          actionable: true,
        },
      ),
    )
  } else {
    // Custom background (house rule #3): three different abilities, two different skills, one tool, one Origin feat.
    if (bg.id === CUSTOM_BACKGROUND) {
      const src = { source: bg.source, actionable: true }
      const custom = char.background.custom
      const abilities = new Set(custom?.abilities ?? [])
      if (abilities.size !== 3 || custom!.abilities.length !== 3)
        out.push(
          w(
            'background-custom-abilities',
            'error',
            'abilities',
            'Custom background: choose three different abilities.',
            'Historique personnalisé : choisissez trois caractéristiques différentes.',
            'Trasfondo personalizado: elige tres características diferentes.',
            src,
          ),
        )
      const skills = new Set(custom?.skills ?? [])
      if (skills.size !== 2 || custom!.skills.length !== 2)
        out.push(
          w(
            'background-custom-skills',
            'error',
            'skills',
            'Custom background: choose two different skills.',
            'Historique personnalisé : choisissez deux compétences différentes.',
            'Trasfondo personalizado: elige dos habilidades diferentes.',
            src,
          ),
        )
      if (rules.gear.get(custom?.tool ?? '')?.kind !== 'tool')
        out.push(
          w(
            'background-custom-tool',
            'error',
            'abilities',
            'Custom background: choose a tool.',
            'Historique personnalisé : choisissez un outil.',
            'Trasfondo personalizado: elige una herramienta.',
            src,
          ),
        )
      if (rules.feats.get(bg.feat)?.category !== 'origin')
        out.push(
          w(
            'background-custom-feat',
            'error',
            'feats',
            'Custom background: choose an Origin feat.',
            'Historique personnalisé : choisissez un don d’origine.',
            'Trasfondo personalizado: elige una dote de origen.',
            src,
          ),
        )
    }
    const inc = char.background.abilities ?? {}
    const vals = Object.values(inc).sort((a, b) => b - a)
    const ok =
      (vals.join(',') === '2,1' || vals.join(',') === '1,1,1') &&
      Object.keys(inc).every((a) => bg.abilities.includes(a as AbilityId))
    if (!ok)
      out.push(
        w(
          'background-abilities',
          'error',
          'abilities',
          `${bg.name.en}: increase one of ${bg.abilities.map((a) => ABILITY_NAMES[a].en).join(', ')} by 2 and another by 1, or all three by 1.`,
          `${bg.name.fr} : augmentez une des caractéristiques ${bg.abilities.map((a) => ABILITY_NAMES[a].fr).join(', ')} de 2 et une autre de 1, ou les trois de 1.`,
          `${esOf(bg.name)}: aumenta una de estas características en 2 y otra en 1, o las tres en 1: ${bg.abilities.map((a) => esOf(ABILITY_NAMES[a])).join(', ')}.`,
          { source: bg.source, actionable: true },
        ),
      )
    // Languages (p. 20): Common plus two languages; class features may add more.
    const known = new Set((char.identity?.languages ?? []).map((l) => languageOf(l)?.id ?? l.trim().toLowerCase()))
    if (!known.has('common') || known.size < STARTING_LANGUAGES)
      out.push(
        w(
          'background-languages',
          'warning',
          'abilities',
          `Languages: Common plus two languages of your choice (${known.size} known).`,
          `Langues : le commun et deux langues de votre choix (${known.size} connue${known.size > 1 ? 's' : ''}).`,
          `Idiomas: común y dos idiomas a tu elección (${known.size} conocido${known.size > 1 ? 's' : ''}).`,
          { source: SRC_LANGUAGES, actionable: true },
        ),
      )
    if (char.background.feat?.featId !== bg.feat)
      out.push(
        w(
          'background-feat',
          'error',
          'feats',
          `${bg.name.en} grants the ${rules.feats.get(bg.feat)?.name.en ?? bg.feat} feat.`,
          `${bg.name.fr} accorde le don ${rules.feats.get(bg.feat)?.name.fr ?? bg.feat}.`,
          `${esOf(bg.name)} otorga la dote ${esOf(rules.feats.get(bg.feat)?.name) || bg.feat}.`,
          { source: bg.source, actionable: true },
        ),
      )
    // A background's feat can fix its spell list: "Magic Initiate (Cleric)" for the Acolyte, "(Wizard)" for the Sage.
    const fixed = bg.featText?.en.match(/\(([^)]+)\)/)?.[1].toLowerCase()
    const chosen = char.background.feat?.choices?.list
    const fixedCls = fixed && rules.classes.get(fixed)
    if (fixedCls && chosen && chosen !== fixed)
      out.push(
        w(
          'background-feat-list',
          'warning',
          'feats',
          `${bg.name.en} grants ${bg.featText!.en.replace(/\s*\(see.*$/, '')}: use the ${fixedCls.name.en} spell list.`,
          `${bg.name.fr} accorde ${bg.featText!.fr.replace(/\s*\(cf\..*$/, '')} : utilisez la liste de sorts de ${fixedCls.name.fr}.`,
          `${esOf(bg.name)} otorga ${(bg.featText!.es ?? bg.featText!.en).replace(/\s*\(consulta.*$/, '')}: usa la lista de conjuros de ${esOf(fixedCls.name)}.`,
          { source: bg.source, actionable: true },
        ),
      )
  }
  // Levels: 1–20, a class that exists, HP entries, subclass at class level 3 (SRD p. 23, each class's "Subclass" feature).
  if (!char.levels.length)
    out.push(
      w('no-level', 'error', 'levels', 'No class level.', 'Aucun niveau de classe.', 'Ningún nivel de clase.', {
        actionable: true,
      }),
    )
  if (char.levels.length > 20)
    out.push(
      w('max-level', 'error', 'levels', 'More than 20 levels.', 'Plus de 20 niveaux.', 'Más de 20 niveles.', {
        source: { page: 23, frPage: 24 },
      }),
    )
  const seen: Record<string, number> = {}
  const featsTaken = new Map<string, number[]>()
  const noteFeat = (id: string | undefined, L: number) => {
    if (id) featsTaken.set(id, [...(featsTaken.get(id) ?? []), L])
  }
  noteFeat(char.background?.feat?.featId, 1)
  for (const f of Object.values(char.extraFeats ?? {})) noteFeat(f.featId, 1)
  char.levels.forEach((l, i) => {
    const def = rules.classes.get(l.classId)
    const L = i + 1
    if (!def) {
      out.push(
        w(
          `class-${L}`,
          'error',
          'levels',
          `Level ${L}: unknown class ${l.classId}.`,
          `Niveau ${L} : classe inconnue ${l.classId}.`,
          `Nivel ${L}: clase desconocida ${l.classId}.`,
          { level: L, actionable: true },
        ),
      )
      return
    }
    seen[l.classId] = (seen[l.classId] ?? 0) + 1
    const cl = seen[l.classId]
    if (i > 0 && !l.hpFixed && (l.hpRoll < 1 || l.hpRoll > def.hitDie))
      out.push(
        w(
          `hp-${L}`,
          'error',
          'levels',
          `Level ${L}: Hit Point Die roll ${l.hpRoll} outside 1–${def.hitDie}.`,
          `Niveau ${L} : jet de dé de vie ${l.hpRoll} hors de 1–${def.hitDie}.`,
          `Nivel ${L}: tirada de dado de puntos de golpe ${l.hpRoll} fuera de 1–${def.hitDie}.`,
          { level: L, source: { page: 23, frPage: 24 }, actionable: true },
        ),
      )
    if (cl === 3 && !char.levels.some((x) => x.classId === l.classId && x.subclassId))
      out.push(
        w(
          `subclass-${l.classId}`,
          'warning',
          'levels',
          `${def.name.en} level 3: choose a subclass.`,
          `${def.name.fr} niveau 3 : choisissez une sous-classe.`,
          `${esOf(def.name)} nivel 3: elige una subclase.`,
          { level: L, source: def.source, actionable: true },
        ),
      )
    if (l.subclassId && !def.subclasses.some((s) => s.id === l.subclassId))
      out.push(
        w(
          `subclass-unknown-${L}`,
          'error',
          'levels',
          `Level ${L}: ${l.subclassId} is not a ${def.name.en} subclass of the SRD.`,
          `Niveau ${L} : ${l.subclassId} n’est pas une sous-classe de ${def.name.fr} du SRD.`,
          `Nivel ${L}: ${l.subclassId} no es una subclase de ${esOf(def.name)} del SRD.`,
          { level: L, actionable: true },
        ),
      )
    // Feat at the class's Ability Score Improvement levels (any feat you qualify for; Epic Boon at 19); none elsewhere.
    const asi = def.asiLevels.includes(cl)
    const boon = cl === 19
    if ((asi || boon) && !l.feat)
      out.push(
        w(
          `feat-missing-${L}`,
          'warning',
          'feats',
          `Level ${L} (${def.name.en} ${cl}): choose a feat (${boon ? 'an Epic Boon, or any feat you qualify for' : 'Ability Score Improvement by default, or any feat you qualify for'}).`,
          `Niveau ${L} (${def.name.fr} ${cl}) : choisissez un don (${boon ? 'une faveur épique, ou tout don dont vous remplissez les prérequis' : 'Amélioration de caractéristique par défaut, ou tout don dont vous remplissez les prérequis'}).`,
          `Nivel ${L} (${esOf(def.name)} ${cl}): elige una dote (${boon ? 'un don épico, o cualquier dote cuyos requisitos cumplas' : 'Mejora de característica por defecto, o cualquier dote cuyos requisitos cumplas'}).`,
          { level: L, source: def.source, actionable: true },
        ),
      )
    if (l.feat && !asi && !boon)
      out.push(
        w(
          `feat-extra-${L}`,
          'error',
          'feats',
          `Level ${L} (${def.name.en} ${cl}): no feat is granted at this level.`,
          `Niveau ${L} (${def.name.fr} ${cl}) : aucun don n’est accordé à ce niveau.`,
          `Nivel ${L} (${esOf(def.name)} ${cl}): no se obtiene ninguna dote en este nivel.`,
          { level: L, source: def.source, actionable: true },
        ),
      )
    if (l.feat) {
      noteFeat(l.feat.featId, L)
      const f = rules.feats.get(l.feat.featId)
      if (!f)
        out.push(
          w(
            `feat-unknown-${L}`,
            'error',
            'feats',
            `Level ${L}: unknown feat ${l.feat.featId}.`,
            `Niveau ${L} : don inconnu ${l.feat.featId}.`,
            `Nivel ${L}: dote desconocida ${l.feat.featId}.`,
            { level: L, actionable: true },
          ),
        )
      else {
        // Prerequisites at the level taken (SRD p. 87 "Prerequisite").
        const sheet = ctx.sheetAt(L)
        const p = f.prereq
        if (p?.level && L < p.level)
          out.push(
            w(
              `feat-prereq-level-${L}`,
              'error',
              'feats',
              `${f.name.en} requires level ${p.level}+.`,
              `${f.name.fr} requiert le niveau ${p.level} ou supérieur.`,
              `${esOf(f.name)} requiere nivel ${p.level} o superior.`,
              { level: L, source: f.source, actionable: true },
            ),
          )
        if (p?.abilities && !p.abilities.any.some((a) => sheet.abilities[a].score.total >= p.abilities!.min))
          out.push(
            w(
              `feat-prereq-ability-${L}`,
              'error',
              'feats',
              `${f.name.en} requires ${p.abilities.any.map((a) => ABILITY_NAMES[a].en).join(' or ')} ${p.abilities.min}+.`,
              `${f.name.fr} requiert ${p.abilities.any.map((a) => ABILITY_NAMES[a].fr).join(' ou ')} ${p.abilities.min} ou plus.`,
              `${esOf(f.name)} requiere ${p.abilities.any.map((a) => esOf(ABILITY_NAMES[a])).join(' o ')} ${p.abilities.min} o más.`,
              { level: L, source: f.source, actionable: true },
            ),
          )
        if (p?.feature === 'fighting-style' && !sheet.features.some((x) => x.def.name.en === 'Fighting Style'))
          out.push(
            w(
              `feat-prereq-feature-${L}`,
              'error',
              'feats',
              `${f.name.en} requires the Fighting Style feature.`,
              `${f.name.fr} requiert l’aptitude Style de combat.`,
              `${esOf(f.name)} requiere el rasgo Estilo de combate.`,
              { level: L, source: f.source, actionable: true },
            ),
          )
        if (p?.feature === 'spellcasting' && !sheet.spellcasting.length)
          out.push(
            w(
              `feat-prereq-feature-${L}`,
              'error',
              'feats',
              `${f.name.en} requires the Spellcasting or Pact Magic feature.`,
              `${f.name.fr} requiert l’aptitude Sorts ou Magie du pacte.`,
              `${esOf(f.name)} requiere el rasgo Lanzamiento de conjuros o Magia del pacto.`,
              { level: L, source: f.source, actionable: true },
            ),
          )
        // Ability Score Increase of the feat: +2 one or +1 two for Ability Score Improvement; +1 among the listed ones otherwise.
        const inc = Object.entries(l.feat.abilities ?? {}).filter(([, v]) => v)
        const total = inc.reduce((s, [, v]) => s + (v ?? 0), 0)
        if (f.id === 'ability-score-improvement') {
          if (!(total === 2 && (inc.length === 1 || inc.length === 2)))
            out.push(
              w(
                `feat-asi-${L}`,
                'warning',
                'abilities',
                `Level ${L}: Ability Score Improvement gives +2 to one ability or +1 to two.`,
                `Niveau ${L} : Amélioration de caractéristique donne +2 à une caractéristique ou +1 à deux.`,
                `Nivel ${L}: Mejora de característica da +2 a una característica o +1 a dos.`,
                { level: L, source: f.source, actionable: true },
              ),
            )
        } else if (f.abilityIncrease) {
          const allowed = f.abilityIncrease === 'any' ? ABILITIES : f.abilityIncrease
          if (total !== 1 || inc.length !== 1 || !allowed.includes(inc[0][0] as AbilityId))
            out.push(
              w(
                `feat-asi-${L}`,
                'warning',
                'abilities',
                `Level ${L}: ${f.name.en} increases one of ${allowed.map((a) => ABILITY_NAMES[a].en).join(', ')} by 1.`,
                `Niveau ${L} : ${f.name.fr} augmente de 1 une des caractéristiques ${allowed.map((a) => ABILITY_NAMES[a].fr).join(', ')}.`,
                `Nivel ${L}: ${esOf(f.name)} aumenta en 1 una de estas características: ${allowed.map((a) => esOf(ABILITY_NAMES[a])).join(', ')}.`,
                { level: L, source: f.source, actionable: true },
              ),
            )
        } else if (total)
          out.push(
            w(
              `feat-asi-${L}`,
              'error',
              'abilities',
              `Level ${L}: ${f.name.en} doesn't increase an ability score.`,
              `Niveau ${L} : ${f.name.fr} n’augmente pas de caractéristique.`,
              `Nivel ${L}: ${esOf(f.name)} no aumenta ninguna puntuación de característica.`,
              { level: L, source: f.source, actionable: true },
            ),
          )
      }
    }
    // A Fighting Style feature gained at this class level needs its choice (each class's Fighting Style feature, e.g. p. 47).
    const styleFeature = def.features.find((f) => f.id.endsWith(':fighting-style') && f.level === cl)
    if (styleFeature && !l.choices?.[styleFeature.id])
      out.push(
        w(
          `choice-${styleFeature.id}`,
          'warning',
          'feats',
          `Level ${L}: choose a Fighting Style (${def.name.en} ${cl}).`,
          `Niveau ${L} : choisissez un style de combat (${def.name.fr} ${cl}).`,
          `Nivel ${L}: elige un estilo de combate (${esOf(def.name)} ${cl}).`,
          { level: L, source: styleFeature.source, actionable: true },
        ),
      )
    // A Fighting Style choice must be a Fighting Style feat.
    for (const [fid, choice] of Object.entries(l.choices ?? {})) {
      if (!fid.endsWith(':fighting-style') || typeof choice !== 'string' || !choice) continue
      if (choice === 'blessed-warrior' || choice === 'druidic-warrior') {
        out.push(
          w(
            `fighting-style-${L}`,
            'info',
            'feats',
            `Level ${L}: ${choice === 'blessed-warrior' ? 'Blessed Warrior: two Cleric cantrips' : 'Druidic Warrior: two Druid cantrips'} — add them under the class's cantrips (they don't count against the class limit yet).`,
            `Niveau ${L} : ${choice === 'blessed-warrior' ? 'Guerrier béni : deux sorts mineurs de Clerc' : 'Guerrier druidique : deux sorts mineurs de Druide'} — ajoutez-les aux sorts mineurs de la classe.`,
            `Nivel ${L}: ${choice === 'blessed-warrior' ? 'Guerrero bendito: dos trucos de clérigo' : 'Guerrero druídico: dos trucos de druida'} — añádelos a los trucos de la clase (todavía no cuentan para el límite de la clase).`,
            {
              level: L,
              source: { page: choice === 'blessed-warrior' ? 54 : 58, frPage: choice === 'blessed-warrior' ? 77 : 81 },
            },
          ),
        )
        continue
      }
      const f = rules.feats.get(choice)
      if (!f || f.category !== 'fighting-style')
        out.push(
          w(
            `fighting-style-${L}`,
            'error',
            'feats',
            `Level ${L}: ${f?.name.en ?? choice} is not a Fighting Style feat.`,
            `Niveau ${L} : ${f?.name.fr ?? choice} n’est pas un don de style de combat.`,
            `Nivel ${L}: ${esOf(f?.name) || choice} no es una dote de estilo de combate.`,
            { level: L, source: { page: 87, frPage: 93 }, actionable: true },
          ),
        )
      else noteFeat(choice, L)
    }
    // Multiclassing: 13+ in the primary ability of the new class and of the current ones (SRD p. 24); the Fighter's
    // "Strength or Dexterity" needs one of the two (p. 47).
    if (cl === 1 && i > 0) {
      const sheet = ctx.sheetAt(L)
      const groups: { def: typeof def; abilities: AbilityId[]; any: boolean }[] = []
      for (const cid of Object.keys(seen)) {
        const d = rules.classes.get(cid)
        if (d) groups.push({ def: d, abilities: d.primaryAbility, any: !!d.primaryAbilityAny })
      }
      const low = groups.filter((g) =>
        g.any
          ? !g.abilities.some((a) => sheet.abilities[a].score.total >= 13)
          : !g.abilities.every((a) => sheet.abilities[a].score.total >= 13),
      )
      if (low.length) {
        const OR = { en: ' or ', fr: ' ou ', es: ' o ' }
        const AND = { en: ' and ', fr: ' et ', es: ' y ' }
        const need = (lang: 'en' | 'fr' | 'es') =>
          groups
            .map(
              (g) =>
                `${g.def.name[lang] || g.def.name.en}: ${g.abilities.map((a) => ABILITY_NAMES[a][lang] || ABILITY_NAMES[a].en).join(g.any ? OR[lang] : AND[lang])}`,
            )
            .join('; ')
        out.push(
          w(
            `multiclass-${L}`,
            'error',
            'levels',
            `Level ${L}: multiclassing into ${def.name.en} needs 13+ in the primary abilities (${need('en')}); too low for ${low.map((g) => g.def.name.en).join(', ')}.`,
            `Niveau ${L} : se multiclasser en ${def.name.fr} demande 13 ou plus dans les caractéristiques principales (${need('fr')}) ; insuffisant pour ${low.map((g) => g.def.name.fr).join(', ')}.`,
            `Nivel ${L}: multiclasar a ${esOf(def.name)} requiere 13 o más en las características principales (${need('es')}); insuficiente para ${low.map((g) => esOf(g.def.name)).join(', ')}.`,
            { level: L, source: { page: 24, frPage: 26 }, actionable: true },
          ),
        )
      }
    }
  })
  // Ability Score Increase of an extra feat (Human Versatile, Lessons of the First Ones…): +1 among the feat's abilities.
  for (const [by, pick] of Object.entries(char.extraFeats ?? {})) {
    const f = rules.feats.get(pick.featId)
    if (!f) continue
    const inc = Object.entries(pick.abilities ?? {}).filter(([, v]) => v)
    const total = inc.reduce((s, [, v]) => s + (v ?? 0), 0)
    if (f.abilityIncrease) {
      const allowed = f.abilityIncrease === 'any' ? ABILITIES : f.abilityIncrease
      if (total !== 1 || inc.length !== 1 || !allowed.includes(inc[0][0] as AbilityId))
        out.push(
          w(
            `feat-asi-${by}`,
            'warning',
            'abilities',
            `${f.name.en} (${by}) increases one of ${allowed.map((a) => ABILITY_NAMES[a].en).join(', ')} by 1.`,
            `${f.name.fr} (${by}) augmente de 1 une des caractéristiques ${allowed.map((a) => ABILITY_NAMES[a].fr).join(', ')}.`,
            `${esOf(f.name)} (${by}) aumenta en 1 una de estas características: ${allowed.map((a) => esOf(ABILITY_NAMES[a])).join(', ')}.`,
            { source: f.source, actionable: true },
          ),
        )
    } else if (total)
      out.push(
        w(
          `feat-asi-${by}`,
          'error',
          'abilities',
          `${f.name.en} (${by}) doesn't increase an ability score.`,
          `${f.name.fr} (${by}) n’augmente pas de caractéristique.`,
          `${esOf(f.name)} (${by}) no aumenta ninguna puntuación de característica.`,
          { source: f.source, actionable: true },
        ),
      )
  }
  // A feat taken twice must be repeatable (SRD p. 87 "Repeatable").
  for (const [id, levels] of featsTaken) {
    const f = rules.feats.get(id)
    if (f && !f.repeatable && levels.length > 1 && id !== 'ability-score-improvement')
      out.push(
        w(
          `feat-repeat-${id}`,
          'error',
          'feats',
          `${f.name.en} is taken ${levels.length} times; it isn't repeatable.`,
          `${f.name.fr} est pris ${levels.length} fois ; il n’est pas répétable.`,
          `${esOf(f.name)} se ha elegido ${levels.length} veces; no es repetible.`,
          { source: f.source, actionable: true },
        ),
      )
  }
  // Scores above 20 without a feature raising the maximum are flagged by the engine (score capped) — report it.
  for (const id of ABILITIES) {
    const cap = now.abilities[id].score.parts.find((p) => p.sourceId === 'max')
    if (cap)
      out.push(
        w(
          `ability-cap-${id}`,
          'warning',
          'abilities',
          `${ABILITY_NAMES[id].en} exceeds its maximum: capped.`,
          `${ABILITY_NAMES[id].fr} dépasse son maximum : plafonnée.`,
          `${esOf(ABILITY_NAMES[id])} supera su máximo: se limita.`,
          { source: { page: 20, frPage: 21 } },
        ),
      )
  }
  // Skill proficiencies chosen at level 1: the first class's count, from its list (SRD class "Core Traits").
  const first = rules.classes.get(char.levels[0]?.classId)
  if (first) {
    const chosen = char.skillProficiencies ?? []
    const n = first.skillChoices.count
    if (chosen.length !== n)
      out.push(
        w(
          'skills-count',
          chosen.length > n ? 'error' : 'warning',
          'skills',
          `${first.name.en}: choose ${n} skill proficiencies (${chosen.length} chosen).`,
          `${first.name.fr} : choisissez ${n} maîtrises de compétence (${chosen.length} choisies).`,
          `${esOf(first.name)}: elige ${n} competencias en habilidades (${chosen.length} elegidas).`,
          { source: first.source, actionable: true },
        ),
      )
    if (first.skillChoices.from !== 'any')
      for (const s of chosen)
        if (!first.skillChoices.from.includes(s))
          out.push(
            w(
              `skill-list-${s}`,
              'error',
              'skills',
              `${rules.skills.get(s)?.name.en ?? s} is not on the ${first.name.en} skill list.`,
              `${rules.skills.get(s)?.name.fr ?? s} n’est pas dans la liste de compétences ${/^[aeiouyéèh]/i.test(first.name.fr) ? 'de l’' : 'du '}${first.name.fr}.`,
              `${esOf(rules.skills.get(s)?.name) || s} no está en la lista de habilidades de ${esOf(first.name)}.`,
              { source: first.source, actionable: true },
            ),
          )
    const bgSkills = new Set(bg?.skills ?? [])
    for (const s of chosen)
      if (bgSkills.has(s))
        out.push(
          w(
            `skill-dup-${s}`,
            'warning',
            'skills',
            `${rules.skills.get(s)?.name.en ?? s} is already granted by the background: pick another skill.`,
            `${rules.skills.get(s)?.name.fr ?? s} est déjà accordée par l’historique : choisissez-en une autre.`,
            `${esOf(rules.skills.get(s)?.name) || s} ya la otorga el trasfondo: elige otra habilidad.`,
            { source: bg?.source, actionable: true },
          ),
        )
  }
  // Expertise: only in skills the character is proficient in (SRD p. 181), no more picks than the features allow.
  const prof = grantedSkills({ ...now, rules }, char)
  for (const e of char.expertise ?? [])
    if (rules.skills.has(e) && !prof.has(e as never))
      out.push(
        w(
          `expertise-${e}`,
          'error',
          'skills',
          `Expertise in ${rules.skills.get(e)?.name.en} requires proficiency in it.`,
          `L’Expertise en ${rules.skills.get(e)?.name.fr} requiert la maîtrise de cette compétence.`,
          `La Pericia en ${esOf(rules.skills.get(e)?.name)} requiere competencia en esa habilidad.`,
          { source: { page: 181, frPage: 192 }, actionable: true },
        ),
      )
  if ((char.expertise ?? []).length > now.expertiseMax)
    out.push(
      w(
        'expertise-count',
        'error',
        'skills',
        `${char.expertise.length} Expertise picks; your features allow ${now.expertiseMax}.`,
        `${char.expertise.length} Expertises choisies ; vos aptitudes en permettent ${now.expertiseMax}.`,
        `${char.expertise.length} elecciones de Pericia; tus rasgos permiten ${now.expertiseMax}.`,
        { source: { page: 181, frPage: 192 }, actionable: true },
      ),
    )
  else if ((char.expertise ?? []).length < now.expertiseMax)
    out.push(
      w(
        'expertise-missing',
        'warning',
        'skills',
        `Expertise: choose ${now.expertiseMax} skills (${(char.expertise ?? []).length} chosen).`,
        `Expertise : choisissez ${now.expertiseMax} compétences (${(char.expertise ?? []).length} choisie${(char.expertise ?? []).length > 1 ? 's' : ''}).`,
        `Pericia: elige ${now.expertiseMax} habilidades (${(char.expertise ?? []).length} elegida${(char.expertise ?? []).length === 1 ? '' : 's'}).`,
        { source: { page: 181, frPage: 192 }, actionable: true },
      ),
    )
  // Weapon Mastery: the count of the Weapon Mastery features; only weapons you're proficient with (e.g. Rogue p. 62).
  const masteries = char.weaponMastery ?? []
  if (masteries.length > now.masteryMax)
    out.push(
      w(
        'mastery-count',
        now.masteryMax ? 'error' : 'warning',
        'combat',
        `${masteries.length} weapon masteries chosen; ${now.masteryMax} allowed.`,
        `${masteries.length} bottes d’arme choisies ; ${now.masteryMax} permises.`,
        `${masteries.length} maestrías con armas elegidas; se permiten ${now.masteryMax}.`,
        { source: { page: 47, frPage: 56 }, actionable: true },
      ),
    )
  else if (now.masteryMax && masteries.length < now.masteryMax)
    out.push(
      w(
        'mastery-missing',
        'warning',
        'combat',
        `Weapon Mastery: choose ${now.masteryMax} kinds of weapons (${masteries.length} chosen).`,
        `Bottes d’arme : choisissez ${now.masteryMax} types d’armes (${masteries.length} choisis).`,
        `Maestría con armas: elige ${now.masteryMax} tipos de armas (${masteries.length} elegidos).`,
        { source: { page: 47, frPage: 56 }, actionable: true },
      ),
    )
  for (const id of masteries) {
    const wdef = rules.weapons.get(id)
    if (
      wdef &&
      !now.proficiencies.weapons.some(
        (p) =>
          p === wdef.category ||
          p === wdef.id ||
          (p === 'martial:light' && wdef.category === 'martial' && wdef.properties.includes('light')) ||
          (p === 'martial:finesse-or-light' &&
            wdef.category === 'martial' &&
            (wdef.properties.includes('light') || wdef.properties.includes('finesse'))),
      )
    )
      out.push(
        w(
          `mastery-prof-${id}`,
          'warning',
          'combat',
          `Weapon Mastery with ${wdef.name.en} needs proficiency with it.`,
          `La botte d’arme de ${wdef.name.fr} demande la maîtrise de cette arme.`,
          `La Maestría con armas con ${esOf(wdef.name)} requiere competencia con esa arma.`,
          { source: { page: 47, frPage: 56 }, actionable: true },
        ),
      )
  }
  // Every choice a feature, trait, feat or option asks for (effects' `choices`): made, the right number, from the list.
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, now.abilities[a].mod])) as Record<AbilityId, number>
  for (const o of now.owners) {
    for (const c of o.eff.choices ?? []) {
      const key = o.pick ? `${o.id}>${c.id ?? 'choice'}` : choiceKey(o.id, c)
      // The choice's own name when it adds something to the owner's ("Divine Order (Divine Order)" reads badly).
      const named = c.name && c.name.en !== o.name.en
      const label = named ? ` (${c.name!.en})` : ''
      const labelFr = named ? ` (${c.name!.fr})` : ''
      const labelEs = named ? ` (${esOf(c.name!)})` : ''
      // Character level at which the feature was gained (its own `level` is a class level).
      const charLevel =
        o.classId && o.level
          ? char.levels.findIndex(
              (l, k) =>
                l.classId === o.classId &&
                char.levels.slice(0, k + 1).filter((x) => x.classId === o.classId).length === o.level,
            ) + 1
          : o.level
      const where = charLevel ? { level: charLevel } : {}
      if (c.kind === 'feat') {
        const pick = char.extraFeats?.[o.id]
        if (!pick) {
          out.push(
            w(
              `choice-${key}`,
              'warning',
              'feats',
              `${o.name.en}: choose ${c.category ? `an ${FEAT_CATEGORY_NAMES[c.category].en}` : 'a feat'}.`,
              `${o.name.fr} : choisissez ${c.category ? `un ${FEAT_CATEGORY_NAMES[c.category].fr.toLowerCase()}` : 'un don'}.`,
              `${esOf(o.name)}: elige una ${c.category ? FEAT_CATEGORY_NAMES[c.category].es!.toLowerCase() : 'dote'}.`,
              { ...where, source: o.source, actionable: true },
            ),
          )
          continue
        }
        const f = rules.feats.get(pick.featId)
        if (!f)
          out.push(
            w(
              `choice-${key}`,
              'error',
              'feats',
              `${o.name.en}: unknown feat ${pick.featId}.`,
              `${o.name.fr} : don inconnu ${pick.featId}.`,
              `${esOf(o.name)}: dote desconocida ${pick.featId}.`,
              { ...where, actionable: true },
            ),
          )
        else if (c.category && f.category !== c.category)
          out.push(
            w(
              `choice-${key}`,
              'error',
              'feats',
              `${o.name.en} grants ${c.category === 'origin' ? 'an Origin' : `a ${c.category}`} feat; ${f.name.en} is a ${f.category} feat.`,
              `${o.name.fr} accorde un ${FEAT_CATEGORY_NAMES[c.category!].fr.toLowerCase()} ; ${f.name.fr} est un ${FEAT_CATEGORY_NAMES[f.category].fr.toLowerCase()}.`,
              `${esOf(o.name)} otorga una dote ${FEAT_CATEGORY_ES[c.category!] ?? c.category}; ${esOf(f.name)} es una dote ${FEAT_CATEGORY_ES[f.category] ?? f.category}.`,
              { ...where, source: o.source, actionable: true },
            ),
          )
        continue
      }
      if (c.kind === 'text') continue
      if (c.kind === 'expertise' && !c.from) continue // counted by `expertise-count` through character.expertise
      const n = resolveCount(c.count, c.byLevel, { ...now, char, rules }, o, mods) ?? 1
      const values = o.choiceValues[c.id ?? 'choice'] ?? []
      if (values.length !== n)
        out.push(
          w(
            `choice-${key}`,
            values.length > n ? 'error' : 'warning',
            'feats',
            `${o.name.en}${label}: choose ${n} (${values.length} chosen).`,
            `${o.name.fr}${labelFr} : choisissez ${n} (${values.length} choisi${values.length > 1 ? 's' : ''}).`,
            `${esOf(o.name)}${labelEs}: elige ${n} (${values.length} elegido${values.length > 1 ? 's' : ''}).`,
            { ...where, source: o.source, actionable: true },
          ),
        )
      // The values must come from what is offered.
      let offered: string[] | undefined
      if (c.kind === 'option') {
        offered = c.options
          ? Object.keys(c.options)
          : asList(c.from).flatMap((k) => rules.classes.get(o.classId ?? '')?.options?.[k]?.map((x) => x.id) ?? [])
      } else if (c.kind === 'skill' || c.kind === 'expertise')
        offered = c.from ? asList(c.from) : [...rules.skills.keys()]
      for (const v of values) {
        if (offered && !offered.includes(v))
          out.push(
            w(
              `choice-${key}-${v}`,
              'error',
              'feats',
              `${o.name.en}${label}: ${v} is not among the options.`,
              `${o.name.fr}${labelFr} : ${v} ne fait pas partie des options.`,
              `${esOf(o.name)}${labelEs}: ${v} no está entre las opciones.`,
              { ...where, source: o.source, actionable: true },
            ),
          )
        if (c.kind === 'spell') {
          const sp = rules.spells.get(v)
          if (!sp)
            out.push(
              w(
                `choice-${key}-${v}`,
                'error',
                'feats',
                `${o.name.en}: unknown spell ${v}.`,
                `${o.name.fr} : sort inconnu ${v}.`,
                `${esOf(o.name)}: conjuro desconocido ${v}.`,
                { ...where, actionable: true },
              ),
            )
          else {
            if (c.level !== undefined && sp.level !== c.level)
              out.push(
                w(
                  `choice-${key}-${v}`,
                  'error',
                  'feats',
                  `${o.name.en}${label}: ${sp.name.en} is level ${sp.level}, a level ${c.level} spell is expected.`,
                  `${o.name.fr}${labelFr} : ${sp.name.fr} est de niveau ${sp.level}, un sort de niveau ${c.level} est attendu.`,
                  `${esOf(o.name)}${labelEs}: ${esOf(sp.name)} es de nivel ${sp.level}; se espera un conjuro de nivel ${c.level}.`,
                  { ...where, source: o.source, actionable: true },
                ),
              )
            if (c.maxLevel !== undefined && sp.level > c.maxLevel)
              out.push(
                w(
                  `choice-${key}-${v}`,
                  'error',
                  'feats',
                  `${o.name.en}${label}: ${sp.name.en} is above level ${c.maxLevel}.`,
                  `${o.name.fr}${labelFr} : ${sp.name.fr} dépasse le niveau ${c.maxLevel}.`,
                  `${esOf(o.name)}${labelEs}: ${esOf(sp.name)} supera el nivel ${c.maxLevel}.`,
                  { ...where, source: o.source, actionable: true },
                ),
              )
            // The list: the choice's own, or the one picked by the owner's 'list' choice (Magic Initiate).
            const lists = c.list ?? (o.choiceValues.list?.length ? o.choiceValues.list : undefined)
            if (
              lists?.length &&
              !lists.some((cid) => rules.classes.get(cid)?.spellList?.some((lv) => lv.spells.includes(v)))
            )
              out.push(
                w(
                  `choice-${key}-${v}`,
                  'warning',
                  'feats',
                  `${o.name.en}${label}: ${sp.name.en} is not on the ${lists.map((x) => rules.classes.get(x)?.name.en ?? x).join(' / ')} spell list.`,
                  `${o.name.fr}${labelFr} : ${sp.name.fr} n’est pas dans la liste de sorts ${lists.map((x) => rules.classes.get(x)?.name.fr ?? x).join(' / ')}.`,
                  `${esOf(o.name)}${labelEs}: ${esOf(sp.name)} no está en la lista de conjuros de ${lists.map((x) => esOf(rules.classes.get(x)?.name) || x).join(' / ')}.`,
                  { ...where, source: o.source, actionable: true },
                ),
              )
          }
        }
        if (c.kind === 'expertise' && !prof.has(v as never))
          out.push(
            w(
              `choice-${key}-${v}`,
              'error',
              'skills',
              `${o.name.en}: Expertise in ${rules.skills.get(v)?.name.en ?? v} requires proficiency in it.`,
              `${o.name.fr} : l’Expertise en ${rules.skills.get(v)?.name.fr ?? v} requiert la maîtrise de cette compétence.`,
              `${esOf(o.name)}: la Pericia en ${esOf(rules.skills.get(v)?.name) || v} requiere competencia en esa habilidad.`,
              { ...where, source: o.source, actionable: true },
            ),
          )
      }
      // An option's own prerequisite, as printed (Eldritch Invocations: "Level 5+ Warlock", "Pact of the Blade"…).
      if (c.kind === 'option' && c.from)
        for (const v of values) {
          const opt = asList(c.from)
            .flatMap((k) => rules.classes.get(o.classId ?? '')?.options?.[k] ?? [])
            .find((x) => x.id === v)
          const m = opt?.prereq?.en.match(/Level (\d+)\+/)
          if (m && (now.classLevels[o.classId ?? ''] ?? 0) < parseInt(m[1], 10))
            out.push(
              w(
                `choice-${key}-${v}-level`,
                'error',
                'feats',
                `${opt!.name.en} requires ${opt!.prereq!.en}.`,
                `${opt!.name.fr} requiert : ${opt!.prereq!.fr || opt!.prereq!.en}.`,
                `${esOf(opt!.name)} requiere: ${esOf(opt!.prereq)}.`,
                { ...where, source: opt!.source, actionable: true },
              ),
            )
        }
    }
  }
  const stale = Object.keys(char.featureChoices ?? {}).filter(
    (k) =>
      !now.owners.some((o) => (o.eff.choices ?? []).some((c) => choiceKey(o.id, c) === k)) &&
      !now.spellcasting.some((s) => s.spellChoice?.key === k),
  )
  for (const k of stale)
    out.push(
      w(
        `choice-stale-${k}`,
        'info',
        'feats',
        `Stored choice ${k} belongs to no current feature.`,
        `Le choix enregistré ${k} ne correspond à aucune aptitude actuelle.`,
        `La elección guardada ${k} no corresponde a ningún rasgo actual.`,
      ),
    )
}
