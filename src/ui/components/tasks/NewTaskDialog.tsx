import React, { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { Dialog } from '../common/Dialog';
import { theme } from '../../theme';

export type TaskType = 'task' | 'epic';

export interface NewTaskData {
  title: string;
  type: TaskType;
  description?: string;
}

export interface NewTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: NewTaskData) => void;
  fieldName: string;
}

type FocusedField = 'type' | 'title' | 'description';

export function NewTaskDialog({
  isOpen,
  onClose,
  onCreate,
  fieldName,
}: NewTaskDialogProps): React.ReactNode {
  const [type, setType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>('type');

  const handleClose = () => {
    setType('task');
    setTitle('');
    setDescription('');
    setFocusedField('type');
    onClose();
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      type,
      description: description.trim() || undefined,
    });

    handleClose();
  };

  useKeyboard((event) => {
    if (!isOpen) return;

    if (event.name === 'escape') {
      handleClose();
      return;
    }

    if (event.name === 'tab') {
      if (event.shift) {
        setFocusedField((prev) => {
          if (prev === 'description') return 'title';
          if (prev === 'title') return 'type';
          return 'description';
        });
      } else {
        setFocusedField((prev) => {
          if (prev === 'type') return 'title';
          if (prev === 'title') return 'description';
          return 'type';
        });
      }
      return;
    }

    if (focusedField === 'type') {
      if (event.name === 'left' || event.name === 'h') {
        setType('task');
        return;
      }
      if (event.name === 'right' || event.name === 'l') {
        setType('epic');
        return;
      }
      if (event.name === 't') {
        setType('task');
        return;
      }
      if (event.name === 'e') {
        setType('epic');
        return;
      }
      if (event.name === 'return') {
        setFocusedField('title');
        return;
      }
    }

    if (focusedField === 'title') {
      if (event.name === 'return') {
        if (title.trim()) {
          setFocusedField('description');
        }
        return;
      }
      if (event.name === 'backspace') {
        setTitle((prev) => prev.slice(0, -1));
        return;
      }
      if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
        setTitle((prev) => prev + event.sequence);
        return;
      }
    }

    if (focusedField === 'description') {
      if (event.ctrl && event.name === 'return') {
        handleSubmit();
        return;
      }
      if (event.name === 'return') {
        setDescription((prev) => prev + '\n');
        return;
      }
      if (event.name === 'backspace') {
        setDescription((prev) => prev.slice(0, -1));
        return;
      }
      if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
        setDescription((prev) => prev + event.sequence);
        return;
      }
    }
  });

  const typeOptions: TaskType[] = ['task', 'epic'];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="New Task"
      size="medium"
      footerHints={[
        { key: 'tab', label: 'next field' },
        { key: 'ctrl+↵', label: 'create' },
        { key: 'esc', label: 'cancel' },
      ]}
    >
      <box style={{ flexDirection: 'column', gap: 1 }}>
        {/* Field indicator */}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>Field:</text>
          <text fg={theme.accent}>{fieldName}</text>
        </box>

        {/* Type selector */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text fg={focusedField === 'type' ? theme.primary : theme.text}>
            {focusedField === 'type' ? '▸ ' : '  '}Type:
          </text>
          <box style={{ flexDirection: 'row', gap: 2, marginLeft: 2 }}>
            {typeOptions.map((opt) => {
              const isSelected = type === opt;
              const isFocused = focusedField === 'type';
              return (
                <box
                  key={opt}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isSelected && isFocused ? theme.primary : undefined,
                    paddingLeft: 1,
                    paddingRight: 1,
                  }}
                >
                  <text fg={isSelected && isFocused ? theme.selectedForeground : isSelected ? theme.primary : theme.textMuted}>
                    {isSelected ? '●' : '○'} {opt}
                  </text>
                </box>
              );
            })}
          </box>
        </box>

        {/* Title input */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text fg={focusedField === 'title' ? theme.primary : theme.text}>
            {focusedField === 'title' ? '▸ ' : '  '}Title:
          </text>
          <box
            style={{
              marginLeft: 2,
              backgroundColor: focusedField === 'title' ? theme.backgroundElement : undefined,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <text fg={title ? theme.text : theme.textMuted}>
              {title || 'Enter task title...'}
              {focusedField === 'title' ? '▌' : ''}
            </text>
          </box>
        </box>

        {/* Description input */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text fg={focusedField === 'description' ? theme.primary : theme.text}>
            {focusedField === 'description' ? '▸ ' : '  '}Description (optional):
          </text>
          <box
            style={{
              marginLeft: 2,
              backgroundColor: focusedField === 'description' ? theme.backgroundElement : undefined,
              paddingLeft: 1,
              paddingRight: 1,
              minHeight: 3,
            }}
          >
            <text fg={description ? theme.text : theme.textMuted}>
              {description || 'Enter description...'}
              {focusedField === 'description' ? '▌' : ''}
            </text>
          </box>
        </box>
      </box>
    </Dialog>
  );
}
