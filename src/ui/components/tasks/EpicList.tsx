import React from 'react';
import type { EpicStatus } from '../../../types/beads';
import { theme, LeftBorder } from '../../theme';

export interface EpicListProps {
  epics: EpicStatus[];
  fieldName: string;
  onAction: (message: string) => void;
  focused?: boolean;
  selectedIndex?: number;
  onSelect?: (epic: EpicStatus) => void;
}

function getProgressBar(closed: number, total: number, width: number = 10): string {
  if (total === 0) return '░'.repeat(width);
  const filled = Math.round((closed / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getProgressColor(closed: number, total: number): string {
  if (total === 0) return theme.textMuted;
  const ratio = closed / total;
  if (ratio === 1) return theme.statusSuccess;
  if (ratio >= 0.5) return theme.statusWarning;
  return theme.statusIdle;
}

export function EpicList({
  epics,
  focused = false,
  selectedIndex = 0,
}: EpicListProps): React.ReactNode {
  const borderColor = focused ? theme.borderActive : theme.border;

  return (
    <box
      style={{
        backgroundColor: theme.backgroundPanel,
        flexDirection: 'column',
        paddingLeft: 1,
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
        <text fg={theme.text}>Epics</text>
        <text fg={theme.textMuted}>{`(${epics.length})`}</text>
      </box>

      {/* Epic list */}
      {epics.length === 0 ? (
        <text fg={theme.textMuted}>No epics</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {epics.map((epicStatus, idx) => {
            const isSelected = focused && idx === selectedIndex;
            const { epic, totalChildren, closedChildren } = epicStatus;
            const progressBar = getProgressBar(closedChildren, totalChildren);
            const progressColor = getProgressColor(closedChildren, totalChildren);

            return (
              <box
                key={epic.id}
                style={{
                  flexDirection: 'column',
                  backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                  paddingLeft: 1,
                  paddingRight: 1,
                  marginBottom: 1,
                }}
              >
                <box style={{ flexDirection: 'row' }}>
                  <text fg={isSelected ? theme.selectedForeground : theme.text}>
                    {`${isSelected ? '▸ ' : ''}${epic.id}`}
                  </text>
                </box>
                <text fg={isSelected ? theme.selectedForeground : theme.textMuted}>
                  {epic.title}
                </text>
                <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
                  <text fg={isSelected ? theme.selectedForeground : progressColor}>
                    {progressBar}
                  </text>
                  <text fg={isSelected ? theme.selectedForeground : theme.textMuted}>
                    {`${closedChildren}/${totalChildren}`}
                  </text>
                </box>
              </box>
            );
          })}
        </scrollbox>
      )}

      {/* Footer keybinds */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>↵</text>
        <text fg={theme.text}>view tasks</text>
        <text fg={theme.textMuted}>g</text>
        <text fg={theme.text}>graph</text>
        <text fg={theme.textMuted}>n</text>
        <text fg={theme.text}>new</text>
      </box>
    </box>
  );
}
