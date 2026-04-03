# ECC OpenClaw 架构设计 v3
# Skill-First：以 `/skill <name>` 为用户入口

---

## 零、三个关键场景的设计（已确认）

### 场景 1：参数如何从 `/skill tdd 实现登录功能` 传进 SKILL.md

**查明的事实**：

OpenClaw 文档没有说会做 `$ARGUMENTS` 变量替换。`/skill tdd 实现登录功能` 被"作为普通请求转发给 agent"——agent 收到的是完整的原始消息文本，包含 skill name 和后面的参数。

**设计方案**：

不依赖变量替换，而是在 SKILL.md body 里告诉 agent 如何提取参数：

```markdown
---
name: tdd
description: "TDD workflow..."
user-invocable: true
---

用户通过 `/skill tdd [任务描述]` 调用此 skill。
从消息中提取 `/skill tdd` 之后的内容作为任务描述。
如果没有任务描述，询问用户要实现什么功能。

# TDD Workflow
...（完整工作流内容）
```

这样 agent 天然能从消息上下文里找到参数，不依赖任何变量替换机制。

**对 `command-dispatch: tool` 模式的说明**：

如果用了 `command-dispatch: tool`，参数会以 `{ command: "<raw args>", commandName: "tdd", skillName: "tdd" }` 的结构传给 tool。但新架构不用这个模式（已去掉 plugin），所以不相关。

---

### 场景 2：用户在主对话里调用只在某个专家 agent workspace 里的 skill

**查明的事实**：

`~/.openclaw/skills/` 是**共享 skill 目录**，所有 agent 都能访问。文档原话：

> "Shared skills live in `~/.openclaw/skills` (managed/local) and are **visible to all agents** on the same machine."

workspace 里的 skill 优先级更高，但共享目录的 skill 对所有 agent 都可见。

**设计方案的修正**：

之前的方案是把 skill 分发到各 agent 的 workspace，现在发现这是**不必要的复杂度**。

正确做法：**所有 68 个 command-skill 都放到 `~/.openclaw/skills/`（共享目录）**。

```
~/.openclaw/skills/
├── tdd/SKILL.md          ← 所有 agent 都能看到
├── rust_review/SKILL.md  ← 所有 agent 都能看到
├── gan_build/SKILL.md    ← 所有 agent 都能看到
└── ...（68 个）
```

这样：
- 用户在任何 agent 的对话里输入 `/skill rust_review`，都能触发
- 不需要按 agent 分发，不需要符号链接
- `install-ecc.sh` 大幅简化：只需把 command 转成 skill 放到 `~/.openclaw/skills/`

**token 开销的重新评估**：

共享目录的 skill 对所有 agent 可见，意味着所有 agent 的 system prompt 里都会注入 68 个 skill 的 XML 摘要。

成本：68 × ~50 tokens ≈ **3,400 tokens** 固定开销，每个 agent 每次调用都要付。

这是可接受的代价，换来的是架构极大简化。如果未来 token 成本成为问题，再考虑分组优化。

**workspace 级 skill 的用途调整**：

workspace 级 skill（`workspace-xxx/skills/`）改为只放**该 agent 专属的覆盖配置**，比如给 rust-reviewer 定制一个更严格版本的 rust_review。平时不需要。

---

### 场景 3：GAN 循环——spawn 后如何等待上一步完成再继续

**查明的事实**：

announce 到达的方式：子 agent 完成后，announce **作为新的对话消息**出现在调用方的 session 里。agent 的 LLM 在下一轮会看到这条消息，就像收到了用户的回复一样。文档原话：

> "rewritten in normal assistant voice... becomes a new turn the agent's model sees"

这意味着：**串行 spawn 流程天然可行**。agent spawn A 之后，等 announce 到来（作为新消息），看到结果，再 spawn B。这是普通的对话流，不需要任何特殊机制。

**设计方案**：

在类型 C（多 agent 编排型）的 SKILL.md body 里，明确写出等待模式：

