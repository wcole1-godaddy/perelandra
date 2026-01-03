export interface WitnessConfig {
  enabled?: boolean;
  pollIntervalMs?: number;
  stuckEldilTimeoutMs?: number;
  maxConsecutiveHealthFailures?: number;
  autoRestartHnau?: boolean;
}

export interface WitnessReport {
  timestamp: string;
  stuckEldila: StuckEldilReport[];
  unhealthyHnau: UnhealthyHnauReport[];
  actionsTaken: WitnessAction[];
}

export interface StuckEldilReport {
  eldilId: string;
  fieldName: string;
  taskId?: string;
  stuckSinceMs: number;
  status: 'detected' | 'marked_error' | 'task_blocked';
}

export interface UnhealthyHnauReport {
  hnauId: string;
  consecutiveFailures: number;
  lastError?: string;
  status: 'detected' | 'restarted' | 'restart_failed';
}

export type WitnessActionType =
  | 'eldil_marked_error'
  | 'task_marked_blocked'
  | 'hnau_restart_attempted'
  | 'hnau_restart_succeeded'
  | 'hnau_restart_failed';

export interface WitnessAction {
  type: WitnessActionType;
  targetId: string;
  timestamp: string;
  error?: string;
}

export const DEFAULT_WITNESS_CONFIG: Required<WitnessConfig> = {
  enabled: true,
  pollIntervalMs: 30000,
  stuckEldilTimeoutMs: 600000, // 10 minutes
  maxConsecutiveHealthFailures: 3,
  autoRestartHnau: false,
};
