import React from 'react';
import type { FieldInfo } from '../../../domain/field';
import { theme } from '../../theme';

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
        border: true,
        borderStyle: 'single',
        borderColor: theme.border.default,
        padding: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <text fg={theme.text.primary}>
        <strong>⚡ Perelandra</strong> │ Field: <em>{activeField}</em>
      </text>
      <text fg={theme.text.muted}>
        [Ctrl+P] Command Palette │ [q] Quit
      </text>
    </box>
  );
}
