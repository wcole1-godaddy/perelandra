import { $ } from 'bun';
import type {
  SornConfig,
  SornIssue,
  SornReviewResult,
  SornReviewOptions,
  SornReviewHistoryEntry,
  ReviewChecklistItem,
  ReviewCategory,
} from '../types/sorn';
import { DEFAULT_CHECKLIST, getEnabledChecklist } from '../types/sorn';
import { logInfo, logWarn, logError } from '../logging/pino';

const DEFAULT_MODEL = 'gpt-4.1';
const MAX_HISTORY_ENTRIES = 100;

export class SornReviewer {
  private config: Required<Omit<SornConfig, 'checklist'>> & { checklist: ReviewChecklistItem[] };
  private history: SornReviewHistoryEntry[] = [];
  private historyIdCounter = 0;

  constructor(config: SornConfig = {}) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      timeout: config.timeout ?? 60000,
      checklist: config.checklist ?? [...DEFAULT_CHECKLIST],
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await $`which opencode`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  getChecklist(): ReviewChecklistItem[] {
    return [...this.config.checklist];
  }

  setChecklist(checklist: ReviewChecklistItem[]): void {
    this.config.checklist = [...checklist];
  }

  enableCategory(category: ReviewCategory): void {
    for (const item of this.config.checklist) {
      if (item.category === category) {
        item.enabled = true;
      }
    }
  }

  disableCategory(category: ReviewCategory): void {
    for (const item of this.config.checklist) {
      if (item.category === category) {
        item.enabled = false;
      }
    }
  }

  enableChecklistItem(id: string): void {
    const item = this.config.checklist.find((i) => i.id === id);
    if (item) {
      item.enabled = true;
    }
  }

  disableChecklistItem(id: string): void {
    const item = this.config.checklist.find((i) => i.id === id);
    if (item) {
      item.enabled = false;
    }
  }

  async reviewDiff(diff: string, options: SornReviewOptions = {}): Promise<SornReviewResult> {
    const enabledChecklist = getEnabledChecklist(this.config.checklist);
    const categoriesToCheck = options.checklist ?? [...new Set(enabledChecklist.map((c) => c.category))];
    const prompt = this.buildReviewPrompt(diff, enabledChecklist, categoriesToCheck);

    logInfo('Sorn review starting', {
      categories: categoriesToCheck,
      checklistItems: enabledChecklist.length,
    });

    try {
      const result = await this.runOpenCode(prompt);
      const reviewResult = this.parseReviewResult(result, categoriesToCheck);

      this.addToHistory({
        taskId: options.taskId,
        fieldName: options.field,
        result: reviewResult,
      });

      logInfo('Sorn review complete', {
        issueCount: reviewResult.issues.length,
        criticalCount: reviewResult.issues.filter((i) => i.severity === 'critical').length,
      });

      return reviewResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError('Sorn review failed', err);

      const failResult: SornReviewResult = {
        success: false,
        issues: [],
        error: errorMsg,
        reviewedAt: new Date().toISOString(),
        checklistUsed: categoriesToCheck,
      };

      this.addToHistory({
        taskId: options.taskId,
        fieldName: options.field,
        result: failResult,
      });

      return failResult;
    }
  }

