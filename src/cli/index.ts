#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig, validateConfig, formatConfigError } from '../core/config';
import { createFieldCommand } from './commands/field';
import { createHnauCommand } from './commands/hnau';
import { createTaskCommand } from './commands/task';
import { createEldilCommand } from './commands/eldil';
import { createSornCommand } from './commands/sorn';
import { createRepoCommand } from './commands/repo';
import { getRepoRoot } from '../domain/git';
import { startUI } from '../ui';
import { formatError, isPerelandraError } from '../util/errors';
import { TmuxManager } from '../domain/tmux';

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

      const { createAndStartOyarsa } = await import('../core/oyarsa');
      const oyarsa = await createAndStartOyarsa({
        config,
        repoRoot: repoRootResult.data,
        autoPersist: true,
      });

      process.on('SIGINT', async () => {
        await oyarsa.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await oyarsa.shutdown();
        process.exit(0);
      });

      await startUI({
        config,
        repoRoot: repoRootResult.data,
        oyarsa,
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
    try {
      const { config } = await loadConfig();
      const repoRootResult = await getRepoRoot();
      if (!repoRootResult.success || !repoRootResult.data) {
        console.error('Error:', repoRootResult.error);
        process.exit(1);
      }

      const { FieldManager } = await import('../domain/field');
      const { BeadsManager } = await import('../domain/beads');

      const fieldManager = new FieldManager(config, repoRootResult.data);
      const beadsRoot = config.beads?.root ?? `${repoRootResult.data}/.beads`;
      const beads = new BeadsManager(beadsRoot, repoRootResult.data);
      const tmux = new TmuxManager();

      console.log('⚡ Perelandra Status\n');

      const fieldsResult = await fieldManager.list();
      if (fieldsResult.success && fieldsResult.data) {
        console.log(`Fields (${fieldsResult.data.length}):`);
        for (const field of fieldsResult.data) {
          const icon = field.exists ? '●' : '○';
          console.log(`  ${icon} ${field.name} (${field.branch})`);
        }
      }

      console.log(`\nHnau (${config.hnau.length}):`);
      for (const hnau of config.hnau) {
        console.log(`  ○ ${hnau.id}${hnau.port ? ` :${hnau.port}` : ''}`);
      }

      const tasksResult = await beads.listTasks({ status: 'in-progress' });
      if (tasksResult.success && tasksResult.data) {
        console.log(`\nIn-Progress Tasks (${tasksResult.data.length}):`);
        for (const task of tasksResult.data.slice(0, 5)) {
          console.log(`  ● ${task.id}: ${task.title}`);
        }
        if (tasksResult.data.length > 5) {
          console.log(`  ... and ${tasksResult.data.length - 5} more`);
        }
      }

      const tmuxAvailable = await tmux.isTmuxAvailable();
      const sessionExists = tmuxAvailable && await tmux.sessionExists();
      console.log(`\nTmux: ${tmuxAvailable ? (sessionExists ? '● session active' : '○ available') : '✗ not available'}`);
    } catch (err) {
      if (isPerelandraError(err)) {
        console.error(formatError(err));
      } else {
        console.error(err instanceof Error ? err.message : err);
      }
      process.exit(1);
    }
  });

program.addCommand(createFieldCommand());
program.addCommand(createHnauCommand());
program.addCommand(createTaskCommand());
program.addCommand(createEldilCommand());
program.addCommand(createSornCommand());
program.addCommand(createRepoCommand());

const logsCmd = program
  .command('logs')
  .description('Log management');

