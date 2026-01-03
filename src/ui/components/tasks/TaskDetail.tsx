import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus, TaskHistoryEntry } from '../../../types/beads';
import { theme } from '../../theme';

export interface TaskDetailProps {
  task: BeadsTaskMetadata;
  history?: TaskHistoryEntry[];
  onClose: () => void;
  onStatusChange: (status: BeadsTaskStatus) => void;
  onAction: (message: string) => void;
}

function getStatusIcon(status: BeadsTaskStatus): string {
  switch (status) {
    case 'done':
      return '✓';
    case 'in-progress':
      return '●';
    case 'blocked':
      return '✗';
    case 'todo':
    default:
      return '○';
  }
}

function getStatusColor(status: BeadsTaskStatus): string | undefined {
  switch (status) {
    case 'done':
      return theme.status.success;
    case 'in-progress':
      return theme.status.warning;
    case 'blocked':
      return theme.status.error;
    case 'todo':
    default:
      return theme.status.idle;
  }
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return ts;
  }
}

export function TaskDetail({
  task,
  history = [],
  onClose: _onClose,
  onStatusChange: _onStatusChange,
}: TaskDetailProps): React.ReactNode {
  void _onClose;
  void _onStatusChange;
  const icon = getStatusIcon(task.status);
  const color = getStatusColor(task.status);

  return (
    <box
      style={{
        border: true,
        borderStyle: 'double',
        flexDirection: 'column',
        padding: 1,
        width: '100%',
        height: '100%',
      }}
    >
      <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <text>
          <strong>Task: {task.id}</strong>
        </text>
        <text fg={theme.text.muted}>[Esc] Close</text>
      </box>

      <text fg={theme.text.muted}>────────────────────────────</text>

      <box style={{ marginTop: 1 }}>
        <text>
          <strong>Title:</strong> {task.title}
        </text>
      </box>

      <box style={{ flexDirection: 'row', marginTop: 1 }}>
        <text>
          <strong>Status:</strong>{' '}
        </text>
        <text fg={color}>
          {icon} {task.status}
        </text>
      </box>

      {task.description && (
        <box style={{ marginTop: 1 }}>
          <text>
            <strong>Description:</strong>
          </text>
          <text fg={theme.text.muted}>{task.description}</text>
        </box>
      )}

      <box style={{ flexDirection: 'row', marginTop: 1 }}>
        <text>
          <strong>Field:</strong> {task.fieldName}
        </text>
        {task.hnauId && (
          <text fg={theme.text.muted}> │ Hnau: {task.hnauId}</text>
        )}
      </box>

      <box style={{ flexDirection: 'row', marginTop: 1 }}>
        <text>
          <strong>Created:</strong> {formatTimestamp(task.createdAt)}
        </text>
        <text fg={theme.text.muted}> by {task.createdBy}</text>
      </box>

      {task.labels && task.labels.length > 0 && (
        <box style={{ marginTop: 1 }}>
          <text>
            <strong>Labels:</strong> {task.labels.join(', ')}
          </text>
        </box>
      )}

      {task.relatedCommits && task.relatedCommits.length > 0 && (
        <box style={{ marginTop: 1 }}>
          <text>
            <strong>Commits:</strong> {task.relatedCommits.join(', ')}
          </text>
        </box>
      )}

      {history.length > 0 && (
        <box style={{ marginTop: 2, flexGrow: 1 }}>
          <text>
            <strong>History</strong> <span fg={theme.text.muted}>({history.length})</span>
          </text>
          <text fg={theme.text.muted}>─────────────────────</text>
          <scrollbox style={{ flexGrow: 1, maxHeight: 10 }}>
            {history.map((entry, idx) => (
              <box key={idx} style={{ flexDirection: 'row' }}>
                <text fg={theme.text.muted}>{formatTimestamp(entry.timestamp)} </text>
                <text>{entry.action}</text>
                {entry.user && <text fg={theme.text.muted}> ({entry.user})</text>}
              </box>
            ))}
          </scrollbox>
        </box>
      )}

      <box style={{ marginTop: 2 }}>
        <text fg={theme.text.muted}>────────────────────────────</text>
        <text fg={theme.text.muted}>
          [s] Set status │ [c] Close task │ [e] Assign eldil
        </text>
      </box>

      <box style={{ marginTop: 1 }}>
        <text fg={theme.accent.primary}>Change status: </text>
        <text fg={theme.text.muted}>[1] todo </text>
        <text fg={theme.status.warning}>[2] in-progress </text>
        <text fg={theme.status.success}>[3] done </text>
        <text fg={theme.status.error}>[4] blocked</text>
      </box>
    </box>
  );
}
