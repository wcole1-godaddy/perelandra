import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { PerelandraConfig, RepoConfig, HnauConfig } from '../types/config';
import * as git from './git';
import { detectService, detectPackageManagerAsync } from './service-detector';
import path from 'path';

export interface RepoInfo {
  id: string;
  url: string;
  path: string;
  defaultBranch?: string;
  exists: boolean;
  currentBranch?: string;
  hnau?: HnauConfig;
}

export interface RepoAddOptions {
  id?: string;
  branch?: string;
  path?: string;
  skipHnau?: boolean;
  skipInstall?: boolean;
}

export interface RepoResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const DEFAULT_REPOS_DIR = 'repos';

export class RepoManager {
  private config: PerelandraConfig;
  private configPath: string;
  private repoRoot: string;
  private reposDir: string;

  constructor(config: PerelandraConfig, configPath: string, repoRoot: string) {
    this.config = config;
    this.configPath = configPath;
    this.repoRoot = repoRoot;
    this.reposDir = `${repoRoot}/${DEFAULT_REPOS_DIR}`;
  }

  async list(): Promise<RepoResult<RepoInfo[]>> {
    const repos: RepoInfo[] = [];

    for (const repoConfig of this.config.repos ?? []) {
      const repoPath = this.resolvePath(repoConfig.path);
      const exists = await git.isGitRepo(repoPath);

      let currentBranch: string | undefined;
      if (exists) {
        const branchResult = await git.getCurrentBranch(repoPath);
        currentBranch = branchResult.data;
      }

      repos.push({
        id: repoConfig.id,
        url: repoConfig.url,
        path: repoPath,
        defaultBranch: repoConfig.defaultBranch,
        exists,
        currentBranch,
      });
    }

    return { success: true, data: repos };
  }

  async get(id: string): Promise<RepoResult<RepoInfo>> {
    const listResult = await this.list();
    if (!listResult.success || !listResult.data) {
      return { success: false, error: listResult.error };
    }

    const repo = listResult.data.find((r) => r.id === id);
    if (!repo) {
      return { success: false, error: `Repository not found: ${id}` };
    }

    return { success: true, data: repo };
  }

  async add(url: string, options: RepoAddOptions = {}): Promise<RepoResult<RepoInfo>> {
    const id = options.id ?? this.extractRepoId(url);

    const existingResult = await this.get(id);
    if (existingResult.success) {
      return { success: false, error: `Repository already exists: ${id}` };
    }

    const repoPath = options.path ?? `${this.reposDir}/${id}`;
    const absolutePath = this.resolvePath(repoPath);

    const isExistingRepo = await git.isGitRepo(absolutePath);

    let branch: string;

    if (isExistingRepo) {
      const remoteResult = await git.getRemoteUrl(absolutePath);
      if (!remoteResult.success) {
        return { success: false, error: `Directory exists but is not a valid git repo with remote: ${absolutePath}` };
      }

      const branchResult = await git.getCurrentBranch(absolutePath);
      branch = branchResult.data ?? options.branch ?? 'main';
    } else {
      const cloneResult = await git.cloneRepo(url, absolutePath, { branch: options.branch });
      if (!cloneResult.success || !cloneResult.data) {
        return { success: false, error: cloneResult.error };
      }
      branch = cloneResult.data.branch;
    }

    if (!options.skipInstall) {
      const { $ } = await import('bun');

      const packageJsonPath = path.join(absolutePath, 'package.json');
      const goModPath = path.join(absolutePath, 'go.mod');

      if (await Bun.file(packageJsonPath).exists()) {
        const packageManager = await detectPackageManagerAsync(absolutePath);
        try {
          await $`${packageManager} install`.cwd(absolutePath).quiet();
        } catch (err) {
          console.warn(`Warning: Failed to run ${packageManager} install`);
        }
      } else if (await Bun.file(goModPath).exists()) {
        try {
          await $`go mod download`.cwd(absolutePath).quiet();
        } catch (err) {
          console.warn(`Warning: Failed to run go mod download`);
        }
      }
    }

    const relativePath = path.isAbsolute(repoPath)
      ? path.relative(this.repoRoot, repoPath)
      : repoPath;

    const newRepoConfig: RepoConfig = {
      id,
      url,
      path: relativePath,
      defaultBranch: options.branch ?? branch,
    };

    let detectedHnau: HnauConfig | undefined;

    if (!options.skipHnau) {
      const detected = await detectService(absolutePath, id, relativePath);
      if (detected) {
        detectedHnau = detected.hnau;
      }
    }

    const updateResult = await this.updateConfig((config) => {
      config.repos = config.repos ?? [];
      config.repos.push(newRepoConfig);

      if (detectedHnau) {
        const existingHnau = config.hnau.find((h) => h.id === id);
        if (!existingHnau) {
          config.hnau.push(detectedHnau);
        }
      }

      return config;
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return {
      success: true,
      data: {
        id,
        url,
        path: absolutePath,
        defaultBranch: newRepoConfig.defaultBranch,
        exists: true,
        currentBranch: branch,
        hnau: detectedHnau,
      },
    };
  }

  async remove(id: string, options: { deleteFiles?: boolean } = {}): Promise<RepoResult> {
    const repoResult = await this.get(id);
    if (!repoResult.success || !repoResult.data) {
      return { success: false, error: repoResult.error ?? `Repository not found: ${id}` };
    }

    if (options.deleteFiles && repoResult.data.exists) {
      const { $ } = await import('bun');
      try {
        await $`rm -rf ${repoResult.data.path}`;
      } catch (err) {
        return { success: false, error: `Failed to delete repository files: ${err}` };
      }
    }

    const updateResult = await this.updateConfig((config) => {
      config.repos = (config.repos ?? []).filter((r) => r.id !== id);
      return config;
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true };
  }

  private extractRepoId(url: string): string {
    let cleaned = url.replace(/\.git$/, '');
    cleaned = cleaned.replace(/^(https?:\/\/|git@)/, '');
    cleaned = cleaned.replace(/:/g, '/');

    const parts = cleaned.split('/');
    return parts[parts.length - 1] || 'repo';
  }

  private resolvePath(repoPath: string): string {
    if (path.isAbsolute(repoPath)) {
      return repoPath;
    }
    return path.join(this.repoRoot, repoPath);
  }

  private async updateConfig(
    updater: (config: PerelandraConfig) => PerelandraConfig
  ): Promise<RepoResult> {
    try {
      const file = Bun.file(this.configPath);
      const content = await file.text();
      const parsed = parseYaml(content) as PerelandraConfig;

      const updated = updater(parsed);

      const newContent = stringifyYaml(updated, { indent: 2 });
      await Bun.write(this.configPath, newContent);

      this.config = updated;

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to update config: ${message}` };
    }
  }
}
