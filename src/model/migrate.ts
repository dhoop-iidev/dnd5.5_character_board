import { SCHEMA_VERSION, type Character } from './character'

/** Upgrade a saved character (from localStorage or an imported JSON file) to the current schema. */
export function migrate(raw: unknown): Character {
  if (!raw || typeof raw !== 'object') throw new Error('Not a character file')
  const data = raw as { schemaVersion?: number; edition?: string }
  const version = data.schemaVersion ?? 0
  if (version > SCHEMA_VERSION)
    throw new Error(`This file was made by a newer version of the app (schema ${version} > ${SCHEMA_VERSION})`)
  // A 3.5 playboard file has no `edition` field: refuse it rather than misread it.
  if (data.edition !== 'srd-5.2.1') throw new Error('Not a D&D 2024 (SRD 5.2.1) character file')
  const c = data as Character
  if (c.schemaVersion < 2) {
    // Schema 2 (2026-10-25): companions and Wild Shape state.
    c.companions ??= []
    c.wildShape ??= { known: [] }
    c.schemaVersion = 2
  }
  if (c.schemaVersion < 3) {
    // Schema 3 (2026-10-25): feature choices and extra feats (Human Versatile, Champion's second Fighting Style…).
    c.featureChoices ??= {}
    c.extraFeats ??= {}
    c.schemaVersion = 3
  }
  if (c.schemaVersion < 4) {
    // Schema 4 (2026-10-26): paper-doll picture (`images.doll`, absent = the built-in one) and real custom items
    // (`ItemInstance.custom` gains attunement, worn kind, bonuses, weapon overrides and modifiers). A custom item that
    // was attuned before required Attunement, so it keeps it.
    c.images ??= {}
    for (const i of c.inventory ?? []) if (i.kind === 'custom' && i.attuned && i.custom) i.custom.attunement = true
    c.schemaVersion = 4
  }
  return c
}
