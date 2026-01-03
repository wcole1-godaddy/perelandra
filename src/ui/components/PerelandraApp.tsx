import { useKeyboard, useRenderer } from '@opentui/react';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RootLayout } from './layout/RootLayout';
import { CommandPalette, createDefaultCommands } from './common/CommandPalette';
import type { PerelandraConfig } from '../../types/config';
import type { FieldInfo } from '../../domain/field';
import type { BeadsTaskMetadata } from '../../types/beads';
import type { HnauRuntime, HnauStatus } from '../../types/hnau';
import type { HnauAction } from '../hooks/useNavigation';
import type { Oyarsa } from '../../core/oyarsa';
import { TmuxManager } from '../../domain/tmux';
import { HnauManager } from '../../domain/hnau';

export interface PerelandraAppProps {
  config: PerelandraConfig;
  repoRoot: string;
  oyarsa?: Oyarsa;
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

export function PerelandraApp({ config, repoRoot, oyarsa }: PerelandraAppProps): React.ReactNode {
  const renderer = useRenderer();
  const hnauManagerRef = useRef<HnauManager>(oyarsa?.getHnauManager() ?? new HnauManager(config));

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
    const initialize = async () => {
      const tmux = oyarsa?.getTmuxManager() ?? new TmuxManager();
      const available = await tmux.isTmuxAvailable();
      
      const initialActiveField = oyarsa?.getActiveField() ?? 'main';
      
      setState((prev) => ({
        ...prev,
        activeField: initialActiveField,
        tmuxAvailable: available,
        initialized: true,
        logs: available
          ? prev.logs
          : [...prev.logs, `${new Date().toISOString()} [WARN] tmux not available, running in degraded mode`],
      }));
    };
    initialize();
  }, [oyarsa]);

  const toggleCommandPalette = useCallback(() => {
    setState((prev: AppState) => ({ ...prev, showCommandPalette: !prev.showCommandPalette }));
  }, []);

  const setActiveField = useCallback((fieldName: string) => {
    oyarsa?.setActiveField(fieldName);
    setState((prev: AppState) => ({ ...prev, activeField: fieldName }));
  }, [oyarsa]);

  const addLog = useCallback((message: string) => {
    setState((prev: AppState) => ({
      ...prev,
      logs: [...prev.logs.slice(-100), `${new Date().toISOString()} ${message}`],
    }));
  }, []);

  const closeCommandPalette = useCallback(() => {
    setState((prev: AppState) => ({ ...prev, showCommandPalette: false }));
  }, []);

  const handleQuit = useCallback(async () => {
    if (oyarsa) {
      await oyarsa.shutdown();
    } else {
      hnauManagerRef.current.dispose();
    }
    renderer.destroy();
    process.exit(0);
  }, [renderer, oyarsa]);

  const updateHnauStatus = useCallback((hnauId: string, status: HnauStatus, error?: string) => {
    setState((prev) => ({
      ...prev,
      hnauRuntimes: prev.hnauRuntimes.map((h) =>
        h.config.id === hnauId ? { ...h, status, lastError: error } : h
      ),
      logs: error
        ? [...prev.logs.slice(-100), `${new Date().toISOString()} [ERROR] ${hnauId}: ${error}`]
        : prev.logs,
    }));
  }, []);

  const handleHnauAction = useCallback(
    async (action: HnauAction, hnauId: string) => {
      const manager = hnauManagerRef.current;
      addLog(`[HNAU] ${action} ${hnauId}`);

      if (action === 'start') {
        updateHnauStatus(hnauId, 'starting');
        const result = await manager.start(hnauId, { field: repoRoot });
        if (result.success) {
          updateHnauStatus(hnauId, 'running');
          watchHnauLogs(hnauId);
        } else {
          updateHnauStatus(hnauId, 'error', result.error);
        }
      } else if (action === 'stop') {
        updateHnauStatus(hnauId, 'stopping');
        const result = await manager.stop(hnauId);
        updateHnauStatus(hnauId, result.success ? 'stopped' : 'error', result.error);
      } else if (action === 'restart') {
        updateHnauStatus(hnauId, 'stopping');
        const result = await manager.restart(hnauId, { field: repoRoot });
        if (result.success) {
          updateHnauStatus(hnauId, 'running');
          watchHnauLogs(hnauId);
        } else {
          updateHnauStatus(hnauId, 'error', result.error);
        }
      }
    },
    [repoRoot, addLog, updateHnauStatus]
  );

  const watchHnauLogs = useCallback((hnauId: string) => {
    const logRoot = config.logs?.root ?? 'logs';
    const logFile = `${repoRoot}/${logRoot}/${hnauId}.log`;
    
    const checkForErrors = async () => {
      try {
        const file = Bun.file(logFile);
        if (await file.exists()) {
          const text = await file.text();
          const lines = text.split('\n').slice(-50);
          const errorLines = lines.filter((line) => 
            /error|exception|fatal|failed|ELIFECYCLE/i.test(line) && 
            !/node_modules/.test(line)
          );
          if (errorLines.length > 0) {
            const lastError = errorLines[errorLines.length - 1];
            if (lastError) {
              updateHnauStatus(hnauId, 'error', lastError.slice(0, 200));
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    };
    
    setTimeout(checkForErrors, 2000);
    setTimeout(checkForErrors, 5000);
  }, [config.logs?.root, repoRoot, updateHnauStatus]);

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
        onHnauAction={handleHnauAction}
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
