import React from 'react';
import type { FieldInfo } from '../../../domain/field';
import { theme, LeftBorder } from '../../theme';

export interface FieldHeaderBarProps {
  activeField: string;
  fields: FieldInfo[];
  onFieldSwitch: (fieldName: string) => void;
  height: number;
}

export function FieldHeaderBar({ activeField, height }: FieldHeaderBarProps): React.ReactNode {
  return (
    <box
      style={{
        height,
        backgroundColor: theme.backgroundPanel,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...LeftBorder,
        borderColor: theme.border,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <text fg={theme.primary} bold>★</text>
        <text fg={theme.text} bold>Perelandra</text>
        <text fg={theme.textMuted}>│</text>
        <text fg={theme.textMuted}>Field:</text>
        <text fg={theme.accent}>{activeField}</text>
      </box>
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>ctrl+p</text>
        <text fg={theme.text}>palette</text>
        <text fg={theme.textMuted}>│</text>
        <text fg={theme.textMuted}>q</text>
        <text fg={theme.text}>quit</text>
      </box>
    </box>
  );
}
