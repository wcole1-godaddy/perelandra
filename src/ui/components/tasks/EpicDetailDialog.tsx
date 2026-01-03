import React from 'react';
import { useKeyboard } from '@opentui/react';
import { Dialog } from '../common/Dialog';
import { MarkdownText } from '../common/MarkdownText';
import type { EpicStatus, EpicGraph, BeadsTaskStatus } from '../../../types/beads';
import { theme } from '../../theme';

export interface EpicDetailDialogProps {
  epicStatus: EpicStatus | null;
  graph: EpicGraph | null;
  isOpen: boolean;
  onClose: () => void;
  onViewTasks: (epicId: string) => void;
  onStatusChange?: (epicId: string, status: BeadsTaskStatus) => void;
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

function getProgressBar(closed: number, total: number, width: number = 20): string {
  if (total === 0) return '░'.repeat(width);
  const filled = Math.round((closed / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function EpicDetailDialog({
  epicStatus,
  graph,
  isOpen,
  onClose,
  onViewTasks,
  onStatusChange,
}: EpicDetailDialogProps): React.ReactNode {
  useKeyboard((event) => {
    if (!isOpen || !epicStatus) return;

    if (event.name === 't') {
      onViewTasks(epicStatus.epic.id);
      onClose();
    } else if (event.name === '1' && onStatusChange) {
      onStatusChange(epicStatus.epic.id, 'todo');
    } else if (event.name === '2' && onStatusChange) {
      onStatusChange(epicStatus.epic.id, 'in-progress');
    } else if (event.name === '3' && onStatusChange) {
      onStatusChange(epicStatus.epic.id, 'done');
    } else if (event.name === '4' && onStatusChange) {
      onStatusChange(epicStatus.epic.id, 'blocked');
    }
  });

  if (!epicStatus) return null;

  const { epic, totalChildren, closedChildren, eligibleForClose } = epicStatus;
  const icon = getStatusIcon(epic.status);
  const color = getStatusColor(epic.status);
  const progressBar = getProgressBar(closedChildren, totalChildren);
  const progressPercent = totalChildren > 0 ? Math.round((closedChildren / totalChildren) * 100) : 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Epic: ${epic.id}`}
      size="large"
      footerHints={[
        { key: 't', label: 'view tasks' },
        { key: '1-4', label: 'status' },
        { key: 'esc', label: 'close' },
      ]}
    >
      <scrollbox style={{ flexGrow: 1 }}>
        {/* Title */}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.text}>Title:</text>
          <text fg={theme.text}>{epic.title}</text>
        </box>

        {/* Status */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text}>Status:</text>
          <text fg={color}>{`${icon} ${epic.status}`}</text>
          {eligibleForClose && (
            <text fg={theme.statusSuccess}>(eligible for close)</text>
          )}
        </box>

        {/* Progress */}
        <box style={{ marginTop: 1, flexDirection: 'column' }}>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.text}>Progress:</text>
            <text fg={theme.text}>{`${closedChildren}/${totalChildren} tasks (${progressPercent}%)`}</text>
          </box>
          <box style={{ marginTop: 1 }}>
            <text fg={progressPercent === 100 ? theme.statusSuccess : theme.statusWarning}>
              {progressBar}
            </text>
          </box>
        </box>

        {/* Description */}
        {epic.description && (
          <box style={{ marginTop: 1, flexDirection: 'column' }}>
            <text fg={theme.text}>Description:</text>
            <box style={{ marginTop: 1 }}>
              <MarkdownText content={epic.description} maxCodeHeight={10} />
            </box>
          </box>
        )}

        {/* Field */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text}>Field:</text>
          <text fg={theme.accent}>{epic.fieldName}</text>
        </box>

        {/* Created */}
        <box style={{ flexDirection: 'row', marginTop: 1, gap: 1 }}>
          <text fg={theme.text}>Created:</text>
          <text fg={theme.text}>{formatTimestamp(epic.createdAt)}</text>
          <text fg={theme.textMuted}>{`by ${epic.createdBy}`}</text>
        </box>

        {/* Labels */}
        {epic.labels && epic.labels.length > 0 && (
          <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
            <text fg={theme.text}>Labels:</text>
            <text fg={theme.text}>{epic.labels.join(', ')}</text>
          </box>
        )}

        {/* Dependency Graph */}
        {graph && graph.layers.length > 0 && (
          <box style={{ marginTop: 2, flexDirection: 'column' }}>
            <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
              <text fg={theme.text}>Dependency Graph</text>
              <text fg={theme.textMuted}>{`(${graph.totalIssues} issues)`}</text>
            </box>
            <box
              style={{
                backgroundColor: theme.backgroundElement,
                padding: 1,
                flexDirection: 'column',
              }}
            >
              {graph.layers.map((layer, layerIdx) => (
                <box key={layerIdx} style={{ flexDirection: 'column', marginBottom: 1 }}>
                  <text fg={theme.textMuted}>{`Layer ${layer.depth} (ready)`}</text>
                  {layer.issues.map((issue) => {
                    const issueIcon = getStatusIcon(issue.status);
                    const issueColor = getStatusColor(issue.status);
                    const truncatedTitle = issue.title.length > 40 ? `${issue.title.slice(0, 40)}…` : issue.title;
                    return (
                      <box key={issue.id} style={{ flexDirection: 'row', gap: 1, marginLeft: 2 }}>
                        <text fg={issueColor}>{issueIcon}</text>
                        <text fg={theme.primary}>{issue.id}</text>
                        <text fg={theme.text}>{truncatedTitle}</text>
                      </box>
                    );
                  })}
                </box>
              ))}
            </box>
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
