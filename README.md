# OpenClaw MAS

A multi-agent development system that brings [Everything Claude Code](https://github.com/anthropics/everything-claude-code) workflows into [OpenClaw](https://docs.openclaw.ai). Use TDD, code review, build fixing, GAN loops, and 60+ other development workflows from any chat channel — Telegram, WhatsApp, Discord, or any channel OpenClaw supports.

---

## What's Included

- **37 specialist agents** — tdd-guide, rust-reviewer, code-reviewer, gan-planner, security-reviewer, and more
- **210 skills** — 142 ECC skills + 68 command skills covering the full development lifecycle
- **14 language rule sets** — Rust, Go, C++, Kotlin, Java, Python, Flutter, TypeScript, and more
- **Hooks** — safety guards, quality gates, and session memory, active automatically

---

## Requirements

- [OpenClaw](https://docs.openclaw.ai) installed and initialized (`~/.openclaw/openclaw.json` exists)
- `python3` available on your system
- This repository cloned locally

---

## Installation

### Option 1: Let your AI agent install it

Clone the repo, then send this to your OpenClaw agent:

```
Read the README in the OpenClaw-MAS repo I just cloned and follow the installation instructions.
```

The agent will read this file, run the install script, verify the result, and report back when done.

### Option 2: Install manually

```bash
git clone https://github.com/majiang213/OpenClaw-MAS.git
cd OpenClaw-MAS
bash install-ecc.sh
```

---

## Quick Start

Once installed, use `/skill <name>` in any OpenClaw chat:

```
/skill tdd implement a login endpoint with JWT auth
/skill code_review
/skill build_fix
/skill rust_review
/skill security_scan
/skill gan_build build a real-time collaborative whiteboard
```

---

## For AI Agents: Installation Instructions

> You are an AI agent reading this to install OpenClaw MAS on behalf of the user.
> Follow these steps exactly. Do not skip steps. Report progress after each step.

### Prerequisites

Verify the following before proceeding:

1. `openclaw` CLI is installed and `openclaw.json` exists at `~/.openclaw/openclaw.json`
2. `python3` is available
3. This repository (`everything-claude-code`) is cloned locally

If any prerequisite is missing, stop and tell the user what needs to be installed first.

### Installation

Run the install script from the repository root:

```bash
bash install-ecc.sh
```

The script will:
- Register 37 specialist agents into `openclaw.json`
- Install 210 skills into `~/.openclaw/skills/` (142 ECC skills + 68 command skills)
- Copy 14 language rule sets into each agent workspace
- Install hooks for safety checks, quality gates, and session memory
- Set `maxSpawnDepth: 2` and `commands.nativeSkills: true` in `openclaw.json`

### Verify Installation

After the script completes, confirm:

```bash
# Skills are installed
ls ~/.openclaw/skills/ | wc -l
# Should be 200+

# Agents are registered
grep -c '"id"' ~/.openclaw/openclaw.json
# Should be 37+
```

Then tell the user: "OpenClaw MAS is installed. You can now use `/skill <name>` in any OpenClaw chat."

---

## Usage

Invoke any workflow with `/skill <name>` in your OpenClaw chat:

```
/skill cmd_tdd implement a login endpoint with JWT auth
/skill cmd_code_review
/skill cmd_code_review 42
/skill cmd_build_fix
/skill cmd_rust_review
/skill cmd_gan_build build a real-time collaborative whiteboard
/skill cmd_plan add payment integration
/skill cmd_security_scan
```

---

## Available Skills

### Development Workflow

| Skill | What it does |
|-------|-------------|
| `/skill cmd_tdd` | TDD: scaffold → RED → GREEN → REFACTOR → 80%+ coverage |
| `/skill cmd_plan` | Create implementation plan before writing code |
| `/skill cmd_code_review` | Review local changes or a PR (pass PR number as arg) |
| `/skill cmd_e2e` | Generate and run E2E tests with Playwright |
| `/skill cmd_refactor_clean` | Remove dead code, consolidate duplicates |
| `/skill cmd_build_fix` | Incrementally fix build/type errors |
| `/skill cmd_security_scan` | OWASP Top 10 security review |
| `/skill cmd_db_review` | PostgreSQL schema and query review |

### Multi-Agent Workflows

| Skill | What it does |
|-------|-------------|
| `/skill cmd_gan_build` | Autonomous build loop: plan → implement → evaluate → repeat until score ≥ 7.0 |
| `/skill cmd_gan_design` | Design quality loop focused on visual output |
| `/skill cmd_santa_loop` | Two reviewers in parallel, both must approve |
| `/skill cmd_orchestrate` | Custom multi-agent workflow |
| `/skill cmd_devfleet` | Parallel agent fleet for concurrent tasks |

### Language-Specific

| Language | Build | Review | Test |
|----------|-------|--------|------|
| Rust | `/skill cmd_rust_build` | `/skill cmd_rust_review` | `/skill cmd_rust_test` |
| Go | `/skill cmd_go_build` | `/skill cmd_go_review` | `/skill cmd_go_test` |
| C++ | `/skill cmd_cpp_build` | `/skill cmd_cpp_review` | `/skill cmd_cpp_test` |
| Kotlin | `/skill cmd_kotlin_build` | `/skill cmd_kotlin_review` | `/skill cmd_kotlin_test` |
| Java | `/skill cmd_java_build` | `/skill cmd_java_review` | — |
| Python | — | `/skill cmd_python_review` | — |
| Flutter | — | `/skill cmd_flutter_review` | — |
| PyTorch | `/skill cmd_pytorch_build` | — | — |

### Docs & Planning

| Skill | What it does |
|-------|-------------|
| `/skill cmd_update_docs` | Update project documentation |
| `/skill cmd_prp_prd` | Generate product requirements doc |
| `/skill cmd_prp_plan` | Generate implementation plan |
| `/skill cmd_prp_implement` | Implement from a PRP spec |

### Session & Learning

| Skill | What it does |
|-------|-------------|
| `/skill cmd_save_session` | Save current session state |
| `/skill cmd_resume_session` | Resume previous session |
| `/skill cmd_learn` | Extract reusable patterns from session |
| `/skill cmd_skill_create` | Generate new skill from git history |

---

## Further Reading

- [docs/architecture.md](./docs/architecture.md) — How the multi-agent system works
- [docs/flow.md](./docs/flow.md) — End-to-end execution traces
- [docs/hooks-migration.md](./docs/hooks-migration.md) — Hooks reference
