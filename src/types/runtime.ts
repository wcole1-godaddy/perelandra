export type EldilStatus = 'idle' | 'running' | 'blocked' | 'error' | 'completed';

export interface EldilState {
  id: string;
  fieldName: string;
  fieldPath?: string;
  hnauId?: string;
  currentTaskId?: string;
  status: EldilStatus;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
  tmuxPane?: string;
  initialPrompt?: string;
  tool?: 'amp' | 'opencode';
}

export interface HnauHealthStatus {
  running: boolean;
  lastHealthCheck?: string;
  healthy?: boolean;
}

export interface FieldState {
  name: string;
  path: string;
  branch: string;
  baseBranch?: string;
  hnauStatuses: Record<string, HnauHealthStatus>;
  activeEldila: string[];
}

export interface OyarsaState {
  activeField: string;
  fields: Record<string, FieldState>;
  eldila: Record<string, EldilState>;
}
