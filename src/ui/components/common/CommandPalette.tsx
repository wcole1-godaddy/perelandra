import React, { useState, useMemo } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme, SplitBorder, type ThemeFlavorName, flavorNames, flavors } from '../../theme';

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
        top: 4,
        left: '20%',
        width: 60,
        maxHeight: '60%',
        backgroundColor: theme.backgroundPanel,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        flexDirection: 'column',
        ...SplitBorder,
        borderColor: theme.primary,
      }}
    >
      {/* Search input */}
      <box style={{ flexDirection: 'row', gap: 1, marginBottom: 1 }}>
        <text fg={theme.primary}>❯</text>
        <text fg={theme.text}>{query || 'Search commands...'}</text>
        <text fg={theme.textMuted}>│</text>
      </box>

      {/* Results */}
      {filteredCommands.length === 0 ? (
        <text fg={theme.textMuted}>No matching commands</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {Array.from(groupedCommands.entries()).map(([category, cmds]) => (
            <box key={category} style={{ marginBottom: 1 }}>
              <text fg={theme.accent} bold>{category}</text>
              {cmds.map((cmd) => {
                const isSelected = flatIndex === selectedIndex;
                flatIndex++;

                return (
                  <box
                    key={cmd.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? theme.primary : undefined,
                      paddingLeft: isSelected ? 0 : 1,
                    }}
                  >
                    <text fg={isSelected ? theme.selectedForeground : theme.text}>
                      {isSelected ? '▸' : ' '} {cmd.label}
                    </text>
                    {cmd.shortcut && (
                      <text fg={isSelected ? theme.selectedForeground : theme.textMuted}>
                        {cmd.shortcut}
                      </text>
                    )}
                  </box>
                );
              })}
            </box>
          ))}
        </scrollbox>
      )}

      {/* Footer */}
      <box style={{ marginTop: 1, flexDirection: 'row', gap: 1 }}>
        <text fg={theme.textMuted}>↑/↓</text>
        <text fg={theme.text}>navigate</text>
        <text fg={theme.textMuted}>enter</text>
        <text fg={theme.text}>execute</text>
        <text fg={theme.textMuted}>esc</text>
        <text fg={theme.text}>close</text>
      </box>
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
  onThemeChange?: (flavor: ThemeFlavorName) => void;
  currentTheme?: ThemeFlavorName;
}): Command[] {
  const commands: Command[] = [
    {
      id: 'field.switch',
      label: 'Switch Field',
      shortcut: 'ctrl+f',
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

  if (handlers.onThemeChange) {
    for (const name of flavorNames) {
      const flavor = flavors[name];
      const isCurrent = name === handlers.currentTheme;
      commands.push({
        id: `theme.${name}`,
        label: `${isCurrent ? '● ' : ''}Theme: ${flavor.name}${flavor.dark ? ' (dark)' : ' (light)'}`,
        category: 'Theme',
        action: () => handlers.onThemeChange!(name),
      });
    }
  }

  return commands;
}
