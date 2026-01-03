import React from 'react';
import type { HnauRuntime, HnauStatus } from '../../../types/hnau';

export interface HnauStatusGridProps {
  hnauRuntimes: HnauRuntime[];
  width: number;
  onAction: (message: string) => void;
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
      return 'green';
    case 'starting':
    case 'stopping':
      return 'yellow';
    case 'stopped':
      return 'gray';
    case 'error':
      return 'red';
    default:
      return 'white';
  }
}

export function HnauStatusGrid({ hnauRuntimes, width }: HnauStatusGridProps): React.ReactNode {
  return (
    <box
      style={{
        width,
        border: true,
        borderStyle: 'single',
        flexDirection: 'column',
        padding: 1,
      }}
    >
      <text>
        <strong>Services (Hnau)</strong>
      </text>
      <text fg="gray">─────────────────────</text>

      {hnauRuntimes.length === 0 ? (
        <text fg="gray">No services configured</text>
      ) : (
        hnauRuntimes.map((runtime) => {
          const icon = getStatusIcon(runtime.status);
          const color = getStatusColor(runtime.status);
          const port = runtime.config.port ? `:${runtime.config.port}` : '';
          const health = runtime.health?.healthy
            ? ' ✓'
            : runtime.health?.healthy === false
            ? ' ✗'
            : '';

          return (
            <box key={runtime.config.id} style={{ flexDirection: 'row' }}>
              <text fg={color}>{icon} </text>
              <text>{runtime.config.id}</text>
              <text fg="gray">{port}{health}</text>
            </box>
          );
        })
      )}

      <box style={{ marginTop: 1 }}>
        <text fg="gray">[s] Start │ [x] Stop │ [r] Restart</text>
      </box>
    </box>
  );
}
