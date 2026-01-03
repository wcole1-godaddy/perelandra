# Perelandra – AI Agent Orchestrator Design

> *"Out of the Silent Planet, into the Fields of Perelandra"*

## 1. Executive Summary

Perelandra is a local developer productivity tool for orchestrating AI agents across multiple microservices. Built with **Bun + OpenTUI**, it coordinates "worker" agents across isolated git worktrees, providing a unified terminal UI, consistent logging, and durable task history via Beads.

### Key Goals

- **Multi-service orchestration**: Coordinate work across microservices (app-registry-api, Traefik router, metrics API, post-action service) from a single control plane
- **Parallel AI workers**: Run multiple AI agents (Eldila) in parallel across isolated git worktrees (Fields)
- **First-class local dev integration**: Use existing `docker-compose` + `pnpm dev` workflows and `pino` JSON logging
- **Persistent, git-backed tasks**: Back tasks with Beads for reproducible, reviewable work history
- **Rich TUI**: Keyboard-centric, tmux-friendly interface via OpenTUI React
- **Amp-powered agents**: Use Amp's oracle and librarian for intelligent code work
- **Multi-model review**: Use OpenCode with alternate models for specialized review tasks

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Ransom (Human)                          │
│              "Fix auth bug across services"                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Oyarsa (Orchestrator)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Parses .perelandra.yaml                             │ │
│  │  • Manages Fields (worktrees) and Hnau (services)      │ │
│  │  • Spawns/supervises Eldila (workers)                  │ │
│  │  • Coordinates tmux sessions                           │ │
│  │  • Hosts OpenTUI React interface                       │ │
│  │  • Integrates with Beads for task persistence          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ spawns
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Eldil #1       │ │  Eldil #2       │ │  Eldil #3       │
│  (worktree A)   │ │  (worktree A)   │ │  (worktree B)   │
│  app-registry   │ │  metrics-api    │ │  router         │
│  tmux pane      │ │  tmux pane      │ │  tmux pane      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Beads (Task Persistence)                 │
│              Git-backed issue tracking + sync               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Maleldil (Log Aggregation)               │
│              logs/<field>/<hnau>.jsonl (pino JSON)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Naming Conventions (C.S. Lewis Space Trilogy)

| Concept              | Name                     | Origin / Notes                              |
|----------------------|--------------------------|---------------------------------------------|
| Orchestrator         | **Oyarsa**               | Planetary ruler; single control process     |
| Worker agent         | **Eldil** (pl. Eldila)   | Angelic being; AI worker                    |
| Service/microservice | **Hnau**                 | Rational creature; code/service             |
| Workspace/worktree   | **Field**                | Region of activity; git worktree            |
| Tool name            | **Perelandra**           | The whole system                            |
| Config file          | `.perelandra.yaml`       | Global + per-repo config                    |
| Environment profile  | **Handramit**            | Named environment slice (dev, stage, prod)  |
| Global settings      | **DeepHeaven**           | `~/.perelandra` global config               |
| Human operator       | **Ransom**               | The protagonist; you                        |
| Log aggregator       | **Maleldil**             | The voice of truth                          |
| Reviewer agent       | **Sorn**                 | The wise, analytical beings of Malacandra   |

### Naming Guidelines

- **Code symbols**: PascalCase (`Oyarsa`, `Eldil`, `HnauConfig`, `FieldState`)
- **Runtime IDs**: kebab-case (`eldil-1`, `app-registry-api`, `feature-branch`)
- **CLI**: Plain English for clarity (`perelandra field create`, not arcane names)

---

## 4. Agent Architecture

### Agent Tools & Models

| Role | Tool | Model | Purpose |
|------|------|-------|---------|
| **Eldil** (Worker) | **Amp** | Claude Opus 4.5 (smart) | Main coding agents with oracle/librarian |
| **Sorn** (Reviewer) | **OpenCode** | GPT-4.1 / O3 / configurable | Backwards compatibility review |
| **Oyarsa** | Perelandra (Bun) | N/A | Orchestrator, spawns agents |

### Why Amp for Eldila

- `--execute` and `--stream-json` for programmatic control
- **Oracle**: Planning, review, debugging assistance
- **Librarian**: Deep codebase understanding across repos
- Thread persistence and sharing
- MCP integration for custom tools
- AGENTS.md support for per-service context

### Why OpenCode for Sorn

