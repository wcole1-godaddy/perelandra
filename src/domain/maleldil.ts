import { readdir, stat, unlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogsConfig } from '../types/config';
import { logInfo, logError } from '../logging/pino';

const DEFAULT_MAX_FILES = 5;

export interface MaleldilConfig {
  root: string;
  maxSizeBytes: number;
  maxFiles: number;
}

export interface LogEntry {
  timestamp: string;
  level: number;
  levelName: string;
  msg: string;
  name?: string;
  [key: string]: unknown;
}

export interface LogQueryOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  from?: Date;
  to?: Date;
  contains?: string;
  field?: string;
  hnau?: string;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
  hasMore: boolean;
}

export interface LogFile {
  path: string;
  name: string;
  size: number;
  modified: Date;
}

export interface MaleldilResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const LEVEL_MAP: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const LEVEL_NUMBERS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export class Maleldil {
  private config: MaleldilConfig;
  private rotationTimer?: Timer;

  constructor(logsConfig?: LogsConfig, repoRoot: string = process.cwd()) {
    this.config = {
      root: logsConfig?.root ? join(repoRoot, logsConfig.root) : join(repoRoot, 'logs'),
      maxSizeBytes: (logsConfig?.maxSizeMb ?? 50) * 1024 * 1024,
      maxFiles: logsConfig?.maxFiles ?? DEFAULT_MAX_FILES,
    };
  }

  getConfig(): MaleldilConfig {
    return { ...this.config };
  }

  async listLogFiles(): Promise<MaleldilResult<LogFile[]>> {
    try {
      const entries = await readdir(this.config.root, { withFileTypes: true });
      const files: LogFile[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.log')) {
          const filePath = join(this.config.root, entry.name);
          const stats = await stat(filePath);
          files.push({
            path: filePath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }

      files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
      return { success: true, data: files };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async rotateLog(logFileName: string): Promise<MaleldilResult> {
    const logPath = join(this.config.root, logFileName);
    const file = Bun.file(logPath);

    if (!(await file.exists())) {
      return { success: true };
    }

    try {
      const stats = await stat(logPath);

      if (stats.size < this.config.maxSizeBytes) {
        return { success: true };
      }

      logInfo('Rotating log file', { file: logFileName, size: stats.size });

      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const oldPath = i === 1 ? logPath : `${logPath}.${i - 1}`;
        const newPath = `${logPath}.${i}`;

        const oldFile = Bun.file(oldPath);
        if (await oldFile.exists()) {
          if (i === this.config.maxFiles - 1) {
            await unlink(oldPath);
          } else {
            await rename(oldPath, newPath);
          }
        }
      }

      await rename(logPath, `${logPath}.1`);
      await Bun.write(logPath, '');

      logInfo('Log rotation complete', { file: logFileName });
      return { success: true };
    } catch (err) {
      logError('Log rotation failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async rotateAllLogs(): Promise<MaleldilResult> {
    const listResult = await this.listLogFiles();
    if (!listResult.success || !listResult.data) {
      return { success: false, error: listResult.error };
    }

    const errors: string[] = [];
    for (const file of listResult.data) {
      const result = await this.rotateLog(file.name);
      if (!result.success) {
        errors.push(`${file.name}: ${result.error}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }

    return { success: true };
  }

  async query(logFileName: string, options: LogQueryOptions = {}): Promise<MaleldilResult<LogQueryResult>> {
    const logPath = join(this.config.root, logFileName);
    const file = Bun.file(logPath);

    if (!(await file.exists())) {
      return {
        success: true,
        data: { entries: [], total: 0, hasMore: false },
      };
    }

    try {
      const content = await file.text();
      const lines = content.split('\n').filter((line) => line.trim());

      let entries: LogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entry.levelName = LEVEL_MAP[entry.level] ?? 'unknown';
          entries.push(entry);
        } catch {
          // Skip non-JSON lines
        }
      }

      if (options.level) {
        const minLevel = LEVEL_NUMBERS[options.level] ?? 30;
        entries = entries.filter((e) => e.level >= minLevel);
      }

      if (options.from) {
        entries = entries.filter((e) => new Date(e.timestamp) >= options.from!);
      }

      if (options.to) {
        entries = entries.filter((e) => new Date(e.timestamp) <= options.to!);
      }

      if (options.contains) {
        const search = options.contains.toLowerCase();
        entries = entries.filter((e) => {
          const line = JSON.stringify(e).toLowerCase();
          return line.includes(search);
        });
      }

      if (options.field) {
        entries = entries.filter((e) => e.field === options.field || e.fieldName === options.field);
      }

      if (options.hnau) {
        entries = entries.filter((e) => e.hnau === options.hnau || e.hnauId === options.hnau);
      }

      const total = entries.length;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 100;

      entries = entries.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          entries,
          total,
          hasMore: offset + entries.length < total,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async tail(logFileName: string, lines: number = 50): Promise<MaleldilResult<LogEntry[]>> {
    const logPath = join(this.config.root, logFileName);
    const file = Bun.file(logPath);

    if (!(await file.exists())) {
      return { success: true, data: [] };
    }

    try {
      const content = await file.text();
      const allLines = content.split('\n').filter((line) => line.trim());
      const tailLines = allLines.slice(-lines);

      const entries: LogEntry[] = [];
      for (const line of tailLines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entry.levelName = LEVEL_MAP[entry.level] ?? 'unknown';
          entries.push(entry);
        } catch {
          // Skip non-JSON lines
        }
      }

      return { success: true, data: entries };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getLogStats(logFileName: string): Promise<MaleldilResult<Record<string, number>>> {
    const logPath = join(this.config.root, logFileName);
    const file = Bun.file(logPath);

    if (!(await file.exists())) {
      return { success: true, data: {} };
    }

    try {
      const content = await file.text();
      const lines = content.split('\n').filter((line) => line.trim());

      const stats: Record<string, number> = {
        total: 0,
        trace: 0,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      };

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          stats.total++;
          const levelName = LEVEL_MAP[entry.level] ?? 'unknown';
          if (stats[levelName] !== undefined) {
            stats[levelName]++;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      return { success: true, data: stats };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  startAutoRotation(intervalMs: number = 60000): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(() => {
      this.rotateAllLogs().catch((err) => {
        logError('Auto-rotation failed', err);
      });
    }, intervalMs);

    logInfo('Started auto-rotation', { intervalMs });
  }

  stopAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
      logInfo('Stopped auto-rotation');
    }
  }

  dispose(): void {
    this.stopAutoRotation();
  }
}

let globalMaleldil: Maleldil | undefined;

export function getMaleldil(): Maleldil | undefined {
  return globalMaleldil;
}

export function initMaleldil(logsConfig?: LogsConfig, repoRoot?: string): Maleldil {
  globalMaleldil = new Maleldil(logsConfig, repoRoot);
  return globalMaleldil;
}
