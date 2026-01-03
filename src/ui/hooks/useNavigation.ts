import { useState, useCallback } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';

export type FocusPane = 'tasks' | 'hnau' | 'logs' | 'eldila';

export interface NavigationState {
  focusedPane: FocusPane;
  selectedIndex: Map<FocusPane, number>;
}

export interface NavigationHandlers {
  focusedPane: FocusPane;
  selectedIndex: number;
  setFocusedPane: (pane: FocusPane) => void;
  selectIndex: (index: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  getSelectedIndex: (pane: FocusPane) => number;
}

export interface UseNavigationOptions {
  panes: FocusPane[];
  itemCounts: Record<FocusPane, number>;
  onEnter?: (pane: FocusPane, index: number) => void;
  onAction?: (action: string) => void;
  disabled?: boolean;
}

export function useNavigation(options: UseNavigationOptions): NavigationHandlers {
  const { panes, itemCounts, onEnter, onAction, disabled = false } = options;

  const [focusedPane, setFocusedPane] = useState<FocusPane>(panes[0] ?? 'tasks');
  const [selectedIndices, setSelectedIndices] = useState<Map<FocusPane, number>>(
    new Map(panes.map((p) => [p, 0]))
  );

  const selectedIndex = selectedIndices.get(focusedPane) ?? 0;
  const maxIndex = Math.max(0, (itemCounts[focusedPane] ?? 0) - 1);

  const selectIndex = useCallback(
    (index: number) => {
      setSelectedIndices((prev) => {
        const next = new Map(prev);
        next.set(focusedPane, Math.max(0, Math.min(index, maxIndex)));
        return next;
      });
    },
    [focusedPane, maxIndex]
  );

  const selectNext = useCallback(() => {
    selectIndex(selectedIndex + 1);
  }, [selectIndex, selectedIndex]);

  const selectPrevious = useCallback(() => {
    selectIndex(selectedIndex - 1);
  }, [selectIndex, selectedIndex]);

  const getSelectedIndex = useCallback(
    (pane: FocusPane) => selectedIndices.get(pane) ?? 0,
    [selectedIndices]
  );

  const cycleFocus = useCallback(
    (direction: 1 | -1) => {
      const currentIdx = panes.indexOf(focusedPane);
      const nextIdx = (currentIdx + direction + panes.length) % panes.length;
      const nextPane = panes[nextIdx];
      if (nextPane) {
        setFocusedPane(nextPane);
        onAction?.(`Focus: ${nextPane}`);
      }
    },
    [focusedPane, panes, onAction]
  );

  useKeyboard((event) => {
    if (disabled) return;

    if (event.name === 'tab') {
      cycleFocus(event.shift ? -1 : 1);
      return;
    }

    if (event.name === 'up' || event.name === 'k') {
      selectPrevious();
      return;
    }

    if (event.name === 'down' || event.name === 'j') {
      selectNext();
      return;
    }

    if (event.name === 'return' && onEnter) {
      onEnter(focusedPane, selectedIndex);
      return;
    }

    if (event.name === '1') {
      setFocusedPane('tasks');
      return;
    }

    if (event.name === '2') {
      setFocusedPane('hnau');
      return;
    }

    if (event.name === '3') {
      setFocusedPane('eldila');
      return;
    }

    if (event.name === '4') {
      setFocusedPane('logs');
      return;
    }
  });

  return {
    focusedPane,
    selectedIndex,
    setFocusedPane,
    selectIndex,
    selectNext,
    selectPrevious,
    getSelectedIndex,
  };
}

export interface FocusIndicatorProps {
  focused: boolean;
  selected: boolean;
}

export function getFocusBorderStyle(focused: boolean): 'single' | 'double' {
  return focused ? 'double' : 'single';
}

export function getFocusBorderColor(focused: boolean): string | undefined {
  return focused ? theme.border.focus : theme.border.default;
}
