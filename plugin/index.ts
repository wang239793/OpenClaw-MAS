import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type { PluginCommandContext } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { readFileSync } from "fs";
import { join } from "path";

const COMMANDS_DIR = process.env.HOME + "/.openclaw/commands";

function readCommand(name: string) {
  const path = join(COMMANDS_DIR, `${name}.md`);
  return readFileSync(path, "utf-8");
}

/**
 * 辅助函数：spawn 子会话并等待完成，返回最终结果
 */
async function spawnAndWait(api: any, agentId: string, task: string, label: string, timeoutSeconds: number = 0) {
  // 启动子会话
  const runResult = await api.runtime.subagent.run({
    sessionKey: agentId,
    message: task,
    deliver: false
  });
  
  // 等待完成（timeoutSeconds=0 表示无限等待）
  const waitParams: any = { runId: runResult.runId };
  if (timeoutSeconds > 0) {
    waitParams.timeoutMs = timeoutSeconds * 1000;
  }
  const waitResult = await api.runtime.subagent.waitForRun(waitParams);
  
  if (waitResult.status === "error") {
    return { text: `❌ 执行失败：${waitResult.error}` };
  }
  if (waitResult.status === "timeout") {
    return { text: `⏱️ 执行超时（${timeoutSeconds}秒）` };
  }
  
  // 获取最终结果
  const messages = await api.runtime.subagent.getSessionMessages({
    sessionKey: agentId,
    limit: 50
  });
  
  // 找到最后一个 assistant 消息
  for (let i = messages.messages.length - 1; i >= 0; i--) {
    const msg = messages.messages[i];
    if (msg.role === "assistant" && msg.content) {
      return { text: msg.content };
    }
  }
  
  return { text: `✅ ${label} 已完成` };
}

