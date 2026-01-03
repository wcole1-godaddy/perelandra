import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { getRepoRoot } from '../../domain/git';
import { SornReviewer, DEFAULT_CHECKLIST } from '../../domain/sorn';
import type { ReviewCategory, SornIssue } from '../../types/sorn';

const ALL_CATEGORIES: ReviewCategory[] = [
  'breaking-api',
  'database-migration',
  'event-schema',
  'config-format',
  'dependency-version',
  'public-contract',
  'security',
  'performance',
];

export function createSornCommand(): Command {
  const sornCmd = new Command('sorn').description('Manage Sorn (reviewer agent)');

  sornCmd
    .command('review')
    .description('Review current changes for backwards compatibility')
    .option('--field <name>', 'Field context', 'main')
    .option('--task <id>', 'Review specific task')
    .option('--files <paths...>', 'Review specific files')
    .option('--category <categories...>', 'Limit to specific categories')
    .option('--json', 'Output as JSON')
    .action(
      async (options: {
        field: string;
        task?: string;
        files?: string[];
        category?: string[];
        json?: boolean;
      }) => {
        const repoRootResult = await getRepoRoot();
        if (!repoRootResult.success || !repoRootResult.data) {
          console.error('Error:', repoRootResult.error);
          process.exit(1);
        }

        const fieldPath =
          options.field === 'main'
            ? repoRootResult.data
            : `${repoRootResult.data}/fields/${options.field}`;

        const sorn = new SornReviewer();

        const available = await sorn.isAvailable();
        if (!available) {
          console.error('Error: opencode is not installed or not in PATH');
          console.log('Install opencode: https://github.com/sst/opencode');
          process.exit(1);
        }

        if (!options.json) {
          console.log(`Reviewing changes in ${options.field}...`);
        }

        const reviewOptions = {
          field: options.field,
          taskId: options.task,
          checklist: options.category as ReviewCategory[] | undefined,
        };

        let result;
        if (options.task) {
          result = await sorn.reviewTask(options.task, fieldPath);
        } else if (options.files && options.files.length > 0) {
          result = await sorn.reviewFiles(options.files, fieldPath, reviewOptions);
        } else {
          result = await sorn.reviewCurrentChanges(fieldPath, reviewOptions);
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          if (sorn.hasCriticalIssues(result)) {
            process.exit(1);
          }
          return;
        }

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

        const grouped = groupIssuesByCategory(result.issues);
        for (const [category, issues] of Object.entries(grouped)) {
          console.log(`── ${category} ──`);
          for (const issue of issues) {
            const icon = getSeverityIcon(issue.severity);
            const location = issue.file
              ? issue.line
                ? `${issue.file}:${issue.line}`
                : issue.file
              : '';
            console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
            if (location) console.log(`   📍 ${location}`);
            if (issue.suggestion) console.log(`   💡 ${issue.suggestion}`);
          }
          console.log();
        }

        const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
        const warningCount = result.issues.filter((i) => i.severity === 'warning').length;

        console.log('────────────────────────────────');
        console.log(
          `Total: ${criticalCount} critical, ${warningCount} warnings, ${result.issues.length - criticalCount - warningCount} info`
        );

        if (criticalCount > 0) {
          console.log('\n❌ Review failed: Critical issues must be addressed');
          process.exit(1);
        }
      }
    );

  sornCmd
    .command('checklist')
    .description('Show the review checklist')
    .option('--category <category>', 'Filter by category')
    .option('--enabled-only', 'Show only enabled items')
    .action(async (options: { category?: string; enabledOnly?: boolean }) => {
      let items = DEFAULT_CHECKLIST;

      if (options.category) {
        items = items.filter((item) => item.category === options.category);
      }

      if (options.enabledOnly) {
        items = items.filter((item) => item.enabled);
      }

      console.log('Sorn Review Checklist:\n');

      const grouped = new Map<string, typeof items>();
      for (const item of items) {
        const existing = grouped.get(item.category) ?? [];
        existing.push(item);
        grouped.set(item.category, existing);
      }

      for (const [category, categoryItems] of grouped) {
        console.log(`── ${category} ──`);
        for (const item of categoryItems) {
          const status = item.enabled ? '✓' : '○';
          const severityIcon = getSeverityIcon(item.severity);
          console.log(`  ${status} ${severityIcon} ${item.description}`);
          console.log(`     ID: ${item.id}`);
        }
        console.log();
      }

      console.log('\nCategories:', ALL_CATEGORIES.join(', '));
    });

  sornCmd
    .command('config')
    .description('Show/edit Sorn model configuration')
    .option('--model <model>', 'Set the model to use')
    .option('--timeout <ms>', 'Set timeout in milliseconds')
    .action(async (options: { model?: string; timeout?: string }) => {
      await loadConfig();
      const sorn = new SornReviewer();

      if (options.model) {
        sorn.setModel(options.model);
        console.log(`✓ Model set to: ${options.model}`);
      }

      if (options.timeout) {
        const timeout = parseInt(options.timeout, 10);
        if (!isNaN(timeout)) {
          sorn.setTimeout(timeout);
          console.log(`✓ Timeout set to: ${timeout}ms`);
        }
      }

      if (!options.model && !options.timeout) {
        const currentConfig = sorn.getConfig();
        console.log('Sorn Configuration:');
        console.log(`  Model: ${currentConfig.model}`);
        console.log(`  Timeout: ${currentConfig.timeout}ms`);
        console.log(`  Checklist items: ${currentConfig.checklist?.length ?? 0}`);
      }
    });

  sornCmd
    .command('history')
    .description('Show past reviews (in-memory only)')
    .option('--task <id>', 'Filter by task ID')
    .option('--field <name>', 'Filter by field')
    .action(async (options: { task?: string; field?: string }) => {
      const sorn = new SornReviewer();
      let history = sorn.getHistory();

      if (options.task) {
        history = sorn.getHistoryForTask(options.task);
      } else if (options.field) {
        history = sorn.getHistoryForField(options.field);
      }

      if (history.length === 0) {
        console.log('No review history found.');
        console.log('Note: History is only stored in-memory for the current session.');
        console.log('Run `perelandra sorn review` to perform a new review.');
        return;
      }

      console.log(`Found ${history.length} review(s):\n`);

      for (const entry of history) {
        const issueCount = entry.result.issues.length;
        const criticalCount = entry.result.issues.filter((i) => i.severity === 'critical').length;
        const status = criticalCount > 0 ? '❌' : issueCount > 0 ? '⚠️' : '✓';

        console.log(`${status} ${entry.id}`);
        console.log(`   Reviewed: ${entry.reviewedAt}`);
        if (entry.taskId) console.log(`   Task: ${entry.taskId}`);
        if (entry.fieldName) console.log(`   Field: ${entry.fieldName}`);
        console.log(`   Issues: ${issueCount} (${criticalCount} critical)`);
        if (entry.result.summary) console.log(`   Summary: ${entry.result.summary}`);
        console.log();
      }
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

function groupIssuesByCategory(issues: SornIssue[]): Record<string, SornIssue[]> {
  const grouped: Record<string, SornIssue[]> = {};
  for (const issue of issues) {
    const category = issue.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(issue);
  }
  return grouped;
}
