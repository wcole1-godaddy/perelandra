import { eventBus } from '../core/events';
import { logInfo, logWarn, logError } from '../logging/pino';
import type { StateManager } from '../core/state';
import type { HnauManager } from './hnau';
import type { BeadsManager } from './beads';
import type {
  WitnessConfig,
  WitnessReport,
  StuckEldilReport,
  UnhealthyHnauReport,
  WitnessAction,
} from '../types/witness';
import { DEFAULT_WITNESS_CONFIG } from '../types/witness';

export interface WitnessOptions {
  stateManager: StateManager;
  hnauManager: HnauManager;
  beadsManager: BeadsManager;
  config?: WitnessConfig;
}

export class Witness {
  private stateManager: StateManager;
  private hnauManager: HnauManager;
  private beadsManager: BeadsManager;
  private config: Required<WitnessConfig>;

  private pollTimer?: Timer;
  private running = false;

  constructor(options: WitnessOptions) {
    this.stateManager = options.stateManager;
    this.hnauManager = options.hnauManager;
    this.beadsManager = options.beadsManager;
    this.config = { ...DEFAULT_WITNESS_CONFIG, ...options.config };
  }

  start(): void {
    if (this.running || !this.config.enabled) {
      return;
    }

    logInfo('Witness starting', {
      pollIntervalMs: this.config.pollIntervalMs,
      stuckEldilTimeoutMs: this.config.stuckEldilTimeoutMs,
      maxConsecutiveHealthFailures: this.config.maxConsecutiveHealthFailures,
    });

    this.running = true;
    this.pollTimer = setInterval(() => {
      this.runInspection().catch((err) => {
        logError('Witness inspection failed', err);
      });
    }, this.config.pollIntervalMs);

    this.runInspection().catch((err) => {
      logError('Witness initial inspection failed', err);
    });
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.running = false;
    logInfo('Witness stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  async runInspection(): Promise<WitnessReport> {
    const timestamp = new Date().toISOString();
    const stuckEldila: StuckEldilReport[] = [];
    const unhealthyHnau: UnhealthyHnauReport[] = [];
    const actionsTaken: WitnessAction[] = [];

    await this.inspectEldila(stuckEldila, actionsTaken);
    await this.inspectHnau(unhealthyHnau, actionsTaken);

    const report: WitnessReport = {
      timestamp,
      stuckEldila,
      unhealthyHnau,
      actionsTaken,
    };

    if (stuckEldila.length > 0 || unhealthyHnau.length > 0) {
      logWarn('Witness detected issues', {
        stuckEldila: stuckEldila.length,
        unhealthyHnau: unhealthyHnau.length,
        actions: actionsTaken.length,
      });

      eventBus.emit('witness:report', report);
    }

    return report;
  }

  private async inspectEldila(
    reports: StuckEldilReport[],
    actions: WitnessAction[]
  ): Promise<void> {
    const now = Date.now();
    const eldila = this.stateManager.listEldila();

    for (const eldil of eldila) {
      if (eldil.status !== 'running') {
        continue;
      }

      const startedAt = new Date(eldil.startedAt).getTime();
      const runningDurationMs = now - startedAt;

      if (runningDurationMs > this.config.stuckEldilTimeoutMs) {
        const report: StuckEldilReport = {
          eldilId: eldil.id,
          fieldName: eldil.fieldName,
          taskId: eldil.currentTaskId,
          stuckSinceMs: runningDurationMs,
          status: 'detected',
        };

        eventBus.emit('witness:alert', {
          type: 'stuck_eldil',
          severity: 'warning',
          message: `Eldil ${eldil.id} stuck for ${Math.round(runningDurationMs / 60000)} minutes`,
          targetId: eldil.id,
        });

        this.stateManager.updateEldilStatus(eldil.id, 'error', 'Marked stuck by Witness');
        report.status = 'marked_error';

        actions.push({
          type: 'eldil_marked_error',
          targetId: eldil.id,
          timestamp: new Date().toISOString(),
        });

        if (eldil.currentTaskId) {
          try {
            await this.beadsManager.updateTask(eldil.currentTaskId, { status: 'blocked' });
            report.status = 'task_blocked';

            actions.push({
              type: 'task_marked_blocked',
              targetId: eldil.currentTaskId,
              timestamp: new Date().toISOString(),
            });

            eventBus.emit('task:statusChanged', {
              taskId: eldil.currentTaskId,
              fieldName: eldil.fieldName,
              to: 'blocked',
              eldilId: eldil.id,
              reason: 'blocked',
            });
          } catch (err) {
            logError('Failed to mark task as blocked', err);
          }
        }

        const field = this.stateManager.getField(eldil.fieldName);
        if (field) {
          field.activeEldila = field.activeEldila.filter((eid) => eid !== eldil.id);
          this.stateManager.setField(eldil.fieldName, field);
        }

        reports.push(report);
      }
    }
  }

  private async inspectHnau(
    reports: UnhealthyHnauReport[],
    actions: WitnessAction[]
  ): Promise<void> {
    const runtimes = this.hnauManager.list();

    for (const runtime of runtimes) {
      if (runtime.status !== 'running') {
        continue;
      }

      const health = runtime.health;
      if (!health) {
        continue;
      }

      if (health.consecutiveFailures >= this.config.maxConsecutiveHealthFailures) {
        const report: UnhealthyHnauReport = {
          hnauId: runtime.config.id,
          consecutiveFailures: health.consecutiveFailures,
          lastError: health.lastError,
          status: 'detected',
        };

        eventBus.emit('witness:alert', {
          type: 'unhealthy_hnau',
          severity: health.consecutiveFailures >= this.config.maxConsecutiveHealthFailures * 2 ? 'critical' : 'warning',
          message: `Hnau ${runtime.config.id} unhealthy: ${health.consecutiveFailures} consecutive failures`,
          targetId: runtime.config.id,
        });

        if (this.config.autoRestartHnau) {
          actions.push({
            type: 'hnau_restart_attempted',
            targetId: runtime.config.id,
            timestamp: new Date().toISOString(),
          });

          try {
            const state = this.stateManager.getState();
            const activeField = state.activeField;
            const fieldState = state.fields[activeField];
            const fieldPath = fieldState?.path;

            if (fieldPath) {
              const restartResult = await this.hnauManager.restart(runtime.config.id, {
                field: fieldPath,
              });

              if (restartResult.success) {
                report.status = 'restarted';
                actions.push({
                  type: 'hnau_restart_succeeded',
                  targetId: runtime.config.id,
                  timestamp: new Date().toISOString(),
                });
                logInfo('Witness restarted unhealthy Hnau', { hnauId: runtime.config.id });
              } else {
                report.status = 'restart_failed';
                actions.push({
                  type: 'hnau_restart_failed',
                  targetId: runtime.config.id,
                  timestamp: new Date().toISOString(),
                  error: restartResult.error,
                });
                logError('Witness failed to restart Hnau', new Error(restartResult.error));
              }
            } else {
              report.status = 'restart_failed';
              actions.push({
                type: 'hnau_restart_failed',
                targetId: runtime.config.id,
                timestamp: new Date().toISOString(),
                error: 'No active field path available',
              });
            }
          } catch (err) {
            report.status = 'restart_failed';
            actions.push({
              type: 'hnau_restart_failed',
              targetId: runtime.config.id,
              timestamp: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
            });
            logError('Witness failed to restart Hnau', err);
          }
        }

        reports.push(report);
      }
    }
  }

  updateConfig(config: Partial<WitnessConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }
  }

  getConfig(): Required<WitnessConfig> {
    return { ...this.config };
  }

  dispose(): void {
    this.stop();
  }
}
