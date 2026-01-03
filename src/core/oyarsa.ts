import type { PerelandraConfig } from '../types/config';
import type { FieldState, EldilState, OyarsaState } from '../types/runtime';
import type { EldilSpawnOptions, EldilRuntime } from '../types/eldil';
import { StateManager } from './state';
import { FieldManager, type FieldInfo } from '../domain/field';
import { HnauManager } from '../domain/hnau';
import { EldilManager } from '../domain/eldil';
import { BeadsManager } from '../domain/beads';
import { SornReviewer } from '../domain/sorn';
import { TmuxManager } from '../domain/tmux';
import { Maleldil } from '../domain/maleldil';
import { Witness } from '../domain/witness';
import { getHeadCommit } from '../domain/git';
import { logInfo, logWarn, logError } from '../logging/pino';
import type { SornReviewResult } from '../types/sorn';
import { eventBus } from './events';
import { getDeepHeaven } from './deepheaven';
import type { DeepHeavenConfig } from '../types/deepheaven';

export interface OyarsaOptions {
  config: PerelandraConfig;
  repoRoot: string;
  autoPersist?: boolean;
  sornReviewOnComplete?: boolean;
}

export interface OyarsaStartResult {
  success: boolean;
  error?: string;
}

export class Oyarsa {
  private config: PerelandraConfig;
  private repoRoot: string;

  private stateManager: StateManager;
  private fieldManager: FieldManager;
  private hnauManager: HnauManager;
  private eldilManager: EldilManager;
  private beadsManager: BeadsManager;
  private sornReviewer: SornReviewer;
  private tmuxManager: TmuxManager;
  private maleldil: Maleldil;
  private witness: Witness;

  private started = false;
  private sornReviewOnComplete: boolean;
  private globalConfig?: DeepHeavenConfig;

  constructor(options: OyarsaOptions) {
    this.config = options.config;
    this.repoRoot = options.repoRoot;
    this.sornReviewOnComplete = options.sornReviewOnComplete ?? true;

    const stateDir = options.config.repoRoot
      ? `${options.repoRoot}/${options.config.repoRoot}`
      : options.repoRoot;

    this.stateManager = new StateManager(stateDir, {
      autoPersist: options.autoPersist ?? true,
      persistIntervalMs: 5000,
    });

    this.fieldManager = new FieldManager(this.config, this.repoRoot);
    this.hnauManager = new HnauManager(this.config);
    this.eldilManager = new EldilManager();
    this.beadsManager = new BeadsManager(
      options.config.beads?.root ?? `${this.repoRoot}/.beads`,
      this.repoRoot
    );
    this.sornReviewer = new SornReviewer();
    this.tmuxManager = new TmuxManager();
    this.maleldil = new Maleldil(options.config.logs, this.repoRoot);
    this.witness = new Witness({
      stateManager: this.stateManager,
      hnauManager: this.hnauManager,
      beadsManager: this.beadsManager,
    });

    this.hnauManager.setTmuxManager(this.tmuxManager);
    this.eldilManager.setTmuxManager(this.tmuxManager);

    this.eldilManager.setOnWorkerComplete((runtime) => {
      this.handleEldilComplete(runtime);
    });
  }

  async start(): Promise<OyarsaStartResult> {
    if (this.started) {
      return { success: true };
    }

    try {
      logInfo('Oyarsa starting', { repoRoot: this.repoRoot });

      const deepHeaven = getDeepHeaven();
      await deepHeaven.load();
      this.globalConfig = deepHeaven.getConfig();
      this.applyGlobalConfig();

      await this.stateManager.load();

      await this.syncFieldsFromManager();

      await this.recoverOrphanedEldila();

      this.maleldil.startAutoRotation(60000);
      this.witness.start();

      this.started = true;
      logInfo('Oyarsa started successfully');

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError('Oyarsa failed to start', err);
      return { success: false, error: errorMsg };
    }
  }

