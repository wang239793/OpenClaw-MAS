# OpenClaw Integration Guide

**Complete guide for integrating Everything Claude Code with OpenClaw**

## Overview

This guide explains how to integrate Everything Claude Code (ECC) with OpenClaw, a multi-channel gateway supporting WhatsApp, Telegram, Discord, and more.

### What You Get

- **37 Independent Agents**: Each ECC agent runs as an isolated OpenClaw agent
- **86 Tools**: All ECC commands available via `/tool_name` syntax
- **Multi-Channel Access**: Use ECC tools from WhatsApp, Telegram, Discord, etc.
- **Agent Isolation**: Each command uses its dedicated agent (no context mixing)

## Architecture

### Agent Mapping

```
ECC Agent              OpenClaw Agent
─────────              ──────────────
planner         →      ~/.openclaw/workspace-planner/
architect       →      ~/.openclaw/workspace-architect/
reviewer        →      ~/.openclaw/workspace-reviewer/
gan-generator   →      ~/.openclaw/workspace-gan-generator/
... (33 more)   →      ~/.openclaw/workspace-*/
```

### Command Mapping

```
ECC Command File      OpenClaw Command
────────────────      ────────────────
commands/gan-build.md  →  /gan_build
commands/code-review.md → /code_review
commands/e2e.md         → /e2e
... (83 more)     →  ... (83 more)
```

## Installation

### Prerequisites

1. OpenClaw installed and configured
2. Everything Claude Code cloned
3. Node.js >= 22

### Step 1: Install Plugin

```bash
cd /path/to/everything-claude-code
openclaw plugins install ./openclaw/plugin
```

### Step 2: Create Agents

```bash
# Automated (recommended)
./openclaw/agents/create-agents.sh

# Manual (one by one)
openclaw agents add planner --workspace ~/.openclaw/workspace-planner
openclaw agents add architect --workspace ~/.openclaw/workspace-architect
# ... repeat for all 37 agents
```

### Step 3: Copy Agent Definitions

```bash
# Automated (part of create-agents.sh)
for agent in planner architect reviewer gan-generator gan-evaluator; do
  cp "agents/${agent}.md" "~/.openclaw/workspace-${agent}/AGENTS.md"
done

# Manual
cp agents/planner.md ~/.openclaw/workspace-planner/AGENTS.md
cp agents/architect.md ~/.openclaw/workspace-architect/AGENTS.md
# ... repeat for all agents
```

### Step 4: Restart Gateway

```bash
openclaw gateway restart
```

### Step 5: Verify

```bash
# Check agents
openclaw agents list

# Check plugin
openclaw plugins list | grep ecc

# Test command
openclaw agent --agent main --message "/gan_build test"
```

## Agent Conversion

### Manual Method

```bash
#!/bin/bash
# Create a single agent

AGENT_ID="planner"
WORKSPACE="~/.openclaw/workspace-${AGENT_ID}"
SRC="agents/${AGENT_ID}.md"

# Create agent
openclaw agents add "$AGENT_ID" --workspace "$WORKSPACE"

# Copy definition
cp "$SRC" "$WORKSPACE/AGENTS.md"

echo "✅ Created $AGENT_ID"
```

### Automated Method

See [`../agents/create-agents.sh`](../agents/create-agents.sh)

## Command Conversion

### Pattern

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { readFileSync } from "fs";
import { join } from "path";

const COMMANDS_DIR = process.env.HOME + "/.openclaw/commands";

function readCommand(name: string) {
  const path = join(COMMANDS_DIR, `${name}.md`);
  return readFileSync(path, "utf-8");
}

