import pino from 'pino';
import type { LogsConfig } from '../types/config';

export interface LoggerOptions {
  name?: string;
  level?: pino.Level;
  logsConfig?: LogsConfig;
}

const DEFAULT_LOG_FILE = 'logs/perelandra.log';

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { name = 'perelandra', level = 'info', logsConfig } = options;

  const logFile = logsConfig?.root
    ? `${logsConfig.root}/perelandra.log`
    : DEFAULT_LOG_FILE;

  const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: logFile, mkdir: true },
        level: level,
      },
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level: level,
      },
    ],
  });

  return pino({ name, level }, transport);
}

let globalLogger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (!globalLogger) {
    globalLogger = createLogger();
  }
  return globalLogger;
}

export function initLogger(options: LoggerOptions): pino.Logger {
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