```markdown
## GAN 循环执行方式（OpenClaw 版）

在 OpenClaw 中执行 GAN 循环：

### 第一步：启动 Planner
通过 sessions_spawn 启动 gan-planner：
- task: "根据以下需求设计完整规范：[用户输入的项目描述]"
- 启动后**停止，等待 gan-planner 的结果消息出现在对话中**

### 第二步：收到 Planner 结果后
当对话中出现 gan-planner 的完成消息时，继续：
- 确认 gan-harness/spec.md 已生成
- 通过 sessions_spawn 启动 gan-generator
- 启动后**停止，等待 gan-generator 的结果消息**

### 第三步：收到 Generator 结果后
当对话中出现 gan-generator 的完成消息时：
- 通过 sessions_spawn 启动 gan-evaluator
- 启动后**停止，等待 gan-evaluator 的结果消息**

### 第四步：收到 Evaluator 结果后
读取分数，判断是否继续循环或结束。

**关键原则：每次 sessions_spawn 后必须停止等待，不要连续 spawn。**
```

**为什么这样能工作**：

announce 到来 = 新的对话消息 = agent 的新一轮 LLM 调用 = agent 看到结果继续执行。这是 OpenClaw 的自然对话流，不需要轮询或特殊等待机制。

**最大的风险**：

announce 是 best-effort，gateway 重启会丢失。对于长时间运行的 GAN 循环（可能几十分钟），这是真实风险。缓解方式：每次 spawn 前把当前状态写入文件（`gan-harness/state.md`），重启后可以从文件恢复进度。

---

## 零·续、Agent 间通信机制（已确认）

在设计之前，必须先把通信机制的事实链钉死，因为这决定了整个架构的可行性。

### sessions_spawn vs sessions_send

| | `sessions_spawn` | `sessions_send` |
|---|---|---|
| **用途** | 启动一个新的子 agent 运行 | 向已有 session 发消息 |
| **返回** | 立即返回 `{runId, childSessionKey}`，非阻塞 | 消息发出即返回 |
| **结果传递** | 子 agent 完成后通过 **announce** 异步推给调用方 | 对方收到消息后自行处理 |
| **配置要求** | **不需要** `agentToAgent`，主 agent 天然可用 | **需要** `agentToAgent` 显式启用 + allowlist |
| **ECC 用途** | 主流程：skill → spawn 专家 agent | 基本不需要 |

**关键结论**：ECC 的主要场景只需要 `sessions_spawn`，不需要配置 `agentToAgent`。

### sessions_spawn 启动的是什么？

**是"有独立 workspace 的 subagent"**，不是完全独立的 agent，也不是简单的后台任务。

`sessions_spawn(agentId: "rust-reviewer", task: "...")` 的执行过程：

```
1. 从 openclaw.json 的 agents.list 找到 "rust-reviewer"
   → workspace: "~/.openclaw/workspace-rust-reviewer"

2. 从该 workspace 加载：
   ✅ AGENTS.md   （rust-reviewer 自己的，含角色定义和工作流）
   ✅ TOOLS.md    （rust-reviewer 自己的）
   ✅ skills/     （rust-reviewer workspace 里的 skill）
   ✅ rules/      （共享 rules）
   ❌ SOUL.md     （subagent 不注入——文档明确说明）
   ❌ IDENTITY.md （subagent 不注入）
   ❌ USER.md     （subagent 不注入）
   ❌ HEARTBEAT.md（subagent 不注入）
   ❌ BOOTSTRAP.md（subagent 不注入）

3. 执行后通过 announce 把结果推给调用方
```

### SOUL.md 不注入的影响

这是架构里最关键的约束：**subagent 不加载 SOUL.md**。

看 ECC 现有的专家 agent：
- `rust-reviewer/SOUL.md`：通用性格模板（"Be genuinely helpful..."），**没有专业内容**
- `rust-reviewer/AGENTS.md`：完整的 Rust 审查规范、优先级、诊断命令、审批标准

**现状是好的**：ECC 的专家 agent 已经把所有工作指令放在了 AGENTS.md，SOUL.md 只是通用性格。所以 subagent 不加载 SOUL.md **不影响专业能力**。

**规则**：新增或修改专家 agent 时，**所有工作指令必须写在 AGENTS.md**，不能只放 SOUL.md。

### 嵌套深度限制

```
默认 maxSpawnDepth: 1
  → 主 agent 可以 spawn 子 agent
  → 子 agent 不能再 spawn（没有 session tools）

设置 maxSpawnDepth: 2（GAN 循环必须）
  → 主 agent spawn orchestrator（如 gan-planner）
  → orchestrator 可以再 spawn worker（如 gan-generator）
  → worker 不能再 spawn

最大支持 5 层，推荐 2 层
每个 session 最多 maxChildrenPerAgent 个并发子 agent（默认 5）
```

