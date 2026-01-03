import React from 'react';
import type { EldilRuntime, EldilStatus } from '../../../types/eldil';
import { getFocusBorderStyle, getFocusBorderColor } from '../../hooks/useNavigation';
import { theme } from '../../theme';

export interface EldilStatusListProps {
  eldila: EldilRuntime[];
  fieldName?: string;
  onSelect?: (id: string) => void;
  onAction: (message: string) => void;
  focused?: boolean;
  selectedIndex?: number;
}

function getStatusIcon(status: EldilStatus): string {
  switch (status) {
    case 'running':
      return '▶';
    case 'completed':
      return '✓';
    case 'error':
      return '✗';
    case 'blocked':
      return '⏸';
    case 'idle':
    default:
      return '○';
  }
}

function getStatusColor(status: EldilStatus): string | undefined {
  switch (status) {
    case 'running':
      return theme.status.active;
    case 'completed':
      return theme.status.success;
    case 'error':
      return theme.status.error;
    case 'blocked':
      return theme.status.blocked;
    case 'idle':
    default:
      return theme.status.idle;
  }
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}m`;
}

function getToolBadge(tool: string): string {
  switch (tool) {
    case 'amp':
      return '⚡';
    case 'opencode':
      return '🔧';
    default:
      return '?';
  }
}

export function EldilStatusList({
  eldila,
  fieldName,
  focused = false,
  selectedIndex = 0,
}: EldilStatusListProps): React.ReactNode {
  const filtered = fieldName
    ? eldila.filter((e) => e.state.fieldName === fieldName)
    : eldila;

  const running = filtered.filter((e) => e.state.status === 'running');
  const others = filtered.filter((e) => e.state.status !== 'running');
  const orderedList = [...running, ...others];

  return (
    <box
      style={{
        border: true,
        borderStyle: getFocusBorderStyle(focused),
        borderColor: getFocusBorderColor(focused),
        flexDirection: 'column',
        padding: 1,
        flexGrow: 1,
      }}
    >
      <text fg={theme.text.primary}>
        <strong>Eldila</strong>{' '}
        <span fg={theme.text.muted}>
          ({running.length} running, {filtered.length} total)
        </span>
      </text>
      <text fg={theme.text.muted}>─────────────────────</text>

      {filtered.length === 0 ? (
        <text fg={theme.text.muted}>No eldila active</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {orderedList.map((eldil, idx) => (
            <EldilRow
              key={eldil.id}
              eldil={eldil}
              isSelected={focused && idx === selectedIndex}
            />
          ))}
        </scrollbox>
      )}

      <box style={{ marginTop: 1 }}>
        <text fg={theme.text.muted}>[n] Spawn │ [Enter] View │ [k] Kill</text>
      </box>
    </box>
  );
}

interface EldilRowProps {
  eldil: EldilRuntime;
  isSelected?: boolean;
}

function EldilRow({ eldil, isSelected = false }: EldilRowProps): React.ReactNode {
  const icon = getStatusIcon(eldil.state.status);
  const color = getStatusColor(eldil.state.status);
  const toolBadge = getToolBadge(eldil.config.tool);
  const duration = formatDuration(eldil.state.startedAt);

  return (
    <box style={{ flexDirection: 'row', marginBottom: 0 }}>
      <text fg={isSelected ? theme.accent.primary : color}>
        {isSelected ? '▸ ' : '  '}
        {icon}{' '}
      </text>
      <text>{toolBadge} </text>
      <text fg={isSelected ? theme.accent.primary : theme.text.primary}>{eldil.id}</text>
      <text fg={theme.text.muted}> │ </text>
      <text fg={theme.text.muted}>{eldil.state.fieldName}</text>
      {eldil.state.currentTaskId && (
        <>
          <text fg={theme.text.muted}> → </text>
          <text fg={theme.accent.primary}>{eldil.state.currentTaskId}</text>
        </>
      )}
      <text fg={theme.text.muted}> │ {duration}</text>
      {eldil.state.lastError && (
        <>
          <text fg={theme.text.muted}> │ </text>
          <text fg={theme.status.error}>{eldil.state.lastError.slice(0, 30)}...</text>
        </>
      )}
    </box>
  );
}
