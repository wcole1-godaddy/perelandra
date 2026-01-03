export type EldilStatus = 'idle' | 'running' | 'blocked' | 'error' | 'completed';
export type EldilTool = 'amp' | 'opencode';

export interface EldilConfig {
  id: string;
  tool: EldilTool;
  model?: string;
  streamJson?: boolean;
  executeMode?: boolean;
}

export interface EldilState {
  id: string;
  fieldName: string;
  hnauId?: string;
  currentTaskId?: string;
  status: EldilStatus;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
  threadUrl?: string;
}

export interface EldilSpawnOptions {
  fieldName: string;
  fieldPath: string;
  hnauId?: string;
  taskId?: string;
  prompt: string;
  tool?: EldilTool;
  useTmux?: boolean;
}

export interface EldilResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EldilOutput {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  timestamp: string;
}

export interface EldilProcess {
  pid?: number;
  startedAt: string;
  exitCode?: number;
  tmuxPane?: string;
}

export interface EldilRuntime {
  id: string;
  config: EldilConfig;
  state: EldilState;
  process?: EldilProcess;
  outputs: EldilOutput[];
}

export interface EldilManagerOptions {
  defaultTool?: EldilTool;
  useTmux?: boolean;
  logOutputs?: boolean;
  maxWorkersPerField?: number;
  maxTotalWorkers?: number;
}

export interface EldilPoolStats {
  totalWorkers: number;
  runningWorkers: number;
  workersByField: Map<string, number>;
  queuedTasks: number;
}

export interface QueuedSpawn {
  options: EldilSpawnOptions;
  resolve: (result: EldilResult<EldilRuntime>) => void;
  queuedAt: string;
}