### announce 是异步的

`sessions_spawn` 非阻塞，结果通过 announce 推回。这意味着：

**GAN 循环不能同时 spawn 所有 agent**，必须等上一个 announce 后再继续：

```
spawn planner → 等 announce → spawn generator → 等 announce → spawn evaluator → ...
```

这个顺序约束必须写进 `gan_build` 的 SKILL.md body，否则 agent 可能并发 spawn。

### openclaw.json 正确配置

```json5
{
  agents: {
    defaults: {
      maxSpawnDepth: 2,        // 支持 GAN 循环等二层嵌套
      maxChildrenPerAgent: 10, // 并发子 agent 上限
    },
    list: [
      { id: "main",                  workspace: "~/.openclaw/workspace-main" },
      { id: "rust-reviewer",         workspace: "~/.openclaw/workspace-rust-reviewer" },
      { id: "cpp-build-resolver",    workspace: "~/.openclaw/workspace-cpp-build-resolver" },
      { id: "tdd-guide",             workspace: "~/.openclaw/workspace-tdd-guide" },
      { id: "gan-planner",           workspace: "~/.openclaw/workspace-gan-planner" },
      { id: "gan-generator",         workspace: "~/.openclaw/workspace-gan-generator" },
      { id: "gan-evaluator",         workspace: "~/.openclaw/workspace-gan-evaluator" },
      // ... 其余 30 个专家 agent
    ],
  },
  // agentToAgent 不需要配置（sessions_spawn 不依赖它）
}
```

**当前 install-ecc.sh 的错误**：`update_config()` 里配置了 `agentToAgent.enabled = True`，这对 `sessions_spawn` 没有作用，应删除。需要的是 `maxSpawnDepth: 2`。

---

## 一、已确认的机制基础

在设计之前，先把所有已查明的事实钉死：

### 1. Skill 注入机制（已确认）

System prompt 里注入的是**紧凑 XML 摘要**，每个 skill 只有三个字段：
```xml
<skill>
  <name>tdd</name>
  <description>...</description>
  <location>/Users/xxx/.openclaw/skills/tdd/SKILL.md</location>
</skill>
```
System prompt 还包含一条指令：**"用 `read` 工具加载 SKILL.md"**。

SKILL.md 的 body 不预注入，**agent 在需要时主动用 `read` 工具读取**。

### 2. `/skill <name>` 触发机制（已确认）

- `commands.text: true`（默认）时，文本解析器识别 `/skill` 为内置命令
- 用户输入 `/skill tdd implement login` → agent 收到消息 → agent 读取 tdd 的 SKILL.md → 按 body 执行
- `/tdd` 直接触发**不可靠**：文本解析器不认识，只在 Discord/Telegram nativeSkills 下作为平台原生命令有效

### 3. Skill name 命名规则（已确认）

- 只允许 `a-z0-9_`，最多 32 字符
- ECC command 文件名中的连字符 `-` 需转换为下划线 `_`
- `code-review.md` → skill name `code_review` → 用户输入 `/skill code_review`

### 4. ECC command 的性质（已确认）

ECC command 文件是**给 agent 看的完整工作流文档**，不是函数调用接口。
- 轻量如 `build-fix.md`：5 步骤，约 60 行
- 复杂如 `code-review.md`：8 阶段，含完整 bash 命令，约 290 行
- 编排如 `gan-build.md`：3 阶段多 agent 循环，含伪代码，约 100 行

---

## 二、核心架构

### 整体流程

```
用户输入: /skill tdd implement login feature
          ↓
OpenClaw 文本解析器识别 /skill 内置命令
          ↓
取参数 "tdd"，查找 ~/.openclaw/skills/tdd/SKILL.md
          ↓
agent 收到消息 + system prompt 里有 tdd skill 的 location
          ↓
agent 用 read 工具读取 SKILL.md（body = ECC command 内容）
          ↓
agent 按 body 里的工作流执行
  ├─ 简单任务：agent 直接执行
  └─ 需要专家：sessions_spawn 对应专家 agent
          ↓
结果返回用户
```

### 与旧架构对比

```
旧架构：/dispatch [描述] → Dispatcher 猜意图 → 选 86 个 tool 之一 → spawnAndWait → 专家 agent

新架构：/skill tdd → agent 读 SKILL.md → 直接执行或按需 spawn 专家 agent
```

