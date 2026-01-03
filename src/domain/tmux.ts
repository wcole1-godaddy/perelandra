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
}

export interface TmuxResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const SESSION_NAME = 'perelandra';
const OYARSA_WINDOW = 'oyarsa';

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
      const output = await $`tmux list-panes -t ${target} -F '#{pane_index}|#{pane_active}|#{pane_width}|#{pane_height}|#{pane_pid}|#{pane_current_command}'`
        .text();

      const panes: TmuxPane[] = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [index, active, width, height, pid, cmd] = line.split('|');
          return {
            index: parseInt(index, 10),
            active: active === '1',
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            pid: pid ? parseInt(pid, 10) : undefined,
            currentCommand: cmd || undefined,
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

      await $`${args}`;

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
}
