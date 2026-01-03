import React from 'react';
import { theme, type ThemeFlavorName, flavors } from '../../theme';

export interface StatusBarProps {
  activeField: string;
  hnauCount: number;
  taskCount: number;
  eldilCount?: number;
  height: number;
  themeFlavor?: ThemeFlavorName;
  tmuxAvailable?: boolean;
}

export function StatusBar({ activeField, hnauCount, taskCount, eldilCount = 0, height, themeFlavor, tmuxAvailable = false }: StatusBarProps): React.ReactNode {
  const themeLabel = themeFlavor ? flavors[themeFlavor].name : '';
  
  return (
    <box
      style={{
        height,
        backgroundColor: theme.backgroundElement,
        paddingLeft: 2,
        paddingRight: 2,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <box style={{ flexDirection: 'row', gap: 2 }}>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>field:</text>
          <text fg={theme.accent}>{activeField}</text>
        </box>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>services:</text>
          <text fg={theme.text}>{hnauCount}</text>
        </box>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>tasks:</text>
          <text fg={theme.text}>{taskCount}</text>
        </box>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>eldila:</text>
          <text fg={theme.text}>{eldilCount}</text>
        </box>
        {themeFlavor && (
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.textMuted}>theme:</text>
            <text fg={theme.secondary}>{themeLabel}</text>
          </box>
        )}
      </box>
      <box style={{ flexDirection: 'row', gap: 2 }}>
        {tmuxAvailable && (
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text fg={theme.accent}>g</text>
            <text fg={theme.textMuted}>=grid</text>
          </box>
        )}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.primary}>★</text>
          <text fg={theme.textMuted}>perelandra v0.1.0</text>
        </box>
      </box>
    </box>
  );
}
