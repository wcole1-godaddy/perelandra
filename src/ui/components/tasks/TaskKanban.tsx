import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus } from '../../../types/beads';
import { theme, LeftBorder } from '../../theme';

export interface TaskKanbanProps {
  tasks: BeadsTaskMetadata[];
  fieldName: string;
  onAction: (message: string) => void;
  focused?: boolean;
  selectedIndex?: number;
  onSelect?: (task: BeadsTaskMetadata) => void;
}

interface KanbanColumn {
  status: BeadsTaskStatus;
  label: string;
  icon: string;
  color: string;
}

const columns: KanbanColumn[] = [
  { status: 'todo', label: 'Todo', icon: '○', color: theme.statusIdle },
  { status: 'in-progress', label: 'Active', icon: '●', color: theme.statusWarning },
  { status: 'done', label: 'Done', icon: '✓', color: theme.statusSuccess },
];

function TaskCard({
  task,
  isSelected,
  compact = false,
}: {
  task: BeadsTaskMetadata;
  isSelected: boolean;
  compact?: boolean;
}): React.ReactNode {
  const bgColor = isSelected ? theme.primary : theme.backgroundElement;
  const fgColor = isSelected ? theme.selectedForeground : theme.text;

  return (
    <box
      style={{
        backgroundColor: bgColor,
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: compact ? 0 : 1,
        flexDirection: 'column',
      }}
    >
      <text fg={fgColor} bold={isSelected}>
        {isSelected ? '▸ ' : ''}{task.id}
      </text>
      <text fg={isSelected ? fgColor : theme.textMuted}>
        {task.title}
      </text>
      {task.hnauIds && task.hnauIds.length > 0 && (
        <text fg={isSelected ? fgColor : theme.accent}>
          ↳ {task.hnauIds.join(', ')}
        </text>
      )}
    </box>
  );
}

function KanbanColumnComponent({
  column,
  tasks,
  selectedTaskId,
  focused,
}: {
  column: KanbanColumn;
  tasks: BeadsTaskMetadata[];
  selectedTaskId?: string;
  focused: boolean;
}): React.ReactNode {
  const columnTasks = tasks.filter((t) => t.status === column.status);

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        flexBasis: 0,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {/* Column header */}
      <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
        <text fg={column.color} bold>
          {column.icon}
        </text>
        <text fg={theme.text} bold>
          {column.label}
        </text>
        <text fg={theme.textMuted}>({columnTasks.length})</text>
      </box>

      {/* Task cards */}
      <scrollbox style={{ flexGrow: 1 }}>
        {columnTasks.length === 0 ? (
          <text fg={theme.textMuted}>—</text>
        ) : (
          columnTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={focused && task.id === selectedTaskId}
            />
          ))
        )}
      </scrollbox>
    </box>
  );
}

export function TaskKanban({
  tasks,
  fieldName,
  focused = false,
  selectedIndex = 0,
}: TaskKanbanProps): React.ReactNode {
  const filteredTasks = tasks.filter((t) => t.fieldName === fieldName || !t.fieldName);
  const borderColor = focused ? theme.borderActive : theme.border;

  const allTasksFlat = columns.flatMap((col) =>
    filteredTasks.filter((t) => t.status === col.status)
  );
  const selectedTask = allTasksFlat[selectedIndex];

  return (
    <box
      style={{
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 1,
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
        <text fg={theme.text} bold>
          Tasks
        </text>
        <text fg={theme.textMuted}>({filteredTasks.length})</text>
      </box>

      {/* Kanban columns */}
      <box style={{ flexDirection: 'row', flexGrow: 1, gap: 1 }}>
        {columns.map((col) => (
          <KanbanColumnComponent
            key={col.status}
            column={col}
            tasks={filteredTasks}
            selectedTaskId={selectedTask?.id}
            focused={focused}
          />
        ))}
      </box>

      {/* Footer keybinds */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>n</text>
        <text fg={theme.text}>new</text>
        <text fg={theme.textMuted}>↵</text>
        <text fg={theme.text}>view</text>
        <text fg={theme.textMuted}>c</text>
        <text fg={theme.text}>close</text>
      </box>
    </box>
  );
}
