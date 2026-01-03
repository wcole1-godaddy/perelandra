import type { PerelandraConfig } from '../types/config';
import type { BeadsTaskMetadata } from '../types/beads';
import type { EldilRuntime } from '../types/eldil';
import type { BeadsManager } from '../domain/beads';
import type { EldilManager } from '../domain/eldil';
import type { StateManager } from './state';
import { logInfo, logWarn, logError, logDebug } from '../logging/pino';
import { eventBus } from './events';

const DEFAULT_POLL_INTERVAL_MS = 30000;
const DEFAULT_MAX_CONCURRENT_SPAWNS = 3;

export interface TaskSchedulerConfig {
  pollIntervalMs?: number;
  maxConcurrentSpawns?: number;
  enabled?: boolean;
  autoStart?: boolean;
}

export interface TaskSchedulerDeps {
  config: PerelandraConfig;
  repoRoot: string;
  beadsManager: BeadsManager;
  eldilManager: EldilManager;
  stateManager: StateManager;
  spawnEldilForTask: (
    fieldName: string,
    prompt: string,
    taskId: string,
    hnauId?: string
  ) => Promise<EldilRuntime | null>;
}

export interface SchedulerStats {
  isRunning: boolean;
  lastPollAt?: string;
  tasksProcessedTotal: number;
  tasksSpawnedTotal: number;
  activeTaskIds: Set<string>;
  pollCount: number;
}

export class TaskScheduler {
  private deps: TaskSchedulerDeps;
  private schedulerConfig: Required<TaskSchedulerConfig>;
  private pollTimer?: Timer;
  private isRunning = false;
  private activeTaskIds = new Set<string>();
  private stats: SchedulerStats;

  constructor(deps: TaskSchedulerDeps, config: TaskSchedulerConfig = {}) {
    this.deps = deps;
    this.schedulerConfig = {
      pollIntervalMs: config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      maxConcurrentSpawns: config.maxConcurrentSpawns ?? DEFAULT_MAX_CONCURRENT_SPAWNS,
      enabled: config.enabled ?? true,
      autoStart: config.autoStart ?? false,
    };

    this.stats = {
      isRunning: false,
      tasksProcessedTotal: 0,
      tasksSpawnedTotal: 0,
      activeTaskIds: this.activeTaskIds,
      pollCount: 0,
    };
  }

  start(): void {
    if (!this.schedulerConfig.enabled) {
      logInfo('TaskScheduler disabled, not starting');
      return;
    }

    if (this.isRunning) {
      logWarn('TaskScheduler already running');
      return;
    }

    this.isRunning = true;
    this.stats.isRunning = true;

    logInfo('TaskScheduler starting', {
      pollIntervalMs: this.schedulerConfig.pollIntervalMs,
      maxConcurrentSpawns: this.schedulerConfig.maxConcurrentSpawns,
    });

    this.poll();

    this.pollTimer = setInterval(() => {
      this.poll();
    }, this.schedulerConfig.pollIntervalMs);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.isRunning = false;
    this.stats.isRunning = false;
    logInfo('TaskScheduler stopped');
  }

  async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.stats.pollCount++;
    this.stats.lastPollAt = new Date().toISOString();

    logDebug('TaskScheduler polling for ready tasks');

