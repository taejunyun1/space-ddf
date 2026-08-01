export function startTextComposition(event) {
  if (event.target) event.target.composing = true
}

export function updateTextInput(event, commit) {
  if (event.isComposing || event.target?.composing) return
  commit(event.target?.value ?? '')
}

export function finishTextComposition(event, commit) {
  if (event.target) event.target.composing = false
  updateTextInput(event, commit)
}
