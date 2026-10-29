// Spells: prepared counts, cantrips, class lists and levels, spellbook (SRD 5.2.1 p. 104 "Preparing Spells", each class's
// Spellcasting feature, p. 78 "Spellbook", p. 25 "Spells Prepared… as if you were a single-classed member of that class").
import { SRC_SPELLBOOK, spellbookLevels, spellbookProblems } from '../spellbook'
import type { CheckContext } from './common'
import { esOf, w } from './common'

export function checkSpells(ctx: CheckContext) {
  const { rules, now, out, char } = ctx
  const slotCasters = now.spellcasting.filter((s) => s.kind !== 'pact').length
  for (const sc of now.spellcasting) {
    // A custom subclass caster with other Spellcasting classes: its share of the Multiclass Spellcaster table must come
    // from the player's book (SRD p. 25 lists only full and half casters; house rule #5).
    if (sc.kind === 'subclass' && slotCasters > 1 && !now.subclasses.get(sc.classId)?.spellcasting?.multiclass)
      out.push(
        w(
          `subclass-multiclass-${sc.classId}`,
          'warning',
          'spells',
          `${sc.className.en}: enter how its subclass levels count toward the Multiclass Spellcaster table (custom subclass, Spellcasting).`,
          `${sc.className.fr} : indiquez comment les niveaux de sa sous-classe comptent dans la table du lanceur de sorts multiclassé (sous-classe personnalisée, Incantation).`,
          `${esOf(sc.className)}: indica cómo cuentan los niveles de su subclase en la tabla de lanzador de conjuros multiclase (subclase personalizada, Lanzamiento de conjuros).`,
          { source: { page: 25, frPage: 27, houseRule: 5 }, actionable: true },
        ),
      )
    const def = rules.classes.get(sc.classId)
    const list = new Map<string, number>()
    // The class's list, or the one its subclass casts from (custom subclass, house rule #5).
    for (const lv of rules.classes.get(sc.list)?.spellList ?? []) for (const id of lv.spells) list.set(id, lv.level)
    for (const sub of def?.subclasses ?? [])
      for (const lv of sub.spells ?? [])
        for (const id of lv.spells) if (!list.has(id)) list.set(id, rules.spells.get(id)?.level ?? 1)
    // Other lists the class may prepare from (Magical Secrets) and the always-prepared spells.
    for (const other of sc.extraLists)
      for (const lv of rules.classes.get(other)?.spellList ?? [])
        for (const id of lv.spells) if (!list.has(id)) list.set(id, lv.level)
    const always = new Set(sc.alwaysPrepared)
    // Spells a species trait or feat makes "always prepared" (Magic Initiate, lineages) are prepared whatever the class.
    const free = new Set(now.extraSpells.flatMap((x) => x.spells))
    const counted = sc.prepared.filter((id) => !always.has(id) && !free.has(id))
    if (counted.length > sc.preparedMax)
      out.push(
        w(
          `prepared-${sc.classId}`,
          'warning',
          'spells',
          `${sc.className.en}: ${counted.length} spells prepared, ${sc.preparedMax} allowed (always-prepared spells don't count).`,
          `${sc.className.fr} : ${counted.length} sorts préparés, ${sc.preparedMax} autorisés (les sorts toujours préparés ne comptent pas).`,
          `${esOf(sc.className)}: ${counted.length} conjuros preparados, se permiten ${sc.preparedMax} (los conjuros siempre preparados no cuentan).`,
          { source: sc.source, actionable: true },
        ),
      )
    else if (counted.length < sc.preparedMax)
      out.push(
        w(
          `prepared-missing-${sc.classId}`,
          'warning',
          'spells',
          `${sc.className.en}: prepare ${sc.preparedMax} spells (${counted.length} prepared).`,
          `${sc.className.fr} : préparez ${sc.preparedMax} sorts (${counted.length} préparé${counted.length > 1 ? 's' : ''}).`,
          `${esOf(sc.className)}: prepara ${sc.preparedMax} conjuros (${counted.length} preparado${counted.length === 1 ? '' : 's'}).`,
          { source: sc.source, actionable: true },
        ),
      )
    const countedCantrips = sc.cantrips.filter((id) => !always.has(id) && !free.has(id))
    if (countedCantrips.length > sc.cantripsMax)
      out.push(
        w(
          `cantrips-${sc.classId}`,
          'warning',
          'spells',
          `${sc.className.en}: ${countedCantrips.length} cantrips, ${sc.cantripsMax} allowed (always-prepared cantrips don't count).`,
          `${sc.className.fr} : ${countedCantrips.length} sorts mineurs, ${sc.cantripsMax} autorisés (les sorts mineurs toujours préparés ne comptent pas).`,
          `${esOf(sc.className)}: ${countedCantrips.length} trucos, se permiten ${sc.cantripsMax} (los trucos siempre preparados no cuentan).`,
          { source: sc.source, actionable: true },
        ),
      )
    else if (countedCantrips.length < sc.cantripsMax)
      out.push(
        w(
          `cantrips-missing-${sc.classId}`,
          'warning',
          'spells',
          `${sc.className.en}: choose ${sc.cantripsMax} cantrips (${countedCantrips.length} chosen).`,
          `${sc.className.fr} : choisissez ${sc.cantripsMax} sorts mineurs (${countedCantrips.length} choisi${countedCantrips.length > 1 ? 's' : ''}).`,
          `${esOf(sc.className)}: elige ${sc.cantripsMax} trucos (${countedCantrips.length} elegido${countedCantrips.length === 1 ? '' : 's'}).`,
          { source: sc.source, actionable: true },
        ),
      )
    // The highest spell level this class alone can prepare (its own table row), not the combined multiclass slots.
    const highest = sc.maxSpellLevel
    for (const id of [...sc.prepared, ...sc.cantrips]) {
      const sp = rules.spells.get(id)
      if (!sp) {
        out.push(
          w(
            `spell-unknown-${id}`,
            'error',
            'spells',
            `Unknown spell ${id}.`,
            `Sort inconnu ${id}.`,
            `Conjuro desconocido ${id}.`,
            {
              actionable: true,
            },
          ),
        )
        continue
      }
      if (!list.has(id) && !always.has(id) && !(sc.spellbook && sc.spellbook.includes(id)))
        out.push(
          w(
            `spell-list-${sc.classId}-${id}`,
            'warning',
            'spells',
            `${sp.name.en} is not on the ${sc.className.en} spell list.`,
            `${sp.name.fr} n’est pas dans la liste de sorts de ${sc.className.fr}.`,
            `${esOf(sp.name)} no está en la lista de conjuros de ${esOf(sc.className)}.`,
            { source: sp.source, actionable: true },
          ),
        )
      if (sp.level > highest && !always.has(id))
        out.push(
          w(
            `spell-level-${sc.classId}-${id}`,
            'warning',
            'spells',
            `${sp.name.en} (level ${sp.level}) is above the highest level a ${sc.className.en} ${now.classLevels[sc.classId]} can prepare (${highest}).`,
            `${sp.name.fr} (niveau ${sp.level}) dépasse le plus haut niveau qu’un ${sc.className.fr} ${now.classLevels[sc.classId]} peut préparer (${highest}).`,
            `${esOf(sp.name)} (nivel ${sp.level}) supera el nivel más alto que puede preparar un ${esOf(sc.className)} de nivel ${now.classLevels[sc.classId]} (${highest}).`,
            { source: { page: 25, frPage: 27 }, actionable: true },
          ),
        )
      if (sc.cantrips.includes(id) && sp.level !== 0)
        out.push(
          w(
            `cantrip-level-${id}`,
            'warning',
            'spells',
            `${sp.name.en} is not a cantrip.`,
            `${sp.name.fr} n’est pas un sort mineur.`,
            `${esOf(sp.name)} no es un truco.`,
            { source: sp.source, actionable: true },
          ),
        )
    }
    if (sc.spellbook) {
      for (const id of sc.prepared)
        if (!sc.spellbook.includes(id) && !always.has(id) && rules.spells.has(id))
          out.push(
            w(
              `spellbook-${id}`,
              'warning',
              'spells',
              `${rules.spells.get(id)!.name.en} is prepared but not in the spellbook.`,
              `${rules.spells.get(id)!.name.fr} est préparé mais absent du grimoire.`,
              `${esOf(rules.spells.get(id)!.name)} está preparado pero no está en el libro de conjuros.`,
              { source: SRC_SPELLBOOK, actionable: true },
            ),
          )
      // The spellbook holds Wizard spells of level 1+ (p. 78 "Spellbook"). The spells added at a Wizard level are
      // checked with their level below.
      const perLevel = new Set(spellbookLevels(char, rules).flatMap((l) => l.learned))
      for (const id of sc.spellbook) {
        if (perLevel.has(id)) continue
        const sp = rules.spells.get(id)
        if (!sp) continue
        if (!list.has(id))
          out.push(
            w(
              `spellbook-list-${id}`,
              'warning',
              'spells',
              `${sp.name.en} in the spellbook is not a ${sc.className.en} spell.`,
              `${sp.name.fr} dans le grimoire n’est pas un sort de ${sc.className.fr}.`,
              `${esOf(sp.name)}, en el libro de conjuros, no es un conjuro de ${esOf(sc.className)}.`,
              { source: SRC_SPELLBOOK, actionable: true },
            ),
          )
        if (sp.level === 0)
          out.push(
            w(
              `spellbook-cantrip-${id}`,
              'warning',
              'spells',
              `${sp.name.en} is a cantrip: cantrips aren't written in the spellbook.`,
              `${sp.name.fr} est un sort mineur : les sorts mineurs ne figurent pas dans le grimoire.`,
              `${esOf(sp.name)} es un truco: los trucos no se escriben en el libro de conjuros.`,
              { source: SRC_SPELLBOOK },
            ),
          )
      }
    }
  }
  // The spells added to the spellbook at each Wizard level (p. 78 "Spellbook"): six at level 1, two at each later level.
  for (const l of spellbookLevels(char, rules))
    if (l.learned.length < l.expected)
      out.push(
        w(
          `spellbook-missing-${l.index + 1}`,
          'warning',
          'spells',
          `Wizard level ${l.wizardLevel}: add ${l.expected} spells to the spellbook (${l.learned.length} added).`,
          `Magicien niveau ${l.wizardLevel} : ajoutez ${l.expected} sorts au grimoire (${l.learned.length} ajouté${l.learned.length > 1 ? 's' : ''}).`,
          `Mago de nivel ${l.wizardLevel}: añade ${l.expected} conjuros al libro de conjuros (${l.learned.length} añadido${l.learned.length === 1 ? '' : 's'}).`,
          { level: l.index + 1, source: SRC_SPELLBOOK, actionable: true },
        ),
      )
  for (const p of spellbookProblems(char, rules))
    out.push(
      w(`spellbook-level-${p.index + 1}${p.id ? `-${p.id}` : ''}`, 'warning', 'spells', p.en, p.fr, p.es, {
        level: p.index + 1,
        source: SRC_SPELLBOOK,
        actionable: true,
      }),
    )
}
