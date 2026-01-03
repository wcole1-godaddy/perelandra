import React from 'react';
import { useKeyboard } from '@opentui/react';
import { Dialog } from '../common/Dialog';
import type { BeadsTaskMetadata, BeadsTaskStatus, TaskHistoryEntry } from '../../../types/beads';
import { theme } from '../../theme';

export interface TaskDetailDialogProps {
  task: BeadsTaskMetadata | null;
  history?: TaskHistoryEntry[];
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, status: BeadsTaskStatus) => void;
  onAssignEldil?: (taskId: string) => void;
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

function getStatusColor(status: BeadsTaskStatus): string {
  switch (status) {
    case 'done':
      return theme.statusSuccess;
    case 'in-progress':
      return theme.statusWarning;
    case 'blocked':
      return theme.statusError;
    case 'todo':
    default:
      return theme.statusIdle;
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

export function TaskDetailDialog({
  task,
  history = [],
  isOpen,
  onClose,
  onStatusChange,
  onAssignEldil,
}: TaskDetailDialogProps): React.ReactNode {
  useKeyboard((event) => {
    if (!isOpen || !task) return;

    if (event.name === '1') {
      onStatusChange(task.id, 'todo');
    } else if (event.name === '2') {
      onStatusChange(task.id, 'in-progress');
    } else if (event.name === '3') {
      onStatusChange(task.id, 'done');
    } else if (event.name === '4') {
      onStatusChange(task.id, 'blocked');
    } else if (event.name === 'e' && onAssignEldil) {
      onAssignEldil(task.id);
    }
  });

  if (!task) return null;

  const icon = getStatusIcon(task.status);
  const color = getStatusColor(task.status);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Task: ${task.id}`}
      size="large"
      footerHints={[
        { key: '1-4', label: 'status' },
        { key: 'e', label: 'eldil' },
        { key: 'esc', label: 'close' },
      ]}
    >
      <scrollbox style={{ flexGrow: 1 }}>
        {/* Title */}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.text} bold>Title:</text>
          <text fg={theme.text}>{task.title}</text>
        </box>

        {/* Status */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text} bold>Status:</text>
          <text fg={color}>{icon} {task.status}</text>
        </box>

        {/* Description */}
        {task.description && (
          <box style={{ marginTop: 1, flexDirection: 'column' }}>
            <text fg={theme.text} bold>Description:</text>
            <text fg={theme.textMuted}>{task.description}</text>
          </box>
        )}

        {/* Field & Hnau */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text} bold>Field:</text>
          <text fg={theme.accent}>{task.fieldName}</text>
          {task.hnauId && (
            <>
              <text fg={theme.textMuted}>│</text>
              <text fg={theme.text} bold>Hnau:</text>
              <text fg={theme.text}>{task.hnauId}</text>
            </>
          )}
        </box>

        {/* Created */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text} bold>Created:</text>
          <text fg={theme.text}>{formatTimestamp(task.createdAt)}</text>
          <text fg={theme.textMuted}>by {task.createdBy}</text>
        </box>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
            <text fg={theme.text} bold>Labels:</text>
            <text fg={theme.text}>{task.labels.join(', ')}</text>
          </box>
        )}

        {/* Commits */}
        {task.relatedCommits && task.relatedCommits.length > 0 && (
          <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
            <text fg={theme.text} bold>Commits:</text>
            <text fg={theme.text}>{task.relatedCommits.join(', ')}</text>
          </box>
        )}

        {/* History */}
        {history.length > 0 && (
          <box style={{ marginTop: 2 }}>
            <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
              <text fg={theme.text} bold>History</text>
              <text fg={theme.textMuted}>({history.length})</text>
            </box>
            {history.map((entry, idx) => (
              <box key={idx} style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>{formatTimestamp(entry.timestamp)}</text>
                <text fg={theme.text}>{entry.action}</text>
                {entry.user && <text fg={theme.textMuted}>({entry.user})</text>}
              </box>
            ))}
          </box>
        )}

        {/* Status change guide */}
        <box style={{ marginTop: 2, flexDirection: 'row', gap: 1 }}>
          <text fg={theme.primary}>Change status:</text>
          <text fg={theme.textMuted}>1</text>
          <text fg={theme.text}>todo</text>
          <text fg={theme.textMuted}>2</text>
          <text fg={theme.statusWarning}>in-progress</text>
          <text fg={theme.textMuted}>3</text>
          <text fg={theme.statusSuccess}>done</text>
          <text fg={theme.textMuted}>4</text>
          <text fg={theme.statusError}>blocked</text>
        </box>
      </scrollbox>
    </Dialog>
  );
}