export default definePluginEntry({
  id: "ecc",
  name: "ECC",
  
  async register(api) {
    api.registerTool({
      name: "gan_build",  // kebab-case → snake_case
      description: "GAN 式开发循环",
      parameters: Type.Object({
        brief: Type.String({ description: "项目描述" }),
        max_iterations: Type.Optional(Type.Number({ default: 15 })),
      }),
      async execute(_id, params) {
        const command = readCommand("gan-build");
        const result = await api.runtime.sessionsSpawn({
          agentId: "planner",  // ECC agent ID
          task: `${command}\n\nBrief: ${params.brief}`,
          label: "gan-build",
          runTimeoutSeconds: params.max_iterations * 60,
        });
        return {
          content: [{
            type: "text",
            text: `🚀 GAN Build started\nSession: ${result.childSessionKey}`,
          }],
        };
      },
    });
    
    // ... repeat for all 86 tools
  },
});
```

### Naming Convention

| ECC Format | OpenClaw Format | Example |
|------------|-----------------|---------|
| `commands/gan-build.md` | `gan_build` | kebab-case → snake_case |
| `commands/code-review.md` | `code_review` | kebab-case → snake_case |
| `agents/planner.md` | `agentId: "planner"` | No change |

### Agent Mapping

| Command | Default Agent | Fallback |
|---------|--------------|----------|
| `/gan_build` | planner | chief-of-staff |
| `/gan_design` | architect | chief-of-staff |
| `/code_review` | reviewer | chief-of-staff |
| `/cpp_*` | cpp-build-resolver / cpp-reviewer | chief-of-staff |
| `/go_*` | go-build-resolver / go-reviewer | chief-of-staff |
| `/python_*` | python-reviewer | chief-of-staff |
| `/java_*` | java-build-resolver | chief-of-staff |
| `/kotlin_*` | kotlin-build-resolver / kotlin-reviewer | chief-of-staff |
| `/rust_*` | rust-build-resolver / rust-reviewer | chief-of-staff |
| `/typescript_*` | typescript-reviewer | chief-of-staff |
| `/flutter_*` | flutter-reviewer | chief-of-staff |
| `/healthcare_*` | healthcare-reviewer | chief-of-staff |
| `/pytorch_*` | pytorch-build-resolver | chief-of-staff |
| `/gradle_*` | gradle-build-resolver | chief-of-staff |
| `/tdd` | tdd-guide | chief-of-staff |
| `/e2e` | e2e-runner | chief-of-staff |
| `/security_*` | security-reviewer | chief-of-staff |
| `/performance_*` | performance-optimizer | chief-of-staff |
| `/harness_*` | harness-optimizer | chief-of-staff |
| `/docs_*` | docs-lookup / doc-updater | main |
| `/refactor_*` | refactor-cleaner | chief-of-staff |
| `/loop_*` | loop-operator | chief-of-staff |
| `/opensource_*` | opensource-* | chief-of-staff |
| `/prp_*` | planner / reviewer / chief-of-staff | chief-of-staff |
| `/multi_*` | chief-of-staff | chief-of-staff |
| `/skill_*` | chief-of-staff | chief-of-staff |
| `/instinct_*` | chief-of-staff | chief-of-staff |
| Other | chief-of-staff | main |

## Testing

### List Agents

```bash
openclaw agents list
```

Expected output:
```
Agents:
- main (default)
- planner
- architect
- reviewer
- gan-generator
- gan-evaluator
- gan-planner
- security-reviewer
- database-reviewer
- build-error-resolver
- java-build-resolver
- chief-of-staff
- performance-optimizer
- e2e-runner
- docs-lookup
- refactor-cleaner
- cpp-build-resolver
- cpp-reviewer
- go-build-resolver
- go-reviewer
- kotlin-build-resolver
- kotlin-reviewer
- rust-build-resolver
- rust-reviewer
- python-reviewer
- gradle-build-resolver
- tdd-guide
- pytorch-build-resolver
- flutter-reviewer
- healthcare-reviewer
- typescript-reviewer
- harness-optimizer
- doc-updater
- loop-operator
- opensource-forker
- opensource-packager
- opensource-sanitizer
```

### List Plugins

```bash
openclaw plugins list
```

Expected output:
```
Plugins (X/Y loaded)
┌──────────────┬──────────────┬──────────┬──────────┬────────────────────────────────────┬─────────┐
│ Name         │ ID           │ Format   │ Status   │ Source                             │ Version │
├──────────────┼──────────────┼──────────┼──────────┼────────────────────────────────────┼─────────┤
│ ECC │ ecc │ openclaw │ loaded   │ ~/.openclaw/plugins/ecc/  │ 1.0.0   │
└──────────────┴──────────────┴──────────┴──────────┴────────────────────────────────────┴─────────┘
```

### Test Tools

```bash
# Test high-priority tools
openclaw agent --agent main --message "/gan_build test"
openclaw agent --agent main --message "/code_review"
openclaw agent --agent main --message "/e2e"

