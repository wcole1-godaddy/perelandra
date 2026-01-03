import type { PerelandraConfig } from '../types/config';
import type { FieldState } from '../types/runtime';
import * as git from './git';

export interface FieldInfo {
  name: string;
  path: string;
  branch: string;
  baseBranch?: string;
  exists: boolean;
  hasUncommittedChanges?: boolean;
}

export interface FieldCreateOptions {
  baseBranch?: string;
  path?: string;
}

export interface FieldDeleteOptions {
  force?: boolean;
}

export interface FieldResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const DEFAULT_FIELDS_DIR = 'fields';

export class FieldManager {
  private config: PerelandraConfig;
  private repoRoot: string;
  private fieldsDir: string;

  constructor(config: PerelandraConfig, repoRoot: string) {
    this.config = config;
    this.repoRoot = repoRoot;
    this.fieldsDir = `${repoRoot}/${DEFAULT_FIELDS_DIR}`;
  }

  async list(): Promise<FieldResult<FieldInfo[]>> {
    const worktreeResult = await git.listWorktrees(this.repoRoot);
    if (!worktreeResult.success || !worktreeResult.data) {
      return { success: false, error: worktreeResult.error };
    }

    const configuredFields = new Map(
      (this.config.fields ?? []).map((f) => [f.name, f])
    );

    const fields: FieldInfo[] = [];

    const mainWorktree = worktreeResult.data.find((w) => w.isMain);
    if (mainWorktree) {
      fields.push({
        name: 'main',
        path: mainWorktree.path,
        branch: mainWorktree.branch,
        exists: true,
      });
    }

    for (const wt of worktreeResult.data) {
      if (wt.isMain) continue;

      const fieldName = this.extractFieldName(wt.path);
      const configField = configuredFields.get(fieldName);

      fields.push({
        name: fieldName,
        path: wt.path,
        branch: wt.branch,
        baseBranch: configField?.baseBranch,
        exists: true,
      });
    }

    for (const [name, fieldConfig] of configuredFields) {
      if (!fields.find((f) => f.name === name)) {
        fields.push({
          name,
          path: fieldConfig.path ?? `${this.fieldsDir}/${name}`,
          branch: fieldConfig.branch ?? name,
          baseBranch: fieldConfig.baseBranch,
          exists: false,
        });
      }
    }

    return { success: true, data: fields };
  }

  async get(name: string): Promise<FieldResult<FieldInfo>> {
    const listResult = await this.list();
    if (!listResult.success || !listResult.data) {
      return { success: false, error: listResult.error };
    }

    const field = listResult.data.find((f) => f.name === name);
    if (!field) {
      return { success: false, error: `Field not found: ${name}` };
    }

    if (field.exists) {
      field.hasUncommittedChanges = await git.hasUncommittedChanges(field.path);
    }

    return { success: true, data: field };
  }

  async create(name: string, options: FieldCreateOptions = {}): Promise<FieldResult<FieldInfo>> {
    const existingResult = await this.get(name);
    if (existingResult.success && existingResult.data?.exists) {
      return { success: false, error: `Field already exists: ${name}` };
    }

    const path = options.path ?? `${this.fieldsDir}/${name}`;
    const baseBranch = options.baseBranch ?? 'main';

    const branchName = name;
    const branchExistsLocal = await git.branchExists(branchName, this.repoRoot);
    const branchExistsRemote = await git.remoteBranchExists(branchName, this.repoRoot);

    let worktreeResult: git.GitResult<git.WorktreeInfo>;

    if (branchExistsLocal || branchExistsRemote) {
      worktreeResult = await git.createWorktree(
        path,
        branchName,
        { newBranch: false },
        this.repoRoot
      );
    } else {
      worktreeResult = await git.createWorktree(
        path,
        branchName,
        { newBranch: true, baseBranch },
        this.repoRoot
      );
    }

    if (!worktreeResult.success || !worktreeResult.data) {
      return { success: false, error: worktreeResult.error };
    }

    const fieldInfo: FieldInfo = {
      name,
      path: worktreeResult.data.path,
      branch: worktreeResult.data.branch,
      baseBranch,
      exists: true,
    };

    return { success: true, data: fieldInfo };
  }

  async delete(name: string, options: FieldDeleteOptions = {}): Promise<FieldResult> {
    if (name === 'main') {
      return { success: false, error: 'Cannot delete main field' };
    }

    const fieldResult = await this.get(name);
    if (!fieldResult.success || !fieldResult.data) {
      return { success: false, error: fieldResult.error ?? `Field not found: ${name}` };
    }

    if (!fieldResult.data.exists) {
      return { success: false, error: `Field does not exist: ${name}` };
    }

    if (!options.force && fieldResult.data.hasUncommittedChanges) {
      return {
        success: false,
        error: `Field has uncommitted changes. Use --force to delete anyway.`,
      };
    }

    const removeResult = await git.removeWorktree(
      fieldResult.data.path,
      { force: options.force },
      this.repoRoot
    );

    if (!removeResult.success) {
      return { success: false, error: removeResult.error };
    }

    return { success: true };
  }

  async switch(name: string): Promise<FieldResult<FieldInfo>> {
    const fieldResult = await this.get(name);
    if (!fieldResult.success || !fieldResult.data) {
      return { success: false, error: fieldResult.error ?? `Field not found: ${name}` };
    }

    if (!fieldResult.data.exists) {
      return { success: false, error: `Field does not exist: ${name}` };
    }

    return { success: true, data: fieldResult.data };
  }

  toFieldState(info: FieldInfo): FieldState {
    return {
      name: info.name,
      path: info.path,
      branch: info.branch,
      baseBranch: info.baseBranch,
      hnauStatuses: {},
      activeEldila: [],
    };
  }

  private extractFieldName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }
}
