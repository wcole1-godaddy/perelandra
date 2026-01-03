import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus } from '../../../types/beads';

export interface TaskListProps {
  tasks: BeadsTaskMetadata[];
  fieldName: string;
  onAction: (message: string) => void;
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
      return 'green';
    case 'in-progress':
      return 'yellow';
    case 'blocked':
      return 'red';
    case 'todo':
    default:
      return 'gray';
  }
}

export function TaskList({ tasks, fieldName }: TaskListProps): React.ReactNode {
  const filteredTasks = tasks.filter((t) => t.fieldName === fieldName || !t.fieldName);

  return (
    <box
      style={{
        border: true,
        borderStyle: 'single',
        flexDirection: 'column',
        padding: 1,
        flexGrow: 1,
      }}
    >
      <text>
        <strong>Tasks</strong> <span fg="gray">({filteredTasks.length})</span>
      </text>
      <text fg="gray">─────────────────────</text>

      {filteredTasks.length === 0 ? (
        <text fg="gray">No tasks for this field</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {filteredTasks.map((task) => {
            const icon = getStatusIcon(task.status);
            const color = getStatusColor(task.status);

            return (
              <box key={task.id} style={{ flexDirection: 'row', marginBottom: 0 }}>
                <text fg={color}>{icon} </text>
                <text>{task.id}: </text>
                <text>{task.title}</text>
              </box>
            );
          })}
        </scrollbox>
      )}

      <box style={{ marginTop: 1 }}>
        <text fg="gray">[n] New │ [Enter] View │ [c] Close</text>
      </box>
    </box>
  );
}
