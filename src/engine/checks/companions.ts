// Companions: Wild Shape known forms (count, CR, Fly Speed; SRD 5.2.1 p. 42 "Known Forms"), familiar forms and "One
// Familiar Only" (p. 130), the steed's stat block (p. 130).
import {
  familiarIneligible,
  familiarSources,
  SRC_FIND_FAMILIAR,
  SRC_FIND_STEED,
  SRC_WILD_SHAPE,
  wildShapeIneligible,
  wildShapeLimits,
} from '../companions'
import type { CheckContext } from './common'
import { esOf, w } from './common'

export function checkCompanions(ctx: CheckContext) {
  const { char, rules, now, out } = ctx
  const known = char.wildShape?.known ?? []
  const lim = wildShapeLimits(now.classLevels.druid ?? 0)
  if (known.length && !lim)
    out.push(
      w(
        'wild-shape-none',
        'warning',
        'companions',
        'Wild Shape forms are listed, but Wild Shape needs Druid level 2.',
        'Des formes sauvages sont notées, mais Forme sauvage demande le niveau 2 de Druide.',
        'Hay formas de Forma salvaje anotadas, pero Forma salvaje requiere druida de nivel 2.',
        { source: SRC_WILD_SHAPE, actionable: true },
      ),
    )
  if (lim) {
    if (known.length > lim.known)
      out.push(
        w(
          'wild-shape-count',
          'warning',
          'companions',
          `${known.length} known forms; ${lim.known} allowed at Druid level ${lim.druidLevel} (Beast Shapes table).`,
          `${known.length} formes connues ; ${lim.known} permises au niveau ${lim.druidLevel} de Druide (table Formes de Bête).`,
          `${known.length} formas conocidas; se permiten ${lim.known} con druida de nivel ${lim.druidLevel} (tabla Formas de bestia).`,
          { source: SRC_WILD_SHAPE, actionable: true },
        ),
      )
    for (const id of known) {
      const def = rules.creatures.get(id)
      if (!def) {
        out.push(
          w(
            `wild-shape-unknown-${id}`,
            'error',
            'companions',
            `Unknown creature ${id}.`,
            `Créature inconnue ${id}.`,
            `Criatura desconocida ${id}.`,
            {
              actionable: true,
            },
          ),
        )
        continue
      }
      const why = wildShapeIneligible(def, lim)
      if (why)
        out.push(
          w(`wild-shape-${id}`, 'warning', 'companions', why.en, why.fr, esOf(why), {
            source: SRC_WILD_SHAPE,
            actionable: true,
          }),
        )
    }
    if (char.wildShape.active && !known.includes(char.wildShape.active))
      out.push(
        w(
          'wild-shape-active',
          'warning',
          'companions',
          'The form assumed is not one of your known forms.',
          'La forme adoptée n’est pas une de vos formes connues.',
          'La forma adoptada no es una de tus formas conocidas.',
          { source: SRC_WILD_SHAPE },
        ),
      )
  }

  const familiars = (char.companions ?? []).filter((c) => c.kind === 'familiar')
  if (familiars.length > 1)
    out.push(
      w(
        'familiar-count',
        'warning',
        'companions',
        'You can’t have more than one familiar at a time ("One Familiar Only").',
        'Vous ne pouvez pas disposer de plus d’un familier à la fois (« Un seul familier »).',
        'No puedes tener más de un familiar a la vez («Un solo familiar»).',
        { source: SRC_FIND_FAMILIAR, actionable: true },
      ),
    )
  if (familiars.length && !familiarSources(char, now).length)
    out.push(
      w(
        'familiar-source',
        'info',
        'companions',
        'A familiar without Find Familiar prepared, Wild Companion or a Warlock level.',
        'Un familier sans Trouver un familier préparé, Compagnon sauvage ni niveau d’Occultiste.',
        'Un familiar sin Encontrar familiar preparado, Compañero salvaje ni nivel de brujo.',
        { source: SRC_FIND_FAMILIAR },
      ),
    )
  const warlock = (now.classLevels.warlock ?? 0) >= 1
  for (const f of familiars) {
    const def = rules.creatures.get(f.creatureId)
    if (!def) {
      out.push(
        w(
          `companion-unknown-${f.uid}`,
          'error',
          'companions',
          `Unknown creature ${f.creatureId}.`,
          `Créature inconnue ${f.creatureId}.`,
          `Criatura desconocida ${f.creatureId}.`,
          { actionable: true },
        ),
      )
      continue
    }
    const why = familiarIneligible(def, warlock)
    if (why)
      out.push(
        w(`familiar-form-${f.uid}`, 'warning', 'companions', why.en, why.fr, esOf(why), {
          source: SRC_FIND_FAMILIAR,
          actionable: true,
        }),
      )
  }
  for (const s of (char.companions ?? []).filter((c) => c.kind === 'steed')) {
    if (s.creatureId !== 'otherworldly-steed')
      out.push(
        w(
          `steed-form-${s.uid}`,
          'warning',
          'companions',
          'Find Steed summons an Otherworldly Steed (its own stat block).',
          'Trouver une monture invoque une Monture d’outremonde (profil dédié).',
          'Hallar corcel invoca un corcel sobrenatural (con su propio perfil).',
          { source: SRC_FIND_STEED },
        ),
      )
    if (!s.spellLevel || s.spellLevel < 2)
      out.push(
        w(
          `steed-level-${s.uid}`,
          'warning',
          'companions',
          'Find Steed is a level 2 spell: pick the slot level used (AC and Hit Points depend on it).',
          'Trouver une monture est un sort de niveau 2 : indiquez le niveau d’emplacement utilisé (CA et PV en dépendent).',
          'Hallar corcel es un conjuro de nivel 2: indica el nivel del espacio de conjuro usado (la CA y los puntos de golpe dependen de él).',
          { source: SRC_FIND_STEED, actionable: true },
        ),
      )
  }
  for (const c of char.companions ?? []) {
    if (c.kind !== 'familiar' && !rules.creatures.has(c.creatureId))
      out.push(
        w(
          `companion-unknown-${c.uid}`,
          'error',
          'companions',
          `Unknown creature ${c.creatureId}.`,
          `Créature inconnue ${c.creatureId}.`,
          `Criatura desconocida ${c.creatureId}.`,
          { actionable: true },
        ),
      )
  }
}
