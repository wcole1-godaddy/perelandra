import { useKeyboard, useRenderer } from '@opentui/react';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { RootLayout } from './layout/RootLayout';
import { CommandPalette, createDefaultCommands } from './common/CommandPalette';
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
  const renderer = useRenderer();

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

  const closeCommandPalette = useCallback(() => {
    setState((prev: AppState) => ({ ...prev, showCommandPalette: false }));
  }, []);

  const handleQuit = useCallback(() => {
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  const commands = useMemo(
    () =>
      createDefaultCommands({
        onFieldSwitch: setActiveField,
        onNewTask: () => addLog('[CMD] New task'),
        onSpawnEldil: () => addLog('[CMD] Spawn eldil'),
        onSyncTasks: () => addLog('[CMD] Sync tasks'),
        onRefresh: () => addLog('[CMD] Refresh'),
        onQuit: handleQuit,
      }),
    [setActiveField, addLog, handleQuit]
  );

  useKeyboard((event) => {
    if (event.ctrl && event.name === 'p') {
      toggleCommandPalette();
    }
    if (event.name === 'escape' && state.showCommandPalette) {
      setState((prev: AppState) => ({ ...prev, showCommandPalette: false }));
    }
    if (event.name === 'q' && !state.showCommandPalette) {
      handleQuit();
    }
  });

  return (
    <>
      <RootLayout
        config={config}
        repoRoot={repoRoot}
        state={state}
        onFieldSwitch={setActiveField}
        onCommand={addLog}
        navigationDisabled={state.showCommandPalette}
      />
      <CommandPalette
        commands={commands}
        isOpen={state.showCommandPalette}
        onClose={closeCommandPalette}
        onAction={addLog}
      />
    </>
  );
}
