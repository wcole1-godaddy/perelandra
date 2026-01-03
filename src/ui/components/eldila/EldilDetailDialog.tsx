import React from 'react';
import { Dialog } from '../common/Dialog';
import type { EldilRuntime, EldilStatus } from '../../../types/eldil';
import { theme } from '../../theme';

export interface EldilDetailDialogProps {
  eldil: EldilRuntime | null;
  isOpen: boolean;
  onClose: () => void;
  onStop: (eldilId: string) => void;
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

function getToolBadge(tool: string): string {
  switch (tool) {
    case 'amp':
      return '⚡ Amp';
    case 'opencode':
      return '🔧 Opencode';
    default:
      return tool;
  }
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}m`;
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return ts;
  }
}

export function EldilDetailDialog({
  eldil,
  isOpen,
  onClose,
}: EldilDetailDialogProps): React.ReactNode {
  if (!eldil) return null;

  const icon = getStatusIcon(eldil.state.status);
  const color = getStatusColor(eldil.state.status);
  const recentOutputs = eldil.outputs.slice(-20);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Eldil: ${eldil.id}`}
      size="large"
      footerHints={[
        { key: 'esc', label: 'close' },
      ]}
    >
      <scrollbox style={{ flexGrow: 1 }}>
        {/* Status & Tool */}
        <box style={{ flexDirection: 'row', gap: 2 }}>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>Status:</text>
            <text fg={color}>{icon} {eldil.state.status}</text>
          </box>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>Tool:</text>
            <text fg={theme.text}>{getToolBadge(eldil.config.tool)}</text>
          </box>
        </box>

        {/* Field & Task */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 2 }}>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>Field:</text>
            <text fg={theme.accent}>{eldil.state.fieldName}</text>
          </box>
          {eldil.state.currentTaskId && (
            <box style={{ flexDirection: 'row', gap: 1 }}>
              <text fg={theme.textMuted}>Task:</text>
              <text fg={theme.primary}>{eldil.state.currentTaskId}</text>
            </box>
          )}
        </box>

        {/* Timing */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 2 }}>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>Started:</text>
            <text fg={theme.text}>{formatTimestamp(eldil.state.startedAt)}</text>
          </box>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>Duration:</text>
            <text fg={theme.text}>{formatDuration(eldil.state.startedAt)}</text>
          </box>
        </box>

        {/* Process info */}
        {eldil.process && (
          <box style={{ flexDirection: 'row', marginTop: 1, gap: 2 }}>
            {eldil.process.pid && (
              <box style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>PID:</text>
                <text fg={theme.text}>{eldil.process.pid}</text>
              </box>
            )}
            {eldil.process.tmuxPane && (
              <box style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>Tmux:</text>
                <text fg={theme.text}>{eldil.process.tmuxPane}</text>
              </box>
            )}
            {eldil.process.exitCode !== undefined && (
              <box style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>Exit:</text>
                <text fg={eldil.process.exitCode === 0 ? theme.statusSuccess : theme.statusError}>
                  {eldil.process.exitCode}
                </text>
              </box>
            )}
          </box>
        )}

        {/* Thread URL */}
        {eldil.state.threadUrl && (
          <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
            <text fg={theme.textMuted}>Thread:</text>
            <text fg={theme.primary}>{eldil.state.threadUrl}</text>
          </box>
        )}

        {/* Error */}
        {eldil.state.lastError && (
          <box style={{ marginTop: 1, flexDirection: 'column' }}>
            <text fg={theme.statusError}>Error:</text>
            <text fg={theme.text}>{eldil.state.lastError}</text>
          </box>
        )}

        {/* Output */}
        {recentOutputs.length > 0 && (
          <box style={{ marginTop: 2, flexDirection: 'column' }}>
            <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
              <text fg={theme.textMuted}>Recent Output</text>
              <text fg={theme.textMuted}>({eldil.outputs.length} total)</text>
            </box>
            <box
              style={{
                backgroundColor: theme.backgroundElement,
                padding: 1,
                flexDirection: 'column',
              }}
            >
              {recentOutputs.map((output, idx) => (
                <box key={idx} style={{ flexDirection: 'row', gap: 1 }}>
                  <text fg={output.type === 'error' ? theme.statusError : theme.textMuted}>
                    {output.type === 'error' ? '!' : '>'}
                  </text>
                  <text fg={theme.text}>
                    {(output.content ?? '').slice(0, 100)}
                    {(output.content?.length ?? 0) > 100 ? '...' : ''}
                  </text>
                </box>
              ))}
            </box>
          </box>
        )}
      </scrollbox>
    </Dialog>
  );
}
