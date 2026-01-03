import React from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { FieldHeaderBar } from './FieldHeaderBar';
import { StatusBar } from './StatusBar';
import { HnauStatusGrid } from '../hnau/HnauStatusGrid';
import { TasksPane, type TasksViewMode } from '../tasks/TasksPane';
import { EldilStatusList } from '../eldila/EldilStatusList';

import type { PerelandraConfig } from '../../../types/config';
import type { AppState } from '../PerelandraApp';
import { theme } from '../../theme';
import { useNavigation, type FocusPane, type HnauAction, type EldilAction, type TaskAction } from '../../hooks/useNavigation';

export interface RootLayoutProps {
  config: PerelandraConfig;
  repoRoot: string;
  state: AppState;
  onFieldSwitch: (fieldName: string) => void;
  onCommand: (message: string) => void;
  onHnauAction?: (action: HnauAction, hnauId: string) => void;
  onEldilAction?: (action: EldilAction, eldilId: string) => void;
  onTaskAction?: (action: TaskAction, taskId: string) => void;
  onViewModeChange?: (mode: TasksViewMode) => void;
  onEpicSelect?: (epicId: string) => void;
  onClearEpicFilter?: () => void;
  navigationDisabled?: boolean;
}

export function RootLayout({ config, state, onFieldSwitch, onCommand, onHnauAction, onEldilAction, onTaskAction, onViewModeChange, onEpicSelect, onClearEpicFilter, navigationDisabled = false }: RootLayoutProps): React.ReactNode {
  const { width, height } = useTerminalDimensions();

  const panes: FocusPane[] = ['hnau', 'tasks', 'eldila'];
  const filteredEldila = state.eldila.filter((e) => e.state.fieldName === state.activeField);
  
  const getTasksItemCount = () => {
    if (state.tasksViewMode === 'epics') {
      return state.epics.length;
    }
    return state.tasks.filter((t) => t.fieldName === state.activeField || !t.fieldName).length;
  };

  const itemCounts: Record<FocusPane, number> = {
    tasks: getTasksItemCount(),
    hnau: state.hnauRuntimes.length,
    logs: state.logs.length,
    eldila: filteredEldila.length,
  };

  const navigation = useNavigation({
    panes,
    itemCounts,
    onEnter: (pane, index) => {
      onCommand(`[Action] ${pane}[${index}] selected`);
    },
    onAction: (action) => {
      onCommand(`[Nav] ${action}`);
    },
    onHnauAction: (action, index) => {
      const hnau = state.hnauRuntimes[index];
      if (hnau && onHnauAction) {
        onHnauAction(action, hnau.config.id);
      }
    },
    onEldilAction: (action, index) => {
      onCommand(`[DEBUG] eldilAction: ${action} index=${index} count=${filteredEldila.length}`);
      const eldil = filteredEldila[index];
      if (eldil && onEldilAction) {
        onEldilAction(action, eldil.id);
      } else if (action === 'spawn' && onEldilAction) {
        onEldilAction('spawn', '');
      } else {
        onCommand(`[DEBUG] No eldil at index ${index}`);
      }
    },
    onTaskAction: (action, index) => {
      if (state.tasksViewMode === 'epics') {
        const epic = state.epics[index];
        if (epic && action === 'view' && onEpicSelect) {
          onEpicSelect(epic.epic.id);
        } else if (action === 'new' && onTaskAction) {
          onTaskAction('new', '');
        }
      } else {
        const filteredTasks = state.tasks.filter((t) => t.fieldName === state.activeField || !t.fieldName);
        const columns = ['todo', 'in-progress', 'done'] as const;
        const allTasksFlat = columns.flatMap((status) =>
          filteredTasks.filter((t) => t.status === status)
        );
        const task = allTasksFlat[index];
        if (task && onTaskAction) {
          onTaskAction(action, task.id);
        } else if (action === 'new' && onTaskAction) {
          onTaskAction('new', '');
        }
      }
    },
    onToggleTasksView: () => {
      if (onViewModeChange) {
        const newMode = state.tasksViewMode === 'epics' ? 'issues' : 'epics';
        onViewModeChange(newMode);
      }
    },
    onShowEpicGraph: (index) => {
      if (state.tasksViewMode === 'epics' && onEpicSelect) {
        const epic = state.epics[index];
        if (epic) {
          onEpicSelect(epic.epic.id);
        }
      }
    },
    onClearEpicFilter: () => {
      if (onClearEpicFilter) {
        onClearEpicFilter();
      }
    },
    disabled: navigationDisabled,
  });

  const headerHeight = 3;
  const statusBarHeight = 1;
  const mainContentHeight = height - headerHeight - statusBarHeight;

  // Opencode-style layout:
  // - Main background is dark (background)
  // - Panels have slightly lighter background (backgroundPanel)
  // - Left borders only for panel separation
  // - Consistent padding (paddingLeft: 2, paddingTop: 1)
  
  const leftColumnWidth = Math.floor(width * 0.35);
  const rightColumnWidth = width - leftColumnWidth;

  return (
    <box style={{ width, height, flexDirection: 'column', backgroundColor: theme.background }}>
      {/* Header */}
      <FieldHeaderBar
        activeField={state.activeField}
        fields={state.fields}
        onFieldSwitch={onFieldSwitch}
        height={headerHeight}
      />

      {/* Main content area */}
      <box style={{ flexDirection: 'row', height: mainContentHeight, overflow: 'hidden' }}>
        {/* Left column: Services */}
        <HnauStatusGrid
          hnauRuntimes={state.hnauRuntimes}
          width={leftColumnWidth}
          onAction={onCommand}
          focused={navigation.focusedPane === 'hnau'}
          selectedIndex={navigation.getSelectedIndex('hnau')}
        />

        {/* Right column: Tasks + Eldila stacked */}
        <box style={{ flexDirection: 'column', width: rightColumnWidth }}>
          <TasksPane
            tasks={state.tasks}
            epics={state.epics}
            fieldName={state.activeField}
            viewMode={state.tasksViewMode}
            selectedEpicId={state.filteredEpicId ?? undefined}
            onAction={onCommand}
            onViewModeChange={onViewModeChange ?? (() => {})}
            onEpicSelect={onEpicSelect}
            focused={navigation.focusedPane === 'tasks'}
            selectedIndex={navigation.getSelectedIndex('tasks')}
          />
          <EldilStatusList
            eldila={state.eldila}
            fieldName={state.activeField}
            onAction={onCommand}
            focused={navigation.focusedPane === 'eldila'}
            selectedIndex={navigation.getSelectedIndex('eldila')}
          />
        </box>
      </box>

      {/* Status bar */}
      <StatusBar
        activeField={state.activeField}
        hnauCount={config.hnau.length}
        taskCount={state.tasks.length}
        eldilCount={filteredEldila.length}
        height={statusBarHeight}
        themeFlavor={state.themeFlavor}
      />
    </box>
  );
}
