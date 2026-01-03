import React from 'react';
import type { BeadsTaskMetadata, BeadsTaskStatus, TaskHistoryEntry } from '../../../types/beads';
import { theme, LeftBorder } from '../../theme';
import { MarkdownText } from '../common/MarkdownText';

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
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        width: '100%',
        height: '100%',
        ...LeftBorder,
        borderColor: theme.borderActive,
      }}
    >
      {/* Header */}
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.text} bold>Task:</text>
          <text fg={theme.primary}>{task.id}</text>
        </box>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>esc</text>
          <text fg={theme.text}>close</text>
        </box>
      </box>

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
          <box style={{ marginTop: 1 }}>
            <MarkdownText content={task.description} maxCodeHeight={15} />
          </box>
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
        <box style={{ marginTop: 2, flexGrow: 1 }}>
          <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
            <text fg={theme.text} bold>History</text>
            <text fg={theme.textMuted}>({history.length})</text>
          </box>
          <scrollbox style={{ flexGrow: 1, maxHeight: 10 }}>
            {history.map((entry, idx) => (
              <box key={idx} style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>{formatTimestamp(entry.timestamp)}</text>
                <text fg={theme.text}>{entry.action}</text>
                {entry.user && <text fg={theme.textMuted}>({entry.user})</text>}
              </box>
            ))}
          </scrollbox>
        </box>
      )}

      {/* Footer keybinds */}
      <box style={{ marginTop: 2, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>s</text>
        <text fg={theme.text}>set status</text>
        <text fg={theme.textMuted}>c</text>
        <text fg={theme.text}>close task</text>
        <text fg={theme.textMuted}>e</text>
        <text fg={theme.text}>assign eldil</text>
      </box>

      {/* Status change options */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
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
    </box>
  );
}
