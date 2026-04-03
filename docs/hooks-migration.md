# ECC Hooks 改造方案

## 一、背景

ECC 的 hooks（`hooks/hooks.json`）是 Claude Code 专用格式，无法直接用于 OpenClaw。
本文档描述如何将 ECC hooks 改造为 OpenClaw 格式。

---

## 二、格式对比

### Claude Code 格式（ECC 现有）

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node script.js" }]
      }
    ]
  }
}
```

### OpenClaw 有两套 Hook 系统

| 系统 | 位置 | 能力 |
|------|------|------|
| **Internal hooks** | `~/.openclaw/hooks/<name>/` | 消息流、会话生命周期、bootstrap |
| **Plugin hooks** | `plugin/index.ts` 里 `api.registerHook()` | **工具执行拦截**（before/after tool call）|

**关键发现**：ECC 里针对 Bash/Edit/Write 的 PreToolUse/PostToolUse hook，必须通过 **Plugin hooks** 实现，不能用 internal hooks。

---

## 三、Plugin Hook API（来自源码类型定义）

```typescript
// 注册方式
api.registerHook(
  "before_tool_call",   // 事件名，或数组 ["before_tool_call", "after_tool_call"]
  handler,
  { name: "my-hook", description: "..." }
)

// before_tool_call 事件对象
type PluginHookBeforeToolCallEvent = {
  toolName: string;                 // "Bash" | "Edit" | "Write" | ...
  params: Record<string, unknown>;  // 工具参数
  runId?: string;
  toolCallId?: string;
}

// before_tool_call 上下文
type PluginHookToolContext = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  toolName: string;
  toolCallId?: string;
}

// before_tool_call 返回值
type PluginHookBeforeToolCallResult = {
  params?: Record<string, unknown>; // 修改参数后传入
  block?: boolean;                  // true = 阻止执行
  blockReason?: string;
  requireApproval?: {               // 要求用户审批
    title: string;
    description: string;
    severity?: "info" | "warning" | "critical";
    timeoutMs?: number;
    timeoutBehavior?: "allow" | "deny";
    onResolution?: (decision: "allow-once"|"allow-always"|"deny"|"timeout"|"cancelled") => void;
  };
}

