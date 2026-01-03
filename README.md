# Perelandra

> *"Out of the Silent Planet, into the Fields of Perelandra"*

**Perelandra** is a local developer productivity tool for orchestrating AI agents across multiple microservices. Built with **Bun + OpenTUI**, it coordinates "worker" agents across isolated git worktrees, providing a unified terminal UI, consistent logging, and durable task history via Beads.

## Features

- **Multi-service orchestration**: Coordinate work across microservices from a single control plane
- **Parallel AI workers**: Run multiple AI agents (Eldila) in parallel across isolated git worktrees (Fields)
- **First-class local dev integration**: Use existing `docker-compose` + `pnpm dev` workflows
- **Persistent, git-backed tasks**: Back tasks with Beads for reproducible, reviewable work history
- **Rich TUI**: Keyboard-centric, tmux-friendly interface via OpenTUI React
- **Amp-powered agents**: Use Amp for intelligent code work with oracle and librarian
- **Multi-model review**: Use OpenCode with alternate models for specialized review tasks

## Requirements

- [Bun](https://bun.sh) >= 1.0.0
- [Zig](https://ziglang.org/) (required for OpenTUI native builds)
- [tmux](https://github.com/tmux/tmux) (optional, for pane management)
- [Amp](https://ampcode.com) (for Eldil workers)
- [OpenCode](https://github.com/sst/opencode) (optional, for Sorn reviewer)
- [Beads](https://github.com/your-org/beads) (for task persistence)

## Installation

```bash
# Clone the repository
git clone https://github.com/wcole1-godaddy/perelandra.git
cd perelandra

# Install dependencies
bun install

# Link the CLI globally
bun link
```

## Quick Start

### 1. Initialize Configuration

Create a `.perelandra.yaml` in your project root:

```yaml
version: "1.0"
hnau:
  - id: app-registry-api
    description: Application Registry API
    root: services/app-registry-api
    devCommand: pnpm dev
    port: 3001
    healthCheck:
      url: http://localhost:3001/health
      intervalSeconds: 30

  - id: metrics-api
    description: Metrics API
    root: services/metrics-api
    devCommand: pnpm dev
    port: 3002
```

### 2. Start the TUI

```bash
perelandra start
```

### 3. Use CLI Commands

```bash
# List configured services
perelandra hnau list

# Create a new worktree for a feature
perelandra field create feature-auth --from-branch main

# Start an AI worker
perelandra eldil start --field feature-auth --prompt "Implement JWT auth"

# Review changes for backwards compatibility
perelandra sorn review --field feature-auth
```

## CLI Reference

### Global Commands

```bash
perelandra init              # Generate .perelandra.yaml
perelandra config validate   # Validate config
perelandra start             # Start Oyarsa + TUI
perelandra status            # Non-interactive summary
```

### Fields (Worktrees)

```bash
perelandra field list
perelandra field create <name> [--from-branch <branch>]
perelandra field delete <name> [--force]
perelandra field switch <name>
```

### Hnau (Services)

```bash
perelandra hnau list
perelandra hnau status [--field <name>]
perelandra hnau start <hnauId> [--field <name>]
perelandra hnau stop <hnauId> [--field <name>]
```

### Tasks (Beads)

```bash
perelandra task new <title> [--field <name>] [--priority P1|P2|P3]
perelandra task list [--field <name>] [--status <status>]
perelandra task show <id>
perelandra task set-status <id> <status>
perelandra task sync
```

### Eldila (AI Workers)

```bash
perelandra eldil list
perelandra eldil start --field <name> --prompt "task description"
perelandra eldil stop <eldilId>
perelandra eldil assign <eldilId> <taskId>
perelandra eldil outputs <eldilId>
```

### Sorn (Reviewer)

```bash
perelandra sorn review [--field <name>]
perelandra sorn review --task <taskId>
perelandra sorn config --model gpt-4.1
```

## Naming Conventions

Perelandra uses names from C.S. Lewis's Space Trilogy:

| Concept | Name | Description |
|---------|------|-------------|
| Orchestrator | **Oyarsa** | The main control process |
| Worker agent | **Eldil** | AI workers (Amp-powered) |
| Service | **Hnau** | Microservices being managed |
| Workspace | **Field** | Git worktrees for isolation |
| Reviewer | **Sorn** | Code review agent (OpenCode) |
| Human | **Ransom** | That's you! |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Ransom (Human)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Oyarsa (Orchestrator)                    │
│  • Parses .perelandra.yaml                                  │
│  • Manages Fields (worktrees) and Hnau (services)           │
│  • Spawns/supervises Eldila (workers)                       │
│  • Coordinates tmux sessions                                │
│  • Hosts OpenTUI React interface                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ spawns
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Eldil #1       │ │  Eldil #2       │ │  Eldil #3       │
│  (worktree A)   │ │  (worktree A)   │ │  (worktree B)   │
│  app-registry   │ │  metrics-api    │ │  router         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Development

```bash
# Run in development mode
bun run dev

# Type check
bun run typecheck

# Build
bun run build
```

## License

MIT

---

*"The Field of Arbol awaits."*
