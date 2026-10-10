import { Platform } from 'obsidian'
import type { LowLevelKanbanSettings } from '@low-level-kanban/core'

export function saveShortcutLabel(modifier: LowLevelKanbanSettings['editorSaveModifier']): string {
  if (modifier === 'Shift') return 'Shift+Enter'
  return Platform.isMacOS ? 'Cmd+Enter' : 'Ctrl+Enter'
}