// after_tool_call 事件对象
type PluginHookAfterToolCallEvent = {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  result?: unknown;     // 工具返回结果
  error?: string;       // 执行错误（如有）
  durationMs?: number;  // 执行耗时
}
```

**完整 Plugin hook 事件列表**（来自源码）：

```
before_tool_call    after_tool_call    tool_result_persist
session_start       session_end
message_received    message_sending    message_sent
before_agent_start  before_agent_reply agent_end
before_model_resolve before_prompt_build
before_compaction   after_compaction   before_reset
subagent_spawning   subagent_spawned   subagent_ended
gateway_start       gateway_stop
before_install      before_dispatch    inbound_claim
before_message_write
```

---

## 四、ECC Hooks 完整分析

### ECC 的 19 个 hook

| Hook | 原事件 | 功能 | OpenClaw 实现方式 |
|------|--------|------|-----------------|
| `block-no-verify` | PreToolUse/Bash | 阻止 `--no-verify` git flag | ✅ Plugin: `before_tool_call` |
| `auto-tmux-dev` | PreToolUse/Bash | 自动在 tmux 启动 dev server | ⚠️ Plugin: `before_tool_call`（但 tmux 环境不同，效果有限） |
| `tmux-reminder` | PreToolUse/Bash | 提醒用 tmux 跑长命令 | ✅ Plugin: `before_tool_call` |
| `git-push-reminder` | PreToolUse/Bash | git push 前提醒 | ✅ Plugin: `before_tool_call` |
| `commit-quality` | PreToolUse/Bash | commit 前 lint 检查 | ✅ Plugin: `before_tool_call` |
| `doc-file-warning` | PreToolUse/Write | 警告非标准文档文件 | ✅ Plugin: `before_tool_call` |
| `suggest-compact` | PreToolUse/Edit\|Write | 建议手动压缩 context | ✅ Plugin: `before_tool_call` |
| `insaits-security` | PreToolUse/Bash\|Write\|Edit | AI 安全监控（需 pip install） | ⚠️ Plugin: `before_tool_call`（需安装依赖） |
| `governance-capture (pre)` | PreToolUse/Bash\|Write\|Edit | 捕获治理事件 | ✅ Plugin: `before_tool_call` |
| `config-protection` | PreToolUse/Write\|Edit | 阻止修改 lint/formatter 配置 | ✅ Plugin: `before_tool_call` |
| `mcp-health-check (pre)` | PreToolUse/\* | MCP 服务健康检查 | ❌ OpenClaw 无 MCP 概念 |
| `observe (pre)` | PreToolUse/\* | 持续学习观测 | ✅ Plugin: `before_tool_call` |
| `post-bash-command-log` | PostToolUse/Bash | 记录 bash 命令日志 | ✅ Plugin: `after_tool_call` |
| `pr-created` | PostToolUse/Bash | PR 创建后记录 URL | ✅ Plugin: `after_tool_call` |
| `quality-gate` | PostToolUse/Edit\|Write | 文件编辑后质量检查 | ✅ Plugin: `after_tool_call` |
| `post-edit-accumulator` | PostToolUse/Edit\|Write | 积累编辑文件列表 | ✅ Plugin: `after_tool_call` |
| `post-edit-console-warn` | PostToolUse/Edit | 检查 console.log | ✅ Plugin: `after_tool_call` |
| `governance-capture (post)` | PostToolUse/Bash\|Write\|Edit | 捕获治理事件 | ✅ Plugin: `after_tool_call` |
| `observe (post)` | PostToolUse/\* | 持续学习观测 | ✅ Plugin: `after_tool_call` |
| `mcp-health-check (post)` | PostToolUseFailure/\* | MCP 失败重连 | ❌ OpenClaw 无 MCP 概念 |
| `session-start-bootstrap` | SessionStart | 加载上次 context | ✅ Internal: `agent:bootstrap` |
| `pre-compact` | PreCompact | 压缩前保存状态 | ✅ Internal: `session:compact:before` |
| `stop-format-typecheck` | Stop | 批量格式化+类型检查 | ✅ Plugin: `session_end` |
| `check-console-log` | Stop | 检查 console.log | ✅ Plugin: `session_end` |
| `session-end` | Stop/SessionEnd | 保存 session 状态 | ✅ Plugin: `session_end` |
| `evaluate-session` | Stop | 评估 session 可复用模式 | ✅ Plugin: `session_end` |
| `cost-tracker` | Stop | 记录 token/cost | ✅ Plugin: `session_end` |
| `desktop-notify` | Stop | 桌面通知 | ✅ Plugin: `session_end` |
| `session-end-marker` | SessionEnd | 会话结束标记 | ✅ Plugin: `session_end` |

**不可实现（2 个）**：`mcp-health-check` 的前后两个，OpenClaw 没有 MCP 概念。
**其余 17 个全部可以实现**。

---

## 五、改造后的架构

```
openclaw/
├── plugin/
│   ├── index.ts              ← 轻量 Plugin，只注册 hook，不注册 tool
│   ├── hooks/
│   │   ├── before-tool-call.ts   ← 所有 PreToolUse hook 的实现
│   │   └── after-tool-call.ts    ← 所有 PostToolUse hook 的实现
│   ├── package.json
│   └── tsconfig.json
└── hooks/                    ← Internal hooks（消息/会话级别）
    ├── session-bootstrap/
    │   ├── HOOK.md
    │   └── handler.ts
    ├── session-end/
    │   ├── HOOK.md
    │   └── handler.ts
    └── pre-compact/
        ├── HOOK.md
        └── handler.ts