  async reviewTask(taskId: string, cwd: string): Promise<SornReviewResult> {
    try {
      const diff = await this.getTaskDiff(cwd);
      if (!diff.trim()) {
        return {
          success: true,
          issues: [],
          summary: 'No changes to review',
          reviewedAt: new Date().toISOString(),
          checklistUsed: [],
        };
      }
      return this.reviewDiff(diff, { taskId });
    } catch (err) {
      logError('Sorn reviewTask failed', err);
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
        reviewedAt: new Date().toISOString(),
        checklistUsed: [],
      };
    }
  }

  async reviewCurrentChanges(cwd: string, options: SornReviewOptions = {}): Promise<SornReviewResult> {
    try {
      const diff = await this.getCurrentDiff(cwd);
      if (!diff.trim()) {
        return {
          success: true,
          issues: [],
          summary: 'No changes to review',
          reviewedAt: new Date().toISOString(),
          checklistUsed: [],
        };
      }
      return this.reviewDiff(diff, options);
    } catch (err) {
      logError('Sorn reviewCurrentChanges failed', err);
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
        reviewedAt: new Date().toISOString(),
        checklistUsed: [],
      };
    }
  }

  async reviewFiles(files: string[], cwd: string, options: SornReviewOptions = {}): Promise<SornReviewResult> {
    try {
      const diffs: string[] = [];
      for (const file of files) {
        const diff = await $`git diff HEAD -- ${file}`.cwd(cwd).text();
        if (diff.trim()) {
          diffs.push(diff);
        }
      }

      if (diffs.length === 0) {
        return {
          success: true,
          issues: [],
          summary: 'No changes to review in specified files',
          reviewedAt: new Date().toISOString(),
          checklistUsed: [],
        };
      }

      return this.reviewDiff(diffs.join('\n'), { ...options, files });
    } catch (err) {
      logError('Sorn reviewFiles failed', err);
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
        reviewedAt: new Date().toISOString(),
        checklistUsed: [],
      };
    }
  }

  hasCriticalIssues(result: SornReviewResult): boolean {
    return result.issues.some((issue) => issue.severity === 'critical');
  }

  hasBlockingIssues(result: SornReviewResult): boolean {
    return this.hasCriticalIssues(result);
  }

  getHistory(): SornReviewHistoryEntry[] {
    return [...this.history];
  }

  getHistoryForTask(taskId: string): SornReviewHistoryEntry[] {
    return this.history.filter((h) => h.taskId === taskId);
  }

  getHistoryForField(fieldName: string): SornReviewHistoryEntry[] {
    return this.history.filter((h) => h.fieldName === fieldName);
  }

  clearHistory(): void {
    this.history = [];
  }

  private addToHistory(entry: Omit<SornReviewHistoryEntry, 'id' | 'reviewedAt' | 'reviewedBy'>): void {
    this.historyIdCounter++;
    const historyEntry: SornReviewHistoryEntry = {
      id: `sorn-review-${this.historyIdCounter}`,
      ...entry,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'sorn',
    };

    this.history.push(historyEntry);

    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(-MAX_HISTORY_ENTRIES);
    }
  }

  private buildReviewPrompt(
    diff: string,
    checklist: ReviewChecklistItem[],
    categories: ReviewCategory[]
  ): string {
    const checklistText = checklist
      .filter((item) => categories.includes(item.category))
      .map((item) => `- [${item.severity.toUpperCase()}] ${item.description}`)
      .join('\n');

    const categoryDescriptions: Record<ReviewCategory, string> = {
      'breaking-api': 'Breaking API Changes - removed/renamed fields, changed types, removed endpoints',
      'database-migration': 'Database Migration Issues - schema changes that could break existing data',
      'event-schema': 'Event/Message Schema Changes - changes to message or event payload formats',
      'config-format': 'Configuration Format Changes - breaking changes to config file formats',
      'dependency-version': 'Dependency Version Conflicts - incompatible version changes',
      'public-contract': 'Public Contract Violations - changes to documented/exported interfaces',
      'security': 'Security Issues - exposed secrets, auth changes, vulnerabilities',
      'performance': 'Performance Concerns - potential regressions, N+1 queries, blocking calls',
      'other': 'Other Issues - miscellaneous concerns',
    };

    const activeCategories = categories
      .map((cat) => `- **${cat}**: ${categoryDescriptions[cat]}`)
      .join('\n');

    return `You are Sorn, a code reviewer specializing in backwards compatibility and breaking change detection.

## Review Categories
${activeCategories}

## Checklist
${checklistText}

## Diff to Review
\`\`\`diff
${diff}
\`\`\`

## Instructions
1. Analyze the diff against each checklist item
2. Identify any potential issues that could break existing functionality
3. Consider downstream consumers of APIs, events, and configs
4. Be specific about the file and line number when possible
5. Suggest mitigations when appropriate

## Response Format
Respond ONLY with valid JSON (no markdown code blocks):
{
  "summary": "Brief summary of the review findings",
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "${categories[0] ?? 'other'}",
      "description": "Clear description of the issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "How to fix or mitigate (optional)"
    }
  ]
}

If no issues found, return:
{"summary": "No backwards compatibility issues found", "issues": []}`;
  }

  private async runOpenCode(prompt: string): Promise<string> {
    const args = ['opencode', '-q'];

    if (this.config.model) {
      args.push('-m', this.config.model);
    }

    args.push('-p', prompt);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`OpenCode timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });

    try {
      const result = await Promise.race([
        $`${args}`.text(),
        timeoutPromise,
      ]);
      return result;
    } catch (err) {
      throw err;
    }
  }

  private parseReviewResult(output: string, checklistUsed: ReviewCategory[]): SornReviewResult {
    const now = new Date().toISOString();

    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logWarn('Sorn response not JSON, using raw output as summary');
        return {
          success: true,
          issues: [],
          summary: output.trim(),
          reviewedAt: now,
          checklistUsed,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        summary?: string;
        issues?: SornIssue[];
      };

      return {
        success: true,
        issues: parsed.issues ?? [],
        summary: parsed.summary,
        reviewedAt: now,
        checklistUsed,
      };
    } catch (parseErr) {
      logWarn('Failed to parse Sorn JSON response', { error: parseErr });
      return {
        success: true,
        issues: [],
        summary: output.trim(),
        reviewedAt: now,
        checklistUsed,
      };
    }
  }

  private async getCurrentDiff(cwd: string): Promise<string> {
    const staged = await $`git diff --cached`.cwd(cwd).text();
    const unstaged = await $`git diff`.cwd(cwd).text();
    return `${staged}\n${unstaged}`.trim();
  }

  private async getTaskDiff(cwd: string): Promise<string> {
    return this.getCurrentDiff(cwd);
  }

  getConfig(): SornConfig {
    return {
      model: this.config.model,
      timeout: this.config.timeout,
      checklist: [...this.config.checklist],
    };
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }
}

export { DEFAULT_CHECKLIST } from '../types/sorn';
export type { SornConfig, SornIssue, SornReviewResult, SornReviewOptions, ReviewCategory } from '../types/sorn';
