# OpenClaw Integration

Run Everything Claude Code in OpenClaw - a multi-channel gateway (WhatsApp, Telegram, Discord, etc.)

## Quick Start

### 方式一：一键安装（推荐）

```bash
# 从 ECC 项目根目录运行
cd ~/path/to/everything-claude-code
./openclaw/install-ecc.sh
```

脚本会自动：
- 安装 ECC Plugin（86 tools + /dispatch 命令）
- 创建 36 个 Agents
- 复制 68 个 Commands
- 复制 142 个 Skills
- 复制 14 个语言 Rules
- 安装 Hooks
- 重启 Gateway

### 方式二：手动安装

```bash
# From ECC project root
cd ~/path/to/everything-claude-code

# Copy plugin
cp -r openclaw/plugin ~/.openclaw/plugins/ecc

# Copy skills (142 skills)
cp -r skills/* ~/.openclaw/skills/

# Copy rules (14 languages)
cp -r rules/* ~/.openclaw/rules/

# Copy commands (68 command definitions)
cp -r commands/* ~/.openclaw/commands/
```

### 使用 Tools

**ECC tools are called by agents, not directly by users.**

```bash
# From chat - via Dispatcher (recommended)
/dispatch 帮我做一个待办应用
/dispatch 审查一下这个 PR
/dispatch 运行 E2E 测试

# From chat - let main agent choose tools
帮我做一个待办应用           # Main agent calls gan_build
审查一下代码                 # Main agent calls code_review

# From shell (hooks)
gpush              # Git push with checks
tmux-dev "npm run dev"  # Dev server in tmux
cost-tracker       # Track token usage
```

**How it works:**
- User sends message → Main agent or Dispatcher analyzes intent
- Agent calls ECC tool (`gan_build`, `code_review`, etc.)
- ECC tool spawns workspace agent to execute task
- Result returned to user

### 8. Verify Installation

```bash
# List plugins
openclaw plugins list | grep -E "ecc|dispatcher"

# List agents
openclaw agents list

# Test a tool (via main agent)
openclaw agent --agent main --message "帮我运行 gan_build test"
```

## What's Included

- **37 Agents**: Each ECC agent becomes an independent OpenClaw agent
- **86 Tools**: All ECC commands available as OpenClaw agent tools
- **7 Hooks**: Converted from ECC hooks (4 shell scripts + 2 skills + internal)
- **142 Skills**: All ECC skills available in OpenClaw
- **14 Rule Packs**: Language-specific coding rules
- **Dispatcher Plugin**: `/dispatch` command for intent-based tool routing
- **Direct Mapping**: ECC `commands/*.md` → OpenClaw `api.registerTool()`

---

## Available Plugins

### ECC Plugin (`ecc`)

The core ECC plugin with 86 tools for GAN development, code review, testing, and more.

**Tools are called by agents, not directly by users.**

```bash
openclaw plugins list | grep ecc
```

**Example usage:**
```
User: /dispatch 帮我审查代码
  ↓
Dispatcher Agent: 用户想要 code_review
  ↓
Calls ECC tool: code_review()
  ↓
Spawns reviewer agent
  ↓
Returns review results
```

### Dispatcher Plugin (`dispatcher`)

Intent-based command router. Use `/dispatch` to let the agent choose the right tool:

```bash
/dispatch /plan
/dispatch 帮我审查代码
/dispatch 这个构建失败了分析一下
```

---

## Available Tools (Called by Agents)

**Note**: These tools are called by agents automatically. Users don't call them directly.

### High Priority (8)

| Tool | Agent | Description |
|---------|-------|-------------|
| `gan_build` | planner | GAN development loop |
| `gan_design` | architect | GAN design loop |
| `code_review` | reviewer | Code review |
| `e2e` | e2e-runner | E2E testing |
| `checkpoint` | main | Session checkpoint |
| `eval` | gan-evaluator | Evaluation |
| `tdd` | tdd-guide | TDD workflow |
| `refactor_clean` | refactor-cleaner | Refactoring |

### Language-Specific (24)

- **C++**: `/cpp_build`, `/cpp_review`, `/cpp_test`
- **Go**: `/go_build`, `/go_review`, `/go_test`
- **Kotlin**: `/kotlin_build`, `/kotlin_review`, `/kotlin_test`
- **Rust**: `/rust_build`, `/rust_review`, `/rust_test`
- **TypeScript**: `/ts_build`, `/ts_review`
- **Python**: `/python_build`, `/python_review`, `/python_test`
- **Java**: `/java_build`, `/gradle_build`, `/java_review`
- **Flutter**: `/flutter_build`, `/flutter_review`
- **Other**: `/pytorch_build`, `/healthcare_review`

### Tools (30+)

- `/security_scan`, `/performance_audit`
- `/build_error`, `/db_review`, `/harness_optimize`
- `/update_docs`, `/loop_start`, `/loop_status`
- `/opensource_fork`, `/opensource_package`, `/opensource_clean`
- `/prp_*` (5 PRP workflow commands)
- `/quality_gate`, `/test_coverage`, `/verify`
- `/skill_create`, `/skill_health`, `/prompt_optimize`
- `/save_session`, `/resume_session`
- `/multi_*` (5 multi-agent commands)
- And more...

