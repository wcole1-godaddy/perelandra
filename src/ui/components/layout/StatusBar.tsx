import React from 'react';
import { theme } from '../../theme';

export interface StatusBarProps {
  activeField: string;
  hnauCount: number;
  taskCount: number;
  height: number;
}

export function StatusBar({ activeField, hnauCount, taskCount, height }: StatusBarProps): React.ReactNode {
  return (
    <box
      style={{
        height,
        backgroundColor: theme.statusBar.bg,
        padding: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <text fg={theme.statusBar.fg}>
        {' '}Field: {activeField} │ Hnau: {hnauCount} │ Tasks: {taskCount}{' '}
      </text>
      <text fg={theme.statusBar.fg}>
        {' '}Perelandra v0.1.0{' '}
      </text>
    </box>
  );
}
