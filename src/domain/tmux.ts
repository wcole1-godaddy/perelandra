import { $ } from 'bun';
import { TmuxError } from '../util/errors';

export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

export interface TmuxPane {
  index: number;
  active: boolean;
  width: number;
  height: number;
  pid?: number;
  currentCommand?: string;
  title?: string;
}

export interface TmuxGridPane {
  paneId: string;
  index: number;
  eldilId?: string;
  width: number;
  height: number;
  pid?: number;
  currentCommand?: string;
  active: boolean;
}

export interface TmuxResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const SESSION_NAME = 'perelandra';
const OYARSA_WINDOW = 'oyarsa';
const ELDILA_GRID_WINDOW = 'eldila-grid';
const ELDIL_ID_TAG = '@eldil_id';

export class TmuxManager {
  private sessionName: string;

  constructor(sessionName: string = SESSION_NAME) {
    this.sessionName = sessionName;
  }

  setSessionName(name: string): void {
    this.sessionName = name;
  }

  getSessionName(): string {
    return this.sessionName;
  }

  async isTmuxAvailable(): Promise<boolean> {
    try {
      await $`which tmux`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  async requireTmux(): Promise<void> {
    if (!(await this.isTmuxAvailable())) {
      throw new TmuxError('tmux is not installed or not in PATH', {
        code: 'TMUX_NOT_AVAILABLE',
        suggestion: 'Install tmux: brew install tmux (macOS) or apt install tmux (Linux)',
      });
    }
  }

  async isInsideTmux(): Promise<boolean> {
    return !!process.env.TMUX;
  }

  async sessionExists(name?: string): Promise<boolean> {
    try {
      await $`tmux has-session -t ${name ?? this.sessionName}`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<TmuxResult<TmuxSession[]>> {
    try {
      const output = await $`tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}'`
        .text();

      const sessions: TmuxSession[] = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, windows, created, attached] = line.split('|');
          return {
            name,
            windows: parseInt(windows, 10),
            created,
            attached: attached === '1',
          };
        });

      return { success: true, data: sessions };
    } catch (err) {
      return { success: false, error: 'No tmux sessions found' };
    }
  }

  async createSession(options: { detached?: boolean } = {}): Promise<TmuxResult> {
    if (await this.sessionExists()) {
      return { success: true };
    }

    try {
      const args = ['tmux', 'new-session', '-s', this.sessionName, '-n', OYARSA_WINDOW];
      if (options.detached) {
        args.push('-d');
      }

      await $`${args}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async killSession(name?: string): Promise<TmuxResult> {
    try {
      await $`tmux kill-session -t ${name ?? this.sessionName}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listWindows(session?: string): Promise<TmuxResult<TmuxWindow[]>> {
    try {
      const target = session ?? this.sessionName;
      const output = await $`tmux list-windows -t ${target} -F '#{window_index}|#{window_name}|#{window_active}|#{window_panes}'`
        .text();

      const windows: TmuxWindow[] = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [index, name, active, panes] = line.split('|');
          return {
            index: parseInt(index, 10),
            name,
            active: active === '1',
            panes: parseInt(panes, 10),
          };
        });

      return { success: true, data: windows };
    } catch (err) {
      return { success: false, error: 'Failed to list windows' };
    }
  }

  async createWindow(name: string, options: { cwd?: string } = {}): Promise<TmuxResult<number>> {
    try {
      const args = ['tmux', 'new-window', '-t', this.sessionName, '-n', name];
      if (options.cwd) {
        args.push('-c', options.cwd);
      }

      await $`${args}`;

      const windowsResult = await this.listWindows();
      if (windowsResult.success && windowsResult.data) {
        const newWindow = windowsResult.data.find((w) => w.name === name);
        if (newWindow) {
          return { success: true, data: newWindow.index };
        }
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async selectWindow(indexOrName: number | string): Promise<TmuxResult> {
    try {
      await $`tmux select-window -t ${this.sessionName}:${indexOrName}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async killWindow(indexOrName: number | string): Promise<TmuxResult> {
    try {
      await $`tmux kill-window -t ${this.sessionName}:${indexOrName}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listPanes(window: string | number): Promise<TmuxResult<TmuxPane[]>> {
    try {
      const target = `${this.sessionName}:${window}`;
      const output = await $`tmux list-panes -t ${target} -F '#{pane_index}|#{pane_active}|#{pane_width}|#{pane_height}|#{pane_pid}|#{pane_current_command}|#{pane_title}'`
        .quiet()
        .text();

      const panes: TmuxPane[] = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [index, active, width, height, pid, cmd, title] = line.split('|');
          return {
            index: parseInt(index, 10),
            active: active === '1',
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            pid: pid ? parseInt(pid, 10) : undefined,
            currentCommand: cmd || undefined,
            title: title || undefined,
          };
        });

      return { success: true, data: panes };
    } catch (err) {
      return { success: false, error: 'Failed to list panes' };
    }
  }

  async splitPane(
    window: string | number,
    options: { vertical?: boolean; cwd?: string; percentage?: number } = {}
  ): Promise<TmuxResult<number>> {
    try {
      const target = `${this.sessionName}:${window}`;
      const args = ['tmux', 'split-window', '-t', target];

      if (options.vertical) {
        args.push('-h');
      } else {
        args.push('-v');
      }

      if (options.percentage) {
        args.push('-p', String(options.percentage));
      }

      if (options.cwd) {
        args.push('-c', options.cwd);
      }

      await $`${args}`.quiet();

      const panesResult = await this.listPanes(window);
      if (panesResult.success && panesResult.data) {
        const activePane = panesResult.data.find((p) => p.active);
        if (activePane) {
          return { success: true, data: activePane.index };
        }
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async killPane(window: string | number, pane: number): Promise<TmuxResult> {
    try {
      await $`tmux kill-pane -t ${this.sessionName}:${window}.${pane}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendKeys(
    target: { window: string | number; pane?: number },
    keys: string,
    options: { enter?: boolean } = { enter: true }
  ): Promise<TmuxResult> {
    try {
      const targetStr = target.pane !== undefined
        ? `${this.sessionName}:${target.window}.${target.pane}`
        : `${this.sessionName}:${target.window}`;

      if (options.enter) {
        await $`tmux send-keys -t ${targetStr} ${keys} Enter`;
      } else {
        await $`tmux send-keys -t ${targetStr} ${keys}`;
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendKeysToPane(
    paneId: string,
    keys: string,
    options: { enter?: boolean } = { enter: true }
  ): Promise<TmuxResult> {
    try {
      if (options.enter) {
        await $`tmux send-keys -t ${paneId} ${keys} Enter`;
      } else {
        await $`tmux send-keys -t ${paneId} ${keys}`;
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async capturePane(
    target: { window: string | number; pane?: number },
    options: { lines?: number } = {}
  ): Promise<TmuxResult<string>> {
    try {
      const targetStr = target.pane !== undefined
        ? `${this.sessionName}:${target.window}.${target.pane}`
        : `${this.sessionName}:${target.window}`;

      const args = ['tmux', 'capture-pane', '-t', targetStr, '-p'];
      if (options.lines) {
        args.push('-S', String(-options.lines));
      }

      const output = await $`${args}`.text();
      return { success: true, data: output };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async attach(): Promise<TmuxResult> {
    if (await this.isInsideTmux()) {
      return { success: false, error: 'Already inside tmux session' };
    }

    try {
      const proc = Bun.spawn(['tmux', 'attach-session', '-t', this.sessionName], {
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async createFieldWindow(fieldName: string, fieldPath: string): Promise<TmuxResult<number>> {
    const windowName = `field-${fieldName}`;
    return this.createWindow(windowName, { cwd: fieldPath });
  }

  async ensureFieldWindow(fieldName: string, fieldPath: string): Promise<TmuxResult<number>> {
    const windowName = `field-${fieldName}`;
    
    const windowsResult = await this.listWindows();
    if (windowsResult.success && windowsResult.data) {
      const existing = windowsResult.data.find((w) => w.name === windowName);
      if (existing) {
        return { success: true, data: existing.index };
      }
    }
    
    return this.createWindow(windowName, { cwd: fieldPath });
  }

  async windowExists(windowName: string): Promise<boolean> {
    const windowsResult = await this.listWindows();
    if (!windowsResult.success || !windowsResult.data) {
      return false;
    }
    return windowsResult.data.some((w) => w.name === windowName);
  }

  async paneExists(tmuxPane: string): Promise<boolean> {
    // Handle pane ID format (e.g., %5)
    if (tmuxPane.startsWith('%')) {
      return this.paneIdExists(tmuxPane);
    }

    // Handle legacy window.pane format
    const [windowName, paneStr] = tmuxPane.split('.');
    if (!windowName) return false;
    
    const panesResult = await this.listPanes(windowName);
    if (!panesResult.success || !panesResult.data) {
      return false;
    }
    
    const paneIndex = parseInt(paneStr, 10);
    return panesResult.data.some((p) => p.index === paneIndex);
  }

  async paneIdExists(paneId: string): Promise<boolean> {
    try {
      await $`tmux display-message -t ${paneId} -p ''`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  async setPaneTitle(
    window: string | number,
    pane: number,
    title: string
  ): Promise<TmuxResult> {
    try {
      const target = `${this.sessionName}:${window}.${pane}`;
      await $`tmux select-pane -t ${target} -T ${title}`.quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getPaneByTitle(title: string): Promise<TmuxResult<{ window: string; pane: number } | null>> {
    try {
      const windowsResult = await this.listWindows();
      if (!windowsResult.success || !windowsResult.data) {
        return { success: false, error: 'Failed to list windows' };
      }

      for (const window of windowsResult.data) {
        const panesResult = await this.listPanes(window.index);
        if (panesResult.success && panesResult.data) {
          const pane = panesResult.data.find((p) => p.title === title);
          if (pane) {
            return {
              success: true,
              data: { window: window.name, pane: pane.index },
            };
          }
        }
      }

      return { success: true, data: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async createHnauPane(
    fieldName: string,
    _hnauId: string,
    options: { cwd?: string; vertical?: boolean } = {}
  ): Promise<TmuxResult<{ window: string; pane: number }>> {
    const windowName = `field-${fieldName}`;

    const windowsResult = await this.listWindows();
    if (!windowsResult.success || !windowsResult.data) {
      return { success: false, error: 'Failed to list windows' };
    }

    const window = windowsResult.data.find((w) => w.name === windowName);
    if (!window) {
      return { success: false, error: `Window not found: ${windowName}` };
    }

    const paneResult = await this.splitPane(window.index, {
      vertical: options.vertical,
      cwd: options.cwd,
    });

    if (!paneResult.success) {
      return { success: false, error: paneResult.error };
    }

    return {
      success: true,
      data: {
        window: windowName,
        pane: paneResult.data ?? 0,
      },
    };
  }

  async ensureSession(name?: string): Promise<TmuxResult> {
    const sessionName = name ?? this.sessionName;
    if (await this.sessionExists(sessionName)) {
      return { success: true };
    }

    try {
      await $`tmux new-session -d -s ${sessionName} -n ${OYARSA_WINDOW}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async ensureWindow(windowName: string, options: { cwd?: string } = {}): Promise<TmuxResult<number>> {
    const windowsResult = await this.listWindows();
    if (windowsResult.success && windowsResult.data) {
      const existing = windowsResult.data.find((w) => w.name === windowName);
      if (existing) {
        return { success: true, data: existing.index };
      }
    }

    return this.createWindow(windowName, options);
  }

  async ensureEldilaGridWindow(): Promise<TmuxResult<number>> {
    return this.ensureWindow(ELDILA_GRID_WINDOW);
  }

  getEldilaGridWindowName(): string {
    return ELDILA_GRID_WINDOW;
  }

  async spawnPane(
    window: string | number,
    cmd: string,
    options: { cwd?: string; eldilId?: string } = {}
  ): Promise<TmuxResult<string>> {
    try {
      const target = `${this.sessionName}:${window}`;

      const panesResult = await this.listPanes(window);
      const isFirstPane = !panesResult.success || !panesResult.data || panesResult.data.length === 0;

      let paneId: string;

      if (isFirstPane) {
        const paneIdOutput = await $`tmux list-panes -t ${target} -F '#{pane_id}'`.text();
        paneId = paneIdOutput.trim().split('\n')[0] || '';

        if (options.cwd) {
          await $`tmux send-keys -t ${paneId} ${'cd ' + options.cwd} Enter`.quiet();
        }
      } else {
        const args = ['tmux', 'split-window', '-t', target, '-P', '-F', '#{pane_id}'];
        if (options.cwd) {
          args.push('-c', options.cwd);
        }

        const output = await $`${args}`.text();
        paneId = output.trim();
      }

      if (!paneId) {
        return { success: false, error: 'Failed to get pane ID' };
      }

      if (options.eldilId) {
        await this.tagPane(paneId, options.eldilId);
      }

      await $`tmux send-keys -t ${paneId} ${cmd} Enter`;

      await this.syncLayout(window);

      return { success: true, data: paneId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async tagPane(paneId: string, eldilId: string): Promise<TmuxResult> {
    try {
      await $`tmux set-option -p -t ${paneId} ${ELDIL_ID_TAG} ${eldilId}`.quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getPaneTag(paneId: string): Promise<TmuxResult<string | null>> {
    try {
      const output = await $`tmux show-options -p -t ${paneId} -v ${ELDIL_ID_TAG}`.quiet().text();
      const value = output.trim();
      return { success: true, data: value || null };
    } catch {
      return { success: true, data: null };
    }
  }

  async killPaneById(paneId: string): Promise<TmuxResult> {
    try {
      await $`tmux kill-pane -t ${paneId}`;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async syncLayout(window: string | number): Promise<TmuxResult> {
    try {
      const target = `${this.sessionName}:${window}`;
      await $`tmux select-layout -t ${target} tiled`.quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listGridPanes(window: string | number): Promise<TmuxResult<TmuxGridPane[]>> {
    try {
      const target = `${this.sessionName}:${window}`;
      const output = await $`tmux list-panes -t ${target} -F '#{pane_id}|#{pane_index}|#{pane_width}|#{pane_height}|#{pane_pid}|#{pane_current_command}|#{pane_active}'`
        .quiet()
        .text();

      const panes: TmuxGridPane[] = [];

      for (const line of output.trim().split('\n').filter(Boolean)) {
        const [paneId, index, width, height, pid, cmd, active] = line.split('|');

        const tagResult = await this.getPaneTag(paneId);
        const eldilId = tagResult.success ? tagResult.data ?? undefined : undefined;

        panes.push({
          paneId,
          index: parseInt(index, 10),
          eldilId,
          width: parseInt(width, 10),
          height: parseInt(height, 10),
          pid: pid ? parseInt(pid, 10) : undefined,
          currentCommand: cmd || undefined,
          active: active === '1',
        });
      }

      return { success: true, data: panes };
    } catch (err) {
      return { success: false, error: 'Failed to list grid panes' };
    }
  }

  async recoverEldilMapping(window?: string | number): Promise<TmuxResult<Map<string, string>>> {
    const targetWindow = window ?? ELDILA_GRID_WINDOW;

    const windowExists = await this.windowExists(String(targetWindow));
    if (!windowExists) {
      return { success: true, data: new Map() };
    }

    const panesResult = await this.listGridPanes(targetWindow);
    if (!panesResult.success || !panesResult.data) {
      return { success: false, error: panesResult.error ?? 'Failed to list panes' };
    }

    const mapping = new Map<string, string>();
    for (const pane of panesResult.data) {
      if (pane.eldilId) {
        mapping.set(pane.eldilId, pane.paneId);
      }
    }

    return { success: true, data: mapping };
  }

  async spawnEldilPane(
    eldilId: string,
    cmd: string,
    options: { cwd?: string } = {}
  ): Promise<TmuxResult<string>> {
    const windowResult = await this.ensureEldilaGridWindow();
    if (!windowResult.success) {
      return { success: false, error: windowResult.error };
    }

    return this.spawnPane(ELDILA_GRID_WINDOW, cmd, {
      cwd: options.cwd,
      eldilId,
    });
  }

  async killEldilPane(eldilId: string): Promise<TmuxResult> {
    const mappingResult = await this.recoverEldilMapping();
    if (!mappingResult.success || !mappingResult.data) {
      return { success: false, error: 'Failed to recover eldil mapping' };
    }

    const paneId = mappingResult.data.get(eldilId);
    if (!paneId) {
      return { success: false, error: `No pane found for eldil: ${eldilId}` };
    }

    const result = await this.killPaneById(paneId);
    if (result.success) {
      await this.syncLayout(ELDILA_GRID_WINDOW);
    }
    return result;
  }

  async getEldilPaneId(eldilId: string): Promise<TmuxResult<string | null>> {
    const mappingResult = await this.recoverEldilMapping();
    if (!mappingResult.success || !mappingResult.data) {
      return { success: false, error: 'Failed to recover eldil mapping' };
    }

    const paneId = mappingResult.data.get(eldilId);
    return { success: true, data: paneId ?? null };
  }

  async countEldilaInGrid(): Promise<number> {
    const panesResult = await this.listGridPanes(ELDILA_GRID_WINDOW);
    if (!panesResult.success || !panesResult.data) {
      return 0;
    }
    return panesResult.data.filter((p) => p.eldilId).length;
  }

  async setupGridKeyBindings(): Promise<TmuxResult> {
    try {
      // Ctrl-g: switch to eldila-grid window
      await $`tmux bind-key -n C-g select-window -t ${this.sessionName}:${ELDILA_GRID_WINDOW}`.quiet();
      // Ctrl-d: switch to oyarsa (dashboard) window
      await $`tmux bind-key -n C-d select-window -t ${this.sessionName}:${OYARSA_WINDOW}`.quiet();
      // Ctrl-space: toggle between last two windows
      await $`tmux bind-key -n C-Space last-window`.quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async ensureGridLayout(): Promise<TmuxResult> {
    const sessionResult = await this.ensureSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const gridResult = await this.ensureEldilaGridWindow();
    if (!gridResult.success) {
      return { success: false, error: gridResult.error };
    }

    const bindingsResult = await this.setupGridKeyBindings();
    if (!bindingsResult.success) {
      return { success: false, error: bindingsResult.error };
    }

    return { success: true };
  }

  getOyarsaWindowName(): string {
    return OYARSA_WINDOW;
  }
}