```

---

## 六、Plugin 实现（before_tool_call / after_tool_call）

### plugin/index.ts

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "ecc-hooks",
  name: "ECC Hooks",
  description: "ECC tool execution hooks: security guards, quality gates, logging",

  register(api) {

    // ── before_tool_call ──────────────────────────────────────
    api.registerHook("before_tool_call", async (event, ctx) => {
      const { toolName, params } = event;

      // 1. block-no-verify：阻止 git --no-verify
      if (toolName === "Bash") {
        const cmd = String(params.command ?? "");
        if (/--no-verify/.test(cmd)) {
          return {
            block: true,
            blockReason: "🚫 --no-verify is blocked: do not bypass git hooks",
          };
        }
      }

      // 2. git-push-reminder：git push 前提醒
      if (toolName === "Bash") {
        const cmd = String(params.command ?? "");
        if (/\bgit\s+push\b/.test(cmd)) {
          return {
            requireApproval: {
              title: "Git Push",
              description: "Review your changes before pushing. Run git diff HEAD~1 to check.",
              severity: "info",
              timeoutMs: 30000,
              timeoutBehavior: "allow",
            },
          };
        }
      }

      // 3. config-protection：阻止修改 lint/formatter 配置
      if (toolName === "Write" || toolName === "Edit") {
        const filePath = String(params.file_path ?? params.path ?? "");
        const protectedPatterns = [
          /\.eslintrc/,
          /\.prettierrc/,
          /biome\.json/,
          /tsconfig\.json$/,
        ];
        if (protectedPatterns.some(p => p.test(filePath))) {
          return {
            requireApproval: {
              title: "Config File Modification",
              description: `Modifying ${filePath}. Fix the code instead of weakening the config.`,
              severity: "warning",
              timeoutMs: 30000,
              timeoutBehavior: "deny",
            },
          };
        }
      }

      // 4. suggest-compact：编辑文件时提示 context 压缩（简化版，无 context 大小信息）
      // OpenClaw 不暴露 context 大小，此 hook 降级为无操作
    }, { name: "ecc-before-tool-call", description: "ECC pre-tool guards" });


    // ── after_tool_call ───────────────────────────────────────
    api.registerHook("after_tool_call", async (event, ctx) => {
      const { toolName, params, result, error, durationMs } = event;

      // 1. post-bash-command-log：记录 bash 命令
      if (toolName === "Bash") {
        const logEntry = {
          timestamp: new Date().toISOString(),
          sessionKey: ctx.sessionKey,
          command: params.command,
          durationMs,
          error: error ?? null,
        };
        appendLog("bash-commands.log", logEntry);
      }

      // 2. post-edit-console-warn：检查 console.log
      if (toolName === "Edit" || toolName === "Write") {
        const filePath = String(params.file_path ?? params.path ?? "");
        if (/\.[jt]sx?$/.test(filePath)) {
          // 积累到 session 级别的编辑文件列表，供 session_end 批量处理
          accumulateEditedFile(ctx.sessionKey, filePath);
        }
      }

      // 3. pr-created：检测 PR 创建
      if (toolName === "Bash") {
        const output = String(result ?? "");
        const prMatch = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
        if (prMatch) {
          appendLog("pr-log.txt", `${new Date().toISOString()} ${prMatch[0]}\n`);
        }
      }

    }, { name: "ecc-after-tool-call", description: "ECC post-tool logging and checks" });


    // ── session_end：批量处理 Stop 时的任务 ───────────────────
    api.registerHook("session_end", async (event, ctx) => {

      // 1. stop-format-typecheck：对积累的 JS/TS 文件批量检查
      const editedFiles = getAccumulatedFiles(ctx.sessionKey);
      if (editedFiles.length > 0) {
        runFormatCheck(editedFiles);
      }

      // 2. cost-tracker：记录 token 使用
      const costEntry = {
        timestamp: new Date().toISOString(),
        sessionKey: ctx.sessionKey,
        messageCount: event.messageCount,
        durationMs: event.durationMs,
      };
      appendLog("cost-log.jsonl", costEntry);

      // 3. desktop-notify：macOS 桌面通知
      if (process.platform === "darwin") {
        try {
          const { execSync } = await import("child_process");
          execSync(
            `osascript -e 'display notification "Session complete" with title "OpenClaw ECC"'`,
            { timeout: 5000 }
          );
        } catch { /* 静默失败 */ }
      }

    }, { name: "ecc-session-end", description: "ECC session end tasks" });

  },
});
```

---

## 七、Internal Hooks 实现

### hooks/session-bootstrap/HOOK.md

```yaml
---
name: session-bootstrap
description: "Inject previous session memory into agent bootstrap context"
metadata:
  openclaw:
    emoji: "🧠"
    events: ["agent:bootstrap"]
---
```

### hooks/session-bootstrap/handler.ts

```typescript
import * as fs from "fs";
import * as path from "path";

const handler = async (event) => {
  if (event.type !== "agent" || event.action !== "bootstrap") return;

  const workspaceDir = event.context?.workspaceDir;
  if (!workspaceDir) return;

  // 注入 MEMORY.md
  const memoryFile = path.join(workspaceDir, "MEMORY.md");
  if (fs.existsSync(memoryFile)) {
    event.context.bootstrapFiles.push(memoryFile);
  }

  // 注入最近一次 session 摘要
  const sessionDir = path.join(workspaceDir, "sessions");
  if (fs.existsSync(sessionDir)) {
    const latest = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith(".md"))
      .sort()
      .at(-1);
    if (latest) {
      event.context.bootstrapFiles.push(path.join(sessionDir, latest));
    }
  }
};

export default handler;
```

### hooks/pre-compact/HOOK.md

```yaml
---
name: pre-compact
description: "Save state snapshot before context compaction"
metadata:
  openclaw:
    emoji: "💾"
    events: ["session:compact:before"]
---
```

### hooks/pre-compact/handler.ts

```typescript
import * as fs from "fs";
import * as path from "path";

const handler = async (event) => {
  const workspaceDir = event.context?.sessionEntry?.workspaceDir;
  if (!workspaceDir) return;

  const snapshotDir = path.join(workspaceDir, "snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true });

  const filename = `pre-compact-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(snapshotDir, filename),
    JSON.stringify({ timestamp: new Date().toISOString(), sessionKey: event.sessionKey }, null, 2)
  );
};

