# ECC OpenClaw 完整流程

---

## 一、安装时发生了什么

`install-ecc.sh` 执行后，系统状态：

```
~/.openclaw/
├── skills/                          ← 共享目录，所有 agent 可见
│   ├── tdd/SKILL.md                 ← 由 commands/tdd.md 生成
│   ├── code_review/SKILL.md         ← 由 commands/code-review.md 生成
│   ├── build_fix/SKILL.md
│   ├── gan_build/SKILL.md
│   ├── rust_review/SKILL.md
│   ├── ... (共 68 个 command-skill)
│   └── ... (原有 142 个 ECC skill)
│
├── workspace-main/
├── workspace-tdd-guide/
├── workspace-rust-reviewer/
├── workspace-rust-build-resolver/
├── workspace-gan-planner/
├── workspace-gan-generator/
├── workspace-gan-evaluator/
└── ... (共 37 个专家 agent workspace)

openclaw.json:
  agents.list: [37 个专家 agent 的 id + workspace 路径]
  agents.defaults.maxSpawnDepth: 2
  commands.text: true
  commands.nativeSkills: true
```

---

## 二、68 个 command 的分类

### 类型 A：有专家 agent，触发即 spawn（约 20 个）

这类 command 在 ECC 里明确指定了对应的专家 agent，触发时直接 spawn，不经过 main agent 判断。

| Command | spawn 的专家 agent |
|---------|------------------|
| tdd | tdd-guide |
| e2e | e2e-runner |
| plan | planner |
| code-review | code-reviewer |
| refactor-clean | refactor-cleaner |
| update-docs | doc-updater |
| update-codemaps | doc-updater |
| cpp-build | cpp-build-resolver |
| cpp-review | cpp-reviewer |
| cpp-test | cpp-build-resolver |
| go-build | go-build-resolver |
| go-review | go-reviewer |
| go-test | go-build-resolver |
| kotlin-build | kotlin-build-resolver |
| kotlin-review | kotlin-reviewer |
| kotlin-test | kotlin-build-resolver |
| rust-build | rust-build-resolver |
| rust-review | rust-reviewer |
| rust-test | rust-build-resolver |
| python-review | python-reviewer |
| java-build | java-build-resolver |
| java-review | java-reviewer |
| gradle-build | java-build-resolver |
| flutter-review | flutter-reviewer |
| pytorch-build | pytorch-build-resolver |
| gan-build | gan-planner → gan-generator → gan-evaluator |
| gan-design | gan-generator → gan-evaluator |
| santa-loop | code-reviewer（×2 并行） |
| loop-start | loop-operator |
| security-scan | security-reviewer |
| db-review | database-reviewer |
| harness-audit | harness-optimizer |
| context-budget | harness-optimizer |

### 类型 B：无专家 agent，main agent 直接执行（约 35 个）

这类 command 在 ECC 里本来就是 Claude 自己执行的工作流，OpenClaw 里 main agent 直接执行。

```
build-fix, save-session, resume-session, checkpoint, aside,
docs, learn, learn-eval, skill-create, skill-health,
instinct-status, instinct-import, instinct-export,
promote, prune, evolve, rules-distill,
plan (prp-prd, prp-plan, prp-implement, prp-pr, prp-commit),
orchestrate, multi-plan, multi-execute, multi-backend,
multi-frontend, multi-workflow, devfleet,
sessions, projects, pm2, verify, quality-gate,
test-coverage, eval, prompt-optimize, model-route, ...
```

---

## 三、用户触发一个 skill 的完整流程

### 类型 A 示例：`/skill cmd_tdd 实现带 JWT 鉴权的登录接口`

```
用户输入: /skill cmd_tdd 实现带 JWT 鉴权的登录接口
    ↓
OpenClaw 识别 /skill 内置命令，找到 ~/.openclaw/skills/cmd_tdd/SKILL.md
    ↓
main agent 收到消息，读取 tdd/SKILL.md
    ↓
SKILL.md body 写明：调用 tdd-guide agent
    ↓
main agent 执行：
  sessions_spawn(
    agentId: "tdd-guide",
    task: "实现带 JWT 鉴权的登录接口"
  )
    ↓
tdd-guide subagent 启动，加载自己的 AGENTS.md（含完整 TDD 规范）
    ↓
tdd-guide 执行 TDD 工作流，输出进度：
  🔍 分析需求：JWT 登录接口...
  ⚙️ scaffold：定义接口类型...
  ✅ 接口定义完成
  ⚙️ RED：写失败测试...
  ✅ 测试已写，确认失败
  ⚙️ GREEN：实现最小代码...
  ✅ 测试通过
  ⚙️ REFACTOR...
    ↓
tdd-guide 完成，announce 结果回 main agent
    ↓
main agent 把结果返回给用户
```

