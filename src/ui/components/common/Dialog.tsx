import React from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { theme, SplitBorder } from '../../theme';

export type DialogSize = 'small' | 'medium' | 'large';

const SIZE_WIDTHS: Record<DialogSize, number> = {
  small: 40,
  medium: 60,
  large: 80,
};

const SIZE_HEIGHTS: Record<DialogSize, number> = {
  small: 15,
  medium: 25,
  large: 35,
};

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: DialogSize;
  children: React.ReactNode;
  showFooter?: boolean;
  footerHints?: Array<{ key: string; label: string }>;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  showFooter = true,
  footerHints = [{ key: 'esc', label: 'close' }],
}: DialogProps): React.ReactNode {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();

  useKeyboard((event) => {
    if (!isOpen) return;

    if (event.name === 'escape') {
      onClose();
    }
  });

  if (!isOpen) return null;

  const dialogWidth = Math.min(SIZE_WIDTHS[size], termWidth - 4);
  const dialogHeight = Math.min(SIZE_HEIGHTS[size], termHeight - 4);

  const left = Math.floor((termWidth - dialogWidth) / 2);
  const top = Math.floor((termHeight - dialogHeight) / 2);

  return (
    <>
      {/* Semi-transparent backdrop */}
      <box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: termWidth,
          height: termHeight,
          backgroundColor: theme.background,
        }}
      />

      {/* Dialog container */}
      <box
        style={{
          position: 'absolute',
          top,
          left,
          width: dialogWidth,
          height: dialogHeight,
          backgroundColor: theme.backgroundPanel,
          flexDirection: 'column',
          ...SplitBorder,
          borderColor: theme.borderActive,
        }}
      >
        {/* Title bar */}
        {title && (
          <box
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              paddingTop: 1,
              paddingBottom: 1,
            }}
          >
            <text fg={theme.primary} bold>
              {title}
            </text>
          </box>
        )}

        {/* Content area */}
        <box
          style={{
            flexGrow: 1,
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
            paddingBottom: 1,
            overflow: 'hidden',
          }}
        >
          {children}
        </box>

        {/* Footer */}
        {showFooter && (
          <box
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              paddingBottom: 1,
              flexDirection: 'row',
              gap: 2,
            }}
          >
            {footerHints.map((hint, i) => (
              <box key={i} style={{ flexDirection: 'row', gap: 1 }}>
                <text fg={theme.textMuted}>{hint.key}</text>
                <text fg={theme.text}>{hint.label}</text>
              </box>
            ))}
          </box>
        )}
      </box>
    </>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'confirm',
  cancelLabel = 'cancel',
}: ConfirmDialogProps): React.ReactNode {
  useKeyboard((event) => {
    if (!isOpen) return;

    if (event.name === 'return' || event.name === 'y') {
      onConfirm();
    } else if (event.name === 'escape' || event.name === 'n') {
      onCancel();
    }
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="small"
      footerHints={[
        { key: 'y/enter', label: confirmLabel },
        { key: 'n/esc', label: cancelLabel },
      ]}
    >
      <text fg={theme.text}>{message}</text>
    </Dialog>
  );
}