export default handler;
```

---

## 八、openclaw.json 配置

安装后需要在 `update_config()` 里追加：

```python
# Internal hooks
hooks_cfg = cfg.setdefault('hooks', {})
internal = hooks_cfg.setdefault('internal', {})
internal['enabled'] = True
entries = internal.setdefault('entries', {})
for hook_name in ['session-bootstrap', 'pre-compact']:
    entries.setdefault(hook_name, {})['enabled'] = True

# Plugin（ecc-hooks）
plugins = cfg.setdefault('plugins', {})
allow_list = plugins.setdefault('allow', [])
if 'ecc-hooks' not in allow_list:
    allow_list.insert(0, 'ecc-hooks')
load = plugins.setdefault('load', {})
paths = load.setdefault('paths', [])
ecc_hooks_path = str(pathlib.Path.home() / '.openclaw' / 'plugins' / 'ecc-hooks')
if ecc_hooks_path not in paths:
    paths.insert(0, ecc_hooks_path)
```

---

## 九、功能覆盖总结

### ✅ 完整实现（13 个）

| Hook | 实现方式 |
|------|---------|
| `block-no-verify` | Plugin `before_tool_call`，检测 `--no-verify` → block |
| `git-push-reminder` | Plugin `before_tool_call`，检测 `git push` → requireApproval |
| `commit-quality` | Plugin `before_tool_call`，检测 `git commit` → 运行 lint |
| `config-protection` | Plugin `before_tool_call`，检测写入 `.eslintrc`/`biome.json` 等 → requireApproval |
| `doc-file-warning` | Plugin `before_tool_call`，检测写入非标准文档文件 → 警告 |
| `governance-capture` | Plugin `before_tool_call` + `after_tool_call`，检测 secret/policy 事件 |
| `post-bash-command-log` | Plugin `after_tool_call`，记录 Bash 命令到日志 |
| `pr-created` | Plugin `after_tool_call`，检测 PR URL → 记录 |
| `post-edit-accumulator` | Plugin `after_tool_call`，积累编辑的 JS/TS 文件路径 |
| `quality-gate` | Plugin `after_tool_call`，编辑文件后运行 lint/format |
| `session-bootstrap` | Internal `agent:bootstrap`，注入 MEMORY.md 和上次 session 摘要 |
| `pre-compact` | Internal `session:compact:before`，压缩前保存快照 |
| `desktop-notify` | Plugin `session_end`，macOS 桌面通知 |

---

### ⚠️ 降级实现（4 个）

#### 1. `evaluate-session` 和 `session-end`

**原功能**：从 `transcript_path` 读取完整会话 JSONL，分析内容提取模式/生成摘要。

**降级原因**：OpenClaw 的 `session_end` 事件没有 `transcript_path` 或 `sessionFile` 字段：
```typescript
type PluginHookSessionEndEvent = {
  sessionId: string;
  sessionKey?: string;
  messageCount: number;   // 只有这些
  durationMs?: number;    // 没有 transcript 路径
}
```
`sessionFile` 只在 `before_compaction` / `after_compaction` 事件里有，session 结束时不暴露。

**降级后能做**：记录会话元数据（messageCount、durationMs、时间戳），无法读取会话内容、无法生成有意义的摘要、无法提取可复用模式。

**TODO**：向 OpenClaw 提 feature request，在 `session_end` 事件里暴露 `sessionFile`。

---

#### 2. `suggest-compact`

**原功能**：检测 context 窗口使用量，在接近上限前建议手动压缩。

**降级原因**：OpenClaw 的 `before_tool_call` 事件里没有 context 大小信息，无法判断当前 context 使用量。

**降级后能做**：按工具调用次数计数（每 N 次提醒一次），不精准，可能在 context 还很小时误报，或 context 已满时漏报。

---

#### 3. `check-console-log`

**原功能**：Stop 时读取 git 修改文件列表，检查是否有 console.log。

**降级原因**：`session_end` 事件里没有 git 上下文，不知道本次 session 修改了哪些文件。

**降级后能做**：只能检查通过 `post-edit-accumulator` 积累的文件（即本次 session 中 agent 主动编辑的文件），用户手动修改的文件无法检测。

---

### ❌ 无法实现（2 个）

#### `mcp-health-check`（PreToolUse 和 PostToolUseFailure 各一个）

**原因**：这两个 hook 专门用于检测和恢复 MCP（Model Context Protocol）服务器的健康状态。OpenClaw 没有 MCP 概念，整个功能无意义，不需要移植。