**去掉的东西：**
- ❌ `plugin/index.ts`（TypeScript plugin，86 个 tool 注册）
- ❌ Dispatcher agent（路由层）
- ❌ `readCommand()` 动态读取 + 字符串拼接

**保留的东西：**
- ✅ 37 个专家 agent（作为 sessions_spawn 目标）
- ✅ 142 个 ECC skill（已有，继续用）
- ✅ 14 种语言 rules
- ✅ `install-ecc.sh`（修改，去掉 plugin 步骤，加入 skill 生成）

**新增的东西：**
- ✅ 68 个 command-skill（把 ECC command 转换为 user-invocable skill）

---

## 三、Skill 文件设计规范

### 目录结构

```
~/.openclaw/skills/
├── tdd/
│   └── SKILL.md          ← ECC command/tdd.md 内容
├── code_review/
│   └── SKILL.md          ← ECC command/code-review.md 内容
├── build_fix/
│   └── SKILL.md
├── gan_build/
│   └── SKILL.md
└── ... (68 个 command-skill)
```

与现有 142 个 ECC skill 共存于同一目录，无冲突（名称不重叠）。

### SKILL.md 通用结构

```markdown
---
name: <snake_case_name>
description: "<一行描述，来自 command 文件的 description frontmatter>"
user-invocable: true
origin: ECC-command
---

<ECC command 文件的完整内容>
```

**关键点：**
- `user-invocable: true`：暴露为 `/skill <name>` 可调用
- `origin: ECC-command`：标记来源，便于区分
- body 直接是 command 文件内容，**不做任何修改**
- `$ARGUMENTS` 在 command 文件里已有，OpenClaw 会把 `/skill tdd <args>` 中的 `<args>` 作为参数传入

### 两类 command 的转换方式

#### 类型 A：有专家 agent，触发即 spawn（约 33 个）

特征：ECC 里明确指定了对应的专家 agent，触发时直接 spawn，不让 main agent 判断。

代表：`tdd`, `e2e`, `plan`, `cpp_build`, `cpp_review`, `rust_build`, `rust_review`,
`go_build`, `go_review`, `kotlin_build`, `kotlin_review`, `python_review`,
`java_build`, `java_review`, `flutter_review`, `pytorch_build`,
`code_review`, `refactor_clean`, `update_docs`, `gan_build`, `gan_design` 等

转换：command 内容放进 body，**末尾追加 OpenClaw spawn 指令**：

```markdown
---
name: tdd
description: "TDD workflow: scaffold → RED (failing tests) → GREEN (minimal impl) → REFACTOR → 80%+ coverage."
user-invocable: true
origin: ECC-command
---

（commands/tdd.md 完整内容）

---

## OpenClaw 执行

在 OpenClaw 中执行此 skill 时，通过 sessions_spawn 调用专家 agent：

sessions_spawn(
  agentId: "tdd-guide",
  task: "[用户的完整请求]"
)

等待 tdd-guide 的 announce 结果回到当前对话，然后返回给用户。
```

**多 agent 编排（如 gan_build）**，追加串行 spawn 说明：

```markdown
## OpenClaw 执行

sessions_spawn 是非阻塞的，必须串行执行，每步等 announce 后再继续：

1. sessions_spawn(agentId: "gan-planner", task: "...")
   → 等待 announce
2. 收到后，sessions_spawn(agentId: "gan-generator", task: "...")
   → 等待 announce
3. 收到后，sessions_spawn(agentId: "gan-evaluator", task: "...")
   → 读取分数，决定是否继续循环

不要同时 spawn 多个 agent。
```

#### 类型 B：无专家 agent，main agent 直接执行（约 35 个）

特征：ECC 里没有对应的专家 agent，本来就是 Claude 自己执行的工作流。OpenClaw 里 main agent 直接执行，无需 spawn。

代表：`build_fix`, `save_session`, `resume_session`, `checkpoint`, `aside`,
`docs`, `learn`, `skill_create`, `instinct_status`, `promote`, `prune`,
`prp_prd`, `prp_plan`, `prp_implement`, `orchestrate`, `multi_plan`,
`devfleet`, `sessions`, `projects`, `verify`, `quality_gate` 等

转换：**直接把 command 内容放进 body，不追加任何 spawn 指令。**