- Access to models not in Amp (GPT-4.1, O3, Groq, etc.)
- `-p` flag for non-interactive prompts
- JSON output format (`-f json -q`)
- Good for specialized review with different model perspectives

### Integration Pattern

```typescript
// src/domain/eldil.ts - Spawn Amp worker
async function spawnEldil(field: string, task: string): Promise<void> {
  const cmd = `amp --execute '${task}' --stream-json`;
  await $`tmux send-keys -t perelandra:${field} "${cmd}" Enter`;
}

// src/domain/sorn.ts - Run OpenCode reviewer
async function runSornReview(diff: string): Promise<ReviewResult> {
  const prompt = `Review for backwards compatibility issues:
  
Check for:
- Breaking API changes (removed/renamed fields, changed types)
- Database migration issues
- Event schema changes
- Config format changes

Diff:
${diff}`;
  
  const result = await $`opencode -p "${prompt}" -f json -q`.json();
  return parseReviewResult(result);
}
```

---

## 5. Core Components

### 5.1 Oyarsa (Orchestrator Core)

**Responsibilities:**
- Load and validate `.perelandra.yaml`
- Resolve repo root and manage Fields (git worktrees)
- Initialize and maintain tmux session topology
- Start and supervise Eldila for tasks
- Maintain runtime state with disk snapshots
- Coordinate log streams to files and UI
- Provide programmatic API for CLI and UI

### 5.2 Eldil (Worker Agent) — Powered by Amp

**Responsibilities:**
- Represent a long-lived AI worker bound to `(Field, Hnau?)`
- Manage a Beads-backed task queue
- Interact with filesystem and git within its Field
- Execute commands via tmux panes or Bun child processes
- Generate logs stored in Beads and log files
- Use Amp's **oracle** for planning and review
- Use Amp's **librarian** for cross-repo understanding

### 5.3 Sorn (Reviewer Agent) — Powered by OpenCode

**Responsibilities:**
- Review all completed work for backwards compatibility
- Use a different model (GPT-4.1, O3, etc.) for diverse perspectives
- Check for breaking API changes, schema changes, migration issues
- Run automatically before work is marked complete
- Generate structured review reports

**Review Checklist:**
- Breaking API changes (removed/renamed fields, changed types)
- Database migration compatibility
- Event/message schema changes
- Configuration format changes
- Dependency version conflicts
- Public contract violations

### 5.4 Hnau Manager

**Responsibilities:**
- Track all configured Hnau from `.perelandra.yaml`
- For each `(Field, Hnau)`:
  - Compose `pnpm` or `docker-compose` commands
  - Allocate tmux panes for dev servers
  - Expose lifecycle: `start`, `stop`, `restart`, `status`
- Provide metadata to UI (health, port, status)

### 5.5 Field Manager (Worktree Manager)

**Responsibilities:**
- Map Field names to local worktree paths
- Create/delete/list Fields using `git worktree`
- Ensure per-Field directories contain:
  - Hnau roots
  - Beads task namespace
  - Log directories

### 5.6 Beads Integration Layer

**Responsibilities:**
- Thin wrapper around Beads CLI:
  - `createTask`, `updateTask`, `listTasks`, `getTaskHistory`
- Map Fields to separate Beads namespaces
- Attach metadata linking tasks to Hnau, Eldila, and commits

### 5.7 Logging Subsystem (Maleldil)

**Responsibilities:**
- Expose pino logger for Perelandra internals
- Configure log paths and rotation by Field and Hnau
- Tail log files and expose streams to UI
- Provide simple queries/filters for pino JSON logs

### 5.8 OpenTUI UI Layer

**Responsibilities:**
- Render main dashboard (Field selector, Hnau grid, tasks, logs)
- Handle keyboard navigation and command palette
- Dispatch commands to Oyarsa via internal API

### 5.9 CLI Entrypoint

**Responsibilities:**
- Parse CLI arguments
- Delegate to Oyarsa APIs (non-interactive) or start TUI (interactive)
- Ensure commands work without tmux where possible

---

## 6. Data Models (TypeScript)

### Configuration Types

