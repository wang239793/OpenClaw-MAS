# ECC · OpenClaw 集成

将 Everything Claude Code (ECC) 集成到 OpenClaw，支持多通道网关（Telegram、WhatsApp、Discord 等）。

用户通过 `/skill <name>` 直接触发 ECC 工作流，无需 Dispatcher，无需猜意图。

---

## 一键安装

```bash
cd ~/path/to/everything-claude-code
./openclaw/install-ecc.sh
```

**自动完成**：
- ✅ 创建 37 个专家 Agent Workspace
- ✅ 安装 142 个 ECC Skills
- ✅ 生成 68 个 Command Skills（ECC commands → user-invocable skills）
- ✅ 安装 14 个语言 Rules
- ✅ 安装 Hooks
- ✅ 更新 openclaw.json（commands、agents、maxSpawnDepth）
- ✅ 重启 Gateway

---

## 使用方法

通过 `/skill <name>` 直接触发对应工作流：

```
/skill cmd_tdd 实现带 JWT 鉴权的登录接口
/skill cmd_build_fix
/skill cmd_code_review
/skill cmd_code_review 42          （审查 PR #42）
/skill cmd_rust_review
/skill cmd_gan_build 做一个实时协作白板
/skill cmd_plan 添加支付功能
/skill cmd_e2e
```

查看所有可用 skill：
```
openclaw skills list
```

---

## 包含内容

| 组件 | 数量 | 说明 |
|------|------|------|
| **专家 Agents** | 37 个 | 每个 ECC agent 有独立 workspace，含专业规范 |
| **Command Skills** | 68 个 | ECC commands 转换为 user-invocable skill |
| **ECC Skills** | 142 个 | ECC skills 直接使用 |
| **Rules** | 14 个 | 14 种编程语言的编码规则 |
| **Hooks** | — | ECC hooks 为 Claude Code 格式，与 OpenClaw 不兼容，需单独适配 |

---

## 核心 Skill 列表

### 开发工作流

| Skill | 说明 | 专家 Agent |
|-------|------|-----------|
| `/skill cmd_tdd` | TDD 工作流（RED→GREEN→REFACTOR） | tdd-guide |
| `/skill cmd_plan` | 实现规划，等待确认后再动手 | planner |
| `/skill cmd_e2e` | E2E 测试生成与执行 | e2e-runner |
| `/skill cmd_code_review` | 代码审查（本地或 PR） | code-reviewer |
| `/skill cmd_refactor_clean` | 死代码清理与重构 | refactor-cleaner |
| `/skill cmd_build_fix` | 增量修复构建错误 | _(直接执行)_ |

### GAN 多 Agent 循环

| Skill | 说明 | 专家 Agent |
|-------|------|-----------|
| `/skill cmd_gan_build` | 完整自主开发循环（规划→实现→评估） | planner→generator→evaluator |
| `/skill cmd_gan_design` | 设计质量循环（专注视觉） | generator→evaluator |

### 语言特定

| 语言 | Build | Review | Test |
|------|-------|--------|------|
| **Rust** | `/skill cmd_rust_build` | `/skill cmd_rust_review` | `/skill cmd_rust_test` |
| **Go** | `/skill cmd_go_build` | `/skill cmd_go_review` | `/skill cmd_go_test` |
| **C++** | `/skill cmd_cpp_build` | `/skill cmd_cpp_review` | `/skill cmd_cpp_test` |
| **Kotlin** | `/skill cmd_kotlin_build` | `/skill cmd_kotlin_review` | `/skill cmd_kotlin_test` |
| **Java** | `/skill cmd_java_build` | `/skill cmd_java_review` | — |
| **Python** | — | `/skill cmd_python_review` | — |
| **Flutter** | — | `/skill cmd_flutter_review` | — |
| **TypeScript** | — | — | — |

### 会话与学习

| Skill | 说明 |
|-------|------|
| `/skill cmd_save_session` | 保存当前会话状态 |
| `/skill cmd_resume_session` | 恢复上次会话 |
| `/skill cmd_learn` | 从会话中提取可复用模式 |
| `/skill cmd_skill_create` | 从 git 历史生成 skill |

---

## 架构

```
用户输入: /skill cmd_tdd 实现登录功能
    ↓
OpenClaw 识别 /skill 内置命令
    ↓
查找 ~/.openclaw/skills/tdd/SKILL.md
    ↓
当前 Agent 读取 SKILL.md（body = ECC command 内容）
    ↓
    ├─ 类型 A（有专家 agent）
    │   sessions_spawn(agentId: "tdd-guide", task: "...")
    │   专家 agent 加载自己的 AGENTS.md，执行工作流
    │   完成后 announce 结果回来
    │
    └─ 类型 B（无专家 agent）
        当前 agent 直接按工作流步骤执行
```

### ECC 组件映射

```
ECC Project              OpenClaw
─────────────────        ──────────────────────────────
agents/              →   ~/.openclaw/workspace-*/AGENTS.md
commands/            →   ~/.openclaw/skills/*/ (user-invocable)
skills/              →   ~/.openclaw/skills/ (142 个)
rules/               →   ~/.openclaw/rules/ (14 种语言)
hooks/               →   ~/.openclaw/hooks/
```

---

## 两类 Command Skill

**类型 A：触发即 spawn 专家 agent（27 个）**

SKILL.md body 末尾包含 `sessions_spawn` 指令，触发时直接启动对应专家 agent。

代表：`tdd`、`e2e`、`plan`、`code_review`、`rust_review`、`gan_build` 等

**类型 B：main agent 直接执行（41 个）**

ECC 原本就是 Claude 自己执行的工作流，无需专家 agent。

代表：`build_fix`、`save_session`、`checkpoint`、`learn`、`orchestrate` 等

---

## 添加新 Command

1. 在 `commands/` 创建 `my-command.md`（描述工作流步骤）
2. 如果需要专家 agent，在 `agents/` 创建对应的 `my-agent.md`
3. 在 `openclaw/scripts/generate_skills.py` 的 `AGENT_MAP` 里添加映射
4. 重新运行安装脚本：`./openclaw/install-ecc.sh`

---

## 相关文档

- [完整流程说明](./FLOW.md) — 端到端执行流程，含场景示例
- [架构设计](./ARCHITECTURE.md) — 详细设计决策和技术规范
- [生成脚本](./scripts/generate_skills.py) — command → skill 转换逻辑
- [OpenClaw 文档](https://docs.openclaw.ai)
- [ECC 主文档](../README.md)

---

**最后更新**: 2026-04-03