```markdown
---
name: build_fix
description: "Incrementally fix build/type errors: detect build system → parse errors → fix one at a time → verify."
user-invocable: true
origin: ECC-command
---

（commands/build-fix.md 完整内容，无修改）
```

---

## 四、进度上报机制

借鉴 Edict 的 progress 上报，但不通过外部脚本——**直接在 SKILL.md body 里规定**。

在每个 command-skill 的 body 开头加入：

```markdown
## 执行规范

在每个关键步骤开始时，立即输出当前状态（不要沉默执行）：

| Emoji | 含义 |
|-------|------|
| 🔍 | 分析/检测中 |
| ⚙️ | 执行操作中 |
| 📋 | 整理结果中 |
| ✅ | 步骤完成 |
| ❌ | 遇到问题 |
| 🤖 | 调用专家 agent |

格式：`[emoji] [动作]：[具体内容]`
```

示例输出：
```
🔍 检测到 TypeScript 项目，运行 tsc --noEmit...
⚙️ 发现 3 个类型错误，开始逐一修复...
✅ 修复完成：src/api.ts:42 类型不匹配 → 已修正
✅ 构建成功，0 错误
```

---

## 五、Context Window 管理

### 结论先行：所有 skill 放共享目录

根据场景 2 的分析，`~/.openclaw/skills/` 是**所有 agent 共享**的目录。

**方案**：68 个 command-skill 全部放到 `~/.openclaw/skills/`，不做分发。

```
~/.openclaw/skills/
├── tdd/SKILL.md
├── code_review/SKILL.md
├── build_fix/SKILL.md
├── rust_review/SKILL.md
├── gan_build/SKILL.md
└── ...（68 个）
```

用户在任何 agent 的对话里都能用 `/skill <name>`，无需关心当前是哪个 agent。

### Token 成本

68 个 skill 的 system prompt 注入成本：
- 每个 skill 摘要约 50 tokens（name + description + location）
- 68 个：**≈ 3,400 tokens** 固定开销，每个 agent 每次调用都付

与旧架构（86 个 tool description ≈ 4,300 tokens）相比，节省约 20%。

### 如果未来 token 成本成为问题

届时可以把高频 skill 放 workspace 级别（优先级更高，覆盖共享版本），低频 skill 从共享目录移除，改为按需通过 `/skill install` 安装。但现阶段不需要这个复杂度。

---

## 六、install-ecc.sh 改造

### 新增：command → skill 批量生成函数

类型 A（有专家 agent）和类型 B（无专家 agent）的 SKILL.md 生成方式不同：
- 类型 A：command body + 末尾追加 `sessions_spawn` 指令
- 类型 B：command body 直接使用，不追加任何内容