```typescript
// src/types/config.ts
export type HandramitName = 'dev' | 'stage' | 'prod' | string;

export interface HnauConfig {
  id: string;                      // 'app-registry-api'
  description?: string;
  root: string;                    // relative to Field root
  devCommand: string;              // 'pnpm dev'
  dockerComposeService?: string;
  env?: Record<string, string>;
  logFiles?: string[];             // ['logs/dev.log']
  port?: number;
  healthCheck?: {
    url: string;
    intervalSeconds?: number;
    timeoutMs?: number;
  };
}

export interface FieldConfig {
  name: string;
  baseBranch?: string;
  branch?: string;
  path?: string;                   // override auto-calculated path
}

export interface PerelandraConfig {
  version: string;
  repoRoot?: string;
  defaultHandramit?: HandramitName;
  handramits?: Record<HandramitName, {
    description?: string;
    hnauEnabled?: string[];
  }>;
  hnau: HnauConfig[];
  fields?: FieldConfig[];
  dockerComposeFile?: string;
  logs?: {
    root?: string;
    maxSizeMb?: number;
    maxFiles?: number;
  };
  beads?: {
    root?: string;
  };
}
```

### Runtime State Types

```typescript
// src/types/runtime.ts
export type EldilStatus = 'idle' | 'running' | 'blocked' | 'error' | 'completed';

export interface EldilState {
  id: string;
  fieldName: string;
  hnauId?: string;
  currentTaskId?: string;
  status: EldilStatus;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface FieldState {
  name: string;
  path: string;
  branch: string;
  baseBranch?: string;
  hnauStatuses: Record<string, {
    running: boolean;
    lastHealthCheck?: string;
    healthy?: boolean;
  }>;
  activeEldila: string[];
}

export interface OyarsaState {
  activeField: string;
  fields: Record<string, FieldState>;
  eldila: Record<string, EldilState>;
}
```

### Beads Task Types

```typescript
// src/types/beads.ts
export interface BeadsTaskMetadata {
  id: string;
  title: string;
  description?: string;
  fieldName: string;
  hnauId?: string;
  createdBy: 'human' | 'eldil';
  createdAt: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  relatedCommits?: string[];
  labels?: string[];
}
```

---

## 7. Service Configuration Schema

### `.perelandra.yaml` Example

```yaml
version: "1"
repoRoot: "."
dockerComposeFile: "docker-compose.yml"

logs:
  root: "logs"
  maxSizeMb: 50
  maxFiles: 5

beads:
  root: ".beads"

hnau:
  - id: "app-registry-api"
    description: "3P app registration and management API"
    root: "services/app-registry-api"
    devCommand: "pnpm dev"
    env:
      NODE_ENV: "development"
    logFiles:
      - "logs/app-registry-dev.log"
    port: 4000
    healthCheck:
      url: "http://localhost:4000/health"
      intervalSeconds: 10

  - id: "router"
    description: "Traefik router configuration"
    root: "infra/router"
    devCommand: "docker-compose up traefik"
    dockerComposeService: "traefik"
    logFiles:
      - "logs/traefik.log"

  - id: "metrics-api"
    description: "Metrics and telemetry API"
    root: "services/metrics-api"
    devCommand: "pnpm dev"
    logFiles:
      - "logs/metrics-dev.log"
    port: 4100

  - id: "post-action-service"
    description: "Post-action event processing service"
    root: "services/post-action-service"
    devCommand: "pnpm dev"
    logFiles:
      - "logs/post-action-dev.log"
    port: 4200

fields:
  - name: "baseline"
    baseBranch: "main"
    branch: "baseline/perelandra"
  - name: "router-spike"
    baseBranch: "main"
    branch: "spike/router-ai-refactor"

handramits:
  dev:
    hnauEnabled:
      - "app-registry-api"
      - "router"
      - "metrics-api"
      - "post-action-service"
```

---

## 8. Tmux Session Management

### Strategy

- **Session name**: `perelandra` (or `perelandra-{repoName}` for multi-repo)
- **Windows**:
  - `0: oyarsa` – Orchestrator and TUI
  - `1..N: field-{fieldName}` – One window per Field
- **Field window panes**:
  - `pane 0`: Field shell (root at Field path)
  - `pane 1..N`: One per enabled Hnau (`devCommand`)

### Tmux Commands

```bash
# Create session
tmux new-session -d -s perelandra -n oyarsa

# Create Field window
tmux new-window -t perelandra -n "field-baseline"

# Split for Hnau
tmux split-window -t perelandra:field-baseline -h
tmux send-keys -t perelandra:field-baseline.1 "cd services/app-registry-api && pnpm dev" Enter

# Attach
perelandra tmux attach  # → tmux attach -t perelandra
```

---

## 9. Beads Integration

### Namespace Strategy

- Directory layout: `<beadsRoot>/<fieldName>/...`
- Each task is a bead with `BeadsTaskMetadata`

