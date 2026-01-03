import type { HnauConfig } from './config';

export type HnauStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface HnauHealthState {
  healthy: boolean;
  lastCheck: string;
  lastError?: string;
  consecutiveFailures: number;
}

export interface HnauProcess {
  pid?: number;
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number;
}

export interface HnauRuntime {
  config: HnauConfig;
  status: HnauStatus;
  process?: HnauProcess;
  health?: HnauHealthState;
  tmuxPane?: string;
  logFile?: string;
}

export interface HnauStartOptions {
  field: string;
  env?: Record<string, string>;
  useDocker?: boolean;
}

export interface HnauStopOptions {
  force?: boolean;
  timeout?: number;
}

export interface HnauLifecycleResult {
  success: boolean;
  hnauId: string;
  status: HnauStatus;
  error?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  responseTimeMs?: number;
  statusCode?: number;
  error?: string;
}

export interface HnauManagerOptions {
  healthCheckIntervalMs?: number;
  defaultStopTimeoutMs?: number;
}
