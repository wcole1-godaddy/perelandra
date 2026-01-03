import React from 'react';
import type { EldilRuntime, EldilStatus } from '../../../types/eldil';
import { theme, LeftBorder } from '../../theme';

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

function getStatusColor(status: EldilStatus): string {
  switch (status) {
    case 'running':
      return theme.statusActive;
    case 'completed':
      return theme.statusSuccess;
    case 'error':
      return theme.statusError;
    case 'blocked':
      return theme.statusBlocked;
    case 'idle':
    default:
      return theme.statusIdle;
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

  const borderColor = focused ? theme.borderActive : theme.border;

  return (
    <box
      style={{
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 2,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        flexGrow: 1,
        ...LeftBorder,
        borderColor,
      }}
    >
      {/* Header */}
      <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
        <text fg={theme.text} bold>Eldila</text>
        <text fg={theme.textMuted}>({running.length} running, {filtered.length} total)</text>
      </box>

      {/* List */}
      {filtered.length === 0 ? (
        <text fg={theme.textMuted}>No eldila active</text>
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

      {/* Footer keybinds */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>n</text>
        <text fg={theme.text}>spawn</text>
        <text fg={theme.textMuted}>enter</text>
        <text fg={theme.text}>view</text>
        <text fg={theme.textMuted}>k</text>
        <text fg={theme.text}>kill</text>
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
      <text>{toolBadge} </text>
      <text fg={isSelected ? theme.selectedForeground : theme.text}>{eldil.id}</text>
      <text fg={isSelected ? theme.selectedForeground : theme.textMuted}> │ </text>
      <text fg={isSelected ? theme.selectedForeground : theme.textMuted}>{eldil.state.fieldName}</text>
      {eldil.state.currentTaskId && (
        <>
          <text fg={isSelected ? theme.selectedForeground : theme.textMuted}> → </text>
          <text fg={isSelected ? theme.selectedForeground : theme.accent}>{eldil.state.currentTaskId}</text>
        </>
      )}
      <text fg={isSelected ? theme.selectedForeground : theme.textMuted}> │ {duration}</text>
      {eldil.state.lastError && (
        <>
          <text fg={isSelected ? theme.selectedForeground : theme.textMuted}> │ </text>
          <text fg={theme.statusError}>{eldil.state.lastError.slice(0, 25)}...</text>
        </>
      )}
    </box>
  );
}
