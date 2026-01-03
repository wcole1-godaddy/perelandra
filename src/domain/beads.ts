import { $ } from 'bun';
import type { BeadsTaskMetadata, BeadsTaskStatus, BeadsTaskCreator, TaskHistoryEntry } from '../types/beads';

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
  hnauId?: string;
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

      if (options.labels && options.labels.length > 0) {
        for (const label of options.labels) {
          args.push('--label', label);
        }
      }

      args.push(options.title);

      if (options.description) {
        args.push('--body', options.description);
      }

      const output = await $`${args}`.cwd(this.cwd).text();
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

      await $`${args}`.cwd(this.cwd);
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
      await $`bd close ${id}`.cwd(this.cwd);
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
      await $`bd sync`.cwd(this.cwd);
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

  private parseTaskOutput(output: unknown): BeadsTaskMetadata {
    const obj = output as Record<string, unknown>;
    return {
      id: String(obj.id ?? ''),
      title: String(obj.title ?? ''),
      description: obj.description ? String(obj.description) : undefined,
      fieldName: String(obj.fieldName ?? 'main'),
      hnauId: obj.hnauId ? String(obj.hnauId) : undefined,
      createdBy: (obj.createdBy as BeadsTaskCreator) ?? 'human',
      createdAt: String(obj.createdAt ?? new Date().toISOString()),
      status: (obj.status as BeadsTaskStatus) ?? 'todo',
      labels: Array.isArray(obj.labels) ? obj.labels.map(String) : undefined,
      relatedCommits: Array.isArray(obj.relatedCommits)
        ? obj.relatedCommits.map(String)
        : undefined,
    };
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
}
