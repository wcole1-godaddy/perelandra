import React from 'react';
import type { BeadsTaskMetadata, EpicStatus } from '../../../types/beads';
import { theme, LeftBorder } from '../../theme';
import { EpicList } from './EpicList';
import { TaskKanban } from './TaskKanban';

export type TasksViewMode = 'epics' | 'issues';

export interface TasksPaneProps {
  tasks: BeadsTaskMetadata[];
  epics: EpicStatus[];
  fieldName: string;
  viewMode: TasksViewMode;
  selectedEpicId?: string;
  onAction: (message: string) => void;
  onViewModeChange: (mode: TasksViewMode) => void;
  onEpicSelect?: (epicId: string) => void;
  focused?: boolean;
  selectedIndex?: number;
}

export function TasksPane({
  tasks,
  epics,
  fieldName,
  viewMode,
  selectedEpicId,
  onAction,
  onViewModeChange: _onViewModeChange,
  focused = false,
  selectedIndex = 0,
}: TasksPaneProps): React.ReactNode {
  void _onViewModeChange;
  const borderColor = focused ? theme.borderActive : theme.border;

  const filteredTasks = selectedEpicId
    ? tasks.filter((t) => t.id.startsWith(selectedEpicId))
    : tasks.filter((t) => t.fieldName === fieldName || !t.fieldName);

  return (
    <box
      style={{
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        flexGrow: 1,
        ...LeftBorder,
        borderColor,
      }}
    >
      {/* View toggle header */}
      <box
        style={{
          flexDirection: 'row',
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 1,
          gap: 2,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            gap: 1,
          }}
        >
          <text fg={viewMode === 'epics' ? theme.primary : theme.textMuted}>
            {`${viewMode === 'epics' ? '●' : '○'} Epics`}
          </text>
          <text fg={theme.textMuted}>|</text>
          <text fg={viewMode === 'issues' ? theme.primary : theme.textMuted}>
            {`${viewMode === 'issues' ? '●' : '○'} Issues`}
          </text>
        </box>
        <box style={{ flexGrow: 1 }} />
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.accent}>v</text>
          <text fg={theme.textMuted}>toggle</text>
        </box>
        {selectedEpicId && viewMode === 'issues' && (
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>|</text>
            <text fg={theme.accent}>{selectedEpicId}</text>
            <text fg={theme.textMuted}>(Esc to clear)</text>
          </box>
        )}
      </box>

      {/* Content area */}
      <box style={{ flexGrow: 1, paddingTop: 1 }}>
        {viewMode === 'epics' ? (
          <EpicList
            epics={epics}
            fieldName={fieldName}
            onAction={onAction}
            focused={focused}
            selectedIndex={selectedIndex}
          />
        ) : (
          <TaskKanban
            tasks={filteredTasks}
            fieldName={fieldName}
            onAction={onAction}
            focused={focused}
            selectedIndex={selectedIndex}
          />
        )}
      </box>
    </box>
  );
}
