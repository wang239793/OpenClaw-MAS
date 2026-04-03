# OpenClaw MAS — Architecture

## Overview

OpenClaw MAS integrates [Everything Claude Code (ECC)](https://github.com/anthropics/everything-claude-code) into [OpenClaw](https://github.com/openclaw/openclaw), making ECC's full suite of development workflows available through any messaging channel (Telegram, WhatsApp, Discord, etc.).

The core design principle: **Skills as the user interface.** Instead of a routing layer that guesses intent, users invoke workflows directly via `/skill <name>`.

---

## How It Works

```
User: /skill tdd implement login with JWT auth
         ↓
OpenClaw recognizes /skill built-in command
         ↓
Looks up ~/.openclaw/skills/tdd/SKILL.md
         ↓
main agent reads SKILL.md and follows the workflow
         ↓
  ├─ Simple workflow → main agent executes directly
  └─ Expert needed  → sessions_spawn specialist agent
                              ↓ announce (async)
                      main agent returns result to user
```

---

## Skill Types

Skills are generated from ECC commands during installation. There are two kinds:

### Type A — Specialist Agent Skills (~33 skills)

These workflows delegate to a dedicated expert agent via `sessions_spawn`.

| Skill | Agent |
|-------|-------|
| `tdd` | tdd-guide |
| `e2e` | e2e-runner |
| `plan` | planner |
| `code_review` | code-reviewer |
| `rust_review` | rust-reviewer |
| `cpp_build` | cpp-build-resolver |
| `go_review` | go-reviewer |
| `security_scan` | security-reviewer |
| `db_review` | database-reviewer |
| `gan_build` | gan-planner → gan-generator → gan-evaluator |
| ... | (see `install-ecc.sh` for full mapping) |

### Type B — Direct Execution Skills (~35 skills)

These workflows run directly in the main agent without spawning a subagent.

Examples: `build_fix`, `save_session`, `resume_session`, `checkpoint`, `learn`, `skill_create`, `orchestrate`, `prp_prd`, `devfleet`, ...

---

## Multi-Agent Execution

`sessions_spawn` is non-blocking. The subagent completes and sends an `announce` message back to the calling agent as a new conversation turn.

```
main agent
    │
    ├─ sessions_spawn("tdd-guide", task)   ← non-blocking
    │
    │  ... (tdd-guide runs independently)
    │
    ◄─ announce from tdd-guide             ← new message turn
    │
    └─ returns result to user
```

For multi-agent pipelines (e.g. `gan_build`), spawns must be **serial** — each step waits for the previous `announce` before proceeding:

```
spawn gan-planner → wait announce → spawn gan-generator → wait announce → spawn gan-evaluator
```

### Spawn Depth

`maxSpawnDepth: 2` is required for multi-agent pipelines:

- Depth 1: main agent → specialist agent (most skills)
- Depth 2: main agent → orchestrator → worker agents (GAN loops)

---

## Skill Loading

OpenClaw injects a compact XML summary of each skill into the system prompt:

```xml
<skill>
  <name>tdd</name>
  <description>TDD workflow: scaffold → RED → GREEN → REFACTOR → 80%+ coverage.</description>
  <location>/Users/xxx/.openclaw/skills/tdd/SKILL.md</location>
</skill>
```

The full SKILL.md body is **not** pre-loaded — the agent reads it on demand using the `read` tool. This keeps the base system prompt lean (~50 tokens per skill).

All skills live in `~/.openclaw/skills/` (shared directory), visible to all agents. No per-agent distribution needed.

---

## Agent Workspace Structure

Each specialist agent has its own workspace:

```
~/.openclaw/workspace-tdd-guide/
├── AGENTS.md      ← role definition and workflow (loaded by subagents)
├── TOOLS.md       ← available tools
├── SOUL.md        ← general personality (NOT loaded by subagents)
├── IDENTITY.md    ← role anchor (NOT loaded by subagents)
├── USER.md        ← collaboration notes (NOT loaded by subagents)
└── HEARTBEAT.md   ← periodic tasks (NOT loaded by subagents)
```

**Important**: Subagents only load `AGENTS.md` and `TOOLS.md`. All workflow instructions must be in `AGENTS.md`, not `SOUL.md`.

---

## Configuration

Key fields in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "maxSpawnDepth": 2,
      "maxChildrenPerAgent": 10
    },
    "list": [
      { "id": "main",         "workspace": "~/.openclaw/workspace-main" },
      { "id": "tdd-guide",    "workspace": "~/.openclaw/workspace-tdd-guide" },
      { "id": "rust-reviewer","workspace": "~/.openclaw/workspace-rust-reviewer" }
    ]
  },
  "commands": {
    "text": true,
    "nativeSkills": true,
    "native": "auto"
  }
}
```

`agentToAgent` is **not required** — `sessions_spawn` works without it.

---

## Key Constraints

1. Skill names must match `[a-z0-9_]` (max 32 chars). Hyphens convert to underscores: `code-review` → `code_review`.
2. Type A skill bodies must explicitly name which agent to spawn — the main agent should not guess.
3. All workflow instructions must be in `AGENTS.md`, not `SOUL.md`.
4. GAN loops must be serial: spawn → wait announce → spawn → wait announce.
5. `maxSpawnDepth: 2` is required for any two-level nesting.
6. `announce` is best-effort. Long-running pipelines should checkpoint state to a file.
