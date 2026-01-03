import React from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { FieldHeaderBar } from './FieldHeaderBar';
import { StatusBar } from './StatusBar';
import { HnauStatusGrid } from '../hnau/HnauStatusGrid';
import { TaskList } from '../tasks/TaskList';
import { LogViewer } from '../logs/LogViewer';
import type { PerelandraConfig } from '../../../types/config';
import type { AppState } from '../PerelandraApp';

export interface RootLayoutProps {
  config: PerelandraConfig;
  repoRoot: string;
  state: AppState;
  onFieldSwitch: (fieldName: string) => void;
  onCommand: (message: string) => void;
}

export function RootLayout({ config, state, onFieldSwitch, onCommand }: RootLayoutProps): React.ReactNode {
  const { width, height } = useTerminalDimensions();

  const headerHeight = 3;
  const statusBarHeight = 1;
  const logViewerHeight = Math.min(10, Math.floor(height * 0.25));
  const mainContentHeight = height - headerHeight - statusBarHeight - logViewerHeight;

  return (
    <box style={{ width, height, flexDirection: 'column' }}>
      <FieldHeaderBar
        activeField={state.activeField}
        fields={state.fields}
        onFieldSwitch={onFieldSwitch}
        height={headerHeight}
      />

      <box style={{ flexDirection: 'row', height: mainContentHeight }}>
        <HnauStatusGrid
          hnauRuntimes={state.hnauRuntimes}
          width={Math.floor(width * 0.4)}
          onAction={onCommand}
        />
        <box style={{ flexDirection: 'column', flexGrow: 1 }}>
          <TaskList
            tasks={state.tasks}
            fieldName={state.activeField}
            onAction={onCommand}
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
