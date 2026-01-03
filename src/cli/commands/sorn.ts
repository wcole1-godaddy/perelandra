import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { getRepoRoot } from '../../domain/git';
import { SornReviewer } from '../../domain/sorn';

export function createSornCommand(): Command {
  const sornCmd = new Command('sorn').description('Manage Sorn (reviewer agent)');

  sornCmd
    .command('review')
    .description('Review current changes for backwards compatibility')
    .option('--field <name>', 'Field context', 'main')
    .option('--task <id>', 'Review specific task')
    .action(async (options: { field: string; task?: string }) => {
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const fieldPath = options.field === 'main'
        ? repoRootResult.data
        : `${repoRootResult.data}/fields/${options.field}`;

      const sorn = new SornReviewer();

      const available = await sorn.isAvailable();
      if (!available) {
        console.error('Error: opencode is not installed or not in PATH');
        console.log('Install opencode: https://github.com/sst/opencode');
        process.exit(1);
      }

      console.log(`Reviewing changes in ${options.field}...`);

      const result = options.task
        ? await sorn.reviewTask(options.task, fieldPath)
        : await sorn.reviewCurrentChanges(fieldPath);

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (result.summary) {
        console.log(`\nSummary: ${result.summary}`);
      }

      if (result.issues.length === 0) {
        console.log('✓ No backwards compatibility issues found');
        return;
      }

      console.log(`\nFound ${result.issues.length} issue(s):\n`);

      for (const issue of result.issues) {
        const icon = getSeverityIcon(issue.severity);
        const location = issue.file
          ? issue.line
            ? `${issue.file}:${issue.line}`
            : issue.file
          : '';
        console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.category}`);
        console.log(`   ${issue.description}`);
        if (location) console.log(`   Location: ${location}`);
        console.log();
      }

      const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
      if (criticalCount > 0) {
        process.exit(1);
      }
    });

  sornCmd
    .command('config')
    .description('Show/edit Sorn model configuration')
    .option('--model <model>', 'Set the model to use')
    .action(async (options: { model?: string }) => {
      await loadConfig();
      const sorn = new SornReviewer();

      if (options.model) {
        sorn.setModel(options.model);
        console.log(`✓ Model set to: ${options.model}`);
        return;
      }

      const currentConfig = sorn.getConfig();
      console.log('Sorn Configuration:');
      console.log(`  Model: ${currentConfig.model}`);
      console.log(`  Timeout: ${currentConfig.timeout}ms`);
    });

  sornCmd
    .command('history')
    .description('Show past reviews')
    .action(async () => {
      console.log('Review history is not yet persisted.');
      console.log('Run `perelandra sorn review` to perform a new review.');
    });

  return sornCmd;
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '⚪';
  }
}
