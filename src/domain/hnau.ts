import type { HnauConfig, PerelandraConfig } from '../types/config';
import type {
  HnauRuntime,
  HnauStatus,
  HnauStartOptions,
  HnauStopOptions,
  HnauLifecycleResult,
  HealthCheckResult,
  HnauManagerOptions,
} from '../types/hnau';
import { TmuxManager } from './tmux';

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30000;
const DEFAULT_STOP_TIMEOUT_MS = 5000;

export class HnauManager {
  private config: PerelandraConfig;
  private runtimes: Map<string, HnauRuntime> = new Map();
  private healthCheckTimers: Map<string, Timer> = new Map();
  private options: Required<HnauManagerOptions>;
  private tmux?: TmuxManager;

  constructor(config: PerelandraConfig, options: HnauManagerOptions = {}) {
    this.config = config;
    this.options = {
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS,
      defaultStopTimeoutMs: options.defaultStopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS,
    };
    this.initializeRuntimes();
  }

  setTmuxManager(tmux: TmuxManager): void {
    this.tmux = tmux;
  }

  private initializeRuntimes(): void {
    for (const hnauConfig of this.config.hnau) {
      this.runtimes.set(hnauConfig.id, {
        config: hnauConfig,
        status: 'stopped',
      });
    }
  }

  list(): HnauRuntime[] {
    return Array.from(this.runtimes.values());
  }

  get(id: string): HnauRuntime | undefined {
    return this.runtimes.get(id);
  }

  getConfig(id: string): HnauConfig | undefined {
    return this.config.hnau.find((h) => h.id === id);
  }

  async start(id: string, options: HnauStartOptions): Promise<HnauLifecycleResult> {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      return { success: false, hnauId: id, status: 'stopped', error: `Hnau not found: ${id}` };
    }

    if (runtime.status === 'running') {
      return { success: true, hnauId: id, status: 'running' };
    }

    runtime.status = 'starting';
    this.runtimes.set(id, runtime);

    try {
      const hnauConfig = runtime.config;
      const workingDir = `${options.field}/${hnauConfig.root}`;
      const devCommand = hnauConfig.devCommand;

      if (this.tmux && options.useTmux !== false) {
        const fieldName = options.field.split('/').pop() ?? 'main';
        const paneResult = await this.tmux.createHnauPane(fieldName, id, { cwd: workingDir });

        if (paneResult.success && paneResult.data) {
          runtime.tmuxPane = `${paneResult.data.window}.${paneResult.data.pane}`;
          await this.tmux.sendKeys(
            { window: paneResult.data.window, pane: paneResult.data.pane },
            devCommand
          );
        }
      } else {
        const env = {
          ...process.env,
          ...hnauConfig.env,
          ...options.env,
        };

        const proc = Bun.spawn(['sh', '-c', devCommand], {
          cwd: workingDir,
          env,
          stdout: 'pipe',
          stderr: 'pipe',
        });

        runtime.process = {
          pid: proc.pid,
          startedAt: new Date().toISOString(),
        };
      }

      runtime.status = 'running';
      this.runtimes.set(id, runtime);

      if (hnauConfig.healthCheck) {
        this.startHealthCheck(id);
      }

      return { success: true, hnauId: id, status: 'running' };
    } catch (err) {
      runtime.status = 'error';
      this.runtimes.set(id, runtime);
      return {
        success: false,
        hnauId: id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async stop(id: string, options: HnauStopOptions = {}): Promise<HnauLifecycleResult> {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      return { success: false, hnauId: id, status: 'stopped', error: `Hnau not found: ${id}` };
    }

    if (runtime.status === 'stopped') {
      return { success: true, hnauId: id, status: 'stopped' };
    }

    this.stopHealthCheck(id);

    runtime.status = 'stopping';
    this.runtimes.set(id, runtime);

    try {
      if (runtime.process?.pid) {
        const signal = options.force ? 'SIGKILL' : 'SIGTERM';
        process.kill(runtime.process.pid, signal);

        if (!options.force) {
          const timeout = options.timeout ?? this.options.defaultStopTimeoutMs;
          await this.waitForExit(runtime.process.pid, timeout);
        }
      }

      runtime.status = 'stopped';
      runtime.process = {
        ...runtime.process,
        stoppedAt: new Date().toISOString(),
      };
      this.runtimes.set(id, runtime);

      return { success: true, hnauId: id, status: 'stopped' };
    } catch (err) {
      if (options.force && runtime.process?.pid) {
        try {
          process.kill(runtime.process.pid, 'SIGKILL');
        } catch {
          // Process already dead
        }
      }

      runtime.status = 'stopped';
      this.runtimes.set(id, runtime);

      return { success: true, hnauId: id, status: 'stopped' };
    }
  }

  async restart(id: string, options: HnauStartOptions): Promise<HnauLifecycleResult> {
    const stopResult = await this.stop(id, { force: false });
    if (!stopResult.success) {
      return stopResult;
    }

    return this.start(id, options);
  }

  status(id: string): HnauStatus | undefined {
    return this.runtimes.get(id)?.status;
  }

  async checkHealth(id: string): Promise<HealthCheckResult> {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      return { healthy: false, error: `Hnau not found: ${id}` };
    }

    const healthCheck = runtime.config.healthCheck;
    if (!healthCheck) {
      return { healthy: true };
    }

    const startTime = Date.now();

    try {
      const timeoutMs = healthCheck.timeoutMs ?? 5000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(healthCheck.url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - startTime;
      const healthy = response.ok;

      runtime.health = {
        healthy,
        lastCheck: new Date().toISOString(),
        consecutiveFailures: healthy ? 0 : (runtime.health?.consecutiveFailures ?? 0) + 1,
      };
      this.runtimes.set(id, runtime);

      return {
        healthy,
        responseTimeMs,
        statusCode: response.status,
      };
    } catch (err) {
      const consecutiveFailures = (runtime.health?.consecutiveFailures ?? 0) + 1;
      runtime.health = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        lastError: err instanceof Error ? err.message : String(err),
        consecutiveFailures,
      };
      this.runtimes.set(id, runtime);

      return {
        healthy: false,
        responseTimeMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private startHealthCheck(id: string): void {
    const runtime = this.runtimes.get(id);
    if (!runtime?.config.healthCheck) return;

    const intervalMs =
      (runtime.config.healthCheck.intervalSeconds ?? 30) * 1000;

    const timer = setInterval(() => {
      this.checkHealth(id);
    }, intervalMs);

    this.healthCheckTimers.set(id, timer);
  }

  private stopHealthCheck(id: string): void {
    const timer = this.healthCheckTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(id);
    }
  }

  private async waitForExit(pid: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        process.kill(pid, 0);
        await Bun.sleep(100);
      } catch {
        return;
      }
    }
    throw new Error('Process did not exit in time');
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.runtimes.keys()).map((id) =>
      this.stop(id, { force: true })
    );
    await Promise.all(stopPromises);
  }

  dispose(): void {
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
  }
}
