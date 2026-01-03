import type {
  EldilConfig,
  EldilState,
  EldilSpawnOptions,
  EldilResult,
  EldilRuntime,
  EldilOutput,
  EldilManagerOptions,
  EldilTool,
  EldilStatus,
} from '../types/eldil';
import type { TmuxManager } from './tmux';
import { EldilError } from '../util/errors';

const DEFAULT_TOOL: EldilTool = 'amp';

export class EldilManager {
  private runtimes: Map<string, EldilRuntime> = new Map();
  private options: Required<EldilManagerOptions>;
  private tmux?: TmuxManager;
  private idCounter = 0;

  constructor(options: EldilManagerOptions = {}) {
    this.options = {
      defaultTool: options.defaultTool ?? DEFAULT_TOOL,
      useTmux: options.useTmux ?? true,
      logOutputs: options.logOutputs ?? true,
    };
  }

  setTmuxManager(tmux: TmuxManager): void {
    this.tmux = tmux;
  }

  private generateId(): string {
    this.idCounter++;
    return `eldil-${this.idCounter}`;
  }

  async spawn(options: EldilSpawnOptions): Promise<EldilResult<EldilRuntime>> {
    const id = this.generateId();
    const tool = options.tool ?? this.options.defaultTool;
    const now = new Date().toISOString();

    const config: EldilConfig = {
      id,
      tool,
      executeMode: true,
      streamJson: true,
    };

    const state: EldilState = {
      id,
      fieldName: options.fieldName,
      hnauId: options.hnauId,
      currentTaskId: options.taskId,
      status: 'running',
      startedAt: now,
      updatedAt: now,
    };

    const runtime: EldilRuntime = {
      id,
      config,
      state,
      outputs: [],
    };

    try {
      if (this.options.useTmux && this.tmux && options.useTmux !== false) {
        const spawnResult = await this.spawnInTmux(runtime, options);
        if (!spawnResult.success) {
          return { success: false, error: spawnResult.error };
        }
      } else {
        const spawnResult = await this.spawnDirect(runtime, options);
        if (!spawnResult.success) {
          return { success: false, error: spawnResult.error };
        }
      }

      this.runtimes.set(id, runtime);
      return { success: true, data: runtime };
    } catch (err) {
      state.status = 'error';
      state.lastError = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: state.lastError,
      };
    }
  }

  private async spawnInTmux(
    runtime: EldilRuntime,
    options: EldilSpawnOptions
  ): Promise<EldilResult> {
    if (!this.tmux) {
      return { success: false, error: 'Tmux manager not configured' };
    }

    const windowName = `eldil-${options.fieldName}`;
    const cmd = this.buildCommand(runtime.config, options.prompt);

    const paneResult = await this.tmux.splitPane(windowName, {
      cwd: options.fieldPath,
      vertical: true,
    });

    if (!paneResult.success) {
      return { success: false, error: paneResult.error };
    }

    runtime.process = {
      startedAt: new Date().toISOString(),
      tmuxPane: `${windowName}.${paneResult.data}`,
    };

    await this.tmux.sendKeys(
      { window: windowName, pane: paneResult.data },
      cmd
    );

    return { success: true };
  }

  private async spawnDirect(
    runtime: EldilRuntime,
    options: EldilSpawnOptions
  ): Promise<EldilResult> {
    const cmd = this.buildCommand(runtime.config, options.prompt);

    try {
      const proc = Bun.spawn(['sh', '-c', cmd], {
        cwd: options.fieldPath,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      runtime.process = {
        pid: proc.pid,
        startedAt: new Date().toISOString(),
      };

      this.handleProcessOutput(runtime, proc);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildCommand(config: EldilConfig, prompt: string): string {
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    if (config.tool === 'amp') {
      const flags: string[] = [];
      if (config.executeMode) flags.push('--execute');
      if (config.streamJson) flags.push('--stream-json');
      return `amp ${flags.join(' ')} '${escapedPrompt}'`;
    } else if (config.tool === 'opencode') {
      const flags: string[] = ['-q'];
      if (config.model) flags.push('-m', config.model);
      return `opencode ${flags.join(' ')} -p '${escapedPrompt}'`;
    }

    return `echo "Unknown tool: ${config.tool}"`;
  }

  private handleProcessOutput(
    runtime: EldilRuntime,
    proc: ReturnType<typeof Bun.spawn>
  ): void {
    const processStream = async (
      stream: ReadableStream<Uint8Array> | null,
      type: 'text' | 'error'
    ) => {
      if (!stream) return;

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const output: EldilOutput = {
            type,
            content: text,
            timestamp: new Date().toISOString(),
          };

          runtime.outputs.push(output);
        }
      } catch {
        // Stream closed
      }
    };

    if (proc.stdout && typeof proc.stdout !== 'number') {
      processStream(proc.stdout, 'text');
    }
    if (proc.stderr && typeof proc.stderr !== 'number') {
      processStream(proc.stderr, 'error');
    }

    proc.exited.then((code) => {
      runtime.state.status = code === 0 ? 'completed' : 'error';
      runtime.state.updatedAt = new Date().toISOString();
      if (runtime.process) {
        runtime.process.exitCode = code;
      }

      const completeOutput: EldilOutput = {
        type: 'complete',
        content: `Process exited with code ${code}`,
        timestamp: new Date().toISOString(),
      };
      runtime.outputs.push(completeOutput);
    });
  }

  get(id: string): EldilRuntime | undefined {
    return this.runtimes.get(id);
  }

  require(id: string): EldilRuntime {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      throw new EldilError(`Eldil not found: ${id}`, {
        code: 'ELDIL_NOT_FOUND',
        eldilId: id,
      });
    }
    return runtime;
  }

  list(): EldilRuntime[] {
    return Array.from(this.runtimes.values());
  }

  listByField(fieldName: string): EldilRuntime[] {
    return this.list().filter((r) => r.state.fieldName === fieldName);
  }

  listByStatus(status: EldilStatus): EldilRuntime[] {
    return this.list().filter((r) => r.state.status === status);
  }

  async stop(id: string): Promise<EldilResult> {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      return { success: false, error: `Eldil not found: ${id}` };
    }

    try {
      if (runtime.process?.pid) {
        process.kill(runtime.process.pid, 'SIGTERM');
      }

      runtime.state.status = 'completed';
      runtime.state.updatedAt = new Date().toISOString();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.runtimes.keys()).map((id) =>
      this.stop(id)
    );
    await Promise.all(stopPromises);
  }

  getOutputs(id: string): EldilOutput[] {
    const runtime = this.runtimes.get(id);
    return runtime?.outputs ?? [];
  }

  remove(id: string): boolean {
    return this.runtimes.delete(id);
  }

  dispose(): void {
    this.stopAll();
    this.runtimes.clear();
  }
}
