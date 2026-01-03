import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { FieldManager } from '../../domain/field';
import { getRepoRoot } from '../../domain/git';

export function createFieldCommand(): Command {
  const fieldCmd = new Command('field').description('Manage Fields (git worktrees)');

  fieldCmd
    .command('list')
    .description('List all Fields')
    .action(async () => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldManager = new FieldManager(config, repoRootResult.data);
      const result = await fieldManager.list();

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (result.data.length === 0) {
        console.log('No fields found');
        return;
      }

      console.log('Fields:');
      for (const field of result.data) {
        const status = field.exists ? '✓' : '○';
        const base = field.baseBranch ? ` (from ${field.baseBranch})` : '';
        console.log(`  ${status} ${field.name}: ${field.branch}${base}`);
        console.log(`      ${field.path}`);
      }
    });

  fieldCmd
    .command('create <name>')
    .description('Create a new Field')
    .option('--from-branch <branch>', 'Base branch for the worktree')
    .action(async (name: string, options: { fromBranch?: string }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldManager = new FieldManager(config, repoRootResult.data);
      const result = await fieldManager.create(name, { baseBranch: options.fromBranch });

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Created field: ${result.data.name}`);
      console.log(`  Branch: ${result.data.branch}`);
      console.log(`  Path: ${result.data.path}`);
    });

  fieldCmd
    .command('delete <name>')
    .description('Delete a Field')
    .option('--force', 'Force delete even if uncommitted changes')
    .action(async (name: string, options: { force?: boolean }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldManager = new FieldManager(config, repoRootResult.data);
      const result = await fieldManager.delete(name, { force: options.force });

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Deleted field: ${name}`);
    });

  fieldCmd
    .command('switch <name>')
    .description('Switch to a Field')
    .action(async (name: string) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldManager = new FieldManager(config, repoRootResult.data);
      const result = await fieldManager.switch(name);

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Switched to field: ${result.data.name}`);
      console.log(`  Path: ${result.data.path}`);
      console.log(`  Branch: ${result.data.branch}`);
    });

  return fieldCmd;
}