**Full list**: See [`plugin/index.ts`](./plugin/index.ts)

---

## Available Hooks

### Shell Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `pre-commit-check.sh` | Pre-commit quality check | Auto-run by Git |
| `git-push-check.sh` | Git push reminder | `gpush` |
| `tmux-dev.sh` | Tmux wrapper for dev servers | `tmux-dev "npm run dev"` |
| `cost-logger.sh` | Cost tracking | `cost-tracker` |

### OpenClaw Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `console-check` | `/console_check` | Check for console.log |
| `typecheck` | `/typecheck` | TypeScript type checking |

**Full documentation**: See [`hooks/README.md`](./hooks/README.md)

### Sync Hooks

```bash
# ECC: hooks/
# OpenClaw: ~/.openclaw/hooks/

./openclaw/hooks/install-hooks.sh
```

**Rule**: Run installer script, hooks auto-configure!

---

## Architecture

```
ECC Project              OpenClaw
─────────────────        ─────────────────

agents/              →   ~/.openclaw/workspace-*/AGENTS.md
commands/            →   plugin/index.ts (86 tools)
hooks/               →   ~/.openclaw/hooks/ (7 hooks)
skills/              →   ~/.openclaw/skills/ (142 skills)
rules/               →   ~/.openclaw/rules/ (14 languages)
dispatcher/          →   ~/.openclaw/plugins/dispatcher/
```

---

## Sync from ECC Project

### Agents

```bash
# ECC: agents/planner.md
# OpenClaw: ~/.openclaw/workspace-planner/AGENTS.md

cp agents/planner.md ~/.openclaw/workspace-planner/AGENTS.md
```

**Rule**: Direct copy, no modification needed!

### Skills

```bash
# ECC: skills/
# OpenClaw: ~/.openclaw/skills/

cp -r skills/* ~/.openclaw/skills/
```

**Rule**: Direct copy, all 142 skills available in OpenClaw!

### Rules

```bash
# ECC: rules/
# OpenClaw: ~/.openclaw/rules/

cp -r rules/* ~/.openclaw/rules/
```

**Rule**: Direct copy, 14 language rule-packs available!

### Dispatcher Plugin

```bash
# ECC: openclaw/dispatcher/
# OpenClaw: ~/.openclaw/plugins/dispatcher/

cp -r openclaw/dispatcher ~/.openclaw/plugins/
cd ~/.openclaw/plugins/dispatcher
npm install
npx tsc
```

**Rule**: Copy, install deps, compile - then restart gateway!

### Commands

```typescript
// ECC: commands/gan-build.md
// OpenClaw: plugin/index.ts

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
      agentId: "planner",
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
```

### Hooks

See [Hooks Conversion Guide](./docs/hooks-conversion-guide.md) for details.

---

## Testing

```bash
# List agents
openclaw agents list

# List plugins
openclaw plugins list

# Test tools (via main agent)
openclaw agent --agent main --message "帮我运行 gan_build 测试项目"

# Test hooks
~/.openclaw/hooks/pre-commit-check.sh  # Should run checks
gpush                                   # Should show git status
tmux-dev "npm run dev"                 # Should suggest tmux
```

---

## Troubleshooting

### Agent not found
```bash
openclaw agents add <name> --workspace "~/.openclaw/workspace-<name>"
```

### Tool not recognized
```bash
openclaw plugins list | grep ecc
openclaw gateway restart
```

### Hook not working
```bash
# Check if script is executable
chmod +x ~/.openclaw/hooks/*.sh

# Reload shell aliases
source ~/.zshrc

# Check Git hook
ls -la .git/hooks/pre-commit
```

---

## Documentation

- [Integration Guide](./docs/integration-guide.md) - Full integration documentation
- [Plugin Source](./plugin/index.ts) - 86 tools implementation
- [Dispatcher Plugin](./dispatcher/index.ts) - Intent-based command routing
- [Agent Script](./agents/create-agents.sh) - Automated agent creation
- [Hooks Guide](./hooks/README.md) - Hooks installation and usage
- [Hooks Conversion](./docs/hooks-conversion-guide.md) - How hooks are converted

---

## Contributing

### Add New Tools

1. Create `commands/my-command.md`
2. Add to `plugin/index.ts`:
   ```typescript
   api.registerTool({ name: "my_tool", ... })
   ```
3. Test: Let agent call it or via `/dispatch 使用 my_tool`

### Add New Dispatcher Routes

The dispatcher plugin uses LLM to understand user intent. No code changes needed - just use natural language:

```bash
/dispatch <your request>
```

### Add New Hooks

1. Create hook script in `hooks/`
2. Add to `hooks/install-hooks.sh`
3. Document in `hooks/README.md`

---

## Related

- [OpenClaw Documentation](https://docs.openclaw.ai)
- [ECC Main Documentation](../README.md)
- [ECC Hooks](../hooks/README.md)

---

**Last Updated**: 2026-04-01