```bash
# ── Step 3（新）: 生成 Command Skills ─────────────────────────

# 类型 A：command → 专家 agent 的映射表
declare -A AGENT_MAP=(
  ["tdd"]="tdd-guide"
  ["e2e"]="e2e-runner"
  ["plan"]="planner"
  ["code-review"]="code-reviewer"
  ["refactor-clean"]="refactor-cleaner"
  ["update-docs"]="doc-updater"
  ["update-codemaps"]="doc-updater"
  ["cpp-build"]="cpp-build-resolver"
  ["cpp-review"]="cpp-reviewer"
  ["cpp-test"]="cpp-build-resolver"
  ["go-build"]="go-build-resolver"
  ["go-review"]="go-reviewer"
  ["go-test"]="go-build-resolver"
  ["kotlin-build"]="kotlin-build-resolver"
  ["kotlin-review"]="kotlin-reviewer"
  ["kotlin-test"]="kotlin-build-resolver"
  ["rust-build"]="rust-build-resolver"
  ["rust-review"]="rust-reviewer"
  ["rust-test"]="rust-build-resolver"
  ["python-review"]="python-reviewer"
  ["java-build"]="java-build-resolver"
  ["java-review"]="java-reviewer"
  ["gradle-build"]="java-build-resolver"
  ["flutter-review"]="flutter-reviewer"
  ["pytorch-build"]="pytorch-build-resolver"
  ["security-scan"]="security-reviewer"
  ["db-review"]="database-reviewer"
  ["harness-audit"]="harness-optimizer"
  ["context-budget"]="harness-optimizer"
  ["loop-start"]="loop-operator"
  ["santa-loop"]="code-reviewer"
  # gan 系列单独处理（多 agent 串行）
)

# gan 系列：多 agent 串行 spawn
declare -A GAN_MAP=(
  ["gan-build"]="gan-planner,gan-generator,gan-evaluator"
  ["gan-design"]="gan-generator,gan-evaluator"
)

generate_command_skills() {
  info "生成 Command Skills (68 个 commands → skills)..."

  CMDS_SRC="$REPO_DIR/commands"
  SKILLS_DST="$OC_HOME/skills"
  mkdir -p "$SKILLS_DST"

  COUNT=0
  for cmd_file in "$CMDS_SRC"/*.md; do
    [ -f "$cmd_file" ] || continue

    cmd_basename=$(basename "$cmd_file" .md)
    skill_name="${cmd_basename//-/_}"

    # 跳过已有同名 skill（ECC 原生 skill 优先级更高）
    [ -d "$SKILLS_DST/$skill_name" ] && continue

    skill_dir="$SKILLS_DST/$skill_name"
    mkdir -p "$skill_dir"

    # 提取 description
    description=$(grep -m1 "^description:" "$cmd_file" \
      | sed 's/^description:[[:space:]]*//' \
      | sed 's/^["'"'"']//;s/["'"'"']$//')
    [ -z "$description" ] && description="ECC $cmd_basename workflow"

    # 提取 body（去掉 frontmatter）
    cmd_body=$(awk '/^---/{n++; if(n==2){found=1; next}} found{print}' "$cmd_file")

    # 生成 spawn 追加内容
    spawn_section=""

    if [ -n "${AGENT_MAP[$cmd_basename]}" ]; then
      # 类型 A：单专家 agent
      agent_id="${AGENT_MAP[$cmd_basename]}"
      spawn_section=$(cat << SPAWN

---

## OpenClaw 执行

通过 sessions_spawn 调用专家 agent：

\`\`\`
sessions_spawn(
  agentId: "$agent_id",
  task: "[用户的完整请求和上下文]"
)
\`\`\`

等待 $agent_id 的 announce 结果，然后返回给用户。
SPAWN
)
    elif [ -n "${GAN_MAP[$cmd_basename]}" ]; then
      # 类型 A：多 agent 串行
      agents="${GAN_MAP[$cmd_basename]}"
      spawn_section=$(cat << SPAWN

---

## OpenClaw 执行

sessions_spawn 是非阻塞的，必须串行执行，每步等 announce 后再继续：

涉及的 agent（按顺序）：$agents

每次 sessions_spawn 后停止等待，收到 announce 后再继续下一步。
不要同时 spawn 多个 agent。
SPAWN
)
    fi
    # 类型 B：spawn_section 为空，不追加任何内容

    # 写入 SKILL.md
    cat > "$skill_dir/SKILL.md" << EOF
---
name: $skill_name
description: "$description"
user-invocable: true
origin: ECC-command
---

$cmd_body$spawn_section
EOF

    COUNT=$((COUNT + 1))
  done

  log "已生成 $COUNT 个 Command Skills → $SKILLS_DST"
}
```

### 不需要分发函数

所有 skill 放 `~/.openclaw/skills/`（共享目录），所有 agent 自动可见。
`distribute_skills_to_agents()` 函数**不需要**，删除。

### 修改：去掉 Plugin 相关步骤

```bash
# 旧的 install_plugin() 调用 → 删除或改为可选
# 旧的 install_commands() → 保留（commands 文件仍有用，作为 skill body 来源）

# main() 新顺序：
banner
check_deps
backup_existing
create_workspaces
# install_plugin    ← 删除（不再需要 TypeScript plugin）
install_commands    # 保留，command 文件作为 skill body 来源
install_skills      # 142 个 ECC skill
generate_command_skills  # 新增：68 个 command → skill（放到共享目录）
# distribute_skills_to_agents  ← 删除（共享目录所有 agent 自动可见）
install_rules
install_hooks
update_config       # 修改：去掉 plugin 配置，加 maxSpawnDepth/nativeSkills
restart_gateway
verify_install
```

### 修改：update_config

