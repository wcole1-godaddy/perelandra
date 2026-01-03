import React, { useState, useMemo } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../../theme';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
  onAction: (message: string) => void;
}

export function CommandPalette({
  commands,
  isOpen,
  onClose,
  onAction,
}: CommandPaletteProps): React.ReactNode {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.category?.toLowerCase().includes(lowerQuery) ||
        cmd.id.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, Command[]>();
    for (const cmd of filteredCommands) {
      const category = cmd.category ?? 'General';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  useKeyboard((event) => {
    if (!isOpen) return;

    if (event.name === 'escape') {
      setQuery('');
      setSelectedIndex(0);
      onClose();
      return;
    }

    if (event.name === 'return') {
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        onAction(`Executing: ${cmd.label}`);
        cmd.action();
        setQuery('');
        setSelectedIndex(0);
        onClose();
      }
      return;
    }

    if (event.name === 'up' || (event.ctrl && event.name === 'p')) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.name === 'down' || (event.ctrl && event.name === 'n')) {
      setSelectedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
      return;
    }

    if (event.name === 'backspace') {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
      setQuery((prev) => prev + event.sequence);
      setSelectedIndex(0);
    }
  });

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <box
      style={{
        position: 'absolute',
        top: 2,
        left: '20%',
        width: '60%',
        height: '70%',
        backgroundColor: theme.surface.base,
        border: true,
        borderStyle: 'double',
        flexDirection: 'column',
        padding: 1,
      }}
    >
      <box style={{ flexDirection: 'row', marginBottom: 1 }}>
        <text fg={theme.accent.primary}>❯ </text>
        <text fg={theme.text.primary}>{query}</text>
        <text fg={theme.text.muted}>│</text>
      </box>

      <text fg={theme.text.muted}>─────────────────────────────</text>

      {filteredCommands.length === 0 ? (
        <text fg={theme.text.muted}>No matching commands</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {Array.from(groupedCommands.entries()).map(([category, cmds]) => (
            <box key={category} style={{ marginBottom: 1 }}>
              <text fg={theme.text.muted}>{category}</text>
              {cmds.map((cmd) => {
                const isSelected = flatIndex === selectedIndex;
                flatIndex++;

                return (
                  <box
                    key={cmd.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <text fg={isSelected ? theme.accent.primary : theme.text.primary}>
                      {isSelected ? '▸ ' : '  '}
                      {cmd.label}
                    </text>
                    {cmd.shortcut && (
                      <text fg={theme.text.muted}>{cmd.shortcut}</text>
                    )}
                  </box>
                );
              })}
            </box>
          ))}
        </scrollbox>
      )}

      <text fg={theme.text.muted}>─────────────────────────────</text>
      <text fg={theme.text.muted}>
        [↑/↓] Navigate │ [Enter] Execute │ [Esc] Close
      </text>
    </box>
  );
}

export function createDefaultCommands(handlers: {
  onFieldSwitch: (name: string) => void;
  onNewTask: () => void;
  onSpawnEldil: () => void;
  onSyncTasks: () => void;
  onRefresh: () => void;
  onQuit: () => void;
}): Command[] {
  return [
    {
      id: 'field.switch',
      label: 'Switch Field',
      shortcut: 'Ctrl+F',
      category: 'Fields',
      action: () => handlers.onFieldSwitch(''),
    },
    {
      id: 'task.new',
      label: 'New Task',
      shortcut: 'n',
      category: 'Tasks',
      action: handlers.onNewTask,
    },
    {
      id: 'task.sync',
      label: 'Sync Tasks',
      shortcut: 's',
      category: 'Tasks',
      action: handlers.onSyncTasks,
    },
    {
      id: 'eldil.spawn',
      label: 'Spawn Eldil',
      shortcut: 'e',
      category: 'Eldila',
      action: handlers.onSpawnEldil,
    },
    {
      id: 'general.refresh',
      label: 'Refresh',
      shortcut: 'r',
      category: 'General',
      action: handlers.onRefresh,
    },
    {
      id: 'general.quit',
      label: 'Quit',
      shortcut: 'q',
      category: 'General',
      action: handlers.onQuit,
    },
  ];
}
