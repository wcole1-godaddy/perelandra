import React from 'react';

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
        backgroundColor: 'blue',
        padding: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <text fg="white" bg="blue">
        {' '}Field: {activeField} │ Hnau: {hnauCount} │ Tasks: {taskCount}{' '}
      </text>
      <text fg="white" bg="blue">
        {' '}Perelandra v0.1.0{' '}
      </text>
    </box>
  );
}
