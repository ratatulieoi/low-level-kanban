import { normalizeSnapshot, type ReadableSnapshot } from '@low-level-kanban/snapshot'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The self-contained page: the viewer template with the language and title filled in and
 * the snapshot embedded as JSON. Every `<` in the JSON is written as a unicode escape, so
 * no task text can close the script tag or open a comment.
 */
export function renderSnapshotHtml(snapshot: ReadableSnapshot, template: string = __VIEWER_TEMPLATE__): string {
  if (!template) throw new Error('this build carries no viewer; run the viewer build first')
  const json = JSON.stringify(normalizeSnapshot(snapshot)).replace(/</g, '\\u003c')
  return template
    .split('__LOW_LEVEL_KANBAN_LOCALE__')
    .join(escapeHtml(snapshot.locale))
    .split('__LOW_LEVEL_KANBAN_TITLE__')
    .join(escapeHtml(snapshot.title))
    .split('__LOW_LEVEL_KANBAN_SNAPSHOT__')
    .join(json)
}
