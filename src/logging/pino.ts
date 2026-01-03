import pino from 'pino';
import type { LogsConfig } from '../types/config';

export interface LoggerOptions {
  name?: string;
  level?: pino.Level;
  logsConfig?: LogsConfig;
}

const DEFAULT_LOG_FILE = 'logs/perelandra.log';

export interface CreateLoggerOptions extends LoggerOptions {
  /** When true, only log to file (no stdout) - use when TUI is active */
  fileOnly?: boolean;
}

export function createLogger(options: CreateLoggerOptions = {}): pino.Logger {
  const { name = 'perelandra', level = 'info', logsConfig, fileOnly = false } = options;

  const logFile = logsConfig?.root
    ? `${logsConfig.root}/perelandra.log`
    : DEFAULT_LOG_FILE;

  const targets: pino.TransportTargetOptions[] = [
    {
      target: 'pino/file',
      options: { destination: logFile, mkdir: true },
      level: level,
    },
  ];

  // Only add stdout transport when not in TUI mode
  if (!fileOnly) {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: level,
    });
  }

  const transport = pino.transport({ targets });

  return pino({ name, level }, transport);
}

let globalLogger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (!globalLogger) {
    globalLogger = createLogger();
  }
  return globalLogger;
}

export function initLogger(options: CreateLoggerOptions): pino.Logger {
  globalLogger = createLogger(options);
  return globalLogger;
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  getLogger().info(data, message);
}

export function logError(message: string, error?: Error | unknown): void {
  if (error instanceof Error) {
    getLogger().error({ err: error }, message);
  } else {
    getLogger().error({ error }, message);
  }
}

export function logWarn(message: string, data?: Record<string, unknown>): void {
  getLogger().warn(data, message);
}

export function logDebug(message: string, data?: Record<string, unknown>): void {
  getLogger().debug(data, message);
}
