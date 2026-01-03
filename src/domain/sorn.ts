import { $ } from 'bun';

export interface SornConfig {
  model?: string;
  timeout?: number;
}

export interface SornReviewResult {
  success: boolean;
  issues: SornIssue[];
  summary?: string;
  error?: string;
}

export interface SornIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  file?: string;
  line?: number;
}

export interface SornReviewOptions {
  field?: string;
  taskId?: string;
  diff?: string;
  files?: string[];
}

const DEFAULT_MODEL = 'gpt-4.1';

export class SornReviewer {
  private config: SornConfig;

  constructor(config: SornConfig = {}) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      timeout: config.timeout ?? 60000,
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

  async reviewDiff(diff: string, _options: SornReviewOptions = {}): Promise<SornReviewResult> {
    const prompt = this.buildReviewPrompt(diff);

    try {
      const result = await this.runOpenCode(prompt);
      return this.parseReviewResult(result);
    } catch (err) {
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async reviewTask(taskId: string, cwd: string): Promise<SornReviewResult> {
    try {
      const diff = await this.getTaskDiff(cwd);
      return this.reviewDiff(diff, { taskId });
    } catch (err) {
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async reviewCurrentChanges(cwd: string): Promise<SornReviewResult> {
    try {
      const diff = await this.getCurrentDiff(cwd);
      if (!diff.trim()) {
        return {
          success: true,
          issues: [],
          summary: 'No changes to review',
        };
      }
      return this.reviewDiff(diff);
    } catch (err) {
      return {
        success: false,
        issues: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildReviewPrompt(diff: string): string {
    return `You are a code reviewer checking for backwards compatibility issues.

Review the following diff and identify any potential problems:

## Check for:
1. **Breaking API changes** - removed/renamed fields, changed types, removed endpoints
2. **Database migration issues** - schema changes that could break existing data
3. **Event/message schema changes** - changes to message formats
4. **Configuration format changes** - breaking config file changes
5. **Dependency version conflicts** - incompatible version changes
6. **Public contract violations** - changes to documented interfaces

## Diff to review:
\`\`\`diff
${diff}
\`\`\`

## Response format:
Respond in JSON format:
{
  "summary": "Brief summary of the review",
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "category name",
      "description": "description of the issue",
      "file": "optional file path",
      "line": optional line number
    }
  ]
}

If there are no issues, return: {"summary": "No issues found", "issues": []}`;
  }

  private async runOpenCode(prompt: string): Promise<string> {
    const args = [
      'opencode',
      '-q',
      '-f', 'json',
    ];

    if (this.config.model) {
      args.push('-m', this.config.model);
    }

    args.push('-p', prompt);

    const result = await $`${args}`.text();
    return result;
  }

  private parseReviewResult(output: string): SornReviewResult {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: true,
          issues: [],
          summary: output.trim(),
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
      };
    } catch {
      return {
        success: true,
        issues: [],
        summary: output.trim(),
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
    return { ...this.config };
  }

  setModel(model: string): void {
    this.config.model = model;
  }
}
