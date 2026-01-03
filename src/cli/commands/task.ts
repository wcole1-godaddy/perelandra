import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { BeadsManager } from '../../domain/beads';
import { getRepoRoot } from '../../domain/git';

export function createTaskCommand(): Command {
  const taskCmd = new Command('task').description('Manage tasks (Beads integration)');

  taskCmd
    .command('new')
    .description('Create a new task')
    .option('--field <name>', 'Field context', 'main')
    .option('--hnau <id>', 'Associated Hnau')
    .option('--priority <p>', 'Priority (P1, P2, P3)', 'P2')
    .option('--type <t>', 'Type (task, epic, bug)', 'task')
    .argument('<title>', 'Task title')
    .action(async (title: string, options: { field: string; hnau?: string; priority: string; type: string }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const result = await beads.createTask({
        title,
        fieldName: options.field,
        hnauId: options.hnau,
        createdBy: 'human',
        priority: options.priority as 'P1' | 'P2' | 'P3',
        type: options.type as 'task' | 'epic' | 'bug',
      });

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Created task: ${result.data}`);
    });

  taskCmd
    .command('list')
    .description('List tasks')
    .option('--field <name>', 'Field context')
    .option('--status <status>', 'Filter by status')
    .action(async (options: { field?: string; status?: string }) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const result = await beads.listTasks({
        fieldName: options.field,
        status: options.status as 'todo' | 'in-progress' | 'done' | 'blocked' | undefined,
      });

      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (result.data.length === 0) {
        console.log('No tasks found');
        return;
      }

      console.log('Tasks:');
      for (const task of result.data) {
        const statusIcon = getStatusIcon(task.status);
        console.log(`  ${statusIcon} ${task.id}: ${task.title} [${task.status}]`);
      }
    });

  taskCmd
    .command('show <id>')
    .description('Show task details')
    .action(async (id: string) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const result = await beads.getTask(id);
      if (!result.success || !result.data) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      const task = result.data;
      console.log(`${task.id}: ${task.title}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  Field: ${task.fieldName}`);
      if (task.hnauId) console.log(`  Hnau: ${task.hnauId}`);
      if (task.description) console.log(`  Description: ${task.description}`);
      if (task.labels?.length) console.log(`  Labels: ${task.labels.join(', ')}`);
    });

  taskCmd
    .command('set-status <id> <status>')
    .description('Update task status')
    .action(async (id: string, status: string) => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const result = await beads.updateTask(id, {
        status: status as 'todo' | 'in-progress' | 'done' | 'blocked',
      });

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log(`✓ Updated task ${id} to ${status}`);
    });

  taskCmd
    .command('sync')
    .description('Sync tasks with Beads')
    .action(async () => {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);

      const result = await beads.sync();
      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      console.log('✓ Synced tasks');
    });

  return taskCmd;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'done':
      return '✓';
    case 'in-progress':
      return '●';
    case 'blocked':
      return '✗';
    case 'todo':
    default:
      return '○';
  }
}
