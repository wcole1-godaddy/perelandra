#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig, validateConfig, formatConfigError } from '../core/config';
import { createFieldCommand } from './commands/field';
import { createHnauCommand } from './commands/hnau';

const program = new Command();

program
  .name('perelandra')
  .description('AI Agent Orchestrator for multi-service development')
  .version('0.1.0');

program
  .command('init')
  .description('Generate a .perelandra.yaml configuration file')
  .action(async () => {
    console.log('TODO: Initialize configuration');
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
      const { config, path } = await loadConfig();
      console.log(`Loaded config from: ${path}`);
      console.log(`Version: ${config.version}`);
      console.log(`Hnau count: ${config.hnau.length}`);
      console.log('TODO: Start Oyarsa and TUI');
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'issues' in err) {
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

const taskCmd = program
  .command('task')
  .description('Manage tasks (Beads integration)');

taskCmd
  .command('new')
  .description('Create a new task')
  .option('--field <name>', 'Field context')
  .option('--hnau <id>', 'Associated Hnau')
  .action(async (_options: { field?: string; hnau?: string }) => {
    console.log('TODO: Create new task');
  });

taskCmd
  .command('list')
  .description('List tasks')
  .option('--field <name>', 'Field context')
  .option('--status <status>', 'Filter by status')
  .action(async (_options: { field?: string; status?: string }) => {
    console.log('TODO: List tasks');
  });

taskCmd
  .command('show <id>')
  .description('Show task details')
  .action(async (id: string) => {
    console.log(`TODO: Show task ${id}`);
  });

taskCmd
  .command('set-status <id> <status>')
  .description('Update task status')
  .action(async (id: string, status: string) => {
    console.log(`TODO: Set task ${id} status to ${status}`);
  });

taskCmd
  .command('sync')
  .description('Sync tasks with Beads')
  .action(async () => {
    console.log('TODO: Sync tasks');
  });

const eldilCmd = program
  .command('eldil')
  .description('Manage Eldila (AI workers)');

eldilCmd
  .command('list')
  .description('List all Eldila')
  .action(async () => {
    console.log('TODO: List eldila');
  });

eldilCmd
  .command('start')
  .description('Start an Eldil')
  .option('--field <name>', 'Field context')
  .option('--hnau <id>', 'Associated Hnau')
  .action(async (_options: { field?: string; hnau?: string }) => {
    console.log('TODO: Start eldil');
  });

eldilCmd
  .command('stop <eldilId>')
  .description('Stop an Eldil')
  .action(async (eldilId: string) => {
    console.log(`TODO: Stop eldil ${eldilId}`);
  });

eldilCmd
  .command('assign <eldilId> <taskId>')
  .description('Assign a task to an Eldil')
  .action(async (eldilId: string, taskId: string) => {
    console.log(`TODO: Assign task ${taskId} to eldil ${eldilId}`);
  });

const sornCmd = program
  .command('sorn')
  .description('Manage Sorn (reviewer agent)');

sornCmd
  .command('review')
  .description('Review current changes')
  .option('--field <name>', 'Field context')
  .action(async (_options: { field?: string }) => {
    console.log('TODO: Run Sorn review');
  });

sornCmd
  .command('config')
  .description('Show/edit Sorn model config')
  .action(async () => {
    console.log('TODO: Show Sorn config');
  });

sornCmd
  .command('history')
  .description('Show past reviews')
  .action(async () => {
    console.log('TODO: Show Sorn history');
  });

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
