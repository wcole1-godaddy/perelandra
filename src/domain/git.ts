import { $ } from 'bun';

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isBare: boolean;
  isMain: boolean;
}

export interface GitResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getRepoRoot(cwd: string = process.cwd()): Promise<GitResult<string>> {
  try {
    const result = await $`git rev-parse --show-toplevel`.cwd(cwd).text();
    return { success: true, data: result.trim() };
  } catch (err) {
    return { success: false, error: `Not a git repository: ${cwd}` };
  }
}

export async function getCurrentBranch(cwd: string = process.cwd()): Promise<GitResult<string>> {
  try {
    const result = await $`git rev-parse --abbrev-ref HEAD`.cwd(cwd).text();
    return { success: true, data: result.trim() };
  } catch (err) {
    return { success: false, error: 'Failed to get current branch' };
  }
}

export async function getCurrentCommit(cwd: string = process.cwd()): Promise<GitResult<string>> {
  try {
    const result = await $`git rev-parse HEAD`.cwd(cwd).text();
    return { success: true, data: result.trim() };
  } catch (err) {
    return { success: false, error: 'Failed to get current commit' };
  }
}

export async function listWorktrees(cwd: string = process.cwd()): Promise<GitResult<WorktreeInfo[]>> {
  try {
    const result = await $`git worktree list --porcelain`.cwd(cwd).text();
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of result.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.slice(9), isBare: false, isMain: false };
      } else if (line.startsWith('HEAD ')) {
        current.commit = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.isBare = true;
      } else if (line === '') {
        if (current.path) {
          if (!current.branch) {
            current.branch = 'HEAD';
          }
          worktrees.push(current as WorktreeInfo);
          current = {};
        }
      }
    }

    if (worktrees.length > 0) {
      worktrees[0].isMain = true;
    }

    return { success: true, data: worktrees };
  } catch (err) {
    return { success: false, error: 'Failed to list worktrees' };
  }
}

export async function createWorktree(
  path: string,
  branch: string,
  options: { baseBranch?: string; newBranch?: boolean } = {},
  cwd: string = process.cwd()
): Promise<GitResult<WorktreeInfo>> {
  try {
    const args: string[] = ['git', 'worktree', 'add'];

    if (options.newBranch) {
      args.push('-b', branch);
      if (options.baseBranch) {
        args.push(path, options.baseBranch);
      } else {
        args.push(path);
      }
    } else {
      args.push(path, branch);
    }

    await $`${args}`.cwd(cwd);

    const branchResult = await getCurrentBranch(path);
    const commitResult = await getCurrentCommit(path);

    return {
      success: true,
      data: {
        path,
        branch: branchResult.data ?? branch,
        commit: commitResult.data ?? '',
        isBare: false,
        isMain: false,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create worktree: ${message}` };
  }
}

export async function removeWorktree(
  path: string,
  options: { force?: boolean } = {},
  cwd: string = process.cwd()
): Promise<GitResult<void>> {
  try {
    const args = ['git', 'worktree', 'remove'];
    if (options.force) {
      args.push('--force');
    }
    args.push(path);

    await $`${args}`.cwd(cwd);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to remove worktree: ${message}` };
  }
}

export async function pruneWorktrees(cwd: string = process.cwd()): Promise<GitResult<void>> {
  try {
    await $`git worktree prune`.cwd(cwd);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to prune worktrees' };
  }
}

export async function branchExists(branch: string, cwd: string = process.cwd()): Promise<boolean> {
  try {
    await $`git rev-parse --verify refs/heads/${branch}`.cwd(cwd).quiet();
    return true;
  } catch {
    return false;
  }
}

export async function remoteBranchExists(branch: string, cwd: string = process.cwd()): Promise<boolean> {
  try {
    await $`git rev-parse --verify refs/remotes/origin/${branch}`.cwd(cwd).quiet();
    return true;
  } catch {
    return false;
  }
}

export async function hasUncommittedChanges(cwd: string = process.cwd()): Promise<boolean> {
  try {
    const result = await $`git status --porcelain`.cwd(cwd).text();
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
