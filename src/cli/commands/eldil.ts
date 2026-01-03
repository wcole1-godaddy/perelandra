import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { getRepoRoot } from '../../domain/git';
import { EldilManager } from '../../domain/eldil';
import { BeadsManager } from '../../domain/beads';

let eldilManager: EldilManager | undefined;

function getEldilManager(): EldilManager {
  if (!eldilManager) {
    eldilManager = new EldilManager();
  }
  return eldilManager;
}

export function createEldilCommand(): Command {
  const eldilCmd = new Command('eldil').description('Manage Eldila (AI workers)');

  eldilCmd
    .command('list')
    .description('List all Eldila')
    .action(async () => {
      const manager = getEldilManager();
      const eldila = manager.list();

      if (eldila.length === 0) {
        console.log('No active eldila');
        return;
      }

      console.log('Eldila:');
      for (const eldil of eldila) {
        const statusIcon = getStatusIcon(eldil.state.status);
        const task = eldil.state.currentTaskId ? ` [${eldil.state.currentTaskId}]` : '';
        console.log(`  ${statusIcon} ${eldil.id} (${eldil.state.fieldName})${task}`);
        console.log(`    Status: ${eldil.state.status}`);
        if (eldil.state.lastError) {
          console.log(`    Error: ${eldil.state.lastError}`);
        }
      }
    });

  eldilCmd
    .command('start')
    .description('Start an Eldil')
    .option('--field <name>', 'Field context', 'main')
    .option('--hnau <id>', 'Associated Hnau')
    .option('--task <id>', 'Task to work on')
    .option('--prompt <text>', 'Prompt for the Eldil')
    .action(async (options: { field: string; hnau?: string; task?: string; prompt?: string }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldPath = options.field === 'main'
        ? repoRootResult.data
        : `${repoRootResult.data}/fields/${options.field}`;

      let prompt = options.prompt;

      if (!prompt && options.task) {
        const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
        const beads = new BeadsManager(beadsRoot, repoRootResult.data);
        const taskResult = await beads.getTask(options.task);

        if (taskResult.success && taskResult.data) {
          prompt = `Work on task: ${taskResult.data.title}\n\n${taskResult.data.description ?? ''}`;
        }
      }

      if (!prompt) {
        console.error('Error: Must provide --prompt or --task');
        process.exit(1);
      }

      const manager = getEldilManager();
      const result = await manager.spawn({
        fieldName: options.field,
        fieldPath,
        hnauId: options.hnau,
        taskId: options.task,
        prompt,
      });

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Started eldil: ${result.data?.id}`);
      console.log(`  Field: ${options.field}`);
      if (options.hnau) console.log(`  Hnau: ${options.hnau}`);
      if (options.task) console.log(`  Task: ${options.task}`);
    });

  eldilCmd
    .command('stop <eldilId>')
    .description('Stop an Eldil')
    .action(async (eldilId: string) => {
      const manager = getEldilManager();
      const result = await manager.stop(eldilId);

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Stopped eldil: ${eldilId}`);
    });

  eldilCmd
    .command('assign <eldilId> <taskId>')
    .description('Assign a task to an Eldil')
    .action(async (eldilId: string, taskId: string) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const taskResult = await beads.getTask(taskId);
      if (!taskResult.success || !taskResult.data) {
        console.error('Error:', taskResult.error ?? 'Task not found');
        process.exit(1);
      }

      const task = taskResult.data;
      const manager = getEldilManager();
      const eldil = manager.get(eldilId);

      if (!eldil) {
        console.error(`Error: Eldil not found: ${eldilId}`);
        process.exit(1);
      }

      eldil.state.currentTaskId = taskId;
      eldil.state.updatedAt = new Date().toISOString();

      await beads.updateTask(taskId, { status: 'in-progress' });

      console.log(`✓ Assigned task ${taskId} to eldil ${eldilId}`);
      console.log(`  Task: ${task.title}`);
    });

  eldilCmd
    .command('outputs <eldilId>')
    .description('Show outputs from an Eldil')
    .option('--follow', 'Follow output stream')
    .option('--lines <n>', 'Number of lines to show', '20')
    .action(async (eldilId: string, options: { follow?: boolean; lines: string }) => {
      const manager = getEldilManager();
      const outputs = manager.getOutputs(eldilId);

      if (outputs.length === 0) {
        console.log('No outputs yet');
        return;
      }

      const lines = parseInt(options.lines, 10);
      const displayOutputs = outputs.slice(-lines);

      for (const output of displayOutputs) {
        const prefix = output.type === 'error' ? '[ERR]' : '[OUT]';
        console.log(`${output.timestamp} ${prefix} ${output.content ?? ''}`);
      }
    });

  return eldilCmd;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'running':
      return '●';
    case 'idle':
      return '○';
    case 'completed':
      return '✓';
    case 'blocked':
      return '◐';
    case 'error':
      return '✗';
    default:
      return '?';
  }
}