  private applyGlobalConfig(): void {
    if (!this.globalConfig) return;

    if (this.globalConfig.sorn?.model) {
      this.sornReviewer.setModel(this.globalConfig.sorn.model);
    }
    if (this.globalConfig.sorn?.timeout) {
      this.sornReviewer.setTimeout(this.globalConfig.sorn.timeout);
    }

    if (this.globalConfig.eldil?.maxWorkersPerField) {
      this.eldilManager.setMaxWorkersPerField(this.globalConfig.eldil.maxWorkersPerField);
    }
    if (this.globalConfig.eldil?.maxTotalWorkers) {
      this.eldilManager.setMaxTotalWorkers(this.globalConfig.eldil.maxTotalWorkers);
    }

    if (this.globalConfig.tmux?.sessionName) {
      this.tmuxManager.setSessionName(this.globalConfig.tmux.sessionName);
    }

    if (this.globalConfig.witness) {
      this.witness.updateConfig(this.globalConfig.witness);
    }

    logInfo('Applied global DeepHeaven config', {
      sornModel: this.globalConfig.sorn?.model,
      maxWorkers: this.globalConfig.eldil?.maxTotalWorkers,
    });
  }

  async shutdown(): Promise<void> {
    if (!this.started) {
      return;
    }

    logInfo('Oyarsa shutting down');

    await this.eldilManager.stopAll();
    await this.hnauManager.stopAll();

    await this.stateManager.persist();

    this.stateManager.dispose();
    this.hnauManager.dispose();
    this.eldilManager.dispose();
    this.maleldil.dispose();
    this.witness.dispose();

    this.started = false;
    logInfo('Oyarsa shutdown complete');
  }

  private async syncFieldsFromManager(): Promise<void> {
    const fieldsResult = await this.fieldManager.list();
    if (!fieldsResult.success || !fieldsResult.data) {
      logWarn('Failed to list fields for state sync', { error: fieldsResult.error });
      return;
    }

    const currentState = this.stateManager.getState();
    const existingFieldNames = new Set(Object.keys(currentState.fields));

    for (const fieldInfo of fieldsResult.data) {
      if (!existingFieldNames.has(fieldInfo.name)) {
        this.stateManager.setField(fieldInfo.name, this.fieldManager.toFieldState(fieldInfo));
      } else {
        const existingField = currentState.fields[fieldInfo.name];
        if (existingField) {
          existingField.path = fieldInfo.path;
          existingField.branch = fieldInfo.branch;
          existingField.baseBranch = fieldInfo.baseBranch;
          this.stateManager.setField(fieldInfo.name, existingField);
        }
      }
    }

    const activeFieldNames = new Set(fieldsResult.data.map((f) => f.name));
    for (const existingName of existingFieldNames) {
      if (!activeFieldNames.has(existingName)) {
        this.stateManager.removeField(existingName);
      }
    }
  }

  private async recoverOrphanedEldila(): Promise<void> {
    const eldila = this.stateManager.listEldila();
    for (const eldil of eldila) {
      if (eldil.status === 'running') {
        logWarn('Found orphaned running Eldil, marking as error', { eldilId: eldil.id });
        this.stateManager.updateEldilStatus(eldil.id, 'error', 'Orphaned after restart');

        if (eldil.currentTaskId) {
          await this.beadsManager.updateTask(eldil.currentTaskId, { status: 'todo' });
        }
      }
    }
  }

  private handleEldilComplete(runtime: EldilRuntime): void {
    const { id, state } = runtime;

    this.stateManager.updateEldilStatus(
      id,
      state.status,
      state.lastError
    );

    eventBus.emit('eldil:statusChanged', {
      eldilId: id,
      fieldName: state.fieldName,
      status: state.status,
      taskId: state.currentTaskId,
    });

    const fieldName = state.fieldName;
    const field = this.stateManager.getField(fieldName);
    if (field) {
      field.activeEldila = field.activeEldila.filter((eid) => eid !== id);
      this.stateManager.setField(fieldName, field);
    }

    if (state.currentTaskId && state.status === 'completed') {
      this.completeTaskWithReview(state.currentTaskId, field?.path ?? this.repoRoot).catch((err) => {
        logError('Failed to complete task with review', err);
      });
    } else if (state.currentTaskId) {
      this.beadsManager.updateTask(state.currentTaskId, { status: 'blocked' }).catch((err) => {
        logError('Failed to update task status after Eldil failure', err);
      });
      eventBus.emit('task:statusChanged', {
        taskId: state.currentTaskId,
        fieldName: state.fieldName,
        to: 'blocked',
        eldilId: id,
        reason: 'blocked',
      });
    }

    logInfo('Eldil completed', {
      eldilId: id,
      status: state.status,
      taskId: state.currentTaskId,
    });
  }

