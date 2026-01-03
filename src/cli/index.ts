#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig, validateConfig, formatConfigError } from '../core/config';
import { createFieldCommand } from './commands/field';
import { createHnauCommand } from './commands/hnau';
import { createTaskCommand } from './commands/task';
import { createEldilCommand } from './commands/eldil';
import { createSornCommand } from './commands/sorn';
import { getRepoRoot } from '../domain/git';
import { startUI } from '../ui';
import { formatError, isPerelandraError } from '../util/errors';

const program = new Command();

program
  .name('perelandra')
  .description('AI Agent Orchestrator for multi-service development')
  .version('0.1.0');

program
  .command('init')
  .description('Generate a .perelandra.yaml configuration file')
  .option('--force', 'Overwrite existing config')
  .action(async (options: { force?: boolean }) => {
    const configPath = '.perelandra.yaml';
    const file = Bun.file(configPath);

    if (await file.exists() && !options.force) {
      console.error(`Config already exists: ${configPath}`);
      console.log('Use --force to overwrite');
      process.exit(1);
    }

    const template = `version: "1"
repoRoot: "."

logs:
  root: "logs"
  maxSizeMb: 50
  maxFiles: 5

beads:
  root: ".beads"

hnau:
  - id: "my-service"
    description: "My service description"
    root: "."
    devCommand: "npm run dev"
    port: 3000
    healthCheck:
      url: "http://localhost:3000/health"
      intervalSeconds: 30
`;

    await Bun.write(configPath, template);
    console.log(`✓ Created ${configPath}`);
    console.log('Edit this file to configure your services (hnau)');
  });

const configCmd = program.command('config').description('Configuration management');

configCmd
  .command('validate')
  .description('Validate the .perelandra.yaml configuration')
  .action(async () => {
    const result = await validateConfig();
    if (result.valid) {
      console.log('✓ Configuration is valid');
    } else if (result.error) {
      console.error(formatConfigError(result.error));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start Oyarsa orchestrator and TUI')
  .action(async () => {
    try {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();

      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error ?? 'Could not determine repo root');
        process.exit(1);
      }

      await startUI({
        config,
        repoRoot: repoRootResult.data,
      });
    } catch (err) {
      if (isPerelandraError(err)) {
        console.error(formatError(err));
      } else if (typeof err === 'object' && err !== null && 'issues' in err) {
        console.error(formatConfigError(err as Parameters<typeof formatConfigError>[0]));
      } else {
        console.error(err instanceof Error ? err.message : err);
      }
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show non-interactive status summary')
  .action(async () => {
    console.log('TODO: Show status');
  });

program.addCommand(createFieldCommand());
program.addCommand(createHnauCommand());
program.addCommand(createTaskCommand());
program.addCommand(createEldilCommand());
program.addCommand(createSornCommand());

const logsCmd = program
  .command('logs')
  .description('Log management');

logsCmd
  .command('tail')
  .description('Tail logs')
  .option('--field <name>', 'Field context')
  .option('--hnau <id>', 'Hnau filter')
  .action(async (_options: { field?: string; hnau?: string }) => {
    console.log('TODO: Tail logs');
  });

const tmuxCmd = program
  .command('tmux')
  .description('Tmux session management');

tmuxCmd
  .command('attach')
  .description('Attach to Perelandra tmux session')
  .action(async () => {
    console.log('TODO: Attach to tmux session');
  });

const tmuxLayoutCmd = tmuxCmd.command('layout').description('Tmux layout management');

tmuxLayoutCmd
  .command('repair')
  .description('Repair tmux layout')
  .action(async () => {
    console.log('TODO: Repair tmux layout');
  });

program.parse();