# Test language-specific tools
openclaw agent --agent main --message "/cpp_build ."
openclaw agent --agent main --message "/go_review"
openclaw agent --agent main --message "/python_test"

# Test tools
openclaw agent --agent main --message "/security_scan"
openclaw agent --agent main --message "/checkpoint"
openclaw agent --agent main --message "/context_budget"
```

## Troubleshooting

### Agent Not Found

```bash
# Error: Agent "planner" not found
openclaw agents add planner --workspace ~/.openclaw/workspace-planner
cp agents/planner.md ~/.openclaw/workspace-planner/AGENTS.md
openclaw gateway restart
```

### Command Not Recognized

```bash
# Error: Command "gan_build" not found
openclaw plugins list | grep ecc
# If not loaded:
openclaw gateway restart
```

### Plugin Not Loading

```bash
# Check plugin config
cat ~/.openclaw/plugins/ecc/openclaw.plugin.json

# Check plugin syntax
cd ~/.openclaw/plugins/ecc
npm install
npx tsc --noEmit

# Restart gateway
openclaw gateway restart
```

### Agent Definition Missing

```bash
# Error: AGENTS.md not found
ls ~/.openclaw/workspace-planner/AGENTS.md
# If missing:
cp agents/planner.md ~/.openclaw/workspace-planner/AGENTS.md
```

## Advanced Configuration

### Custom Agent Models

Edit `~/.openclaw/openclaw.json`:

```json5
{
  "agents": {
    "list": [
      {
        "id": "planner",
        "model": "anthropic/claude-opus-4-6",
        "workspace": "~/.openclaw/workspace-planner"
      },
      {
        "id": "architect",
        "model": "anthropic/claude-opus-4-6",
        "workspace": "~/.openclaw/workspace-architect"
      },
      {
        "id": "reviewer",
        "model": "anthropic/claude-sonnet-4-6",
        "workspace": "~/.openclaw/workspace-reviewer"
      }
    ]
  }
}
```

### Sub-Agent Configuration

```json5
{
  "agents": {
    "defaults": {
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 5,
        "model": "modelstudio/qwen3.5-plus"
      }
    }
  }
}
```

### Agent-to-Agent Communication

```json5
{
  "tools": {
    "agentToAgent": {
      "enabled": true,
      "allow": ["main", "planner", "architect", "reviewer", "chief-of-staff"]
    }
  }
}
```

## Contributing

### Adding New Tools

1. Create `commands/my-command.md`
2. Add to `plugin/index.ts`:
   ```typescript
   api.registerTool({
     name: "my_tool",
     description: "My tool description",
     parameters: Type.Object({
       // Define parameters
     }),
     async execute(_id, params) {
       const command = readCommand("my-command");
       const result = await api.runtime.sessionsSpawn({
         agentId: "chief-of-staff",
         task: `${command}\n\nParams: ${JSON.stringify(params)}`,
         label: "my-command",
         runTimeoutSeconds: 300,
       });
       return {
         content: [{
           type: "text",
           text: `My command started\nSession: ${result.childSessionKey}`,
         }],
       };
     },
   });
   ```
3. Test: `/my_command`
4. Commit and push

### Adding New Agents

1. Create `agents/my-agent.md`
2. Add to `agents/create-agents.sh`:
   ```bash
   AGENTS=(
     ...
     "my-agent"
   )
   ```
3. Test:
   ```bash
   ./openclaw/agents/create-agents.sh
   ```
4. Commit and push

## Related

- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw Plugins](https://docs.openclaw.ai/tools/plugin)
- [OpenClaw Agents](https://docs.openclaw.ai/concepts/multi-agent)
- [ECC Main Documentation](../README.md)

## Support

- OpenClaw Discord: https://discord.com/invite/clawd
- ECC GitHub Issues: https://github.com/affaan-m/everything-claude-code/issues
