import { $ } from 'bun';
import type { BeadsTaskMetadata, BeadsTaskStatus, BeadsTaskCreator, TaskHistoryEntry } from '../types/beads';
import type { HnauConfig, PerelandraConfig } from '../types/config';
import type { FieldState } from '../types/runtime';
import { FieldManager, type FieldInfo } from './field';

export interface BeadsResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BeadsListOptions {
  fieldName?: string;
  status?: BeadsTaskStatus;
  labels?: string[];
  limit?: number;
}

export interface BeadsCreateOptions {
  title: string;
  description?: string;
  fieldName: string;
  hnauIds?: string[];
  createdBy: BeadsTaskCreator;
  labels?: string[];
  priority?: 'P1' | 'P2' | 'P3';
  type?: 'task' | 'epic' | 'bug';
}

export interface BeadsUpdateOptions {
  status?: BeadsTaskStatus;
  labels?: string[];
  description?: string;
}

export class BeadsManager {
  private beadsRoot: string;
  private cwd: string;

  constructor(beadsRoot: string, cwd: string = process.cwd()) {
    this.beadsRoot = beadsRoot;
    this.cwd = cwd;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await $`which bd`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  async createTask(options: BeadsCreateOptions): Promise<BeadsResult<string>> {
    try {
      const args = ['bd', 'new'];

      if (options.priority) {
        args.push('--priority', options.priority);
      }

      if (options.type) {
        args.push('--type', options.type);
      }

      // Encode fieldName and hnauIds as labels
      args.push('--label', `field:${options.fieldName}`);
      if (options.hnauIds && options.hnauIds.length > 0) {
        for (const hnauId of options.hnauIds) {
          args.push('--label', `hnau:${hnauId}`);
        }
      }

      if (options.labels && options.labels.length > 0) {
        for (const label of options.labels) {
          args.push('--label', label);
        }
      }

      args.push(options.title);

      if (options.description) {
        args.push('--body', options.description);
      }

      const output = await $`${args}`.cwd(this.cwd).quiet().text();
      const match = output.match(/Created:\s*(\S+)/);
      const taskId = match?.[1] ?? output.trim();

      return { success: true, data: taskId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async updateTask(id: string, options: BeadsUpdateOptions): Promise<BeadsResult> {
    try {
      const args = ['bd', 'update', id];

      if (options.status) {
        args.push('--status', options.status);
      }

      if (options.labels && options.labels.length > 0) {
        for (const label of options.labels) {
          args.push('--label', label);
        }
      }

      await $`${args}`.cwd(this.cwd).quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async closeTask(id: string): Promise<BeadsResult> {
    try {
      await $`bd close ${id}`.cwd(this.cwd).quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getTask(id: string): Promise<BeadsResult<BeadsTaskMetadata>> {
    try {
      const output = await $`bd show ${id} --json`.cwd(this.cwd).json();
      const metadata = this.parseTaskOutput(output);
      return { success: true, data: metadata };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listTasks(options: BeadsListOptions = {}): Promise<BeadsResult<BeadsTaskMetadata[]>> {
    try {
      const args = ['bd', 'list', '--json'];

      if (options.status) {
        args.push('--status', options.status);
      }

      if (options.labels && options.labels.length > 0) {
        for (const label of options.labels) {
          args.push('--label', label);
        }
      }

      if (options.limit) {
        args.push('--limit', String(options.limit));
      }

      const output = await $`${args}`.cwd(this.cwd).json();
      const tasks = this.parseTaskListOutput(output, options.fieldName);
      return { success: true, data: tasks };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listReady(): Promise<BeadsResult<BeadsTaskMetadata[]>> {
    try {
      const output = await $`bd ready --json`.cwd(this.cwd).json();
      const tasks = this.parseTaskListOutput(output);
      return { success: true, data: tasks };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sync(): Promise<BeadsResult> {
    try {
      await $`bd sync`.cwd(this.cwd).quiet();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getTaskHistory(id: string): Promise<BeadsResult<TaskHistoryEntry[]>> {
    try {
      const output = await $`bd log ${id} --json`.cwd(this.cwd).json();
      const history = this.parseHistoryOutput(output);
      return { success: true, data: history };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private parseHistoryOutput(output: unknown): TaskHistoryEntry[] {
    if (!Array.isArray(output)) {
      return [];
    }

    return output.map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        timestamp: String(obj.timestamp ?? ''),
        action: String(obj.action ?? ''),
        user: obj.user ? String(obj.user) : undefined,
        details: obj.details as Record<string, unknown> | undefined,
      };
    });
  }

  getFieldBeadsRoot(fieldName: string): string {
    return `${this.beadsRoot}/${fieldName}`;
  }

  private normalizeStatus(status: unknown): BeadsTaskStatus {
    const s = String(status ?? 'todo').toLowerCase();
    if (s === 'open' || s === 'todo') return 'todo';
    if (s === 'in_progress' || s === 'in-progress') return 'in-progress';
    if (s === 'done' || s === 'closed' || s === 'completed') return 'done';
    if (s === 'blocked') return 'blocked';
    return 'todo';
  }

  private parseTaskOutput(output: unknown): BeadsTaskMetadata {
    const obj = output as Record<string, unknown>;
    const rawLabels = Array.isArray(obj.labels) ? obj.labels.map(String) : [];

    // Extract fieldName and hnauIds from labels
    const { fieldName, hnauIds, labels } = this.extractFieldAndHnauFromLabels(rawLabels);

    // Merge with any existing hnauIds from the object
    const existingHnauIds = Array.isArray(obj.hnauIds) ? obj.hnauIds.map(String) : [];
    const allHnauIds = [...new Set([...hnauIds, ...existingHnauIds])];

    return {
      id: String(obj.id ?? ''),
      title: String(obj.title ?? ''),
      description: obj.description ? String(obj.description) : undefined,
      fieldName: fieldName ?? String(obj.fieldName ?? 'main'),
      hnauIds: allHnauIds.length > 0 ? allHnauIds : undefined,
      createdBy: (obj.createdBy as BeadsTaskCreator) ?? 'human',
      createdAt: String(obj.createdAt ?? new Date().toISOString()),
      status: this.normalizeStatus(obj.status),
      labels: labels.length > 0 ? labels : undefined,
      relatedCommits: Array.isArray(obj.relatedCommits)
        ? obj.relatedCommits.map(String)
        : undefined,
    };
  }

  private extractFieldAndHnauFromLabels(labels: string[]): {
    fieldName: string | undefined;
    hnauIds: string[];
    labels: string[];
  } {
    let fieldName: string | undefined;
    const hnauIds: string[] = [];
    const remainingLabels: string[] = [];

    for (const label of labels) {
      if (label.startsWith('field:')) {
        fieldName = label.slice(6);
      } else if (label.startsWith('hnau:')) {
        hnauIds.push(label.slice(5));
      } else {
        remainingLabels.push(label);
      }
    }

    return { fieldName, hnauIds, labels: remainingLabels };
  }

  private parseTaskListOutput(
    output: unknown,
    filterFieldName?: string
  ): BeadsTaskMetadata[] {
    if (!Array.isArray(output)) {
      return [];
    }

    let tasks = output.map((item) => this.parseTaskOutput(item));

    if (filterFieldName) {
      tasks = tasks.filter((t) => t.fieldName === filterFieldName);
    }

    return tasks;
  }

  /**
   * Resolves the FieldState for a task, creating the field if it doesn't exist.
   */
  async resolveFieldForTask(
    task: BeadsTaskMetadata,
    config: PerelandraConfig,
    repoRoot: string
  ): Promise<BeadsResult<FieldState>> {
    const fieldManager = new FieldManager(config, repoRoot);
    const fieldResult = await fieldManager.get(task.fieldName);

    if (fieldResult.success && fieldResult.data) {
      if (!fieldResult.data.exists) {
        const createResult = await fieldManager.create(task.fieldName);
        if (!createResult.success || !createResult.data) {
          return { success: false, error: createResult.error ?? 'Failed to create field' };
        }
        return { success: true, data: fieldManager.toFieldState(createResult.data) };
      }
      return { success: true, data: fieldManager.toFieldState(fieldResult.data) };
    }

    const createResult = await fieldManager.create(task.fieldName);
    if (!createResult.success || !createResult.data) {
      return { success: false, error: createResult.error ?? 'Failed to create field' };
    }
    return { success: true, data: fieldManager.toFieldState(createResult.data) };
  }

  /**
   * Resolves the HnauConfigs for a task.
   * If hnauIds is set, returns those hnau configs.
   * Otherwise, infers from task content or returns empty array.
   */
  resolveHnauForTask(
    task: BeadsTaskMetadata,
    config: PerelandraConfig
  ): HnauConfig[] {
    if (task.hnauIds && task.hnauIds.length > 0) {
      return task.hnauIds
        .map((id) => config.hnau.find((h) => h.id === id))
        .filter((h): h is HnauConfig => h !== undefined);
    }

    const inferred = this.inferHnauFromTask(task, config);
    return inferred ? [inferred] : [];
  }

  /**
   * Attempts to infer which hnau a task should target based on content.
   * Returns undefined if no inference can be made.
   */
  private inferHnauFromTask(
    task: BeadsTaskMetadata,
    config: PerelandraConfig
  ): HnauConfig | undefined {
    const content = `${task.title} ${task.description ?? ''}`.toLowerCase();

    for (const hnau of config.hnau) {
      const hnauId = hnau.id.toLowerCase();
      if (content.includes(hnauId)) {
        return hnau;
      }
    }

    const labels = task.labels ?? [];
    for (const hnau of config.hnau) {
      if (labels.some((l) => l.toLowerCase() === hnau.id.toLowerCase())) {
        return hnau;
      }
    }

    return undefined;
  }
}