### Task Lifecycle

1. `perelandra task new` → creates bead via Beads CLI
2. Eldil picks tasks from Beads (by status/labels)
3. On progress, Eldil appends to bead (AI reasoning, logs, diffs)
4. On completion, updates status and attaches commit hashes

### Integration API

```typescript
// src/domain/beads.ts
export async function createTask(meta: Partial<BeadsTaskMetadata>): Promise<BeadsTaskMetadata>
export async function updateTask(id: string, patch: Partial<BeadsTaskMetadata>): Promise<void>
export async function listTasks(filter: TaskFilter): Promise<BeadsTaskMetadata[]>
export async function getTaskStream(id: string): AsyncIterable<string>
```

---

## 10. Worktree Management (Fields)

### Storage Convention

Fields live under `<repoRoot>/fields/<fieldName>`

### Operations

```bash
# Create Field
git worktree add fields/feature-auth feature/auth-refactor

# Delete Field
git worktree remove fields/feature-auth

# List Fields
git worktree list
```

### Field Directory Structure

```
fields/
  feature-auth/
    .beads/              # Field-specific beads namespace
    logs/                # Field-specific logs
    services/            # Hnau roots (symlinked or copied)
    .perelandra.local.yaml  # Optional overrides
```

---

## 11. Log Aggregation (Maleldil)

### Strategy

1. **Perelandra logs**: `pino` → `logs/perelandra-oyarsa.log`
2. **Hnau logs**: Each Hnau writes pino JSON to configured `logFiles[]`
3. **Aggregation**: Oyarsa tails log files, streams to UI
4. **Layout**:
   ```
   logs/
     perelandra-oyarsa.log
     fields/
       baseline/
         app-registry-api.log
         metrics-api.log
       feature-auth/
         app-registry-api.log
   ```

### Pino Configuration

```typescript
import pino from 'pino';

export const logger = pino({
  level: 'info',
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 'logs/perelandra-oyarsa.log' } },
      { target: 'pino-pretty', options: { colorize: true } }
    ]
  }
});
```

---

## 12. UI Components (OpenTUI React)

### Component Hierarchy

