import { useKeyboard } from '@opentui/react';
import React, { useState, useCallback, useEffect } from 'react';
import { RootLayout } from './layout/RootLayout';
import type { PerelandraConfig } from '../../types/config';
import type { FieldInfo } from '../../domain/field';
import type { BeadsTaskMetadata } from '../../types/beads';
import type { HnauRuntime } from '../../types/hnau';
import { TmuxManager } from '../../domain/tmux';

export interface PerelandraAppProps {
  config: PerelandraConfig;
  repoRoot: string;
}

export interface AppState {
  activeField: string;
  fields: FieldInfo[];
  hnauRuntimes: HnauRuntime[];
  tasks: BeadsTaskMetadata[];
  logs: string[];
  showCommandPalette: boolean;
  tmuxAvailable: boolean;
  initialized: boolean;
}

export function PerelandraApp({ config, repoRoot }: PerelandraAppProps): React.ReactNode {
  const [state, setState] = useState<AppState>({
    activeField: 'main',
    fields: [],
    hnauRuntimes: config.hnau.map((h) => ({
      config: h,
      status: 'stopped' as const,
    })),
    tasks: [],
    logs: [],
    showCommandPalette: false,
    tmuxAvailable: false,
    initialized: false,
  });

  useEffect(() => {
    const checkTmux = async () => {
      const tmux = new TmuxManager();
      const available = await tmux.isTmuxAvailable();
      setState((prev) => ({
        ...prev,
        tmuxAvailable: available,
        initialized: true,
        logs: available
          ? prev.logs
          : [...prev.logs, `${new Date().toISOString()} [WARN] tmux not available, running in degraded mode`],
      }));
    };
    checkTmux();
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setState((prev: AppState) => ({ ...prev, showCommandPalette: !prev.showCommandPalette }));
  }, []);

  const setActiveField = useCallback((fieldName: string) => {
    setState((prev: AppState) => ({ ...prev, activeField: fieldName }));
  }, []);

  const addLog = useCallback((message: string) => {
    setState((prev: AppState) => ({
      ...prev,
      logs: [...prev.logs.slice(-100), `${new Date().toISOString()} ${message}`],
    }));
  }, []);

  useKeyboard((event) => {
    if (event.ctrl && event.name === 'p') {
      toggleCommandPalette();
    }
    if (event.name === 'escape' && state.showCommandPalette) {
      setState((prev: AppState) => ({ ...prev, showCommandPalette: false }));
    }
  });

  return (
    <RootLayout
      config={config}
      repoRoot={repoRoot}
      state={state}
      onFieldSwitch={setActiveField}
      onCommand={addLog}
    />
  );
}
