import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus } from '../../../types/beads';
import { theme, LeftBorder } from '../../theme';

export interface TaskListProps {
  tasks: BeadsTaskMetadata[];
  fieldName: string;
  onAction: (message: string) => void;
  focused?: boolean;
  selectedIndex?: number;
  onSelect?: (task: BeadsTaskMetadata) => void;
}

function getStatusIcon(status: BeadsTaskStatus): string {
  switch (status) {
    case 'done':
      return '✓';
    case 'in-progress':
      return '●';
    case 'blocked':
      return '✗';
    case 'todo':
    default:
      return '○';
  }
}

function getStatusColor(status: BeadsTaskStatus): string {
  switch (status) {
    case 'done':
      return theme.statusSuccess;
    case 'in-progress':
      return theme.statusWarning;
    case 'blocked':
      return theme.statusError;
    case 'todo':
    default:
      return theme.statusIdle;
  }
}

export function TaskList({
  tasks,
  fieldName,
  focused = false,
  selectedIndex = 0,
}: TaskListProps): React.ReactNode {
  const filteredTasks = tasks.filter((t) => t.fieldName === fieldName || !t.fieldName);
  const borderColor = focused ? theme.borderActive : theme.border;

  return (
    <box
      style={{
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 2,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        flexGrow: 1,
        ...LeftBorder,
        borderColor,
      }}
    >
      {/* Header */}
      <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
        <text fg={theme.text} bold>Tasks</text>
        <text fg={theme.textMuted}>({filteredTasks.length})</text>
      </box>

      {/* List */}
      {filteredTasks.length === 0 ? (
        <text fg={theme.textMuted}>No tasks for this field</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {filteredTasks.map((task, idx) => {
            const icon = getStatusIcon(task.status);
            const color = getStatusColor(task.status);
            const isSelected = focused && idx === selectedIndex;

            return (
              <box
                key={task.id}
                style={{
                  flexDirection: 'row',
                  backgroundColor: isSelected ? theme.primary : undefined,
                  paddingLeft: isSelected ? 0 : 1,
                }}
              >
                <text fg={isSelected ? theme.selectedForeground : color}>
                  {isSelected ? '▸' : ' '} {icon}{' '}
                </text>
                <text fg={isSelected ? theme.selectedForeground : theme.text}>
                  {task.id}:{' '}
                </text>
                <text fg={isSelected ? theme.selectedForeground : theme.text}>
                  {task.title}
                </text>
              </box>
            );
          })}
        </scrollbox>
      )}

      {/* Footer keybinds */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>n</text>
        <text fg={theme.text}>new</text>
        <text fg={theme.textMuted}>enter</text>
        <text fg={theme.text}>view</text>
        <text fg={theme.textMuted}>c</text>
        <text fg={theme.text}>close</text>
      </box>
    </box>
  );
}
