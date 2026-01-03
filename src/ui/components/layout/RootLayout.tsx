import React from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { FieldHeaderBar } from './FieldHeaderBar';
import { StatusBar } from './StatusBar';
import { HnauStatusGrid } from '../hnau/HnauStatusGrid';
import { TaskList } from '../tasks/TaskList';
import { EldilStatusList } from '../eldila/EldilStatusList';
import { LogViewer } from '../logs/LogViewer';
import type { PerelandraConfig } from '../../../types/config';
import type { AppState } from '../PerelandraApp';
import { theme } from '../../theme';
import { useNavigation, type FocusPane, type HnauAction, type EldilAction } from '../../hooks/useNavigation';

export interface RootLayoutProps {
  config: PerelandraConfig;
  repoRoot: string;
  state: AppState;
  onFieldSwitch: (fieldName: string) => void;
  onCommand: (message: string) => void;
  onHnauAction?: (action: HnauAction, hnauId: string) => void;
  onEldilAction?: (action: EldilAction, eldilId: string) => void;
  navigationDisabled?: boolean;
}

export function RootLayout({ config, state, onFieldSwitch, onCommand, onHnauAction, onEldilAction, navigationDisabled = false }: RootLayoutProps): React.ReactNode {
  const { width, height } = useTerminalDimensions();

  const panes: FocusPane[] = ['hnau', 'tasks', 'eldila', 'logs'];
  const filteredEldila = state.eldila.filter((e) => e.state.fieldName === state.activeField);
  const itemCounts: Record<FocusPane, number> = {
    tasks: state.tasks.filter((t) => t.fieldName === state.activeField || !t.fieldName).length,
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
      const eldil = filteredEldila[index];
      if (eldil && onEldilAction) {
        onEldilAction(action, eldil.id);
      } else if (action === 'spawn' && onEldilAction) {
        onEldilAction('spawn', '');
      }
    },
    disabled: navigationDisabled,
  });

  const headerHeight = 3;
  const statusBarHeight = 1;
  const logViewerHeight = Math.min(10, Math.floor(height * 0.25));
  const mainContentHeight = height - headerHeight - statusBarHeight - logViewerHeight;

  return (
    <box style={{ width, height, flexDirection: 'column', backgroundColor: theme.surface.base }}>
      <FieldHeaderBar
        activeField={state.activeField}
        fields={state.fields}
        onFieldSwitch={onFieldSwitch}
        height={headerHeight}
      />

      <box style={{ flexDirection: 'row', height: mainContentHeight }}>
        <HnauStatusGrid
          hnauRuntimes={state.hnauRuntimes}
          width={Math.floor(width * 0.35)}
          onAction={onCommand}
          focused={navigation.focusedPane === 'hnau'}
          selectedIndex={navigation.getSelectedIndex('hnau')}
        />
        <box style={{ flexDirection: 'column', flexGrow: 1 }}>
          <TaskList
            tasks={state.tasks}
            fieldName={state.activeField}
            onAction={onCommand}
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

      <LogViewer
        logs={state.logs}
        height={logViewerHeight}
      />

      <StatusBar
        activeField={state.activeField}
        hnauCount={config.hnau.length}
        taskCount={state.tasks.length}
        height={statusBarHeight}
      />
    </box>
  );
}