  private async completeTaskWithReview(taskId: string, fieldPath: string): Promise<void> {
    const taskResult = await this.beadsManager.getTask(taskId);
    const task = taskResult?.data;
    const fieldName = task?.fieldName ?? '';

    // Record the HEAD commit for this task
    await this.recordTaskCommit(taskId, fieldPath);

    if (!this.sornReviewOnComplete) {
      await this.beadsManager.updateTask(taskId, { status: 'done' });
      eventBus.emit('task:statusChanged', {
        taskId,
        fieldName,
        to: 'done',
        reason: 'completed',
      });
      logInfo('Task completed without Sorn review', { taskId });
      return;
    }

    logInfo('Running Sorn review before task completion', { taskId });

    const reviewResult = await this.runSornReviewForTask(taskId, task?.hnauId, fieldPath);

    if (!reviewResult.success) {
      logWarn('Sorn review failed, completing task anyway', {
        taskId,
        error: reviewResult.error,
      });
      await this.beadsManager.updateTask(taskId, { status: 'done' });
      return;
    }

    if (this.sornReviewer.hasBlockingIssues(reviewResult)) {
      logWarn('Sorn found critical issues, blocking task completion', {
        taskId,
        issueCount: reviewResult.issues.length,
        criticalIssues: reviewResult.issues.filter((i) => i.severity === 'critical'),
      });
      await this.beadsManager.updateTask(taskId, {
        status: 'blocked',
        labels: ['sorn-blocked'],
      });
      eventBus.emit('task:statusChanged', {
        taskId,
        fieldName,
        to: 'blocked',
        reason: 'blocked',
      });
      return;
    }

    if (reviewResult.issues.length > 0) {
      logInfo('Sorn found non-blocking issues', {
        taskId,
        issueCount: reviewResult.issues.length,
        summary: reviewResult.summary,
      });
    }

    await this.beadsManager.updateTask(taskId, { status: 'done' });
    eventBus.emit('task:statusChanged', {
      taskId,
      fieldName,
      to: 'done',
      reason: 'completed',
    });
    logInfo('Task completed after Sorn review', { taskId, issueCount: reviewResult.issues.length });
  }

  private async runSornReviewForTask(
    taskId: string,
    hnauId: string | undefined,
    fieldPath: string
  ): Promise<SornReviewResult> {
    if (hnauId) {
      const hnauConfig = this.config.hnau.find((h) => h.id === hnauId);
      if (hnauConfig) {
        return this.sornReviewer.reviewMultiHnau(taskId, [hnauConfig], fieldPath);
      }
    }

    if (this.config.hnau.length > 1) {
      logInfo('Running multi-hnau Sorn review', {
        taskId,
        hnauCount: this.config.hnau.length,
      });
      return this.sornReviewer.reviewMultiHnau(taskId, this.config.hnau, fieldPath);
    }

    return this.sornReviewer.reviewTask(taskId, fieldPath);
  }

  async runSornReview(fieldName?: string): Promise<SornReviewResult> {
    const field = fieldName
      ? this.stateManager.getField(fieldName)
      : this.stateManager.getField(this.stateManager.getActiveField());

    const fieldPath = field?.path ?? this.repoRoot;

    return this.sornReviewer.reviewCurrentChanges(fieldPath, { field: field?.name });
  }

