/**
 * Custom error classes for Perelandra
 * 
 * Provides structured error handling with helpful messages,
 * error codes, and context for debugging.
 */

export type ErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'CONFIG_PARSE_ERROR'
  | 'FIELD_NOT_FOUND'
  | 'FIELD_ALREADY_EXISTS'
  | 'FIELD_CREATE_FAILED'
  | 'FIELD_DELETE_FAILED'
  | 'HNAU_NOT_FOUND'
  | 'HNAU_START_FAILED'
  | 'HNAU_STOP_FAILED'
  | 'ELDIL_NOT_FOUND'
  | 'ELDIL_SPAWN_FAILED'
  | 'ELDIL_STOP_FAILED'
  | 'TMUX_NOT_AVAILABLE'
  | 'TMUX_SESSION_ERROR'
  | 'TMUX_PANE_ERROR'
  | 'BEADS_ERROR'
  | 'BEADS_TASK_NOT_FOUND'
  | 'GIT_ERROR'
  | 'GIT_WORKTREE_ERROR'
  | 'PROCESS_ERROR'
  | 'STATE_CORRUPTED'
  | 'UNKNOWN_ERROR';

export interface ErrorContext {
  code: ErrorCode;
  cause?: Error;
  details?: Record<string, unknown>;
  suggestion?: string;
}

/**
 * Base error class for all Perelandra errors
 */
export class PerelandraError extends Error {
  readonly code: ErrorCode;
  readonly cause?: Error;
  readonly details?: Record<string, unknown>;
  readonly suggestion?: string;

  constructor(message: string, context: ErrorContext) {
    super(message);
    this.name = 'PerelandraError';
    this.code = context.code;
    this.cause = context.cause;
    this.details = context.details;
    this.suggestion = context.suggestion;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Format error for display in CLI
   */
  format(): string {
    const lines: string[] = [`Error [${this.code}]: ${this.message}`];

    if (this.details && Object.keys(this.details).length > 0) {
      for (const [key, value] of Object.entries(this.details)) {
        lines.push(`  ${key}: ${String(value)}`);
      }
    }

    if (this.suggestion) {
      lines.push(`\nSuggestion: ${this.suggestion}`);
    }

    if (this.cause) {
      lines.push(`\nCaused by: ${this.cause.message}`);
    }

    return lines.join('\n');
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
      cause: this.cause?.message,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'CONFIG_NOT_FOUND' | 'CONFIG_INVALID' | 'CONFIG_PARSE_ERROR';
      path?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'CONFIG_INVALID',
      cause: options.cause,
      details: options.path ? { path: options.path } : undefined,
      suggestion:
        options.suggestion ??
        'Run `perelandra init` to create a new configuration file',
    });
    this.name = 'ConfigError';
  }
}

/**
 * Field (worktree) related errors
 */
export class FieldError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?:
        | 'FIELD_NOT_FOUND'
        | 'FIELD_ALREADY_EXISTS'
        | 'FIELD_CREATE_FAILED'
        | 'FIELD_DELETE_FAILED';
      fieldName?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'FIELD_NOT_FOUND',
      cause: options.cause,
      details: options.fieldName ? { field: options.fieldName } : undefined,
      suggestion:
        options.suggestion ??
        'Run `perelandra field list` to see available fields',
    });
    this.name = 'FieldError';
  }
}

/**
 * Hnau (service) related errors
 */
export class HnauError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'HNAU_NOT_FOUND' | 'HNAU_START_FAILED' | 'HNAU_STOP_FAILED';
      hnauId?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'HNAU_NOT_FOUND',
      cause: options.cause,
      details: options.hnauId ? { hnau: options.hnauId } : undefined,
      suggestion:
        options.suggestion ?? 'Run `perelandra hnau list` to see available services',
    });
    this.name = 'HnauError';
  }
}

/**
 * Eldil (worker) related errors
 */
export class EldilError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'ELDIL_NOT_FOUND' | 'ELDIL_SPAWN_FAILED' | 'ELDIL_STOP_FAILED';
      eldilId?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'ELDIL_NOT_FOUND',
      cause: options.cause,
      details: options.eldilId ? { eldil: options.eldilId } : undefined,
      suggestion:
        options.suggestion ?? 'Run `perelandra eldil list` to see active workers',
    });
    this.name = 'EldilError';
  }
}

/**
 * Tmux-related errors
 */
export class TmuxError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'TMUX_NOT_AVAILABLE' | 'TMUX_SESSION_ERROR' | 'TMUX_PANE_ERROR';
      session?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'TMUX_NOT_AVAILABLE',
      cause: options.cause,
      details: options.session ? { session: options.session } : undefined,
      suggestion:
        options.suggestion ??
        'Install tmux or run with --no-tmux for degraded mode',
    });
    this.name = 'TmuxError';
  }
}

/**
 * Beads (task tracking) related errors
 */
export class BeadsError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'BEADS_ERROR' | 'BEADS_TASK_NOT_FOUND';
      taskId?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'BEADS_ERROR',
      cause: options.cause,
      details: options.taskId ? { task: options.taskId } : undefined,
      suggestion:
        options.suggestion ?? 'Run `perelandra task list` to see available tasks',
    });
    this.name = 'BeadsError';
  }
}

/**
 * Git-related errors
 */
export class GitError extends PerelandraError {
  constructor(
    message: string,
    options: {
      code?: 'GIT_ERROR' | 'GIT_WORKTREE_ERROR';
      path?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? 'GIT_ERROR',
      cause: options.cause,
      details: options.path ? { path: options.path } : undefined,
      suggestion:
        options.suggestion ??
        'Ensure you are in a git repository',
    });
    this.name = 'GitError';
  }
}

/**
 * State corruption errors
 */
export class StateError extends PerelandraError {
  constructor(
    message: string,
    options: {
      statePath?: string;
      cause?: Error;
      suggestion?: string;
    } = {}
  ) {
    super(message, {
      code: 'STATE_CORRUPTED',
      cause: options.cause,
      details: options.statePath ? { statePath: options.statePath } : undefined,
      suggestion:
        options.suggestion ??
        'Try removing the state file and restarting Perelandra',
    });
    this.name = 'StateError';
  }
}

/**
 * Check if an error is a PerelandraError
 */
export function isPerelandraError(error: unknown): error is PerelandraError {
  return error instanceof PerelandraError;
}

/**
 * Wrap an unknown error in a PerelandraError
 */
export function wrapError(
  error: unknown,
  message: string,
  code: ErrorCode = 'UNKNOWN_ERROR'
): PerelandraError {
  const cause = error instanceof Error ? error : new Error(String(error));
  return new PerelandraError(message, { code, cause });
}

/**
 * Format any error for CLI display
 */
export function formatError(error: unknown): string {
  if (isPerelandraError(error)) {
    return error.format();
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${String(error)}`;
}

/**
 * Exit with formatted error message
 */
export function exitWithError(error: unknown, exitCode = 1): never {
  console.error(formatError(error));
  process.exit(exitCode);
}
