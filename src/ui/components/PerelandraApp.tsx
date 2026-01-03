import { useKeyboard, useRenderer } from '@opentui/react';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RootLayout } from './layout/RootLayout';
import { CommandPalette, createDefaultCommands } from './common/CommandPalette';
import type { PerelandraConfig } from '../../types/config';
import type { FieldInfo } from '../../domain/field';
import type { BeadsTaskMetadata } from '../../types/beads';
import type { HnauRuntime, HnauStatus } from '../../types/hnau';
import type { EldilRuntime } from '../../types/eldil';
import type { HnauAction, EldilAction } from '../hooks/useNavigation';
import type { Oyarsa } from '../../core/oyarsa';
import { TmuxManager } from '../../domain/tmux';
import { HnauManager } from '../../domain/hnau';
import { logInfo } from '../../logging/pino';
import { ThemeProvider } from '../hooks/useTheme';
import { type ThemeFlavorName, detectDefaultFlavor } from '../theme';

export interface PerelandraAppProps {
  config: PerelandraConfig;
  repoRoot: string;
  oyarsa?: Oyarsa;
}

function loadThemePreference(repoRoot: string): ThemeFlavorName {
  try {
    const content = require('fs').readFileSync(`${repoRoot}/.perelandra-state.json`, 'utf-8');
    const data = JSON.parse(content);
    if (data.themeFlavor && ['mocha', 'macchiato', 'frappe', 'latte'].includes(data.themeFlavor)) {
      return data.themeFlavor as ThemeFlavorName;
    }
  } catch {
    // File doesn't exist or invalid, use default
  }
  return detectDefaultFlavor();
}

async function saveThemePreference(repoRoot: string, flavor: ThemeFlavorName): Promise<void> {
  try {
    const stateFile = `${repoRoot}/.perelandra-state.json`;
    let data: Record<string, unknown> = {};
    try {
      const content = require('fs').readFileSync(stateFile, 'utf-8');
      data = JSON.parse(content);
    } catch {
      // File doesn't exist, start fresh
    }
    data.themeFlavor = flavor;
    await Bun.write(stateFile, JSON.stringify(data, null, 2));
  } catch (err) {
    // Ignore save errors
  }
}

export interface AppState {
  activeField: string;
  fields: FieldInfo[];
  hnauRuntimes: HnauRuntime[];
  eldila: EldilRuntime[];
  tasks: BeadsTaskMetadata[];
  logs: string[];
  showCommandPalette: boolean;
  tmuxAvailable: boolean;
  initialized: boolean;
  themeFlavor: ThemeFlavorName;
}

