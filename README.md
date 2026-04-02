# OpenClaw Integration

将 Everything Claude Code (ECC) 集成到 OpenClaw - 支持多通道网关（Telegram、WhatsApp、Discord 等）

---

## 一键安装

```bash
cd ~/path/to/everything-claude-code
./openclaw/install-ecc.sh
```

**自动完成**：
- ✅ 安装 ECC Plugin（86 tools + /dispatch 命令）
- ✅ 创建 36 个 Agents
- ✅ 复制 68 个 Commands
- ✅ 复制 142 个 Skills
- ✅ 复制 14 个语言 Rules
- ✅ 安装 Hooks
- ✅ 重启 Gateway

---

## 使用方法

### 通过 /dispatch 命令

```
/dispatch 帮我做一个待办应用
/dispatch 审查一下这个 PR
/dispatch 运行 E2E 测试
```

Dispatcher Agent 会自动理解你的意图并调用正确的工具。

**这是目前唯一支持的使用方式。**

---

## 包含内容

| 组件 | 数量 | 说明 |
|------|------|------|
| **Agents** | 36 个 | 每个 ECC agent 成为独立的 OpenClaw agent |
| **Tools** | 86 个 | ECC commands 转换为 OpenClaw tools |
| **Skills** | 142 个 | ECC skills 直接使用 |
| **Rules** | 14 个 | 14 种编程语言的编码规则 |
| **Hooks** | 7 个 | 4 个 shell 脚本 + 2 个 skills + internal |

---

## 核心工具

### GAN 开发循环

| 工具 | 说明 |
|------|------|
| `/gan_build` | GAN 式开发（Planner → Generator → Evaluator） |
| `/gan_design` | GAN 设计循环（专注视觉质量） |

### 代码质量

| 工具 | 说明 |
|------|------|
| `/code_review` | 代码审查 |
| `/e2e` | E2E 测试 |
| `/tdd` | TDD 工作流 |
| `/refactor_clean` | 重构清理 |

### 语言特定

- **C++**: `cpp_build`, `cpp_review`, `cpp_test`
- **Go**: `go_build`, `go_review`, `go_test`
- **Kotlin**: `kotlin_build`, `kotlin_review`, `kotlin_test`
- **Rust**: `rust_build`, `rust_review`, `rust_test`
- **Python**: `python_build`, `python_review`, `python_test`
- **Java**: `java_build`, `gradle_build`, `java_review`
- **TypeScript**: `ts_build`, `ts_review`
- **Flutter**: `flutter_build`, `flutter_review`

[完整列表](./plugin/index.ts)

---

## 架构

```
ECC Project              OpenClaw
─────────────────        ─────────────────

agents/              →   ~/.openclaw/workspace-*/AGENTS.md
commands/            →   plugin/index.ts (86 tools)
hooks/               →   ~/.openclaw/hooks/ (7 hooks)
skills/              →   ~/.openclaw/skills/ (142 skills)
rules/               →   ~/.openclaw/rules/ (14 languages)
```

---

## 工作原理

### Tools 如何调用

```
用户：/dispatch 帮我审查代码
  ↓
Dispatcher Agent 分析意图
  ↓
调用 ECC tool: code_review()
  ↓
ECC Plugin → spawnAndWait(agentId: "reviewer")
  ↓
等待 Reviewer Agent 执行完成
  ↓
返回完整结果给用户
```

### 关键点

- **Tools 不是直接调用的命令**，而是由 Agent 调用的
- 用户通过 `/dispatch` 与 Dispatcher Agent 交互
- Dispatcher Agent 决定调用哪个 tool
- **同步等待**：Dispatcher 会等待 tool 执行完成并返回结果
- **完整结果**：用户收到的是实际执行结果，不是"已启动"

### 执行模式

ECC tools 使用 **同步等待模式** (`spawnAndWait`)：

```typescript
async function spawnAndWait(api, agentId, task, label, timeoutSeconds) {
  // 1. 启动子会话
  const runResult = await api.runtime.subagent.run({
    sessionKey: agentId,
    message: task,
    deliver: false  // 不直接 deliver，由我们控制返回时机
  });
  
  // 2. 等待完成
  const waitResult = await api.runtime.subagent.waitForRun({
    runId: runResult.runId,
    timeoutMs: timeoutSeconds * 1000
  });
  
  // 3. 处理错误/超时
  if (waitResult.status === 'error') return { text: '❌ 执行失败' };
  if (waitResult.status === 'timeout') return { text: '⏱️ 执行超时' };
  
  // 4. 获取并返回最终结果
  const messages = await api.runtime.subagent.getSessionMessages({
    sessionKey: agentId,
    limit: 50
  });
  return { text: messages[messages.length - 1].content };
}
```

**优点**：
- ✅ 用户收到完整执行结果
- ✅ Dispatcher 可以跟踪执行状态
- ✅ 可以处理错误和超时

**注意**：
- ⏱️ 长时间任务会阻塞 Dispatcher（但主 agent 不受影响）
- ⏱️ 可以通过 `max_iterations` 等参数控制超时时间

---

## 手动安装

```bash
# 1. 安装 Plugin
cp -r openclaw/plugin ~/.openclaw/plugins/ecc
cd ~/.openclaw/plugins/ecc && npm install && npx tsc

# 2. 复制资源
cp -r commands/* ~/.openclaw/commands/
cp -r skills/* ~/.openclaw/skills/
cp -r rules/* ~/.openclaw/rules/

# 3. 创建 Agents
# (自动通过 install-ecc.sh，或手动逐个创建)

# 4. 安装 Hooks
cp -r hooks/* ~/.openclaw/hooks/

# 5. 更新配置
# 编辑 ~/.openclaw/openclaw.json，添加 ecc 到 plugins.allow

# 6. 重启 Gateway
openclaw gateway restart
```

---

## 添加新 Agents

1. 在 `agents/` 目录创建 `my-agent.md`
2. 运行 `./openclaw/install-ecc.sh` 自动创建 workspace
3. 测试：`openclaw agents list`

---

## 添加新 Tools

1. 创建 `commands/my-command.md`
2. 在 `plugin/index.ts` 添加：
   ```typescript
   api.registerTool({
     name: "my_tool",
     description: "工具描述",
     parameters: Type.Object({...}),
     async execute(_id, params) {
       const command = readCommand("my-command");
       const result = await api.runtime.sessionsSpawn({
         agentId: "my-agent",
         task: `${command}\n\nParams: ${JSON.stringify(params)}`,
         label: "my-tool",
         runTimeoutSeconds: 300,
       });
       return { content: [{ type: "text", text: `已启动\n会话：${result.childSessionKey}` }] };
     },
   });
   ```
3. 编译：`cd plugin && npx tsc`
4. 重启 Gateway

---

## 文档

- [集成指南](./docs/integration-guide.md) - 完整技术文档
- [Plugin 源码](./plugin/index.ts) - 86 tools 实现
- [Hooks 指南](./hooks/README.md) - Hooks 安装和使用

---

## 相关资源

- [OpenClaw 文档](https://docs.openclaw.ai)
- [ECC 主文档](../README.md)
- [ECC Hooks](../hooks/README.md)

---

**最后更新**: 2026-04-02