```python
# 删除：plugins.allow ecc
# 删除：plugins.load.paths ecc
# 删除：agentToAgent 配置（sessions_spawn 不需要它）

# 新增：
commands = cfg.setdefault('commands', {})
commands['text'] = True           # 确保文本命令解析开启
commands['nativeSkills'] = True   # Telegram/Discord 原生 skill 命令
commands['native'] = 'auto'       # 原生命令自动模式

# 新增：支持 GAN 循环等二层嵌套
agents_cfg = cfg.setdefault('agents', {})
agents_cfg.setdefault('defaults', {})['maxSpawnDepth'] = 2
agents_cfg['defaults']['maxChildrenPerAgent'] = 10

# 新增：注册所有 37 个专家 agent（sessions_spawn 需要在 agents.list 里找到 agentId）
agents_list = agents_cfg.setdefault('list', [])
existing_ids = {a.get('id') for a in agents_list}
for agent_dir in (Path.home() / '.openclaw').glob('workspace-*'):
    agent_id = agent_dir.name.replace('workspace-', '')
    if agent_id not in existing_ids:
        agents_list.append({
            'id': agent_id,
            'workspace': str(agent_dir)
        })
```

---

## 七、用户体验设计

### 使用方式

```
/skill tdd implement a login feature with JWT auth
/skill code_review 42
/skill build_fix
/skill gan_build 做一个实时协作白板应用
/skill plan add payment integration
/skill cpp_review    （在 cpp-build-resolver 的对话里）
```

### 与旧方式对比

| 旧方式 | 新方式 |
|--------|--------|
| `/dispatch 帮我做 TDD 开发` | `/skill tdd implement login` |
| `/dispatch 审查一下代码` | `/skill code_review` |
| `/dispatch 修复构建错误` | `/skill build_fix` |
| 等 Dispatcher 猜意图（经常猜错） | 直接指定，无歧义 |

### Telegram nativeSkills 下的体验

当 `nativeSkills: true` 时，Telegram 命令菜单会出现：
```
/skill           - 按名称运行 ECC skill
/tdd             - TDD workflow（如果 main workspace 有 tdd skill）
/code_review     - Code review
/build_fix       - Fix build errors
/plan            - Implementation planning
...
```

用户可以直接点击菜单，或输入 `/skill <name>`。

---

## 八、文件变更清单

### 新增
```
openclaw/skills/tdd/SKILL.md               （由 install.sh 生成）
openclaw/skills/code_review/SKILL.md
openclaw/skills/build_fix/SKILL.md
openclaw/skills/e2e/SKILL.md
openclaw/skills/plan/SKILL.md
openclaw/skills/gan_build/SKILL.md
openclaw/skills/cpp_build/SKILL.md
openclaw/skills/rust_review/SKILL.md
... 共 68 个（对应 68 个 command）
```

### 修改
```
openclaw/install-ecc.sh
  + generate_command_skills()     新增
  + distribute_skills_to_agents() 新增
  - install_plugin()              删除（或改为可选 --with-plugin flag）
  ~ update_config()               去掉 plugin 配置，加 nativeSkills
  ~ verify_install()              更新验证逻辑
```

### 删除（可选）
```
openclaw/plugin/index.ts    不再需要（但可保留作为备选方案）
```

### 保留不变
```
agents/                     37 个专家 agent，全部保留
skills/                     142 个 ECC skill，全部保留
rules/                      14 种语言规则
commands/                   68 个 command 文件，作为 skill body 来源
```

---

## 九、验证方法

安装后逐步验证：

```bash
# 1. 确认 skill 生成
ls ~/.openclaw/skills/ | grep -E "^(tdd|code_review|build_fix|gan_build)$"

# 2. 确认分发
ls ~/.openclaw/workspace-main/skills/
ls ~/.openclaw/workspace-cpp-build-resolver/skills/

# 3. 确认 skill 可被列出
openclaw skills list | grep "ECC-command"

# 4. 功能测试（在 Telegram 或 Control UI）
/skill tdd implement a simple add function
# 期望：agent 读取 tdd SKILL.md，按 RED→GREEN→REFACTOR 执行，每步有进度上报

/skill build_fix
# 期望：agent 检测构建系统，逐一修复，每步有状态输出

/skill code_review
# 期望：agent 执行 git diff，按 8 阶段流程审查

/skill gan_build 做一个待办应用
# 期望：agent 依次 spawn planner、generator、evaluator

# 5. token 开销验证
# main agent 的 system prompt 里应只有 ~10-15 个 skill 的 XML 摘要
```
