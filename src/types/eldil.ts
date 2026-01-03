export type EldilStatus = 'idle' | 'running' | 'blocked' | 'error' | 'completed';
export type EldilTool = 'amp' | 'opencode';
export type EldilHandoffReason = 'context_near_limit' | 'manual';

export interface EldilConfig {
  id: string;
  tool: EldilTool;
  model?: string;
  streamJson?: boolean;
  executeMode?: boolean;
}

export interface EldilContextUsage {
  inputTokens: number;
  outputTokens: number;
  maxTokens: number;
  totalTokens: number;
  ratio: number;
  nearingLimit: boolean;
  lastUpdatedAt: string;
}

export interface EldilHandoffInfo {
  parentEldilId?: string;
  handoffChildId?: string;
  reason?: EldilHandoffReason;
  triggeredAt?: string;
}

export interface EldilThreadChain {
  threadUrl?: string;
  rootThreadUrl?: string;
  previousThreadUrls?: string[];
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
  contextUsage?: EldilContextUsage;
  handoff?: EldilHandoffInfo;
  threadChain?: EldilThreadChain;
}

export interface EldilSpawnOptions {
  fieldName: string;
  fieldPath: string;
  hnauId?: string;
  taskId?: string;
  prompt: string;
  tool?: EldilTool;
}

export interface EldilResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EldilOutput {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'complete' | 'json';
  content?: string;
  json?: unknown;
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
  fieldPath: string;
  initialPrompt: string;
}

export interface EldilManagerOptions {
  defaultTool?: EldilTool;
  logOutputs?: boolean;
  maxWorkersPerField?: number;
  maxTotalWorkers?: number;
  contextThresholdRatio?: number;
  maxAutoHandoffDepth?: number;
}

export interface AmpUsage {
  input_tokens: number;
  output_tokens: number;
  max_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

export type StreamJSONMessage =
  | {
      type: 'assistant';
      message: {
        type: 'message';
        role: 'assistant';
        content: Array<
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        >;
        stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | null;
        usage?: AmpUsage;
      };
      parent_tool_use_id: string | null;
      session_id: string;
    }
  | {
      type: 'user';
      message: {
        role: 'user';
        content: Array<{
          type: 'tool_result';
          tool_use_id: string;
          content: string;
          is_error: boolean;
        }>;
      };
      parent_tool_use_id: string | null;
      session_id: string;
    }
  | {
      type: 'result';
      subtype: 'success';
      duration_ms: number;
      is_error: false;
      num_turns: number;
      result: string;
      session_id: string;
      usage?: AmpUsage;
      permission_denials?: string[];
    }
  | {
      type: 'result';
      subtype: 'error_during_execution' | 'error_max_turns';
      duration_ms: number;
      is_error: true;
      num_turns: number;
      error: string;
      session_id: string;
      usage?: AmpUsage;
      permission_denials?: string[];
    }
  | {
      type: 'system';
      subtype: 'init';
      cwd: string;
      session_id: string;
      tools: string[];
      mcp_servers: Array<{
        name: string;
        status: 'connected' | 'connecting' | 'connection-failed' | 'disabled';
      }>;
    };

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