export function PerelandraApp({ config, repoRoot, oyarsa }: PerelandraAppProps): React.ReactNode {
  const renderer = useRenderer();
  const hnauManagerRef = useRef<HnauManager>(oyarsa?.getHnauManager() ?? new HnauManager(config));

  const [state, setState] = useState<AppState>(() => {
    const savedTheme = loadThemePreference(repoRoot);
    return {
      activeField: 'main',
      fields: [],
      hnauRuntimes: config.hnau.map((h) => ({
        config: h,
        status: 'stopped' as const,
      })),
      eldila: [],
      tasks: [],
      logs: [],
      showCommandPalette: false,
      tmuxAvailable: false,
      initialized: false,
      themeFlavor: savedTheme,
    };
  });

  useEffect(() => {
    const initialize = async () => {
      const tmux = oyarsa?.getTmuxManager() ?? new TmuxManager();
      const available = await tmux.isTmuxAvailable();
      
      const initialActiveField = oyarsa?.getActiveField() ?? 'main';
      
      let fields: FieldInfo[] = [];
      let tasks: BeadsTaskMetadata[] = [];
      let eldila: EldilRuntime[] = [];

      if (oyarsa) {
        fields = await oyarsa.getFields();
        
        const beadsManager = oyarsa.getBeadsManager();
        const tasksResult = await beadsManager.listReady();
        if (tasksResult.success && tasksResult.data) {
          tasks = tasksResult.data;
        }

        eldila = oyarsa.getEldilManager().list();
        
        logInfo('TUI initialized with real data', {
          fieldCount: fields.length,
          taskCount: tasks.length,
          eldilCount: eldila.length,
        });
      }
      
      setState((prev) => ({
        ...prev,
        activeField: initialActiveField,
        fields,
        tasks,
        eldila,
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

  const handleEldilAction = useCallback(
    async (action: EldilAction, eldilId: string) => {
      if (!oyarsa) {
        addLog('[WARN] Cannot perform eldil action: oyarsa not available');
        return;
      }

      const eldilManager = oyarsa.getEldilManager();
      addLog(`[ELDIL] ${action} ${eldilId || '(new)'}`);

      if (action === 'spawn') {
        addLog('[ELDIL] Use command palette to spawn new Eldil with task');
      } else if (action === 'stop' && eldilId) {
        const result = await eldilManager.stop(eldilId);
        if (result.success) {
          setState((prev) => ({
            ...prev,
            eldila: prev.eldila.map((e) =>
              e.id === eldilId ? { ...e, state: { ...e.state, status: 'completed' as const } } : e
            ),
          }));
          addLog(`[ELDIL] Stopped ${eldilId}`);
        } else {
          addLog(`[ERROR] Failed to stop ${eldilId}: ${result.error}`);
        }
      } else if (action === 'view' && eldilId) {
        const outputs = eldilManager.getOutputs(eldilId);
        addLog(`[ELDIL] ${eldilId} has ${outputs.length} outputs`);
      }
    },
    [oyarsa, addLog]
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

  const syncTasks = useCallback(async () => {
    if (!oyarsa) {
      addLog('[WARN] Cannot sync tasks: oyarsa not available');
      return;
    }

    addLog('[SYNC] Syncing tasks from beads...');
    const beadsManager = oyarsa.getBeadsManager();
    
    await beadsManager.sync();
    const tasksResult = await beadsManager.listReady();
    
    if (tasksResult.success && tasksResult.data) {
      setState((prev) => ({
        ...prev,
        tasks: tasksResult.data ?? [],
      }));
      addLog(`[SYNC] Loaded ${tasksResult.data.length} ready tasks`);
    } else {
      addLog(`[ERROR] Failed to sync tasks: ${tasksResult.error}`);
    }
  }, [oyarsa, addLog]);

  const refreshAll = useCallback(async () => {
    if (!oyarsa) return;

    addLog('[REFRESH] Refreshing all data...');
    
    const [fields, eldila] = await Promise.all([
      oyarsa.getFields(),
      Promise.resolve(oyarsa.getEldilManager().list()),
    ]);

    const hnauRuntimes = oyarsa.getHnauManager().list();

    setState((prev) => ({
      ...prev,
      fields,
      eldila,
      hnauRuntimes,
    }));

    await syncTasks();
    addLog('[REFRESH] Complete');
  }, [oyarsa, addLog, syncTasks]);

  const handleThemeChange = useCallback(
    (flavor: ThemeFlavorName) => {
      setState((prev) => ({ ...prev, themeFlavor: flavor }));
      saveThemePreference(repoRoot, flavor);
      addLog(`[THEME] Switched to ${flavor}`);
    },
    [repoRoot, addLog]
  );

  const commands = useMemo(
    () =>
      createDefaultCommands({
        onFieldSwitch: setActiveField,
        onNewTask: () => addLog('[CMD] New task'),
        onSpawnEldil: () => addLog('[CMD] Spawn eldil'),
        onSyncTasks: syncTasks,
        onRefresh: refreshAll,
        onQuit: handleQuit,
        onThemeChange: handleThemeChange,
        currentTheme: state.themeFlavor,
      }),
    [setActiveField, addLog, handleQuit, syncTasks, refreshAll, handleThemeChange, state.themeFlavor]
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
    <ThemeProvider initialFlavor={state.themeFlavor} onFlavorChange={handleThemeChange}>
      <RootLayout
        config={config}
        repoRoot={repoRoot}
        state={state}
        onFieldSwitch={setActiveField}
        onCommand={addLog}
        onHnauAction={handleHnauAction}
        onEldilAction={handleEldilAction}
        navigationDisabled={state.showCommandPalette}
      />
      <CommandPalette
        commands={commands}
        isOpen={state.showCommandPalette}
        onClose={closeCommandPalette}
        onAction={addLog}
      />
    </ThemeProvider>
  );
}
