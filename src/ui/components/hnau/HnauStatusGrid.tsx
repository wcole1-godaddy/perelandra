import React from 'react';
import type { HnauRuntime, HnauStatus } from '../../../types/hnau';
import { getFocusBorderStyle, getFocusBorderColor } from '../../hooks/useNavigation';
import { theme } from '../../theme';

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

function getStatusColor(status: HnauStatus): string | undefined {
  switch (status) {
    case 'running':
      return theme.status.running;
    case 'starting':
      return theme.status.starting;
    case 'stopping':
      return theme.status.stopping;
    case 'stopped':
      return theme.status.stopped;
    case 'error':
      return theme.status.error;
    default:
      return theme.text.primary;
  }
}

export function HnauStatusGrid({
  hnauRuntimes,
  width,
  focused = false,
  selectedIndex = 0,
}: HnauStatusGridProps): React.ReactNode {
  return (
    <box
      style={{
        width,
        border: true,
        borderStyle: getFocusBorderStyle(focused),
        borderColor: getFocusBorderColor(focused),
        flexDirection: 'column',
        padding: 1,
      }}
    >
      <text fg={theme.text.primary}>
        <strong>Services (Hnau)</strong>
      </text>
      <text fg={theme.text.muted}>─────────────────────</text>

      {hnauRuntimes.length === 0 ? (
        <text fg={theme.text.muted}>No services configured</text>
      ) : (
        hnauRuntimes.map((runtime, idx) => {
          const icon = getStatusIcon(runtime.status);
          const color = getStatusColor(runtime.status);
          const port = runtime.config.port ? `:${runtime.config.port}` : '';
          const health = runtime.health?.healthy
            ? ' ✓'
            : runtime.health?.healthy === false
            ? ' ✗'
            : '';
          const isSelected = focused && idx === selectedIndex;

          return (
            <box key={runtime.config.id} style={{ flexDirection: 'row' }}>
              <text fg={isSelected ? theme.accent.primary : color}>
                {isSelected ? '▸ ' : '  '}
                {icon}{' '}
              </text>
              <text fg={isSelected ? theme.accent.primary : theme.text.primary}>{runtime.config.id}</text>
              <text fg={theme.text.muted}>{port}{health}</text>
            </box>
          );
        })
      )}

      <box style={{ marginTop: 1 }}>
        <text fg={theme.text.muted}>[s] Start │ [x] Stop │ [r] Restart</text>
      </box>
    </box>
  );
}
