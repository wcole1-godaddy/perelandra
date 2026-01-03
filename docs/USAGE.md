# Perelandra Usage Guide

> Complete guide to using the Perelandra AI orchestrator for multi-service development.

## Table of Contents

- [Mental Model](#mental-model)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Core Concepts](#core-concepts)
- [CLI Reference](#cli-reference)
- [TUI (Terminal UI)](#tui-terminal-ui)
- [Workflows](#workflows)
- [Troubleshooting](#troubleshooting)

---

## Mental Model

Perelandra coordinates AI-powered development across multiple microservices. Think of it as a control plane:

```
                    ┌─────────────────────────────────────┐
                    │           Oyarsa (Brain)            │
                    │   Central orchestrator managing:    │
                    │   • State persistence               │
                    │   • Event coordination              │
                    │   • Lifecycle management            │
                    └────────────────┬────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐          ┌─────────────────┐          ┌─────────────────┐
│    Fields     │          │      Hnau       │          │     Eldila      │
│  (Worktrees)  │          │   (Services)    │          │  (AI Workers)   │
│               │          │                 │          │                 │
│ Isolated git  │          │ Your dev        │          │ Amp instances   │
│ branches for  │          │ servers:        │          │ doing actual    │
│ parallel work │          │ pnpm, docker    │          │ coding work     │
└───────────────┘          └─────────────────┘          └────────┬────────┘
                                                                 │
                                                                 ▼
                                                        ┌─────────────────┐
                                                        │      Sorn       │
                                                        │   (Reviewer)    │
                                                        │                 │
                                                        │ OpenCode-based  │
                                                        │ code review     │
                                                        └─────────────────┘
```

### Naming (C.S. Lewis Space Trilogy)

The naming conventions in Perelandra are drawn from C.S. Lewis's *Space Trilogy* (also called the *Cosmic Trilogy* or *Ransom Trilogy*), consisting of *Out of the Silent Planet* (1938), *Perelandra* (1943), and *That Hideous Strength* (1945). The trilogy follows Dr. Elwin Ransom, a philologist who travels to Mars and Venus and discovers a cosmos alive with spiritual beings and meaning.

Lewis envisioned a universe where planets are governed by great spiritual intelligences, served by lesser beings, and where humanity plays a unique role. This maps naturally to an orchestration system where a central intelligence coordinates workers, services run in the background, and human operators guide the whole.

> *"A world, a life, a moment of time—these are things of a different nature from points and lines and plane surfaces."*
> — C.S. Lewis, *Perelandra*

| Name | Role | Real-World Equivalent | Trilogy Origin |
|------|------|----------------------|----------------|
| **Oyarsa** | Central orchestrator | Process manager / control plane | The ruling angelic intelligence (eldil) of a planet. Each world has its Oyarsa who governs and coordinates all within its sphere. |
| **Eldil** (pl. Eldila) | AI worker agent | Amp or OpenCode session | Spiritual beings—swift, intelligent messengers and workers who carry out the will of the Oyarsa across the cosmos. |
| **Hnau** | Background service | Dev server, docker-compose, etc. | The Old Solar word for "rational creature"—beings with soul and purpose. Hnau are the living inhabitants that make a world function. |
| **Field** | Isolated workspace | Git worktree | The "Field of Arbol" refers to the solar system as a living space. Here, a Field is an isolated working environment. |
| **Sorn** | Code reviewer | OpenCode with review prompts | Tall, intellectual creatures of Malacandra (Mars) devoted to knowledge, philosophy, and careful analysis. |
| **Maleldil** | Log system | Log aggregation / rotation | The supreme being—"Maleldil the Young"—who knows all and sees all. The logs record everything that transpires. |
| **DeepHeaven** | Global config | `~/.perelandra/config.yaml` | "Deep Heaven" is Lewis's term for outer space—the vast realm beyond any single world, where universal truths apply. |
| **Ransom** | Human operator | You! | Dr. Elwin Ransom, the protagonist—a human who bridges worlds and guides events through understanding and will. |

> *"The love of knowledge is a kind of madness."*
> — C.S. Lewis, *Out of the Silent Planet*

---

## Prerequisites

### Required

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Bun** ≥1.0 | Runtime | `curl -fsSL https://bun.sh/install \| bash` |
| **Amp** | AI workers | [ampcode.com](https://ampcode.com) |
| **Beads** (`bd`) | Task management | Project-local or global install |

### Recommended

| Tool | Purpose | Installation |
|------|---------|--------------|
| **tmux** | Pane management | `brew install tmux` / `apt install tmux` |
| **OpenCode** | Sorn reviewer | [github.com/sst/opencode](https://github.com/sst/opencode) |

### Verify Installation

```bash
# Check all dependencies
which bun amp bd tmux opencode

# Or use perelandra's built-in check
perelandra status
```

---

## Getting Started

### 1. Install Perelandra

```bash
git clone https://github.com/wcole1-godaddy/perelandra.git
cd perelandra
bun install
bun link
```

### 2. Initialize Your Project

Navigate to your project root and create a configuration:

```bash
cd /path/to/your/project
perelandra init
```

This creates `.perelandra.yaml`. Edit it to match your services.

### 3. Validate Configuration

```bash
perelandra config validate
```

### 4. Start Perelandra

```bash
perelandra start
```

This launches Oyarsa + the TUI. You'll see:
- Field status (your worktrees)
- Hnau grid (your services)
- Task list (from Beads)
- Log viewer

---

## Configuration

### Project Config: `.perelandra.yaml`

This is the per-project configuration file. Place it in your repo root.

```yaml
version: "1.0"

# Logs configuration
logs:
  root: logs              # Relative to repo root
  maxSizeMb: 50          # Rotate when file exceeds this size
  maxFiles: 5            # Keep this many rotated files

# Beads (task management) configuration
beads:
  root: .beads           # Where Beads stores task data

# Services (Hnau) - your microservices
hnau:
  - id: app-registry-api
    description: Application Registry API
    root: services/app-registry-api    # Path relative to repo root
    devCommand: pnpm dev               # Command to start dev server
    port: 3001
    healthCheck:
      url: http://localhost:3001/health
      intervalSeconds: 30
      timeoutMs: 5000

  - id: metrics-api
    description: Metrics API
    root: services/metrics-api
    devCommand: pnpm dev
    port: 3002

  - id: router
    description: Traefik router
    root: infra/router
    devCommand: docker-compose up traefik
    dockerComposeService: traefik
    port: 80

# Preconfigured Fields (worktrees) - optional
fields:
  - name: feature-auth
    baseBranch: main
    branch: feature/authentication
  - name: bugfix-metrics
    baseBranch: main

# Environment profiles (Handramits)
handramits:
  dev:
    description: Local development
    hnauEnabled:
      - app-registry-api
      - metrics-api
  stage:
    description: Staging environment
    hnauEnabled:
      - router
      - app-registry-api
      - metrics-api
```

### Global Config: DeepHeaven

User-level defaults stored at `~/.perelandra/config.yaml`.

```bash
# Initialize global config
perelandra config global --init

# View current settings
perelandra config global --show

# Set values
perelandra config global --set sorn.model=gpt-4.1
perelandra config global --set eldil.maxWorkersPerField=3
perelandra config global --set eldil.maxTotalWorkers=10
perelandra config global --set tmux.sessionName=my-project
```

Available global settings:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sorn.model` | string | - | OpenCode model for Sorn reviews |
| `sorn.timeout` | number | 120000 | Review timeout in ms |
| `eldil.maxWorkersPerField` | number | 2 | Max Eldila per Field |
| `eldil.maxTotalWorkers` | number | 5 | Max total Eldila |
| `tmux.sessionName` | string | `perelandra` | Tmux session name |

---

## Core Concepts

### Fields (Git Worktrees)

Fields are isolated workspaces backed by git worktrees. Each Field has:
- Its own branch
- Its own working directory
- Independent Hnau instances
- Dedicated Eldila workers

```bash
# List all Fields
perelandra field list

# Create a new Field
perelandra field create feature-auth --from-branch main

# Switch active Field (for context in TUI/CLI)
perelandra field switch feature-auth

# Delete a Field (removes worktree)
perelandra field delete feature-auth
perelandra field delete feature-auth --force  # Skip uncommitted check
```

The `main` Field always exists (your main worktree). Additional Fields live in `./fields/<name>/` by default.

### Hnau (Services)

Hnau are the background services your project needs: dev servers, databases, routers.

```bash
# List configured Hnau
perelandra hnau list

# Check status
perelandra hnau status
perelandra hnau status --field feature-auth

# Start a service
perelandra hnau start app-registry-api
perelandra hnau start app-registry-api --field feature-auth

# Stop a service
perelandra hnau stop app-registry-api

# Restart
perelandra hnau restart app-registry-api
```

**How Hnau Run:**
- With tmux: Commands run in dedicated panes within Field windows
- Without tmux: Commands run as background processes with logs written to files

**Health Checks:**
If configured, Perelandra periodically polls `healthCheck.url` and tracks status.

### Eldila (AI Workers)

Eldila are AI agents (Amp or OpenCode) that do actual coding work.

```bash
# List active Eldila
perelandra eldil list

# Spawn a new Eldil
perelandra eldil start --field feature-auth --prompt "Implement JWT authentication"

# Spawn with a specific tool
perelandra eldil start --field main --tool opencode --prompt "Review error handling"

# Stop an Eldil
perelandra eldil stop eldil-1

# Assign a task to an Eldil
perelandra eldil assign eldil-1 task-123
```

**Concurrency:**
- Eldila are queued if you exceed `maxWorkersPerField` or `maxTotalWorkers`
- Configure limits in DeepHeaven global config

**Context Handoff:**
When an Eldil nears its context window limit, Perelandra automatically:
1. Summarizes the work done
2. Spawns a new Eldil with the handoff context
3. Links the thread chain for continuity

### Tasks (Beads Integration)

Tasks are managed by Beads (`bd`) and integrate with the Eldil workflow.

```bash
# Create a new task
perelandra task new "Implement user authentication" --field feature-auth --priority P1

# List tasks
perelandra task list
perelandra task list --field feature-auth
perelandra task list --status in-progress

# View task details
perelandra task show perelandra-abc123

# Update task status
perelandra task set-status perelandra-abc123 in-progress

# Sync with git
perelandra task sync
```

**Task Lifecycle:**
```
todo → in-progress → [Eldil works] → Sorn review → done
                                  ↘ blocked (if issues)
```

### Sorn (Code Reviewer)

Sorn uses OpenCode to review code changes before completing tasks.

```bash
# Review current changes in active Field
perelandra sorn review

# Review a specific Field
perelandra sorn review --field feature-auth

# Review changes for a specific task
perelandra sorn review --task perelandra-abc123

# Configure Sorn
perelandra sorn config --model gpt-4.1

# View review history
perelandra sorn history
```

**Review Checklist:**
Sorn checks for:
- Breaking API changes
- Migration requirements
- Schema changes
- Security issues
- Performance concerns
- Documentation needs

**Blocking vs Non-Blocking:**
- Critical issues block task completion
- Non-critical issues are logged but don't block

---

## CLI Reference

### Global Commands

| Command | Description |
|---------|-------------|
| `perelandra init` | Create `.perelandra.yaml` |
| `perelandra config validate` | Validate configuration |
| `perelandra config global` | Manage DeepHeaven global config |
| `perelandra start` | Launch Oyarsa + TUI |
| `perelandra status` | Non-interactive status summary |

### Field Commands

| Command | Description |
|---------|-------------|
| `perelandra field list` | List all Fields |
| `perelandra field create <name>` | Create a new Field |
| `perelandra field delete <name>` | Delete a Field |
| `perelandra field switch <name>` | Switch active Field |

### Hnau Commands

| Command | Description |
|---------|-------------|
| `perelandra hnau list` | List configured Hnau |
| `perelandra hnau status` | Show Hnau status |
| `perelandra hnau start <id>` | Start a service |
| `perelandra hnau stop <id>` | Stop a service |
| `perelandra hnau restart <id>` | Restart a service |

### Task Commands

| Command | Description |
|---------|-------------|
| `perelandra task new <title>` | Create a task |
| `perelandra task list` | List tasks |
| `perelandra task show <id>` | Show task details |
| `perelandra task set-status <id> <status>` | Update status |
| `perelandra task sync` | Sync with git |

### Eldil Commands

| Command | Description |
|---------|-------------|
| `perelandra eldil list` | List active Eldila |
| `perelandra eldil start` | Spawn an Eldil |
| `perelandra eldil stop <id>` | Stop an Eldil |
| `perelandra eldil assign <id> <taskId>` | Assign task |
| `perelandra eldil outputs <id>` | View Eldil output |

### Sorn Commands

| Command | Description |
|---------|-------------|
| `perelandra sorn review` | Review current changes |
| `perelandra sorn config` | Configure Sorn |
| `perelandra sorn history` | View review history |

### Log Commands

| Command | Description |
|---------|-------------|
| `perelandra logs tail` | Tail log file |
| `perelandra logs query` | Search logs |
| `perelandra logs stats` | Log statistics |
| `perelandra logs rotate` | Rotate logs |
| `perelandra logs list` | List log files |

### Tmux Commands

| Command | Description |
|---------|-------------|
| `perelandra tmux attach` | Attach to tmux session |
| `perelandra tmux layout repair` | Repair tmux layout |

---

## TUI (Terminal UI)

### Launching

```bash
perelandra start
```

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Field: main (branch: main)                          [Ctrl+P] ⌘ │
├─────────────────────────────────────────────────────────────────┤
│ HNAU                           │ TASKS                         │
│ ● app-registry-api  :3001      │ ○ Implement auth [P1]         │
│ ● metrics-api       :3002      │ ● Fix metrics bug [P2]        │
│ ○ router            :80        │ ○ Add logging [P3]            │
├─────────────────────────────────────────────────────────────────┤
│ ELDILA                         │ LOGS                          │
│ eldil-1 [running] auth task    │ [14:32:01] Started eldil-1    │
│ eldil-2 [running] metrics      │ [14:32:05] Hnau started       │
│                                │ [14:32:10] Task claimed       │
├─────────────────────────────────────────────────────────────────┤
│ Status: Ready                                         tmux: ✓  │
└─────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+P` | Open Command Palette |
| `Escape` | Close dialogs/palette |
| `q` | Quit Perelandra |
| `Tab` | Navigate between panels |
| `Enter` | Select/confirm |
| `↑/↓` | Navigate lists |

### Command Palette

Press `Ctrl+P` to access:
- **Switch Field** - Change active Field
- **New Task** - Create a task
- **Spawn Eldil** - Start an AI worker
- **Sync Tasks** - Refresh from Beads
- **Refresh** - Reload all state
- **Theme** - Change color theme
- **Quit** - Exit Perelandra

### Dialogs

**New Eldil Dialog:**
- Select tool (Amp or OpenCode)
- Enter prompt
- Optionally attach to existing task

**Task Detail Dialog:**
- View task metadata
- Change status
- See associated Eldila

**Eldil Detail Dialog:**
- View Eldil status and outputs
- Stop running Eldil
- See thread chain (for handoffs)

---

## Workflows

### Workflow 1: Start Development Session

```bash
# 1. Start Perelandra
perelandra start

# 2. (In TUI) Start needed Hnau services
#    Click on Hnau or use Ctrl+P → "Start Hnau"

# 3. (In TUI) Review tasks with Ctrl+P → "Sync Tasks"
```

### Workflow 2: Work on a Feature

```bash
# 1. Create a Field for the feature
perelandra field create feature-auth --from-branch main

# 2. Switch to it
perelandra field switch feature-auth

# 3. Create a task
perelandra task new "Implement JWT authentication" --priority P1

# 4. Spawn an Eldil to work on it
perelandra eldil start --field feature-auth --prompt "Implement JWT authentication for the API"

# 5. Monitor in TUI (perelandra start)
```

### Workflow 3: Review and Complete

```bash
# 1. When Eldil completes, Sorn reviews automatically

# 2. If blocked, check the issues:
perelandra sorn history

# 3. Fix issues and re-review:
perelandra sorn review --field feature-auth

# 4. Complete the task:
perelandra task set-status perelandra-abc123 done
```

### Workflow 4: Parallel Development

```bash
# Create multiple Fields for parallel work
perelandra field create feature-auth
perelandra field create feature-metrics
perelandra field create bugfix-api

# Spawn Eldila in each (respects concurrency limits)
perelandra eldil start --field feature-auth --prompt "Implement auth"
perelandra eldil start --field feature-metrics --prompt "Add metrics"
perelandra eldil start --field bugfix-api --prompt "Fix API bug"

# Monitor all in TUI
perelandra start
```

---

## Troubleshooting

### Configuration Issues

**"Configuration is invalid"**
```bash
# Check what's wrong
perelandra config validate

# Common fixes:
# - Ensure hnau.root paths exist
# - Check YAML syntax
# - Verify port numbers are integers
```

### Tmux Issues

**"tmux not available"**
- Install tmux: `brew install tmux` or `apt install tmux`
- Perelandra works without tmux (degraded mode), but pane management won't work

**"Already inside tmux session"**
```bash
# Switch instead of attach
tmux switch-client -t perelandra
```

### Eldil Issues

**"Eldil spawn failed"**
- Check that `amp` is installed and in PATH
- Verify the Field path exists
- Check concurrency limits in DeepHeaven

**"Context limit reached"**
- This is normal - Perelandra handles automatic handoff
- Check thread chain in Eldil detail view

### Hnau Issues

**"Service won't start"**
```bash
# Check logs
perelandra logs tail --hnau app-registry-api

# Verify the devCommand works manually
cd services/app-registry-api && pnpm dev
```

**"Health check failing"**
- Verify the health check URL is correct
- Check if the service is actually running
- Look for port conflicts

### State Issues

**"State seems corrupted"**
```bash
# Perelandra auto-backs up corrupted state
# Check for backup files
ls -la .perelandra-state.json*

# If needed, remove state to reset
rm .perelandra-state.json
```

### Getting Help

```bash
# Check overall status
perelandra status

# View logs
perelandra logs tail --follow

# Query specific logs
perelandra logs query --level error --limit 50
```

---

## Best Practices

1. **Use Fields for isolation** - Create a Field per feature/bugfix to avoid conflicts

2. **Configure health checks** - Helps monitor Hnau automatically

3. **Set reasonable concurrency** - Don't spawn too many Eldila; quality over quantity

4. **Let Sorn review** - Don't skip reviews; they catch real issues

5. **Use tasks** - Track work in Beads for history and reproducibility

6. **Commit often** - Eldila work in your git repo; commit their changes

7. **Check logs** - When things go wrong, logs have the answers

---

*"The Field of Arbol awaits."*
