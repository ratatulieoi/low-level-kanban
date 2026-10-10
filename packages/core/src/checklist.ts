/** A `- [ ]` / `- [x]` line in a task note body, by its line index in the split body. */
export interface BodyChecklistItem {
  line: number
  done: boolean
  text: string
}

const CHECKLIST_LINE = /^- \[([ xX])\] ?(.*)$/
const FENCE_LINE = /^(`{3,}|~{3,})/

/**
 * Every plain checkbox in the body counts as a subtask, even one the author meant as
 * prose: nothing marks checklist subtasks apart from other checkboxes. Lines inside
 * fenced code blocks never count. Only lines starting at column zero match.
 */
export function parseBodyChecklist(description: string): BodyChecklistItem[] {
  const items: BodyChecklistItem[] = []
  const lines = description.split('\n')
  let fenced = false
  lines.forEach((raw, line) => {
    if (FENCE_LINE.test(raw.trim())) {
      fenced = !fenced
      return
    }
    if (fenced) return
    const match = CHECKLIST_LINE.exec(raw)
    if (match) items.push({ line, done: match[1] !== ' ', text: match[2] ?? '' })
  })
  return items
}

/** done/total*100, rounded. A body without checklist lines reads as 0. */
export function checklistProgress(description: string): number {
  const items = parseBodyChecklist(description)
  if (items.length === 0) return 0
  return Math.round((items.filter((item) => item.done).length / items.length) * 100)
}

/** Groups checklist lines so that all unfinished items appear before all done items. */
export function groupBodyChecklist(description: string): string {
  const items = parseBodyChecklist(description)
  if (items.length <= 1) return description

  let seenDone = false
  let alreadyGrouped = true
  for (const item of items) {
    if (item.done) {
      seenDone = true
    } else if (seenDone) {
      alreadyGrouped = false
      break
    }
  }
  if (alreadyGrouped) return description

  const lines = description.split('\n')
  const lineIndices = items.map((i) => i.line)
  const unfinished = items.filter((i) => !i.done).map((i) => lines[i.line] ?? '')
  const done = items.filter((i) => i.done).map((i) => lines[i.line] ?? '')
  const reordered = [...unfinished, ...done]

  for (let k = 0; k < lineIndices.length; k++) {
    lines[lineIndices[k]] = reordered[k]
  }
  return lines.join('\n')
}

/**
 * Adds a `- [ ]` line for the text. If done items exist, inserts right before the
 * first done item so unfinished items remain grouped on top.
 */
export function appendBodyChecklist(description: string, text: string): string {
  const newLine = `- [ ] ${text.trim()}`
  const items = parseBodyChecklist(description)
  if (items.length === 0) {
    return description ? `${description.replace(/\n+$/, '')}\n${newLine}` : newLine
  }

  const lines = description.split('\n')
  const firstDoneIndex = items.findIndex((item) => item.done)
  if (firstDoneIndex === -1) {
    const lastItem = items[items.length - 1]
    lines.splice(lastItem.line + 1, 0, newLine)
  } else {
    const firstDoneLine = items[firstDoneIndex].line
    lines.splice(firstDoneLine, 0, newLine)
  }
  return lines.join('\n')
}

/**
 * Toggles the nth checklist item. When marked done, the item automatically
 * moves down below the unfinished items. When unmarked, it moves up into
 * the unfinished items.
 */
export function toggleBodyChecklist(description: string, index: number): string {
  const items = parseBodyChecklist(description)
  const target = items[index]
  if (!target) return description

  const lines = description.split('\n')
  const newDone = !target.done
  const updatedLine = (lines[target.line] ?? '').replace(/- \[[ xX]\]/, newDone ? '- [x]' : '- [ ]')

  const otherItems = items.filter((_, i) => i !== index)
  const unfinished = otherItems.filter((i) => !i.done).map((i) => lines[i.line] ?? '')
  const done = otherItems.filter((i) => i.done).map((i) => lines[i.line] ?? '')

  const reordered = newDone ? [...unfinished, ...done, updatedLine] : [...unfinished, updatedLine, ...done]

  const lineIndices = items.map((i) => i.line)
  for (let k = 0; k < lineIndices.length; k++) {
    lines[lineIndices[k]] = reordered[k]
  }
  return lines.join('\n')
}

/** Removes the nth checklist item's line; anything else is untouched. */
export function deleteBodyChecklist(description: string, index: number): string {
  const item = parseBodyChecklist(description)[index]
  if (!item) return description
  const lines = description.split('\n')
  lines.splice(item.line, 1)
  return lines.join('\n')
}

/** Removes all body checklist lines, returning only the prose description. */
export function stripChecklist(description: string): string {
  const lines = description.split('\n')
  let fenced = false
  const proseLines: string[] = []
  lines.forEach((raw) => {
    if (FENCE_LINE.test(raw.trim())) {
      fenced = !fenced
      proseLines.push(raw)
      return
    }
    if (fenced) {
      proseLines.push(raw)
      return
    }
    if (!CHECKLIST_LINE.test(raw)) {
      proseLines.push(raw)
    }
  })
  return proseLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Replaces the prose part of a note body with new prose, preserving existing checklist items. */
export function setBodyProse(body: string, newProse: string): string {
  const items = parseBodyChecklist(body)
  const checklistLines = items.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`)
  const trimmedProse = newProse.trim()
  if (!checklistLines.length) return trimmedProse
  if (!trimmedProse) return checklistLines.join('\n')
  return `${trimmedProse}\n\n${checklistLines.join('\n')}`
}
