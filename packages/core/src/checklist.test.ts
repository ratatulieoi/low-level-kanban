import { describe, expect, it } from 'vitest'
import {
  appendBodyChecklist,
  checklistProgress,
  deleteBodyChecklist,
  groupBodyChecklist,
  parseBodyChecklist,
  setBodyProse,
  stripChecklist,
  toggleBodyChecklist
} from './checklist'

describe('parseBodyChecklist', () => {
  it('reads unchecked and checked lines with their text', () => {
    const items = parseBodyChecklist('- [ ] alpha\n- [x] beta')
    expect(items).toEqual([
      { line: 0, done: false, text: 'alpha' },
      { line: 1, done: true, text: 'beta' }
    ])
  })

  it('ignores prose and indented checkboxes', () => {
    expect(parseBodyChecklist('notes\n  - [ ] nested\n- plain dash')).toEqual([])
  })

  it('skips lines inside fenced code blocks', () => {
    const body = ['```', '- [ ] not a subtask', '```', '- [ ] real'].join('\n')
    expect(parseBodyChecklist(body)).toEqual([{ line: 3, done: false, text: 'real' }])
  })
})

describe('groupBodyChecklist', () => {
  it('groups unfinished subtasks on top and done subtasks on the bottom', () => {
    const mixed = '- [x] this\n- [ ] a\n- [x] test\n- [ ] and'
    expect(groupBodyChecklist(mixed)).toBe('- [ ] a\n- [ ] and\n- [x] this\n- [x] test')
  })

  it('preserves surrounding prose and leaves single/empty checklists alone', () => {
    const withProse = 'Some prose\n\n- [x] done\n- [ ] todo\n\nFooter note'
    expect(groupBodyChecklist(withProse)).toBe('Some prose\n\n- [ ] todo\n- [x] done\n\nFooter note')
    expect(groupBodyChecklist('')).toBe('')
    expect(groupBodyChecklist('- [ ] only')).toBe('- [ ] only')
  })
})

describe('toggleBodyChecklist', () => {
  it('flips the nth item and leaves the rest of the body alone', () => {
    const body = 'intro\n- [ ] one\n- [ ] two'
    expect(toggleBodyChecklist(body, 1)).toBe('intro\n- [ ] one\n- [x] two')
  })

  it('moves newly checked item down to the bottom of the list', () => {
    const body = '- [ ] one\n- [ ] two\n- [x] three'
    expect(toggleBodyChecklist(body, 0)).toBe('- [ ] two\n- [x] three\n- [x] one')
  })

  it('moves newly unchecked item up into the unfinished group', () => {
    const body = '- [ ] two\n- [x] three\n- [x] one'
    expect(toggleBodyChecklist(body, 1)).toBe('- [ ] two\n- [ ] three\n- [x] one')
  })

  it('returns the body unchanged for an out-of-range index', () => {
    const body = '- [ ] one'
    expect(toggleBodyChecklist(body, 3)).toBe(body)
  })
})

describe('appendBodyChecklist and deleteBodyChecklist', () => {
  it('appends a checklist line at the end of the body when no checklist exists', () => {
    expect(appendBodyChecklist('notes', 'new item')).toBe('notes\n- [ ] new item')
    expect(appendBodyChecklist('', 'first')).toBe('- [ ] first')
  })

  it('inserts new item before done items so unfinished items remain on top', () => {
    const body = '- [ ] one\n- [x] two'
    expect(appendBodyChecklist(body, 'new item')).toBe('- [ ] one\n- [ ] new item\n- [x] two')
  })

  it('removes the nth item line and keeps everything else', () => {
    const body = 'intro\n- [ ] one\n- [x] two\noutro'
    expect(deleteBodyChecklist(body, 0)).toBe('intro\n- [x] two\noutro')
  })
})

describe('checklistProgress', () => {
  it('reads a body with no checklist lines as 0', () => {
    expect(checklistProgress('just prose')).toBe(0)
    expect(checklistProgress('')).toBe(0)
  })

  it('reads an all-done checklist as 100', () => {
    expect(checklistProgress('- [x] one\n- [X] two')).toBe(100)
  })

  it('rounds done over total', () => {
    expect(checklistProgress('- [x] one\n- [ ] two\n- [ ] three')).toBe(33)
  })
})

describe('stripChecklist and setBodyProse', () => {
  it('strips checklist lines from description prose', () => {
    const body = 'Here is the description.\n\n- [ ] Subtask 1\n- [x] Subtask 2\n\nMore notes.'
    expect(stripChecklist(body)).toBe('Here is the description.\n\nMore notes.')
  })

  it('returns empty string if only checklist lines exist', () => {
    expect(stripChecklist('- [ ] One\n- [x] Two')).toBe('')
  })

  it('preserves checklist items while updating prose', () => {
    const body = 'Old prose\n\n- [ ] Item 1\n- [x] Item 2'
    expect(setBodyProse(body, 'New prose')).toBe('New prose\n\n- [ ] Item 1\n- [x] Item 2')
  })
})
