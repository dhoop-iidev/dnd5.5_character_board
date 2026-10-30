// The Builder (ui/Builder.svelte) is open: creating the character (`create`: the starting equipment step too) or editing
// one level (`index`, 0 = level 1 with the Origin and the ability scores). It edits the live character, so the sheet's
// rule checks and editors apply as it goes (user request 2026-10-30: a step-by-step creation and level up).
import type { Kits, StepId } from './creation'

export const builder = $state<{
  open: boolean
  index: number
  create: boolean
  step: StepId
  /** Starting equipment picked during this creation (unknown when the Builder is reopened later). */
  kits?: Kits
}>({ open: false, index: 0, create: false, step: 'level' })

export function openBuilder(index: number, opts: { create?: boolean; step?: StepId; kits?: Kits } = {}) {
  builder.index = index
  builder.create = !!opts.create
  builder.step = opts.step ?? 'level'
  if (opts.kits) builder.kits = opts.kits
  builder.open = true
  window.scrollTo?.(0, 0)
}

export function closeBuilder() {
  builder.open = false
  window.scrollTo?.(0, 0)
}
