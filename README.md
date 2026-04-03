# ECC · OpenClaw 集成

将 Everything Claude Code (ECC) 集成到 OpenClaw，通过 Telegram、WhatsApp、Discord 等任意渠道使用 ECC 的全部能力。

用户通过 `/skill cmd_<name>` 直接触发 ECC 工作流，无路由层，无需猜意图。

---

## 快速开始

### 安装

```bash
cd ~/path/to/everything-claude-code
./openclaw/install-ecc.sh
```

安装完成后：
- 37 个专家 Agent 已注册（tdd-guide、rust-reviewer、gan-planner 等）
- 210 个 Skill 可用（142 个 ECC skill + 68 个 command skill）
- 14 种语言编码规则已加载
- Hooks 已启用（安全防护、质量检查、会话记忆）

### 使用

```
/skill cmd_tdd 实现带 JWT 鉴权的登录接口
/skill cmd_plan 添加支付功能
/skill cmd_code_review
/skill cmd_code_review 42
/skill cmd_rust_review
/skill cmd_build_fix
/skill cmd_gan_build 做一个实时协作白板
```

---

## Skill 完整列表

### 开发流程

| Skill | 说明 | 执行方式 |
|-------|------|---------|
| `/skill cmd_plan` | 制定实现方案，等确认后再动手 | → planner agent |
| `/skill cmd_tdd` | TDD 工作流（RED→GREEN→REFACTOR，80%+ 覆盖率） | → tdd-guide agent |
| `/skill cmd_e2e` | 生成并运行 E2E 测试（Playwright） | → e2e-runner agent |
| `/skill cmd_code_review` | 代码审查，本地变更或 PR（传 PR 号） | → code-reviewer agent |
| `/skill cmd_refactor_clean` | 死代码清理与重构 | → refactor-cleaner agent |
| `/skill cmd_build_fix` | 增量修复构建/类型错误 | 直接执行 |
| `/skill cmd_verify` | 综合验证（lint + test + build） | 直接执行 |
| `/skill cmd_quality_gate` | 质量门检查 | 直接执行 |

### 多 Agent 协作

| Skill | 说明 | 执行方式 |
|-------|------|---------|
| `/skill cmd_gan_build` | 自主开发循环：规划→实现→评估，循环直到达标 | planner → generator → evaluator |
| `/skill cmd_gan_design` | 设计质量循环，专注视觉效果 | generator → evaluator |
| `/skill cmd_santa_loop` | 双审查员并行审查，两者都通过才算过 | code-reviewer × 2（并行） |
| `/skill cmd_orchestrate` | 多 agent 编排工作流 | 直接执行 |
| `/skill cmd_devfleet` | 并行 agent 舰队，多任务同时推进 | 直接执行 |

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
| **Gradle** | `/skill cmd_gradle_build` | — | — |
| **PyTorch** | `/skill cmd_pytorch_build` | — | — |

### 文档与规划

| Skill | 说明 |
|-------|------|
| `/skill cmd_update_docs` | 更新项目文档 |
| `/skill cmd_update_codemaps` | 更新代码地图 |
| `/skill cmd_prp_prd` | 生成产品需求文档 |
| `/skill cmd_prp_plan` | 生成实现计划 |
| `/skill cmd_prp_implement` | 按 PRP 规范实现功能 |
| `/skill cmd_prp_pr` | 生成 PR 描述 |

### 会话与学习

| Skill | 说明 |
|-------|------|
| `/skill cmd_save_session` | 保存当前会话状态 |
| `/skill cmd_resume_session` | 恢复上次会话 |
| `/skill cmd_learn` | 从会话提取可复用模式 |
| `/skill cmd_learn_eval` | 评估会话学习质量 |
| `/skill cmd_skill_create` | 从 git 历史生成 skill |
| `/skill cmd_evolve` | 进化已有 instinct |

---

## 执行架构

```
用户: /skill cmd_tdd 实现登录功能
    ↓
OpenClaw 识别 /skill 命令
查找 ~/.openclaw/skills/cmd_tdd/SKILL.md
    ↓
当前 Agent 读取 SKILL.md
    │
    ├─ 类型 A（27 个）：触发即 spawn 专家 agent
    │   sessions_spawn(agentId: "tdd-guide", task: "...")
    │   ↓ 专家 agent 执行（加载自己的 AGENTS.md）
    │   ↓ announce 结果回来
    │   用户收到结果
    │
    └─ 类型 B（41 个）：当前 agent 直接执行
        按 SKILL.md 步骤执行工作流
        用户收到结果
```

**多 Agent 串行（GAN 循环）**：
```
/skill cmd_gan_build 做一个白板应用
    ↓
sessions_spawn(gan-planner)  → 等 announce
sessions_spawn(gan-generator) → 等 announce
sessions_spawn(gan-evaluator) → 检查分数
    分数 < 7.0 → 回到 generator
    分数 ≥ 7.0 → 输出报告
```

---

## Hooks

安装后自动生效，对用户透明：

**安全防护（before_tool_call）**
- 拦截 `git --no-verify`，直接 block
- `git push` 前弹出审批确认
- 修改 `.eslintrc` / `biome.json` 等配置文件前弹出警告
- `git commit` 前检查 staged 文件质量

**质量检查（after_tool_call）**
- 编辑 JS/TS 文件后检查 `console.log`
- 记录所有 bash 命令到 `~/.openclaw/bash-commands.log`
- 检测 PR 创建并记录 URL

**会话记忆（internal hooks）**
- agent 启动时自动注入上次 session 摘要（`agent:bootstrap`）
- context 压缩前自动保存快照（`session:compact:before`）

**会话结束（session_end）**
- 批量对本次编辑的 TS 文件运行 `tsc --noEmit`
- 记录 session 统计到 `~/.openclaw/cost-log.jsonl`
- macOS 桌面通知（仅 macOS）

---

## 添加新 Command

1. 在 `commands/` 创建 `my-command.md`（描述工作流步骤）
2. 如果需要专家 agent，在 `agents/` 创建对应的 `my-agent.md`，并在 `openclaw/scripts/generate_skills.py` 的 `AGENT_MAP` 里添加映射
3. 重新运行安装脚本：`./openclaw/install-ecc.sh`

---

## 相关文档

- [FLOW.md](./FLOW.md) — 端到端执行流程，含完整场景示例
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构设计决策和技术规范
- [docs/hooks-migration.md](./docs/hooks-migration.md) — Hooks 改造方案
- [scripts/generate_skills.py](./scripts/generate_skills.py) — command → skill 转换脚本
- [OpenClaw 文档](https://docs.openclaw.ai)
- [ECC 主文档](../README.md)
