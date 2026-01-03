import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { RepoManager } from '../../domain/repo';
import { getRepoRoot } from '../../domain/git';

export function createRepoCommand(): Command {
  const repoCmd = new Command('repo').description('Manage git repositories');

  repoCmd
    .command('list')
    .description('List all managed repositories')
    .action(async () => {
      const { config, path: configPath } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const repoManager = new RepoManager(config, configPath, repoRootResult.data);
      const result = await repoManager.list();

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (result.data.length === 0) {
        console.log('No repositories configured');
        console.log('Use `perelandra repo add <url>` to add a repository');
        return;
      }

      console.log('Repositories:');
      for (const repo of result.data) {
        const status = repo.exists ? '✓' : '○';
        const branch = repo.currentBranch ? ` (${repo.currentBranch})` : '';
        console.log(`  ${status} ${repo.id}${branch}`);
        console.log(`      ${repo.url}`);
        console.log(`      ${repo.path}`);
      }
    });

  repoCmd
    .command('add <url>')
    .description('Add a git repository')
    .option('--id <id>', 'Custom identifier for the repository')
    .option('--branch <branch>', 'Branch to checkout')
    .option('--path <path>', 'Custom path for the repository')
    .option('--skip-hnau', 'Skip auto-detecting and adding hnau service config')
    .option('--skip-install', 'Skip running package manager install')
    .action(async (url: string, options: { id?: string; branch?: string; path?: string; skipHnau?: boolean; skipInstall?: boolean }) => {
      const { config, path: configPath } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const repoManager = new RepoManager(config, configPath, repoRootResult.data);
      console.log(`Cloning repository...`);
      const result = await repoManager.add(url, {
        id: options.id,
        branch: options.branch,
        path: options.path,
        skipHnau: options.skipHnau,
        skipInstall: options.skipInstall,
      });

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Added repository: ${result.data.id}`);
      console.log(`  URL: ${result.data.url}`);
      console.log(`  Path: ${result.data.path}`);
      console.log(`  Branch: ${result.data.currentBranch}`);

      if (result.data.hnau) {
        console.log(`✓ Auto-detected hnau service config:`);
        console.log(`  Dev command: ${result.data.hnau.devCommand}`);
        if (result.data.hnau.port) {
          console.log(`  Port: ${result.data.hnau.port}`);
        }
        if (result.data.hnau.description) {
          console.log(`  Description: ${result.data.hnau.description}`);
        }
      } else if (!options.skipHnau) {
        console.log(`  No hnau config detected (add manually if needed)`);
      }
    });

  repoCmd
    .command('remove <id>')
    .description('Remove a repository from configuration')
    .option('--delete', 'Also delete repository files')
    .action(async (id: string, options: { delete?: boolean }) => {
      const { config, path: configPath } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const repoManager = new RepoManager(config, configPath, repoRootResult.data);
      const result = await repoManager.remove(id, { deleteFiles: options.delete });

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Removed repository: ${id}`);
      if (options.delete) {
        console.log('  Repository files deleted');
      }
    });

  return repoCmd;
}