```
<PerelandraApp>
  <RootLayout>
    <FieldHeaderBar />           # Active Field, branch, shortcuts
    <Box flexDirection="row">
      <HnauStatusGrid />         # Left: service status grid
      <TaskAndEldilPane>         # Right: tasks + workers
        <TaskList />
        <EldilStatusList />
      </TaskAndEldilPane>
    </Box>
    <LogViewer />                # Bottom: streaming logs
    <StatusBar />                # Footer: tmux, errors, hints
  </RootLayout>
  <CommandPalette />             # Ctrl+P fuzzy command search
  <FieldSwitcherModal />         # Quick Field switching
</PerelandraApp>
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `FieldHeaderBar` | Shows active Field, branch, keyboard hints |
| `HnauStatusGrid` | Table of Hnau with status, port, health |
| `TaskList` | Beads tasks for active Field |
| `EldilStatusList` | Active workers with status and current task |
| `LogViewer` | Scrollable log stream with filters |
| `CommandPalette` | Fuzzy search over all commands |
| `StatusBar` | Session info, error indicators |

---

## 13. CLI Commands

### Global

```bash
perelandra init              # Generate .perelandra.yaml
perelandra config validate   # Validate config
perelandra start             # Start Oyarsa + TUI
perelandra status            # Non-interactive summary
```

### Fields

```bash
perelandra field list
perelandra field create <name> [--from-branch <branch>]
perelandra field delete <name> [--force]
perelandra field switch <name>
```

### Hnau

```bash
perelandra hnau list
perelandra hnau status [--field <name>]
perelandra hnau start <hnauId> [--field <name>]
perelandra hnau stop <hnauId> [--field <name>]
```

### Tasks (Beads)

```bash
perelandra task new [--field <name>] [--hnau <id>]
perelandra task list [--field <name>] [--status <status>]
perelandra task show <id>
perelandra task set-status <id> <status>
perelandra task sync
```

### Eldila

```bash
perelandra eldil list
perelandra eldil start [--field <name>] [--hnau <id>]
perelandra eldil stop <eldilId>
perelandra eldil assign <eldilId> <taskId>
```

### Sorn (Review)

```bash
perelandra sorn review [--field <name>]     # Review current changes
perelandra sorn review <taskId>             # Review specific task
perelandra sorn config                       # Show/edit Sorn model config
perelandra sorn history                      # Show past reviews
```

### Logs & Tmux

```bash
perelandra logs tail [--field <name>] [--hnau <id>]
perelandra tmux attach
perelandra tmux layout repair
```

---

## 14. Implementation Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| **1** | Core skeleton & config validation | 0.5–1.5 days |
| **2** | Worktree + Hnau management (no tmux) | 1–2 days |
| **3** | Tmux integration | 1–2 days |
| **4** | Beads integration | 1–2 days |
| **5** | OpenTUI UI | 2–4 days |
| **6** | Eldila & parallelism | 2–3 days |
| **7** | Polish & observability | 1–2 days |

**Total estimated: 9–16 days**

---

## 15. Project Structure

```
perelandra/
├── bin/
│   └── perelandra           # Shell shim → bun run src/cli/index.ts
├── src/
│   ├── cli/
│   │   ├── index.ts         # CLI entrypoint
│   │   └── commands/
│   │       ├── start.ts
│   │       ├── init.ts
│   │       ├── status.ts
│   │       ├── field.ts
│   │       ├── hnau.ts
│   │       ├── task.ts
│   │       ├── eldil.ts
│   │       ├── logs.ts
│   │       └── tmux.ts
│   ├── core/
│   │   ├── oyarsa.ts        # Orchestrator core
│   │   ├── config.ts        # Load/validate .perelandra.yaml
│   │   └── state.ts         # OyarsaState management
│   ├── domain/
│   │   ├── hnau.ts          # Hnau manager
│   │   ├── field.ts         # Field/worktree manager
│   │   ├── eldil.ts         # Eldil management (Amp integration)
│   │   ├── sorn.ts          # Sorn reviewer (OpenCode integration)
│   │   ├── beads.ts         # Beads integration
│   │   ├── logs.ts          # Log registry/tailing
│   │   ├── git.ts           # Git utilities
│   │   └── tmux.ts          # Tmux command helpers
│   ├── ui/
│   │   ├── index.tsx        # OpenTUI entrypoint
│   │   └── components/
│   │       ├── PerelandraApp.tsx
│   │       ├── layout/
│   │       │   ├── RootLayout.tsx
│   │       │   ├── FieldHeaderBar.tsx
│   │       │   └── StatusBar.tsx
│   │       ├── fields/
│   │       │   └── FieldSwitcher.tsx
│   │       ├── hnau/
│   │       │   └── HnauStatusGrid.tsx
│   │       ├── tasks/
│   │       │   ├── TaskList.tsx
│   │       │   └── TaskDetail.tsx
│   │       ├── eldila/
│   │       │   ├── EldilStatusList.tsx
│   │       │   └── EldilDetail.tsx
│   │       ├── logs/
│   │       │   └── LogViewer.tsx
│   │       └── common/
│   │           ├── CommandPalette.tsx
│   │           ├── Modal.tsx
│   │           └── Toasts.tsx
│   ├── types/
│   │   ├── config.ts
│   │   ├── runtime.ts
│   │   ├── beads.ts
│   │   ├── hnau.ts
│   │   └── eldil.ts
│   ├── logging/
│   │   └── pino.ts          # Pino configuration
│   └── util/
│       ├── fs.ts
│       ├── exec.ts
│       ├── env.ts
│       └── errors.ts
├── config/
│   └── perelandra.sample.yaml
├── logs/                    # Default log root (gitignored)
├── fields/                  # Worktree roots (gitignored)
├── .perelandra.yaml         # Project config
├── package.json
├── bunfig.toml
├── tsconfig.json
└── README.md
```

---

## 16. Risks & Guardrails

| Risk | Guardrail |
|------|-----------|
| Tmux missing/misconfigured | Auto-detect; provide helpful errors; degraded mode |
| High log volume | Limit in-memory buffers; size-based rotation |
| Beads complexity | Keep CLI/UI explicit; use familiar "task" terminology |
| Config drift | `perelandra init` + `config validate`; CI hooks |
| Concurrency conflicts | One Eldil per task; one Field per feature branch |

---

## 17. Future Considerations

- **Remote orchestration**: Client-server model for multi-machine coordination
- **Centralized logging**: Optional integration with ELK/Loki
- **AI strategy plugins**: Different Eldil behaviors (refactor, diagnostics, experiments)
- **Schema CLI**: Extract OpenAPI/GraphQL models from spec repo

---

*"The Field of Arbol awaits."*
