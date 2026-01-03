import React from 'react';
import type { HnauRuntime, HnauStatus } from '../../../types/hnau';
import { theme, LeftBorder } from '../../theme';

export interface HnauStatusGridProps {
  hnauRuntimes: HnauRuntime[];
  width: number;
  onAction: (message: string) => void;
  focused?: boolean;
  selectedIndex?: number;
}

function getStatusIcon(status: HnauStatus): string {
  switch (status) {
    case 'running':
      return '●';
    case 'starting':
      return '◐';
    case 'stopping':
      return '◑';
    case 'stopped':
      return '○';
    case 'error':
      return '✗';
    default:
      return '?';
  }
}

function getStatusColor(status: HnauStatus): string {
  switch (status) {
    case 'running':
      return theme.statusRunning;
    case 'starting':
      return theme.statusStarting;
    case 'stopping':
      return theme.statusStopping;
    case 'stopped':
      return theme.statusStopped;
    case 'error':
      return theme.statusError;
    default:
      return theme.text;
  }
}

export function HnauStatusGrid({
  hnauRuntimes,
  width,
  focused = false,
  selectedIndex = 0,
}: HnauStatusGridProps): React.ReactNode {
  const borderColor = focused ? theme.borderActive : theme.border;

  return (
    <box
      style={{
        width,
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 2,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        ...LeftBorder,
        borderColor,
      }}
    >
      {/* Header */}
      <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
        <text fg={theme.text} bold>Services</text>
        <text fg={theme.textMuted}>({hnauRuntimes.length})</text>
      </box>

      {/* List */}
      {hnauRuntimes.length === 0 ? (
        <text fg={theme.textMuted}>No services configured</text>
      ) : (
        <box style={{ flexDirection: 'column', flexGrow: 1 }}>
          {hnauRuntimes.map((runtime, idx) => {
            const icon = getStatusIcon(runtime.status);
            const color = getStatusColor(runtime.status);
            const port = runtime.config.port ? `:${runtime.config.port}` : '';
            const health = runtime.health?.healthy
              ? ' ✓'
              : runtime.health?.healthy === false
              ? ' ✗'
              : '';
            const isSelected = focused && idx === selectedIndex;
            const hasError = runtime.status === 'error' && runtime.lastError;

            return (
              <box key={runtime.config.id} style={{ flexDirection: 'column' }}>
                <box
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
                    {runtime.config.id}
                  </text>
                  <text fg={isSelected ? theme.selectedForeground : theme.textMuted}>
                    {port}{health}
                  </text>
                </box>
                {hasError && (
                  <text fg={theme.statusError}>    └ {runtime.lastError?.slice(0, 50)}...</text>
                )}
              </box>
            );
          })}
        </box>
      )}

      {/* Footer keybinds */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>s</text>
        <text fg={theme.text}>start</text>
        <text fg={theme.textMuted}>x</text>
        <text fg={theme.text}>stop</text>
        <text fg={theme.textMuted}>r</text>
        <text fg={theme.text}>restart</text>
      </box>
    </box>
  );
}
