# Eldil Context Management & Automatic Handoff

> *"When the Eldil's vessel grows full, another rises to continue the work."*

## Overview

This document describes the automatic context management and handoff system for Perelandra's Eldila (AI worker agents). When an Eldil approaches its context window limit, it automatically hands off to a fresh Eldil to continue the work.

## Problem Statement

Amp agents (Eldila) operate within a ~200k token context window. Long-running tasks can exhaust this window, causing:
- Degraded agent performance ("drunk" behavior)
- Task abandonment or errors
- Lost work and context

**Solution**: Monitor context usage via `--stream-json` output and automatically trigger handoffs before exhaustion.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EldilManager                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  ContextMonitor                          ││
│  │  • Parses --stream-json output (NDJSON)                 ││
│  │  • Tracks token usage per Eldil                         ││
│  │  • Triggers handoff at threshold (e.g., 80%)            ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              handleContextHandoff()                      ││
│  │  1. Build handoff prompt with task context               ││
│  │  2. Spawn new Eldil with handoff prompt                  ││
│  │  3. Link parent/child in handoff chain                   ││
│  │  4. Stop original Eldil gracefully                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Model Extensions

### EldilContextUsage

Tracks token consumption from Amp's `--stream-json` usage events:

```typescript
interface EldilContextUsage {
  inputTokens: number;      // Tokens in context window
  outputTokens: number;     // Tokens generated this session
  maxTokens: number;        // Context window limit (~200k)
  totalTokens: number;      // input + output
  ratio: number;            // totalTokens / maxTokens (0.0-1.0)
  nearingLimit: boolean;    // true when ratio >= threshold
  lastUpdatedAt: string;    // ISO timestamp
}
```

### EldilHandoffInfo

Tracks handoff lineage for audit trail:

```typescript
interface EldilHandoffInfo {
  parentEldilId?: string;              // Who handed off to me
  handoffChildId?: string;             // Who I handed off to
  reason?: 'context_near_limit' | 'manual';
  triggeredAt?: string;                // When handoff was triggered
}
```

### EldilThreadChain

Preserves thread history across handoffs:

```typescript
interface EldilThreadChain {
  threadUrl?: string;           // Current Amp thread URL
  rootThreadUrl?: string;       // First thread in this chain
  previousThreadUrls?: string[];// All threads before this one
}
```

## ContextMonitor

The ContextMonitor watches token usage and triggers handoffs:

```typescript
class ContextMonitor {
  constructor(
    manager: EldilManager,
    options: {
      thresholdRatio?: number;      // Default: 0.8 (80%)
      maxAutoHandoffDepth?: number; // Default: 3 (prevent infinite chains)
    }
  );

  // Called on each usage event from --stream-json
  handleUsage(runtime: EldilRuntime, usage: AmpUsageEvent): void;
}
```

### Threshold Logic

- **Trigger at 80%**: Leaves headroom for the handoff prompt itself
- **Once per Eldil**: Only triggers if not already handed off
- **Depth limit**: Maximum 3 auto-handoffs per task chain (configurable)

## Stream JSON Parsing

Amp's `--stream-json` output is NDJSON (one JSON object per line):

```json
{"type":"system","subtype":"init","session_id":"T-...","tools":[...]}
{"type":"user","message":{...}}
{"type":"assistant","message":{...,"usage":{"input_tokens":12783,"output_tokens":8,"max_tokens":224000}}}
{"type":"result","subtype":"success","session_id":"T-..."}
```

The parser extracts:
1. **`usage`**: Token consumption → `ContextMonitor.handleUsage()`
2. **`session_id`**: Thread URL → `EldilState.threadChain`
3. **Other events**: Stored in `EldilOutput[]` for debugging

## Handoff Prompt Template

When a handoff is triggered, a new Eldil is spawned with this prompt:

```
You are an Eldil (Amp worker agent) taking over an existing task because 
the previous Amp thread is approaching its context window limit.

Original task / goal:
{initialPrompt}

Current thread: {currentThreadUrl}
Previous threads:
- {thread1}
- {thread2}

Use Amp's built-in handoff pattern:
1. Treat the previous thread(s) as read-only history.
2. Summarize the current state of the task, open issues, and key decisions.
3. Create a new, focused working context that only carries forward 
   the necessary information.
4. Continue executing on the same task.

Your job is to continue from where the previous Eldil left off.
```

## Configuration

New `EldilManagerOptions`:

```typescript
interface EldilManagerOptions {
  // ... existing options ...
  
  contextThresholdRatio?: number;   // Default: 0.8
  maxAutoHandoffDepth?: number;     // Default: 3
}
```

## Audit Trail

Each task maintains a complete history via:

1. **Handoff chain**: `parentEldilId` → `handoffChildId` links
2. **Thread chain**: `rootThreadUrl` → `previousThreadUrls[]` → `threadUrl`
3. **Task ID**: All Eldila in a chain share `currentTaskId`

Query example:
```typescript
// Find all Eldila that worked on task X
const taskEldila = manager.list()
  .filter(r => r.state.currentTaskId === taskId);

// Reconstruct thread chain
const allThreads = taskEldila
  .flatMap(r => [
    r.state.threadChain?.rootThreadUrl,
    ...(r.state.threadChain?.previousThreadUrls ?? []),
    r.state.threadChain?.threadUrl
  ])
  .filter(Boolean);
```

## Limitations

### Tmux Workers

Context monitoring only works for direct-spawned workers (`useTmux: false`) because we need to parse stdout. For tmux-based workers:

- Consider `tmux pipe-pane` to capture output to a file
- Or use direct mode for tasks requiring auto-handoff

### Prompt Dependency

Handoff quality depends on the prompt template. The new Eldil must:
1. Understand it's a continuation
2. Read relevant context from previous threads
3. Avoid re-doing completed work

## Future Enhancements

1. **HandoffStore**: Persist structured handoff packages (summaries, TODOs) to disk/DB
2. **Interactive mode**: Use Amp's `--stream-json-input` for bidirectional control
3. **Cross-host handoffs**: Serialize handoff state for distributed orchestration
4. **Graceful threshold**: Trigger at 80%, stop at 85% for partial response completion

## Related

- [DESIGN.md](/DESIGN.md) - Overall Perelandra architecture
- [Amp Context Management Guide](https://ampcode.com/guides/context-management)
- [Amp Handoff Feature](https://ampcode.com/news/handoff)
