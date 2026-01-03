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
  EldilPoolStats,
  QueuedSpawn,
  EldilHandoffReason,
  AmpUsage,
  StreamJSONMessage,
} from '../types/eldil';
import type { TmuxManager } from './tmux';
import { EldilError } from '../util/errors';
import { ContextMonitor } from './context-monitor';

const DEFAULT_TOOL: EldilTool = 'amp';
const DEFAULT_MAX_WORKERS_PER_FIELD = 3;
const DEFAULT_MAX_TOTAL_WORKERS = 10;
const DEFAULT_CONTEXT_THRESHOLD_RATIO = 0.8;
const DEFAULT_MAX_AUTO_HANDOFF_DEPTH = 3;

interface RequiredManagerOptions {
  defaultTool: EldilTool;
  useTmux: boolean;
  logOutputs: boolean;
  maxWorkersPerField: number;
  maxTotalWorkers: number;
  contextThresholdRatio: number;
  maxAutoHandoffDepth: number;
}

export class EldilManager {
  private runtimes: Map<string, EldilRuntime> = new Map();
  private options: RequiredManagerOptions;
  private tmux?: TmuxManager;
  private idCounter = 0;
  private spawnQueue: QueuedSpawn[] = [];
  private onWorkerComplete?: (runtime: EldilRuntime) => void;
  private contextMonitor: ContextMonitor;

  constructor(options: EldilManagerOptions = {}) {
    this.options = {
      defaultTool: options.defaultTool ?? DEFAULT_TOOL,
      useTmux: options.useTmux ?? true,
      logOutputs: options.logOutputs ?? true,
      maxWorkersPerField: options.maxWorkersPerField ?? DEFAULT_MAX_WORKERS_PER_FIELD,
      maxTotalWorkers: options.maxTotalWorkers ?? DEFAULT_MAX_TOTAL_WORKERS,
      contextThresholdRatio: options.contextThresholdRatio ?? DEFAULT_CONTEXT_THRESHOLD_RATIO,
      maxAutoHandoffDepth: options.maxAutoHandoffDepth ?? DEFAULT_MAX_AUTO_HANDOFF_DEPTH,
    };

    this.contextMonitor = new ContextMonitor(
      {
        onHandoffNeeded: (eldilId, reason) => this.handleContextHandoff(eldilId, reason),
      },
      {
        thresholdRatio: this.options.contextThresholdRatio,
        maxAutoHandoffDepth: this.options.maxAutoHandoffDepth,
      }
    );
  }

  setTmuxManager(tmux: TmuxManager): void {
    this.tmux = tmux;
  }

  setOnWorkerComplete(callback: (runtime: EldilRuntime) => void): void {
    this.onWorkerComplete = callback;
  }

  private generateId(): string {
    this.idCounter++;
    return `eldil-${this.idCounter}`;
  }

  private canSpawnInField(fieldName: string): boolean {
    const running = this.listByField(fieldName).filter(
      (r) => r.state.status === 'running'
    );
    return running.length < this.options.maxWorkersPerField;
  }

  private canSpawnTotal(): boolean {
    const running = this.listByStatus('running');
    return running.length < this.options.maxTotalWorkers;
  }

  async spawn(options: EldilSpawnOptions): Promise<EldilResult<EldilRuntime>> {
    if (!this.canSpawnTotal() || !this.canSpawnInField(options.fieldName)) {
      return new Promise((resolve) => {
        this.spawnQueue.push({
          options,
          resolve,
          queuedAt: new Date().toISOString(),
        });
      });
    }

    return this.spawnImmediate(options);
  }

  async spawnImmediate(options: EldilSpawnOptions): Promise<EldilResult<EldilRuntime>> {
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
      fieldPath: options.fieldPath,
      initialPrompt: options.prompt,
    };

    state.threadChain = {
      threadUrl: undefined,
      rootThreadUrl: undefined,
      previousThreadUrls: [],
    };