### 类型 B 示例：`/skill cmd_build_fix`

```
用户输入: /skill cmd_build_fix
    ↓
OpenClaw 找到 ~/.openclaw/skills/cmd_build_fix/SKILL.md
    ↓
main agent 收到消息，读取 build_fix/SKILL.md
    ↓
SKILL.md body 就是工作流步骤，没有指定专家 agent
    ↓
main agent 直接执行：
  🔍 检测构建系统：发现 tsconfig.json，TypeScript 项目
  ⚙️ 运行 tsc --noEmit，发现 3 个错误
  ⚙️ 修复 src/api.ts:42 类型不匹配...
  ✅ 修复完成
  ⚙️ 修复 src/db.ts:17...
  ✅ 全部修复，构建成功
    ↓
结果直接返回给用户（无 announce，因为没有 subagent）
```

### 类型 A 多 agent 示例：`/skill cmd_gan_build 做一个实时协作白板`

```
用户输入: /skill cmd_gan_build 做一个实时协作白板
    ↓
main agent 读取 gan_build/SKILL.md
    ↓
SKILL.md body 描述三阶段串行流程：

  第一步：
  sessions_spawn(agentId: "gan-planner", task: "设计白板应用规范")
  → 非阻塞，等待 announce
  → gan-planner 完成，announce 回来（作为新对话消息）

  第二步（收到 announce 后）：
  sessions_spawn(agentId: "gan-generator", task: "按 spec.md 实现")
  → 等待 announce
  → gan-generator 完成，announce 回来

  第三步（收到 announce 后）：
  sessions_spawn(agentId: "gan-evaluator", task: "评估并评分")
  → 等待 announce
  → 读取分数，< 7.0 回到第二步，≥ 7.0 结束
    ↓
输出最终报告给用户
```

---

## 四、sessions_spawn 的执行细节

```
sessions_spawn(agentId: "tdd-guide", task: "...")

1. 在 openclaw.json 的 agents.list 里找到 "tdd-guide"
   → workspace: ~/.openclaw/workspace-tdd-guide

2. 启动 subagent，从 workspace 加载：
   ✅ AGENTS.md   （含完整 TDD 专业规范）
   ✅ TOOLS.md
   ✅ skills/     （共享 skills 可见）
   ✅ rules/      （语言规则）
   ❌ SOUL.md     （subagent 不加载）
   ❌ IDENTITY.md （subagent 不加载）
   ❌ USER.md     （subagent 不加载）

3. 立即返回 runId，非阻塞

4. subagent 完成后 announce 结果回调用方
   → announce 作为新的对话消息出现
   → main agent 下一轮 LLM 调用时看到，继续处理
```

**关键**：专家 agent 的工作指令必须在 AGENTS.md，不能只放 SOUL.md，因为 subagent 不加载 SOUL.md。ECC 现有的专家 agent 已经符合这个规则（AGENTS.md 含专业内容，SOUL.md 只是通用性格）。

---

## 五、架构全图

```
用户
  │  /skill cmd_tdd ...
  │  /skill cmd_build_fix
  │  /skill cmd_gan_build ...
  ▼
OpenClaw Gateway
  │  识别 /skill 命令
  │  查找 ~/.openclaw/skills/<name>/SKILL.md
  ▼
main agent
  │  read SKILL.md
  │
  ├─ 类型 B（无专家 agent）
  │   main agent 直接执行工作流
  │   输出进度，返回结果
  │
  └─ 类型 A（有专家 agent）
      sessions_spawn(agentId: "xxx")
             ↓
      专家 subagent（加载自己的 AGENTS.md）
      执行专业工作流，输出进度
             ↓ announce
      main agent 收到结果，返回给用户

      （GAN 循环：串行 spawn 多个 agent，每步等 announce）
```

---

## 六、关键约束

1. **skill name 只能用 `a-z0-9_`**，连字符转下划线（`code-review` → `code_review`）

2. **类型 A 的 SKILL.md body 必须明确写出 spawn 哪个 agent**，不能让 main agent 自己猜

3. **专家 agent 的工作指令必须在 AGENTS.md**，不能只放 SOUL.md

4. **GAN 循环必须串行**，每次 sessions_spawn 后等 announce，不能并发

5. **sessions_spawn 不需要配置 agentToAgent**，但 agentId 必须在 `agents.list` 里注册

6. **maxSpawnDepth 必须设为 2**，GAN 循环需要二层嵌套

7. **announce 是 best-effort**，长流程需要把状态写文件做容错
