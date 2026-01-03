import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { HnauManager } from '../../domain/hnau';
import { getRepoRoot } from '../../domain/git';

export function createHnauCommand(): Command {
  const hnauCmd = new Command('hnau').description('Manage Hnau (services)');

  hnauCmd
    .command('list')
    .description('List all Hnau')
    .action(async () => {
      const { config } = await loadConfig();
      const manager = new HnauManager(config);
      const hnauList = manager.list();

      if (hnauList.length === 0) {
        console.log('No hnau configured');
        return;
      }

      console.log('Hnau:');
      for (const hnau of hnauList) {
        const desc = hnau.config.description ? ` - ${hnau.config.description}` : '';
        const port = hnau.config.port ? ` [:${hnau.config.port}]` : '';
        console.log(`  ${hnau.config.id}${desc}${port}`);
        console.log(`    Command: ${hnau.config.devCommand}`);
        console.log(`    Root: ${hnau.config.root}`);
      }

      manager.dispose();
    });

  hnauCmd
    .command('status')
    .description('Show Hnau status')
    .option('--field <name>', 'Field context')
    .action(async (options: { field?: string }) => {
      const { config } = await loadConfig();
      const manager = new HnauManager(config);
      const hnauList = manager.list();

      if (hnauList.length === 0) {
        console.log('No hnau configured');
        return;
      }

      const fieldInfo = options.field ? ` (field: ${options.field})` : '';
      console.log(`Hnau Status${fieldInfo}:`);
      for (const hnau of hnauList) {
        const statusIcon = getStatusIcon(hnau.status);
        const health = hnau.health?.healthy ? '✓' : hnau.health?.healthy === false ? '✗' : '-';
        console.log(`  ${statusIcon} ${hnau.config.id} [${hnau.status}] health: ${health}`);
      }

      manager.dispose();
    });

  hnauCmd
    .command('start <hnauId>')
    .description('Start a Hnau')
    .option('--field <name>', 'Field context')
    .action(async (hnauId: string, options: { field?: string }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldPath = options.field
        ? `${repoRootResult.data}/fields/${options.field}`
        : repoRootResult.data;

      const manager = new HnauManager(config);
      const result = await manager.start(hnauId, { field: fieldPath });

      if (!result.success) {
        console.error('Error:', result.error);
        manager.dispose();
        process.exit(1);
      }

      console.log(`✓ Started hnau: ${hnauId}`);
      manager.dispose();
    });

  hnauCmd
    .command('stop <hnauId>')
    .description('Stop a Hnau')
    .option('--field <name>', 'Field context')
    .option('--force', 'Force stop')
    .action(async (hnauId: string, options: { field?: string; force?: boolean }) => {
      const { config } = await loadConfig();
      const manager = new HnauManager(config);
      const result = await manager.stop(hnauId, { force: options.force });

      if (!result.success) {
        console.error('Error:', result.error);
        manager.dispose();
        process.exit(1);
      }

      console.log(`✓ Stopped hnau: ${hnauId}`);
      manager.dispose();
    });

  return hnauCmd;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'running':
      return '●';
    case 'starting':
      return '◐';
    case 'stopping':
      return '◑';
    case 'stopped':
      return '○';
    case 'error':
      return '✗';
    default:
      return '?';
  }
}
