import type {
  EldilRuntime,
  EldilContextUsage,
  AmpUsage,
  EldilHandoffReason,
} from '../types/eldil';

const DEFAULT_THRESHOLD_RATIO = 0.8;
const DEFAULT_MAX_HANDOFF_DEPTH = 3;

export interface ContextMonitorOptions {
  thresholdRatio?: number;
  maxAutoHandoffDepth?: number;
}

export interface ContextMonitorCallbacks {
  onHandoffNeeded: (eldilId: string, reason: EldilHandoffReason) => Promise<void>;
}

export class ContextMonitor {
  private thresholdRatio: number;
  private maxAutoHandoffDepth: number;
  private callbacks: ContextMonitorCallbacks;

  constructor(
    callbacks: ContextMonitorCallbacks,
    options: ContextMonitorOptions = {}
  ) {
    this.thresholdRatio = options.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
    this.maxAutoHandoffDepth = options.maxAutoHandoffDepth ?? DEFAULT_MAX_HANDOFF_DEPTH;
    this.callbacks = callbacks;
  }

  handleUsage(runtime: EldilRuntime, usage: AmpUsage): void {
    const total = usage.input_tokens + usage.output_tokens;
    const ratio = total / usage.max_tokens;
    const now = new Date().toISOString();

    const prev = runtime.state.contextUsage;
    const nearingLimit = ratio >= this.thresholdRatio;

    const contextUsage: EldilContextUsage = {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      maxTokens: usage.max_tokens,
      totalTokens: total,
      ratio,
      nearingLimit,
      lastUpdatedAt: now,
    };

    runtime.state.contextUsage = contextUsage;

    const wasNearingLimit = prev?.nearingLimit ?? false;
    const alreadyHandedOff = !!runtime.state.handoff?.handoffChildId;

    if (nearingLimit && !wasNearingLimit && !alreadyHandedOff) {
      this.triggerHandoffIfAllowed(runtime);
    }
  }

  private triggerHandoffIfAllowed(runtime: EldilRuntime): void {
    const depth = this.computeHandoffDepth(runtime);
    if (depth >= this.maxAutoHandoffDepth) {
      return;
    }

    void this.callbacks.onHandoffNeeded(runtime.id, 'context_near_limit');
  }

  private computeHandoffDepth(runtime: EldilRuntime): number {
    return runtime.state.threadChain?.previousThreadUrls?.length ?? 0;
  }

  getThresholdRatio(): number {
    return this.thresholdRatio;
  }

  setThresholdRatio(ratio: number): void {
    this.thresholdRatio = Math.max(0.1, Math.min(0.95, ratio));
  }

  getMaxAutoHandoffDepth(): number {
    return this.maxAutoHandoffDepth;
  }

  setMaxAutoHandoffDepth(depth: number): void {
    this.maxAutoHandoffDepth = Math.max(1, depth);
  }
}
