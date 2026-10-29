// "Generate the PDF": the printable sheet (ui/PrintSheet.svelte) is rendered only while printing, then the browser's
// print dialog saves it as a PDF. Ctrl+P and the browser menu print the same sheet: they fire `beforeprint`, which
// renders the sheet synchronously before the page is laid out for printing.
import { flushSync } from 'svelte'
import { app } from '../state.svelte'

export const printState = $state({ on: false })

let title = ''
function before() {
  if (printState.on) return // printSheet() already prepared it; `beforeprint` follows
  title = document.title
  // The PDF file is named after the page title: the character's name.
  document.title = app.character.identity?.name?.trim() || 'character'
  flushSync(() => (printState.on = true))
}
function after() {
  document.title = title || document.title
  printState.on = false
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', before)
  window.addEventListener('afterprint', after)
}

export function printSheet() {
  before()
  window.print()
}