    try {
      const result = await this.deps.beadsManager.listReady();
      if (!result.success || !result.data) {
        logWarn('Failed to list ready tasks', { error: result.error });
        return;
      }

      const readyTasks = result.data;
      if (readyTasks.length === 0) {
        logDebug('No ready tasks found');
        return;
      }

      logInfo('Found ready tasks', { count: readyTasks.length });

      const eligibleTasks = this.filterEligibleTasks(readyTasks);
      if (eligibleTasks.length === 0) {
        logDebug('No eligible tasks after filtering');
        return;
      }

      const tasksToSpawn = eligibleTasks.slice(0, this.schedulerConfig.maxConcurrentSpawns);

      for (const task of tasksToSpawn) {
        await this.processTask(task);
      }
    } catch (err) {
      logError('TaskScheduler poll error', err);
    }
  }

  private filterEligibleTasks(tasks: BeadsTaskMetadata[]): BeadsTaskMetadata[] {
    return tasks.filter((task) => {
      if (this.activeTaskIds.has(task.id)) {
        logDebug('Skipping task with active Eldil', { taskId: task.id });
        return false;
      }

      if (this.hasActiveEldilForTask(task.id)) {
        logDebug('Skipping task - Eldil already running', { taskId: task.id });
        this.activeTaskIds.add(task.id);
        return false;
      }

      return true;
    });
  }

  private hasActiveEldilForTask(taskId: string): boolean {
    const eldila = this.deps.stateManager.listEldila();
    return eldila.some(
      (e) => e.currentTaskId === taskId && e.status === 'running'
    );
  }

  private async processTask(task: BeadsTaskMetadata): Promise<void> {
    logInfo('Processing task for Eldil spawn', { taskId: task.id, title: task.title });
    this.stats.tasksProcessedTotal++;

    try {
      const fieldResult = await this.deps.beadsManager.resolveFieldForTask(
        task,
        this.deps.config,
        this.deps.repoRoot
      );

      if (!fieldResult.success || !fieldResult.data) {
        logError('Failed to resolve field for task', new Error(fieldResult.error));
        return;
      }

      const fieldState = fieldResult.data;

      const hnauConfig = this.deps.beadsManager.resolveHnauForTask(task, this.deps.config);

      const prompt = this.buildEldilPrompt(task, hnauConfig?.id);

      this.activeTaskIds.add(task.id);

      const runtime = await this.deps.spawnEldilForTask(
        fieldState.name,
        prompt,
        task.id,
        hnauConfig?.id
      );

      if (!runtime) {
        logError('Failed to spawn Eldil for task', new Error(`Task: ${task.id}`));
        this.activeTaskIds.delete(task.id);
        return;
      }

      this.stats.tasksSpawnedTotal++;

      logInfo('Eldil spawned for task', {
        taskId: task.id,
        eldilId: runtime.id,
        fieldName: fieldState.name,
        hnauId: hnauConfig?.id,
      });

      eventBus.emit('task:statusChanged', {
        taskId: task.id,
        fieldName: fieldState.name,
        to: 'in-progress',
        eldilId: runtime.id,
        reason: 'claimed',
      });
    } catch (err) {
      logError('Error processing task', err);
      this.activeTaskIds.delete(task.id);
    }
  }

  private buildEldilPrompt(task: BeadsTaskMetadata, hnauId?: string): string {
    const parts: string[] = [];

    parts.push(`# Task: ${task.title}`);
    parts.push(`Task ID: ${task.id}`);

    if (task.description) {
      parts.push('');
      parts.push('## Description');
      parts.push(task.description);
    }

    if (hnauId) {
      parts.push('');
      parts.push(`## Target Service: ${hnauId}`);
      parts.push(`You are working on the "${hnauId}" service/component.`);
    }

    if (task.labels && task.labels.length > 0) {
      parts.push('');
      parts.push(`## Labels: ${task.labels.join(', ')}`);
    }

    parts.push('');
    parts.push('## Instructions');
    parts.push('1. Analyze the task requirements');
    parts.push('2. Make the necessary code changes');
    parts.push('3. Ensure tests pass if applicable');
    parts.push('4. Commit your changes with a descriptive message referencing the task ID');

    return parts.join('\n');
  }

  markTaskComplete(taskId: string): void {
    this.activeTaskIds.delete(taskId);
    logDebug('Task marked complete in scheduler', { taskId });
  }

  getStats(): SchedulerStats {
    return { ...this.stats, activeTaskIds: new Set(this.activeTaskIds) };
  }

  isTaskActive(taskId: string): boolean {
    return this.activeTaskIds.has(taskId);
  }

  setEnabled(enabled: boolean): void {
    this.schedulerConfig.enabled = enabled;
    if (!enabled && this.isRunning) {
      this.stop();
    }
  }

  setPollInterval(intervalMs: number): void {
    this.schedulerConfig.pollIntervalMs = intervalMs;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  dispose(): void {
    this.stop();
    this.activeTaskIds.clear();
  }
}