    try {
      let spawnResult: EldilResult;

      if (this.options.useTmux && this.tmux && options.useTmux !== false) {
        spawnResult = await this.spawnInTmux(runtime, options);
        if (!spawnResult.success) {
          spawnResult = await this.spawnDirect(runtime, options);
        }
      } else {
        spawnResult = await this.spawnDirect(runtime, options);
      }

      if (!spawnResult.success) {
        return { success: false, error: spawnResult.error };
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
      const flags: string[] = ['--execute', '--stream-json'];
      return `echo '${escapedPrompt}' | amp ${flags.join(' ')}`;
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
    const isStreamJson = runtime.config.streamJson && runtime.config.tool === 'amp';

    const processStream = async (
      stream: ReadableStream<Uint8Array> | null,
      type: 'text' | 'error'
    ) => {
      if (!stream) return;

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);

          if (!isStreamJson || type === 'error') {
            runtime.outputs.push({
              type,
              content: chunk,
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          buffer += chunk;
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (!line) continue;

            let parsed: unknown;
            try {
              parsed = JSON.parse(line);
            } catch {
              runtime.outputs.push({
                type: 'text',
                content: line,
                timestamp: new Date().toISOString(),
              });
              continue;
            }

            runtime.outputs.push({
              type: 'json',
              json: parsed,
              timestamp: new Date().toISOString(),
            });

            this.processAmpEvent(runtime, parsed);
          }
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

      this.onWorkerComplete?.(runtime);
      this.processQueue();
    });
  }

  private processAmpEvent(runtime: EldilRuntime, event: unknown): void {
    if (!event || typeof event !== 'object') return;

    const msg = event as StreamJSONMessage;

    if (msg.session_id?.startsWith('T-')) {
      const threadUrl = `https://ampcode.com/threads/${msg.session_id}`;
      this.updateThreadChain(runtime, threadUrl);
    }

    let usage: AmpUsage | undefined;

    if (msg.type === 'assistant' && msg.message?.usage) {
      usage = msg.message.usage;
    } else if (msg.type === 'result' && msg.usage) {
      usage = msg.usage;
    }

    if (
      usage &&
      typeof usage.input_tokens === 'number' &&
      typeof usage.output_tokens === 'number' &&
      typeof usage.max_tokens === 'number'
    ) {
      this.contextMonitor.handleUsage(runtime, usage);
    }
  }

  private updateThreadChain(runtime: EldilRuntime, url: string): void {
    const chain = runtime.state.threadChain ?? {
      threadUrl: undefined,
      rootThreadUrl: undefined,
      previousThreadUrls: [],
    };

    if (!chain.threadUrl) {
      chain.threadUrl = url;
      chain.rootThreadUrl = url;
    } else if (chain.threadUrl !== url) {
      chain.previousThreadUrls = [
        ...(chain.previousThreadUrls ?? []),
        chain.threadUrl,
      ];
      chain.threadUrl = url;
    }

    runtime.state.threadChain = chain;
    runtime.state.threadUrl = chain.threadUrl;
  }

  async handleContextHandoff(
    eldilId: string,
    reason: EldilHandoffReason
  ): Promise<void> {
    const runtime = this.require(eldilId);
    const now = new Date().toISOString();

    if (runtime.state.handoff?.handoffChildId) {
      return;
    }

    runtime.state.handoff = {
      ...runtime.state.handoff,
      reason,
      triggeredAt: now,
    };

    const handoffPrompt = this.buildHandoffPrompt(runtime);

    const spawnOptions: EldilSpawnOptions = {
      fieldName: runtime.state.fieldName,
      fieldPath: runtime.fieldPath,
      hnauId: runtime.state.hnauId,
      taskId: runtime.state.currentTaskId,
      prompt: handoffPrompt,
      tool: runtime.config.tool,
      useTmux: false,
    };

    const result = await this.spawn(spawnOptions);
    if (!result.success || !result.data) {
      runtime.state.lastError = `Failed to spawn handoff Eldil: ${result.error}`;
      return;
    }

    const child = result.data;

    runtime.state.handoff = {
      ...runtime.state.handoff,
      handoffChildId: child.id,
    };

    child.state.handoff = {
      parentEldilId: runtime.id,
    };

    const parentChain = runtime.state.threadChain;
    if (parentChain) {
      child.state.threadChain = {
        rootThreadUrl: parentChain.rootThreadUrl ?? parentChain.threadUrl,
        threadUrl: undefined,
        previousThreadUrls: [
          ...(parentChain.previousThreadUrls ?? []),
          parentChain.threadUrl,
        ].filter((u): u is string => !!u),
      };
    }

    await this.stop(runtime.id);
  }

  private buildHandoffPrompt(runtime: EldilRuntime): string {
    const { initialPrompt } = runtime;
    const state = runtime.state;
    const chain = state.threadChain;
    const currentThreadUrl = chain?.threadUrl ?? state.threadUrl;
    const previousThreads = chain?.previousThreadUrls ?? [];

    const chainParts: string[] = [];
    if (currentThreadUrl) {
      chainParts.push(`Current thread: ${currentThreadUrl}`);
    }
    if (previousThreads.length > 0) {
      chainParts.push(`Previous threads:\n${previousThreads.map((u) => `- ${u}`).join('\n')}`);
    }
    const chainText = chainParts.join('\n');

    return `You are an Eldil (Amp worker agent) taking over an existing task because the previous Amp thread is approaching its context window limit.

Original task / goal:
${initialPrompt}

${chainText || 'There is a single previous thread for this task.'}

Use Amp's built-in handoff pattern:
1. Treat the previous thread(s) as read-only history.
2. Summarize the current state of the task, open issues, and key decisions.
3. Create or use a new, focused working context (a fresh thread) that only carries forward the necessary information.
4. Continue executing on the same task, minimizing repeated context expansions.

Your job is to continue from where the previous Eldil left off, preserving intent and key constraints while working in a fresh context window.`;
  }

  private async processQueue(): Promise<void> {
    if (this.spawnQueue.length === 0) return;

    const eligibleIndex = this.spawnQueue.findIndex((item) => {
      return (
        this.canSpawnTotal() && this.canSpawnInField(item.options.fieldName)
      );
    });

    if (eligibleIndex === -1) return;

    const [item] = this.spawnQueue.splice(eligibleIndex, 1);
    if (!item) return;

    const result = await this.spawnImmediate(item.options);
    item.resolve(result);
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

  getPoolStats(): EldilPoolStats {
    const all = this.list();
    const running = all.filter((r) => r.state.status === 'running');

    const workersByField = new Map<string, number>();
    for (const runtime of running) {
      const current = workersByField.get(runtime.state.fieldName) ?? 0;
      workersByField.set(runtime.state.fieldName, current + 1);
    }

    return {
      totalWorkers: all.length,
      runningWorkers: running.length,
      workersByField,
      queuedTasks: this.spawnQueue.length,
    };
  }

  getQueueLength(): number {
    return this.spawnQueue.length;
  }

  getQueueForField(fieldName: string): number {
    return this.spawnQueue.filter((q) => q.options.fieldName === fieldName)
      .length;
  }

  async spawnParallel(
    optionsList: EldilSpawnOptions[]
  ): Promise<EldilResult<EldilRuntime>[]> {
    return Promise.all(optionsList.map((opts) => this.spawn(opts)));
  }

  setMaxWorkersPerField(max: number): void {
    this.options.maxWorkersPerField = max;
    this.processQueue();
  }

  setMaxTotalWorkers(max: number): void {
    this.options.maxTotalWorkers = max;
    this.processQueue();
  }

  dispose(): void {
    this.stopAll();
    this.runtimes.clear();
    this.spawnQueue.length = 0;
  }
}