logsCmd
  .command('tail')
  .description('Tail logs in real-time')
  .option('-n, --lines <count>', 'Number of lines to show initially', '20')
  .option('--field <name>', 'Filter by field context')
  .option('--hnau <id>', 'Filter by hnau service')
  .option('-f, --follow', 'Follow log output (default: true)', true)
  .action(async (options: { lines: string; field?: string; hnau?: string; follow?: boolean }) => {
    try {
      const { config } = await loadConfig();
      const logRoot = config.logs?.root ?? 'logs';
      const logFile = `${logRoot}/perelandra.log`;

      const file = Bun.file(logFile);
      if (!(await file.exists())) {
        console.log(`No logs found at ${logFile}`);
        console.log('Logs will appear here once Perelandra starts writing to the log file.');
        if (options.follow) {
          console.log('Waiting for logs...\n');
        } else {
          process.exit(0);
        }
      }

      const numLines = parseInt(options.lines, 10) || 20;

      const filterLog = (line: string): boolean => {
        if (!line.trim()) return false;
        if (options.field && !line.includes(`field":"${options.field}`)) return false;
        if (options.hnau && !line.includes(`hnau":"${options.hnau}`)) return false;
        return true;
      };

      const formatLogLine = (line: string): string => {
        try {
          const parsed = JSON.parse(line);
          const time = parsed.time ? new Date(parsed.time).toLocaleTimeString() : '';
          const level = (parsed.level === 30 ? 'INFO' : parsed.level === 40 ? 'WARN' : parsed.level === 50 ? 'ERROR' : 'DEBUG').padEnd(5);
          const msg = parsed.msg ?? '';
          return `${time} [${level}] ${msg}`;
        } catch {
          return line;
        }
      };

      if (await file.exists()) {
        const content = await file.text();
        const lines = content.split('\n').filter(filterLog);
        const tail = lines.slice(-numLines);

        for (const line of tail) {
          console.log(formatLogLine(line));
        }
      }

      if (options.follow) {
        console.log('\n--- Following logs (Ctrl+C to exit) ---\n');

        let lastSize = (await file.exists()) ? file.size : 0;

        const checkForNewLogs = async () => {
          try {
            if (!(await file.exists())) return;

            const currentSize = Bun.file(logFile).size;
            if (currentSize > lastSize) {
              const content = await Bun.file(logFile).text();
              const newContent = content.slice(lastSize);
              const newLines = newContent.split('\n').filter(filterLog);

              for (const line of newLines) {
                if (line.trim()) {
                  console.log(formatLogLine(line));
                }
              }

              lastSize = currentSize;
            }
          } catch {
            // File might be temporarily unavailable
          }
        };

        const interval = setInterval(checkForNewLogs, 500);

        process.on('SIGINT', () => {
          clearInterval(interval);
          console.log('\nStopped following logs.');
          process.exit(0);
        });

        await new Promise(() => {});
      }
    } catch (err) {
      if (isPerelandraError(err)) {
        console.error(formatError(err));
      } else {
        console.error(err instanceof Error ? err.message : err);
      }
      process.exit(1);
    }
  });

const tmuxCmd = program
  .command('tmux')
  .description('Tmux session management');

tmuxCmd
  .command('attach')
  .description('Attach to Perelandra tmux session')
  .action(async () => {
    const tmux = new TmuxManager();

    if (!(await tmux.isTmuxAvailable())) {
      console.error('Error: tmux is not installed or not in PATH');
      console.log('Install tmux: brew install tmux (macOS) or apt install tmux (Linux)');
      process.exit(1);
    }

    if (await tmux.isInsideTmux()) {
      console.error('Error: Already inside a tmux session');
      console.log('Use `tmux switch-client -t perelandra` to switch sessions');
      process.exit(1);
    }

    if (!(await tmux.sessionExists())) {
      console.log('No perelandra session exists. Creating one...');
      const createResult = await tmux.createSession({ detached: false });
      if (!createResult.success) {
        console.error('Error:', createResult.error);
        process.exit(1);
      }
      return;
    }

    const attachResult = await tmux.attach();
    if (!attachResult.success) {
      console.error('Error:', attachResult.error);
      process.exit(1);
    }
  });

const tmuxLayoutCmd = tmuxCmd.command('layout').description('Tmux layout management');

tmuxLayoutCmd
  .command('repair')
  .description('Repair tmux layout')
  .action(async () => {
    console.log('TODO: Repair tmux layout');
  });

program.parse();