  private async recordTaskCommit(taskId: string, fieldPath: string): Promise<void> {
    const commitResult = await getHeadCommit(fieldPath);
    if (!commitResult.success || !commitResult.data) {
      logWarn('Could not get HEAD commit for task', { taskId, error: commitResult.error });
      return;
    }

    const result = await this.beadsManager.addCommitLabels(taskId, [commitResult.data.sha]);
    if (!result.success) {
      logWarn('Failed to add commit label to task', { taskId, error: result.error });
    } else {
      logInfo('Recorded commit for task', { taskId, commit: commitResult.data.shortSha });
    }
  }

  async spawnEldilForTask(
    fieldName: string,
    prompt: string,
    taskId?: string,
    hnauId?: string
  ): Promise<EldilRuntime | null> {
    const field = this.stateManager.getField(fieldName);
    if (!field) {
      logError('Cannot spawn Eldil: field not found', new Error(`Field not found: ${fieldName}`));
      return null;
    }

    const spawnOptions: EldilSpawnOptions = {
      fieldName,
      fieldPath: field.path,
      prompt,
      taskId,
      hnauId,
    };

    const result = await this.eldilManager.spawn(spawnOptions);
    if (!result.success || !result.data) {
      logError('Failed to spawn Eldil', new Error(result.error ?? 'Unknown error'));
      return null;
    }

    const eldilState: EldilState = {
      id: result.data.id,
      fieldName,
      hnauId,
      currentTaskId: taskId,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.stateManager.setEldil(result.data.id, eldilState);

    field.activeEldila = [...field.activeEldila, result.data.id];
    this.stateManager.setField(fieldName, field);

    if (taskId) {
      await this.beadsManager.updateTask(taskId, { status: 'in-progress' });
    }

    eventBus.emit('eldil:statusChanged', {
      eldilId: result.data.id,
      fieldName,
      status: 'running',
      taskId,
    });

    if (taskId) {
      eventBus.emit('task:statusChanged', {
        taskId,
        fieldName,
        to: 'in-progress',
        eldilId: result.data.id,
        reason: 'claimed',
      });
    }

    logInfo('Eldil spawned', {
      eldilId: result.data.id,
      fieldName,
      taskId,
    });

    return result.data;
  }

  getState(): OyarsaState {
    return this.stateManager.getState();
  }

  getActiveField(): string {
    return this.stateManager.getActiveField();
  }

  setActiveField(fieldName: string): void {
    this.stateManager.setActiveField(fieldName);
  }

  async getFields(): Promise<FieldInfo[]> {
    const result = await this.fieldManager.list();
    return result.data ?? [];
  }

  getFieldState(name: string): FieldState | undefined {
    return this.stateManager.getField(name);
  }

  getHnauRuntimes() {
    return this.hnauManager.list();
  }

  getEldila(): EldilState[] {
    return this.stateManager.listEldila();
  }

  getEldilaForField(fieldName: string): EldilState[] {
    return this.stateManager.getEldilaForField(fieldName);
  }

  getConfig(): PerelandraConfig {
    return this.config;
  }

  getRepoRoot(): string {
    return this.repoRoot;
  }

  getFieldManager(): FieldManager {
    return this.fieldManager;
  }

  getHnauManager(): HnauManager {
    return this.hnauManager;
  }

  getEldilManager(): EldilManager {
    return this.eldilManager;
  }

  getBeadsManager(): BeadsManager {
    return this.beadsManager;
  }

  getSornReviewer(): SornReviewer {
    return this.sornReviewer;
  }

  getTmuxManager(): TmuxManager {
    return this.tmuxManager;
  }

  getMaleldil(): Maleldil {
    return this.maleldil;
  }

  getWitness(): Witness {
    return this.witness;
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  isStarted(): boolean {
    return this.started;
  }
}

let globalOyarsa: Oyarsa | undefined;

export function getOyarsa(): Oyarsa | undefined {
  return globalOyarsa;
}

export function setOyarsa(oyarsa: Oyarsa): void {
  globalOyarsa = oyarsa;
}

export async function createAndStartOyarsa(options: OyarsaOptions): Promise<Oyarsa> {
  const oyarsa = new Oyarsa(options);
  const result = await oyarsa.start();

  if (!result.success) {
    throw new Error(`Failed to start Oyarsa: ${result.error}`);
  }

  setOyarsa(oyarsa);
  return oyarsa;
}