export default definePluginEntry({
  id: "ecc",
  name: "ECC",
  description: "Everything Claude Code - Core Plugin",
  
  register(api) {
    // ========== 高优先级 Tools（8 个）==========
    
    // /gan_build
    api.registerTool({
      name: "gan_build",
      description: "GAN 式开发循环（Planner → Generator → Evaluator）",
      parameters: Type.Object({
        brief: Type.String({ description: "项目描述" }),
        max_iterations: Type.Optional(Type.Number({ default: 15 })),
        pass_threshold: Type.Optional(Type.Number({ default: 7.0 })),
      }),
      async execute(_id, params) {
        const command = readCommand("gan-build");
        const timeout = (params.max_iterations || 15) * 60;
        return await spawnAndWait(
          api,
          "planner",
          `${command}\n\nBrief: ${params.brief}`,
          "GAN Build",
          timeout
        );
      },
    });

    // /gan_design
    api.registerTool({
      name: "gan_design",
      description: "GAN 设计循环（跳过 planner，专注视觉质量）",
      parameters: Type.Object({
        brief: Type.String({ description: "设计描述" }),
        max_iterations: Type.Optional(Type.Number({ default: 8 })),
        pass_threshold: Type.Optional(Type.Number({ default: 7.5 })),
      }),
      async execute(_id, params) {
        const command = readCommand("gan-design");
        return await spawnAndWait(
          api,
          "architect",
          `${command}\n\nBrief: ${params.brief}`,
          "gan-design",
          params.max_iterations * 60
        );
      },
    });

    // /code_review
    api.registerTool({
      name: "code_review",
      description: "代码审查（本地变更或 GitHub PR）",
      parameters: Type.Object({
        pr: Type.Optional(Type.String({ description: "PR 号或 URL" })),
      }),
      async execute(_id, params) {
        const command = readCommand("code-review");
        return await spawnAndWait(
          api,
          "reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "code-review",
          600
        );
      },
    });

    // /e2e
    api.registerTool({
      name: "e2e",
      description: "E2E 测试执行",
      parameters: Type.Object({
        suite: Type.Optional(Type.String({ description: "测试套件" })),
      }),
      async execute(_id, params) {
        const command = readCommand("e2e");
        return await spawnAndWait(
          api,
          "e2e-runner",
          `${command}\n\nSuite: ${params.suite || "all"}`,
          "e2e-test",
          600
        );
      },
    });

    // /checkpoint
    api.registerTool({
      name: "checkpoint",
      description: "会话检查点保存",
      parameters: Type.Object({
        name: Type.Optional(Type.String({ description: "检查点名称" })),
      }),
      async execute(_id, params) {
        const command = readCommand("checkpoint");
        return await spawnAndWait(
          api,
          "main",
          `${command}\n\nName: ${params.name || "auto"}`,
          "checkpoint",
          120
        );
      },
    });

    // /eval
    api.registerTool({
      name: "eval",
      description: "评估/测试",
      parameters: Type.Object({
        target: Type.Optional(Type.String({ description: "评估目标" })),
      }),
      async execute(_id, params) {
        const command = readCommand("eval");
        return await spawnAndWait(
          api,
          "gan-evaluator",
          `${command}\n\nTarget: ${params.target || "current"}`,
          "eval",
          300
        );
      },
    });

    // /tdd
    api.registerTool({
      name: "tdd",
      description: "TDD 工作流",
      parameters: Type.Object({
        feature: Type.String({ description: "功能描述" }),
      }),
      async execute(_id, params) {
        const command = readCommand("tdd");
        return await spawnAndWait(
          api,
          "tdd-guide",
          `${command}\n\nFeature: ${params.feature}`,
          "tdd",
          600
        );
      },
    });

    // /refactor_clean
    api.registerTool({
      name: "refactor_clean",
      description: "重构清理",
      parameters: Type.Object({
        target: Type.Optional(Type.String({ description: "重构目标" })),
      }),
      async execute(_id, params) {
        const command = readCommand("refactor-clean");
        return await spawnAndWait(
          api,
          "refactor-cleaner",
          `${command}\n\nTarget: ${params.target || "current"}`,
          "refactor-clean",
          600
        );
      },
    });

    // ========== 中优先级：语言特定（15 个）==========
    
    // C++
    api.registerTool({
      name: "cpp_build",
      description: "C++ 构建",
      parameters: Type.Object({ target: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("cpp-build");
        return await spawnAndWait(
          api,
          "cpp-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "cpp-build",
          300
        );
      },
    });

    api.registerTool({
      name: "cpp_review",
      description: "C++ 代码审查",
      parameters: Type.Object({ pr: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("cpp-review");
        return await spawnAndWait(
          api,
          "cpp-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "cpp-review",
          300
        );
      },
    });

    api.registerTool({
      name: "cpp_test",
      description: "C++ 测试",
      parameters: Type.Object({ target: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("cpp-test");
        return await spawnAndWait(
          api,
          "cpp-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "cpp-test",
          300
        );
      },
    });

    // Go
    api.registerTool({ name: "go_build", description: "Go 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-build"); return await spawnAndWait(
          api,
          "go-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "go-build",
          300
        ); }});
    api.registerTool({ name: "go_review", description: "Go 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-review"); return await spawnAndWait(
          api,
          "go-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "go-review",
          300
        ); }});
    api.registerTool({ name: "go_test", description: "Go 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-test"); return await spawnAndWait(
          api,
          "go-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "go-test",
          300
        ); }});

    // Kotlin
    api.registerTool({ name: "kotlin_build", description: "Kotlin 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-build"); return await spawnAndWait(
          api,
          "kotlin-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "kotlin-build",
          300
        ); }});
    api.registerTool({ name: "kotlin_review", description: "Kotlin 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-review"); return await spawnAndWait(
          api,
          "kotlin-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "kotlin-review",
          300
        ); }});
    api.registerTool({ name: "kotlin_test", description: "Kotlin 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-test"); return await spawnAndWait(
          api,
          "kotlin-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "kotlin-test",
          300
        ); }});

    // Rust
    api.registerTool({ name: "rust_build", description: "Rust 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rust-build"); return await spawnAndWait(
          api,
          "rust-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "rust-build",
          300
        ); }});
    api.registerTool({ name: "rust_review", description: "Rust 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rust-review"); return await spawnAndWait(
          api,
          "rust-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "rust-review",
          300
        ); }});

    // 其他语言
    api.registerTool({ name: "python_review", description: "Python 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("python-review"); return await spawnAndWait(
          api,
          "python-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "python-review",
          300
        ); }});
    api.registerTool({ name: "java_build", description: "Java 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("gradle-build"); return await spawnAndWait(
          api,
          "java-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "java-build",
          300
        ); }});
    api.registerTool({ name: "gradle_build", description: "Gradle 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("gradle-build"); return await spawnAndWait(
          api,
          "gradle-build-resolver",
          `${command}\n\nTarget: ${params.target || "."}`,
          "gradle-build",
          300
        ); }});

    // ========== 基础 Tools（3 个）==========
    
    api.registerTool({
      name: "context_budget",
      description: "审计上下文窗口消耗",
      parameters: Type.Object({}),
      async execute(_id, _params) {
        const command = readCommand("context-budget");
        return await spawnAndWait(
          api,
          "main",
          `${command}\n\nError: ${params.error || "auto"}`,
          "build-fix",
          300
        );
      },
    });

    api.registerTool({
      name: "docs",
      description: "文档查询",
      parameters: Type.Object({ query: Type.String() }),
      async execute(_id, params) {
        const command = readCommand("docs");
        return await spawnAndWait(
          api,
          "docs-lookup",
          `${command}\n\nQuery: ${params.query}`,
          "docs",
          300
        );
      },
    });

    // ========== 其他 Tools（40 个）==========
    
    // 安全/性能
    api.registerTool({ name: "security_scan", description: "安全扫描", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "security-reviewer",
          `Scan for security issues\n\nTarget: ${params.target || "."}`,
          "security-scan",
          300
        ); }});
    api.registerTool({ name: "performance_audit", description: "性能审计", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "performance-optimizer",
          `Audit performance\n\nTarget: ${params.target || "."}`,
          "perf-audit",
          300
        ); }});

    // 数据库
    api.registerTool({ name: "db_review", description: "数据库审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("code-review"); return await spawnAndWait(
          api,
          "database-reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "db-review",
          300
        ); }});

    // 构建错误
    api.registerTool({ name: "build_error", description: "构建错误解决", parameters: Type.Object({ error: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "build-error-resolver",
          `Fix build error\n\nError: ${params.error || "auto"}`,
          "build-error",
          300
        ); }});

    // Java/Gradle
    api.registerTool({ name: "java_review", description: "Java 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "java-build-resolver",
          `Review Java code\n\nPR: ${params.pr || "local"}`,
          "java-review",
          300
        ); }});

    // TypeScript
    api.registerTool({ name: "typescript_review", description: "TypeScript 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "typescript-reviewer",
          `Review TypeScript code\n\nPR: ${params.pr || "local"}`,
          "ts-review",
          300
        ); }});
    api.registerTool({ name: "typescript_build", description: "TypeScript 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "typescript-reviewer",
          `Build TypeScript\n\nTarget: ${params.target || "."}`,
          "ts-build",
          300
        ); }});

    // Python
    api.registerTool({ name: "python_build", description: "Python 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "python-reviewer",
          `Build Python project\n\nTarget: ${params.target || "."}`,
          "python-build",
          300
        ); }});
    api.registerTool({ name: "python_test", description: "Python 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "python-reviewer",
          `Run Python tests\n\nTarget: ${params.target || "."}`,
          "python-test",
          300
        ); }});

    // Flutter
    api.registerTool({ name: "flutter_build", description: "Flutter 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "flutter-reviewer",
          `Build Flutter app\n\nTarget: ${params.target || "."}`,
          "flutter-build",
          300
        ); }});
    api.registerTool({ name: "flutter_review", description: "Flutter 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "flutter-reviewer",
          `Review Flutter code\n\nPR: ${params.pr || "local"}`,
          "flutter-review",
          300
        ); }});

    // Healthcare
    api.registerTool({ name: "healthcare_review", description: "医疗代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "healthcare-reviewer",
          `Review healthcare code\n\nPR: ${params.pr || "local"}`,
          "healthcare-review",
          300
        ); }});

    // PyTorch
    api.registerTool({ name: "pytorch_build", description: "PyTorch 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "pytorch-build-resolver",
          `Build PyTorch project\n\nTarget: ${params.target || "."}`,
          "pytorch-build",
          300
        ); }});

    // Rust test
    api.registerTool({ name: "rust_test", description: "Rust 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "rust-build-resolver",
          `Run Rust tests\n\nTarget: ${params.target || "."}`,
          "rust-test",
          300
        ); }});

    // Harness optimizer
    api.registerTool({ name: "harness_optimize", description: "Harness 优化", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "harness-optimizer",
          `Optimize agent harness\n\nTarget: ${params.target || "."}`,
          "harness-optimize",
          300
        ); }});

    // Doc updater
    api.registerTool({ name: "update_docs", description: "更新文档", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("update-docs"); return await spawnAndWait(
          api,
          "doc-updater",
          `${command}\n\nTarget: ${params.target || "."}`,
          "update-docs",
          300
        ); }});

    // Loop operator
    api.registerTool({ name: "loop_start", description: "启动循环", parameters: Type.Object({ task: Type.String() }), async execute(_id, params) { const command = readCommand("loop-start"); return await spawnAndWait(
          api,
          "loop-operator",
          `${command}\n\nTask: ${params.task}`,
          "loop-start",
          600
        ); }});
    api.registerTool({ name: "loop_status", description: "循环状态", parameters: Type.Object({}), async execute(_id, _params) { const command = readCommand("loop-status"); return await spawnAndWait(
          api,
          "loop-operator",
          `Manage fork\n\nRepo: ${params.repo || "current"}`,
          "oss-fork",
          300
        ); }});
    api.registerTool({ name: "opensource_package", description: "打包发布", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "opensource-packager",
          `Package project\n\nTarget: ${params.target || "."}`,
          "oss-package",
          300
        ); }});
    api.registerTool({ name: "opensource_clean", description: "代码清理", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { return await spawnAndWait(
          api,
          "opensource-sanitizer",
          `Clean code\n\nTarget: ${params.target || "."}`,
          "oss-clean",
          300
        ); }});

    // PRP 工作流（5 个）
    api.registerTool({ name: "prp_prd", description: "PRP 产品需求文档", parameters: Type.Object({ feature: Type.String() }), async execute(_id, params) { const command = readCommand("prp-prd"); return await spawnAndWait(
          api,
          "planner",
          `${command}\n\nFeature: ${params.feature}`,
          "prp-prd",
          300
        ); }});
    api.registerTool({ name: "prp_plan", description: "PRP 规划", parameters: Type.Object({ feature: Type.String() }), async execute(_id, params) { const command = readCommand("prp-plan"); return await spawnAndWait(
          api,
          "planner",
          `${command}\n\nFeature: ${params.feature}`,
          "prp-plan",
          300
        ); }});
    api.registerTool({ name: "prp_implement", description: "PRP 实现", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("prp-implement"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nSpec: ${params.spec}`,
          "prp-implement",
          600
        ); }});
    api.registerTool({ name: "prp_pr", description: "PRP PR 审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("prp-pr"); return await spawnAndWait(
          api,
          "reviewer",
          `${command}\n\nPR: ${params.pr || "local"}`,
          "prp-pr",
          300
        ); }});
    api.registerTool({ name: "prp_commit", description: "PRP Commit", parameters: Type.Object({ message: Type.String() }), async execute(_id, params) { const command = readCommand("prp-commit"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nMessage: ${params.message}`,
          "prp-commit",
          120
        ); }});

    // 其他工具
    api.registerTool({ name: "quality_gate", description: "质量门检查", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("quality-gate"); return await spawnAndWait(
          api,
          "reviewer",
          `${command}\n\nTarget: ${params.target || "."}`,
          "quality-gate",
          300
        ); }});
    api.registerTool({ name: "test_coverage", description: "测试覆盖率", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("test-coverage"); return await spawnAndWait(
          api,
          "e2e-runner",
          `${command}\n\nTarget: ${params.target || "."}`,
          "test-coverage",
          300
        ); }});
    api.registerTool({ name: "refactor", description: "重构", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("refactor-clean"); return await spawnAndWait(
          api,
          "refactor-cleaner",
          `${command}\n\nTarget: ${params.target || "."}`,
          "refactor",
          300
        ); }});
    api.registerTool({ name: "verify", description: "验证", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("verify"); return await spawnAndWait(
          api,
          "reviewer",
          `${command}\n\nTarget: ${params.target || "."}`,
          "verify",
          300
        ); }});
    api.registerTool({ name: "promote", description: "推广", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("promote"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "promote",
          300
        ); }});
    api.registerTool({ name: "prune", description: "修剪", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("prune"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "prune",
          300
        ); }});
    api.registerTool({ name: "rules_distill", description: "规则提炼", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rules-distill"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "rules-distill",
          300
        ); }});
    api.registerTool({ name: "skill_create", description: "创建技能", parameters: Type.Object({ name: Type.String() }), async execute(_id, params) { const command = readCommand("skill-create"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nName: ${params.name}`,
          "skill-create",
          300
        ); }});
    api.registerTool({ name: "skill_health", description: "技能健康检查", parameters: Type.Object({ name: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("skill-health"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nName: ${params.name || "all"}`,
          "skill-health",
          300
        ); }});
    api.registerTool({ name: "prompt_optimize", description: "提示优化", parameters: Type.Object({ prompt: Type.String() }), async execute(_id, params) { const command = readCommand("prompt-optimize"); return await spawnAndWait(
          api,
          "performance-optimizer",
          `${command}\n\nPrompt: ${params.prompt}`,
          "prompt-optimize",
          300
        ); }});
    api.registerTool({ name: "save_session", description: "保存会话", parameters: Type.Object({ name: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("save-session"); return await spawnAndWait(
          api,
          "main",
          `${command}\n\nName: ${params.name || "auto"}`,
          "save-session",
          120
        ); }});
    api.registerTool({ name: "resume_session", description: "恢复会话", parameters: Type.Object({ name: Type.String() }), async execute(_id, params) { const command = readCommand("resume-session"); return await spawnAndWait(
          api,
          "main",
          `${command}\n\nName: ${params.name}`,
          "resume-session",
          120
        ); }});
    api.registerTool({ name: "setup_pm", description: "设置项目管理", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("setup-pm"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "setup-pm",
          300
        ); }});
    api.registerTool({ name: "update_codemaps", description: "更新代码地图", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("update-codemaps"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "update-codemaps",
          300
        ); }});
    api.registerTool({ name: "learn", description: "学习", parameters: Type.Object({ topic: Type.String() }), async execute(_id, params) { const command = readCommand("learn"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTopic: ${params.topic}`,
          "learn",
          300
        ); }});
    api.registerTool({ name: "learn_eval", description: "学习评估", parameters: Type.Object({ topic: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("learn-eval"); return await spawnAndWait(
          api,
          "gan-evaluator",
          `${command}\n\nTopic: ${params.topic || "current"}`,
          "learn-eval",
          300
        ); }});
    api.registerTool({ name: "instinct_status", description: "本能状态", parameters: Type.Object({}), async execute(_id, _params) { const command = readCommand("instinct-status"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nTarget: ${params.target || "."}`,
          "instinct-export",
          300
        ); }});
    api.registerTool({ name: "instinct_import", description: "本能导入", parameters: Type.Object({ source: Type.String() }), async execute(_id, params) { const command = readCommand("instinct-import"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nSource: ${params.source}`,
          "instinct-import",
          300
        ); }});
    api.registerTool({ name: "harness_audit", description: "Harness 审计", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("harness-audit"); return await spawnAndWait(
          api,
          "harness-optimizer",
          `${command}\n\nTarget: ${params.target || "."}`,
          "harness-audit",
          300
        ); }});
    api.registerTool({ name: "evolve", description: "进化", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("evolve"); return await spawnAndWait(
          api,
          "performance-optimizer",
          `${command}\n\nTarget: ${params.target || "."}`,
          "evolve",
          300
        ); }});
    api.registerTool({ name: "devfleet", description: "开发舰队", parameters: Type.Object({ action: Type.String() }), async execute(_id, params) { const command = readCommand("devfleet"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nAction: ${params.action}`,
          "devfleet",
          300
        ); }});
    api.registerTool({ name: "claw", description: "Claw 工具", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("claw"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nAction: ${params.action || "status"}`,
          "claw",
          120
        ); }});
    api.registerTool({ name: "aside", description: "旁注", parameters: Type.Object({ note: Type.String() }), async execute(_id, params) { const command = readCommand("aside"); return await spawnAndWait(
          api,
          "main",
          `${command}\n\nNote: ${params.note}`,
          "aside",
          60
        ); }});
    api.registerTool({ name: "plan", description: "规划", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("plan"); return await spawnAndWait(
          api,
          "planner",
          `${command}\n\nGoal: ${params.goal}`,
          "plan",
          300
        ); }});
    api.registerTool({ name: "projects", description: "项目管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("projects"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nAction: ${params.action || "list"}`,
          "projects",
          120
        ); }});
    api.registerTool({ name: "sessions", description: "会话管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("sessions"); return await spawnAndWait(
          api,
          "main",
          `${command}\n\nAction: ${params.action || "list"}`,
          "sessions",
          120
        ); }});
    api.registerTool({ name: "pm2", description: "PM2 进程管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("pm2"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nAction: ${params.action || "list"}`,
          "pm2",
          120
        ); }});
    api.registerTool({ name: "orchestrate", description: "编排", parameters: Type.Object({ workflow: Type.String() }), async execute(_id, params) { const command = readCommand("orchestrate"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nWorkflow: ${params.workflow}`,
          "orchestrate",
          600
        ); }});
    api.registerTool({ name: "multi_plan", description: "多 Agent 规划", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("multi-plan"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nGoal: ${params.goal}`,
          "multi-plan",
          300
        ); }});
    api.registerTool({ name: "multi_execute", description: "多 Agent 执行", parameters: Type.Object({ plan: Type.String() }), async execute(_id, params) { const command = readCommand("multi-execute"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nPlan: ${params.plan}`,
          "multi-execute",
          600
        ); }});
    api.registerTool({ name: "multi_backend", description: "多 Agent 后端", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("multi-backend"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nSpec: ${params.spec}`,
          "multi-backend",
          600
        ); }});
    api.registerTool({ name: "multi_frontend", description: "多 Agent 前端", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("multi-frontend"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nSpec: ${params.spec}`,
          "multi-frontend",
          600
        ); }});
    api.registerTool({ name: "multi_workflow", description: "多 Agent 工作流", parameters: Type.Object({ workflow: Type.String() }), async execute(_id, params) { const command = readCommand("multi-workflow"); return await spawnAndWait(
          api,
          "chief-of-staff",
          `${command}\n\nWorkflow: ${params.workflow}`,
          "multi-workflow",
          600
        ); }});
    api.registerTool({ name: "santa_loop", description: "Santa 循环", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("santa-loop"); return await spawnAndWait(
          api,
          "loop-operator",
          `${command}\n\nGoal: ${params.goal}`,
          "santa-loop",
          600
        ); }});
  },
});
