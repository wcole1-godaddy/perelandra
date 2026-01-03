import { $ } from 'bun';
import type { BeadsTaskMetadata, BeadsTaskStatus, BeadsTaskCreator, TaskHistoryEntry, BeadsTaskType, EpicStatus, EpicGraph, EpicGraphLayer, EpicGraphNode } from '../types/beads';
import type { HnauConfig, PerelandraConfig } from '../types/config';
import type { FieldState } from '../types/runtime';
import { FieldManager } from './field';

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

  async addCommitLabels(id: string, commitShas: string[]): Promise<BeadsResult> {
    if (commitShas.length === 0) {
      return { success: true };
    }

    const labels = commitShas.map((sha) => `commit:${sha}`);
    return this.updateTask(id, { labels });
  }

  async addArtifactLabel(id: string, artifactDir: string): Promise<BeadsResult> {
    return this.updateTask(id, { labels: [`artifact:${artifactDir}`] });
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

  async listEpics(): Promise<BeadsResult<BeadsTaskMetadata[]>> {
    try {
      const output = await $`bd list --type epic --json`.cwd(this.cwd).json();
      const epics = this.parseTaskListOutput(output);
      return { success: true, data: epics };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getEpicStatus(): Promise<BeadsResult<EpicStatus[]>> {
    try {
      const output = await $`bd epic status --json`.cwd(this.cwd).json();
      const epicStatuses = this.parseEpicStatusOutput(output);
      return { success: true, data: epicStatuses };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getEpicGraph(epicId: string): Promise<BeadsResult<EpicGraph>> {
    try {
      const output = await $`bd graph ${epicId} --json`.cwd(this.cwd).text();
      const graph = this.parseEpicGraphOutput(output);
      return { success: true, data: graph };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getEpicChildren(epicId: string): Promise<BeadsResult<BeadsTaskMetadata[]>> {
    try {
      const output = await $`bd list --parent ${epicId} --json`.cwd(this.cwd).json();
      const children = this.parseTaskListOutput(output);
      return { success: true, data: children };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private parseEpicStatusOutput(output: unknown): EpicStatus[] {
    if (!Array.isArray(output)) {
      return [];
    }

    return output.map((item) => {
      const obj = item as Record<string, unknown>;
      const epicObj = obj.epic as Record<string, unknown> | undefined;
      
      return {
        epic: epicObj ? this.parseTaskOutput(epicObj) : this.parseTaskOutput(obj),
        totalChildren: typeof obj.total_children === 'number' ? obj.total_children : 0,
        closedChildren: typeof obj.closed_children === 'number' ? obj.closed_children : 0,
        eligibleForClose: obj.eligible_for_close === true,
      };
    });
  }

  private parseEpicGraphOutput(output: string): EpicGraph {
    try {
      const data = JSON.parse(output);
      if (data.layers && Array.isArray(data.layers)) {
        return {
          layers: data.layers.map((layer: Record<string, unknown>) => ({
            depth: typeof layer.depth === 'number' ? layer.depth : 0,
            issues: Array.isArray(layer.issues)
              ? layer.issues.map((issue: Record<string, unknown>) => ({
                  id: String(issue.id ?? ''),
                  title: String(issue.title ?? ''),
                  status: this.normalizeStatus(issue.status),
                }))
              : [],
          })),
          totalIssues: typeof data.total_issues === 'number' ? data.total_issues : 0,
        };
      }
    } catch {
      // Not valid JSON, parse ASCII output
    }

    // Parse ASCII graph output (fallback)
    return this.parseAsciiGraph(output);
  }

  private parseAsciiGraph(output: string): EpicGraph {
    const lines = output.split('\n');
    const issues: EpicGraphNode[] = [];
    let currentLayer = 0;
    const layers: EpicGraphLayer[] = [];

    for (const line of lines) {
      const layerMatch = line.match(/Layer (\d+)/);
      if (layerMatch) {
        currentLayer = parseInt(layerMatch[1], 10);
        if (!layers[currentLayer]) {
          layers[currentLayer] = { depth: currentLayer, issues: [] };
        }
        continue;
      }

      const issueMatch = line.match(/([○●◐✓✗])\s+(.+)/);
      if (issueMatch) {
        const statusChar = issueMatch[1];
        let status: BeadsTaskStatus = 'todo';
        if (statusChar === '✓') status = 'done';
        else if (statusChar === '●' || statusChar === '◐') status = 'in-progress';
        else if (statusChar === '✗') status = 'blocked';

        const title = issueMatch[2].trim();
        const idMatch = lines[lines.indexOf(line) + 1]?.match(/([\w-]+)/);
        const id = idMatch?.[1] ?? '';

        if (id && !layers[currentLayer]) {
          layers[currentLayer] = { depth: currentLayer, issues: [] };
        }

        if (id && layers[currentLayer]) {
          layers[currentLayer].issues.push({ id, title, status });
          issues.push({ id, title, status });
        }
      }
    }

    return {
      layers: layers.filter(Boolean),
      totalIssues: issues.length,
    };
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

  private normalizeType(issueType: unknown): BeadsTaskType | undefined {
    const t = String(issueType ?? '').toLowerCase();
    if (t === 'epic') return 'epic';
    if (t === 'bug') return 'bug';
    if (t === 'task') return 'task';
    return undefined;
  }

  private parseTaskOutput(output: unknown): BeadsTaskMetadata {
    const obj = output as Record<string, unknown>;
    const rawLabels = Array.isArray(obj.labels) ? obj.labels.map(String) : [];

    // Extract fieldName, hnauId, commits, and artifactDir from labels
    const { fieldName, hnauId, commits, artifactDir, labels } = this.extractMetadataFromLabels(rawLabels);

    // Merge commits from labels with any existing relatedCommits
    const existingCommits = Array.isArray(obj.relatedCommits)
      ? obj.relatedCommits.map(String)
      : [];
    const allCommits = [...new Set([...commits, ...existingCommits])];

    return {
      id: String(obj.id ?? ''),
      title: String(obj.title ?? ''),
      description: obj.description ? String(obj.description) : undefined,
      fieldName: fieldName ?? String(obj.fieldName ?? 'main'),
      hnauIds: allHnauIds.length > 0 ? allHnauIds : undefined,
      createdBy: (obj.createdBy as BeadsTaskCreator) ?? 'human',
      createdAt: String(obj.createdAt ?? obj.created_at ?? new Date().toISOString()),
      status: this.normalizeStatus(obj.status),
      labels: labels.length > 0 ? labels : undefined,
      relatedCommits: allCommits.length > 0 ? allCommits : undefined,
      artifactDir: artifactDir ?? (obj.artifactDir ? String(obj.artifactDir) : undefined),
      type: this.normalizeType(obj.issue_type ?? obj.type),
      priority: typeof obj.priority === 'number' ? obj.priority : undefined,
    };
  }

  private extractMetadataFromLabels(labels: string[]): {
    fieldName: string | undefined;
    hnauId: string | undefined;
    commits: string[];
    artifactDir: string | undefined;
    labels: string[];
  } {
    let fieldName: string | undefined;
    let hnauId: string | undefined;
    let artifactDir: string | undefined;
    const commits: string[] = [];
    const remainingLabels: string[] = [];

    for (const label of labels) {
      if (label.startsWith('field:')) {
        fieldName = label.slice(6);
      } else if (label.startsWith('hnau:')) {
        hnauId = label.slice(5);
      } else if (label.startsWith('commit:')) {
        commits.push(label.slice(7));
      } else if (label.startsWith('artifact:')) {
        artifactDir = label.slice(9);
      } else {
        remainingLabels.push(label);
      }
    }

    return { fieldName, hnauId, commits, artifactDir, labels: remainingLabels };
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
