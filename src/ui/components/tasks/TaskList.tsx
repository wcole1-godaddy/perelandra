import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus } from '../../../types/beads';
import { getFocusBorderStyle, getFocusBorderColor } from '../../hooks/useNavigation';
import { theme } from '../../theme';

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

function getStatusColor(status: BeadsTaskStatus): string | undefined {
  switch (status) {
    case 'done':
      return theme.status.success;
    case 'in-progress':
      return theme.status.warning;
    case 'blocked':
      return theme.status.error;
    case 'todo':
    default:
      return theme.status.idle;
  }
}

export function TaskList({
  tasks,
  fieldName,
  focused = false,
  selectedIndex = 0,
}: TaskListProps): React.ReactNode {
  const filteredTasks = tasks.filter((t) => t.fieldName === fieldName || !t.fieldName);

  return (
    <box
      style={{
        border: true,
        borderStyle: getFocusBorderStyle(focused),
        borderColor: getFocusBorderColor(focused),
        flexDirection: 'column',
        padding: 1,
        flexGrow: 1,
      }}
    >
      <text fg={theme.text.primary}>
        <strong>Tasks</strong> <span fg={theme.text.muted}>({filteredTasks.length})</span>
      </text>
      <text fg={theme.text.muted}>─────────────────────</text>

      {filteredTasks.length === 0 ? (
        <text fg={theme.text.muted}>No tasks for this field</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {filteredTasks.map((task, idx) => {
            const icon = getStatusIcon(task.status);
            const color = getStatusColor(task.status);
            const isSelected = focused && idx === selectedIndex;

            return (
              <box key={task.id} style={{ flexDirection: 'row', marginBottom: 0 }}>
                <text fg={isSelected ? theme.accent.primary : color}>
                  {isSelected ? '▸ ' : '  '}
                  {icon}{' '}
                </text>
                <text fg={isSelected ? theme.accent.primary : theme.text.primary}>{task.id}: </text>
                <text fg={isSelected ? theme.accent.primary : theme.text.primary}>{task.title}</text>
              </box>
            );
          })}
        </scrollbox>
      )}

      <box style={{ marginTop: 1 }}>
        <text fg={theme.text.muted}>[n] New │ [Enter] View │ [c] Close</text>
      </box>
    </box>
  );
}
