import React from 'react';
import type { FieldInfo } from '../../../domain/field';

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
        padding: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <text>
        <strong>⚡ Perelandra</strong> │ Field: <em>{activeField}</em>
      </text>
      <text fg="gray">
        [Ctrl+P] Command Palette │ [q] Quit
      </text>
    </box>
  );
}
