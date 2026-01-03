import React, { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { Dialog } from '../common/Dialog';
import { theme } from '../../theme';
import type { EldilTool } from '../../../types/eldil';

export interface NewEldilData {
  prompt: string;
  tool: EldilTool;
  taskId?: string;
}

export interface NewEldilDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (data: NewEldilData) => void;
  fieldName: string;
  availableTasks?: Array<{ id: string; title: string }>;
}

type FocusedField = 'tool' | 'task' | 'prompt';

export function NewEldilDialog({
  isOpen,
  onClose,
  onSpawn,
  fieldName,
  availableTasks = [],
}: NewEldilDialogProps): React.ReactNode {
  const [tool, setTool] = useState<EldilTool>('amp');
  const [prompt, setPrompt] = useState('');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(-1);
  const [focusedField, setFocusedField] = useState<FocusedField>('tool');

  const handleClose = () => {
    setTool('amp');
    setPrompt('');
    setSelectedTaskIndex(-1);
    setFocusedField('tool');
    onClose();
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;

    const selectedTask = selectedTaskIndex >= 0 ? availableTasks[selectedTaskIndex] : undefined;

    onSpawn({
      prompt: prompt.trim(),
      tool,
      taskId: selectedTask?.id,
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
          if (prev === 'prompt') return availableTasks.length > 0 ? 'task' : 'tool';
          if (prev === 'task') return 'tool';
          return 'prompt';
        });
      } else {
        setFocusedField((prev) => {
          if (prev === 'tool') return availableTasks.length > 0 ? 'task' : 'prompt';
          if (prev === 'task') return 'prompt';
          return 'tool';
        });
      }
      return;
    }

    if (focusedField === 'tool') {
      if (event.name === 'left' || event.name === 'h') {
        setTool('amp');
        return;
      }
      if (event.name === 'right' || event.name === 'l') {
        setTool('opencode');
        return;
      }
      if (event.name === 'a') {
        setTool('amp');
        return;
      }
      if (event.name === 'o') {
        setTool('opencode');
        return;
      }
      if (event.name === 'return') {
        setFocusedField(availableTasks.length > 0 ? 'task' : 'prompt');
        return;
      }
    }

    if (focusedField === 'task') {
      if (event.name === 'up' || event.name === 'k') {
        setSelectedTaskIndex((prev) => Math.max(-1, prev - 1));
        return;
      }
      if (event.name === 'down' || event.name === 'j') {
        setSelectedTaskIndex((prev) => Math.min(availableTasks.length - 1, prev + 1));
        return;
      }
      if (event.name === 'return') {
        setFocusedField('prompt');
        return;
      }
    }

    if (focusedField === 'prompt') {
      if (event.ctrl && event.name === 'return') {
        handleSubmit();
        return;
      }
      if (event.name === 'return') {
        setPrompt((prev) => prev + '\n');
        return;
      }
      if (event.name === 'backspace') {
        setPrompt((prev) => prev.slice(0, -1));
        return;
      }
      if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
        setPrompt((prev) => prev + event.sequence);
        return;
      }
    }
  });

  const toolOptions: EldilTool[] = ['amp', 'opencode'];
  const selectedTask = selectedTaskIndex >= 0 ? availableTasks[selectedTaskIndex] : undefined;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Spawn Eldil"
      size="large"
      footerHints={[
        { key: 'tab', label: 'next field' },
        { key: 'ctrl+↵', label: 'spawn' },
        { key: 'esc', label: 'cancel' },
      ]}
    >
      <box style={{ flexDirection: 'column', gap: 1 }}>
        {/* Field indicator */}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.textMuted}>Field:</text>
          <text fg={theme.accent}>{fieldName}</text>
        </box>

        {/* Tool selector */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text fg={focusedField === 'tool' ? theme.primary : theme.text}>
            {focusedField === 'tool' ? '▸ ' : '  '}Tool:
          </text>
          <box style={{ flexDirection: 'row', gap: 2, marginLeft: 2 }}>
            {toolOptions.map((opt) => {
              const isSelected = tool === opt;
              const isFocused = focusedField === 'tool';
              const icon = opt === 'amp' ? '⚡' : '🔧';
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
                    {isSelected ? '●' : '○'} {icon} {opt}
                  </text>
                </box>
              );
            })}
          </box>
        </box>

        {/* Task selector (optional) */}
        {availableTasks.length > 0 && (
          <box style={{ flexDirection: 'column', marginTop: 1 }}>
            <text fg={focusedField === 'task' ? theme.primary : theme.text}>
              {focusedField === 'task' ? '▸ ' : '  '}Task (optional):
            </text>
            <box
              style={{
                marginLeft: 2,
                flexDirection: 'column',
                maxHeight: 4,
                overflow: 'hidden',
              }}
            >
              <box
                style={{
                  flexDirection: 'row',
                  backgroundColor: selectedTaskIndex === -1 && focusedField === 'task' ? theme.primary : undefined,
                  paddingLeft: 1,
                  paddingRight: 1,
                }}
              >
                <text fg={selectedTaskIndex === -1 ? (focusedField === 'task' ? theme.selectedForeground : theme.primary) : theme.textMuted}>
                  {selectedTaskIndex === -1 ? '●' : '○'} (no task)
                </text>
              </box>
              {availableTasks.slice(0, 3).map((task, idx) => {
                const isSelected = selectedTaskIndex === idx;
                const isFocused = focusedField === 'task';
                return (
                  <box
                    key={task.id}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: isSelected && isFocused ? theme.primary : undefined,
                      paddingLeft: 1,
                      paddingRight: 1,
                    }}
                  >
                    <text fg={isSelected && isFocused ? theme.selectedForeground : isSelected ? theme.primary : theme.textMuted}>
                      {isSelected ? '●' : '○'} {task.id}: {task.title.slice(0, 30)}
                    </text>
                  </box>
                );
              })}
            </box>
          </box>
        )}

        {/* Prompt input */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text fg={focusedField === 'prompt' ? theme.primary : theme.text}>
            {focusedField === 'prompt' ? '▸ ' : '  '}Prompt:
          </text>
          <box
            style={{
              marginLeft: 2,
              backgroundColor: focusedField === 'prompt' ? theme.backgroundElement : undefined,
              paddingLeft: 1,
              paddingRight: 1,
              minHeight: 5,
            }}
          >
            <text fg={prompt ? theme.text : theme.textMuted}>
              {prompt || 'Enter prompt for the AI agent...'}
              {focusedField === 'prompt' ? '▌' : ''}
            </text>
          </box>
        </box>

        {/* Selected task indicator */}
        {selectedTask && (
          <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
            <text fg={theme.textMuted}>Working on:</text>
            <text fg={theme.accent}>{selectedTask.id}</text>
          </box>
        )}
      </box>
    </Dialog>
  );
}
