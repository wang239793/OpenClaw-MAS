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
  description: "Everything Claude Code - Core Plugin",
  
  register(api) {
    // 注册 /dispatch 命令
    api.registerCommand({
      name: "dispatch",
      description: "理解用户意图并调用正确的工具",
      acceptsArgs: true,
      handler: async (ctx: PluginCommandContext) => {
        const input = ctx.args || ctx.commandBody;

        // dispatcher agent 自己理解用户意图，选择工具
        // 这里不需要硬编码映射，让 LLM 来决定
        const runResult = await api.runtime.subagent.run({
          sessionKey: "dispatcher",
          message: `请理解用户意图并调用正确的工具：${input}`,
          deliver: false
        });

        // 等待子代理完成并获取结果
        const waitResult = await api.runtime.subagent.waitForRun({
          runId: runResult.runId,
          timeoutMs: 300000
        });

        if (waitResult.status === "error") {
          return { text: `处理失败：${waitResult.error}` };
        }
        if (waitResult.status === "timeout") {
          return { text: "处理超时，请稍后重试" };
        }

        // 获取子代理的消息
        const messages = await api.runtime.subagent.getSessionMessages({
          sessionKey: "dispatcher",
          limit: 10
        });

        const lastMessage: any = messages.messages[messages.messages.length - 1];
        const responseText = (lastMessage?.content as string) || `已处理：${input}`;

        return { text: responseText };
      }
    });
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "planner",
          task: `${command}\n\nBrief: ${params.brief}`,
          label: `gan-build`,
          runTimeoutSeconds: params.max_iterations * 60,
        });
        return { content: [{ type: "text", text: `🚀 GAN Build 已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "architect",
          task: `${command}\n\nBrief: ${params.brief}`,
          label: `gan-design`,
          runTimeoutSeconds: params.max_iterations * 60,
        });
        return { content: [{ type: "text", text: `🎨 GAN Design 已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "reviewer",
          task: `${command}\n\nPR: ${params.pr || "local"}`,
          label: "code-review",
          runTimeoutSeconds: 600,
        });
        return { content: [{ type: "text", text: `🔍 代码审查已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "e2e-runner",
          task: `${command}\n\nSuite: ${params.suite || "all"}`,
          label: "e2e-test",
          runTimeoutSeconds: 600,
        });
        return { content: [{ type: "text", text: `🧪 E2E 测试已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "main",
          task: `${command}\n\nName: ${params.name || "auto"}`,
          label: "checkpoint",
          runTimeoutSeconds: 120,
        });
        return { content: [{ type: "text", text: `💾 检查点已保存\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "gan-evaluator",
          task: `${command}\n\nTarget: ${params.target || "current"}`,
          label: "eval",
          runTimeoutSeconds: 300,
        });
        return { content: [{ type: "text", text: `📊 评估已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "tdd-guide",
          task: `${command}\n\nFeature: ${params.feature}`,
          label: "tdd",
          runTimeoutSeconds: 600,
        });
        return { content: [{ type: "text", text: `🔴 TDD 已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "refactor-cleaner",
          task: `${command}\n\nTarget: ${params.target || "current"}`,
          label: "refactor-clean",
          runTimeoutSeconds: 600,
        });
        return { content: [{ type: "text", text: `🧹 重构已启动\n会话：${result.childSessionKey}` }] };
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
        const result = await api.runtime.sessionsSpawn({
          agentId: "cpp-build-resolver",
          task: `${command}\n\nTarget: ${params.target || "."}`,
          label: "cpp-build",
          runTimeoutSeconds: 300,
        });
        return { content: [{ type: "text", text: `🔨 C++ Build 已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    api.registerTool({
      name: "cpp_review",
      description: "C++ 代码审查",
      parameters: Type.Object({ pr: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("cpp-review");
        const result = await api.runtime.sessionsSpawn({
          agentId: "cpp-reviewer",
          task: `${command}\n\nPR: ${params.pr || "local"}`,
          label: "cpp-review",
          runTimeoutSeconds: 300,
        });
        return { content: [{ type: "text", text: `🔍 C++ Review 已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    api.registerTool({
      name: "cpp_test",
      description: "C++ 测试",
      parameters: Type.Object({ target: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("cpp-test");
        const result = await api.runtime.sessionsSpawn({
          agentId: "cpp-build-resolver",
          task: `${command}\n\nTarget: ${params.target || "."}`,
          label: "cpp-test",
          runTimeoutSeconds: 300,
        });
        return { content: [{ type: "text", text: `🧪 C++ Test 已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    // Go
    api.registerTool({ name: "go_build", description: "Go 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-build"); const result = await api.runtime.sessionsSpawn({ agentId: "go-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "go-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔨 Go Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "go_review", description: "Go 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-review"); const result = await api.runtime.sessionsSpawn({ agentId: "go-reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "go-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 Go Review 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "go_test", description: "Go 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("go-test"); const result = await api.runtime.sessionsSpawn({ agentId: "go-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "go-test", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🧪 Go Test 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Kotlin
    api.registerTool({ name: "kotlin_build", description: "Kotlin 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-build"); const result = await api.runtime.sessionsSpawn({ agentId: "kotlin-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "kotlin-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔨 Kotlin Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "kotlin_review", description: "Kotlin 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-review"); const result = await api.runtime.sessionsSpawn({ agentId: "kotlin-reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "kotlin-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 Kotlin Review 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "kotlin_test", description: "Kotlin 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("kotlin-test"); const result = await api.runtime.sessionsSpawn({ agentId: "kotlin-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "kotlin-test", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🧪 Kotlin Test 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Rust
    api.registerTool({ name: "rust_build", description: "Rust 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rust-build"); const result = await api.runtime.sessionsSpawn({ agentId: "rust-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "rust-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔨 Rust Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "rust_review", description: "Rust 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rust-review"); const result = await api.runtime.sessionsSpawn({ agentId: "rust-reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "rust-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 Rust Review 已启动\n会话：${result.childSessionKey}` }] }; }});

    // 其他语言
    api.registerTool({ name: "python_review", description: "Python 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("python-review"); const result = await api.runtime.sessionsSpawn({ agentId: "python-reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "python-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 Python Review 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "java_build", description: "Java 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("gradle-build"); const result = await api.runtime.sessionsSpawn({ agentId: "java-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "java-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔨 Java Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "gradle_build", description: "Gradle 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("gradle-build"); const result = await api.runtime.sessionsSpawn({ agentId: "gradle-build-resolver", task: `${command}\n\nTarget: ${params.target || "."}`, label: "gradle-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔨 Gradle Build 已启动\n会话：${result.childSessionKey}` }] }; }});

    // ========== 基础 Tools（3 个）==========
    
    api.registerTool({
      name: "context_budget",
      description: "审计上下文窗口消耗",
      parameters: Type.Object({}),
      async execute(_id, _params) {
        const command = readCommand("context-budget");
        const result = await api.runtime.sessionsSpawn({ agentId: "main", task: command, label: "context-budget", runTimeoutSeconds: 300 });
        return { content: [{ type: "text", text: `📊 上下文审计已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    api.registerTool({
      name: "build_fix",
      description: "构建错误修复",
      parameters: Type.Object({ error: Type.Optional(Type.String()) }),
      async execute(_id, params) {
        const command = readCommand("build-fix");
        const result = await api.runtime.sessionsSpawn({ agentId: "reviewer", task: `${command}\n\nError: ${params.error || "auto"}`, label: "build-fix", runTimeoutSeconds: 300 });
        return { content: [{ type: "text", text: `🔧 构建修复已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    api.registerTool({
      name: "docs",
      description: "文档查询",
      parameters: Type.Object({ query: Type.String() }),
      async execute(_id, params) {
        const command = readCommand("docs");
        const result = await api.runtime.sessionsSpawn({ agentId: "docs-lookup", task: `${command}\n\nQuery: ${params.query}`, label: "docs", runTimeoutSeconds: 300 });
        return { content: [{ type: "text", text: `📖 文档查询已启动\n会话：${result.childSessionKey}` }] };
      },
    });

    // ========== 其他 Tools（40 个）==========
    
    // 安全/性能
    api.registerTool({ name: "security_scan", description: "安全扫描", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "security-reviewer", task: `Scan for security issues\n\nTarget: ${params.target || "."}`, label: "security-scan", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔒 安全扫描已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "performance_audit", description: "性能审计", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "performance-optimizer", task: `Audit performance\n\nTarget: ${params.target || "."}`, label: "perf-audit", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `⚡ 性能审计已启动\n会话：${result.childSessionKey}` }] }; }});

    // 数据库
    api.registerTool({ name: "db_review", description: "数据库审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("code-review"); const result = await api.runtime.sessionsSpawn({ agentId: "database-reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "db-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🗄️ 数据库审查已启动\n会话：${result.childSessionKey}` }] }; }});

    // 构建错误
    api.registerTool({ name: "build_error", description: "构建错误解决", parameters: Type.Object({ error: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "build-error-resolver", task: `Fix build error\n\nError: ${params.error || "auto"}`, label: "build-error", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔧 构建错误解决已启动\n会话：${result.childSessionKey}` }] }; }});

    // Java/Gradle
    api.registerTool({ name: "java_review", description: "Java 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "java-build-resolver", task: `Review Java code\n\nPR: ${params.pr || "local"}`, label: "java-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `☕ Java Review 已启动\n会话：${result.childSessionKey}` }] }; }});

    // TypeScript
    api.registerTool({ name: "typescript_review", description: "TypeScript 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "typescript-reviewer", task: `Review TypeScript code\n\nPR: ${params.pr || "local"}`, label: "ts-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📘 TS Review 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "typescript_build", description: "TypeScript 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "typescript-reviewer", task: `Build TypeScript\n\nTarget: ${params.target || "."}`, label: "ts-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📘 TS Build 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Python
    api.registerTool({ name: "python_build", description: "Python 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "python-reviewer", task: `Build Python project\n\nTarget: ${params.target || "."}`, label: "python-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🐍 Python Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "python_test", description: "Python 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "python-reviewer", task: `Run Python tests\n\nTarget: ${params.target || "."}`, label: "python-test", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🐍 Python Test 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Flutter
    api.registerTool({ name: "flutter_build", description: "Flutter 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "flutter-reviewer", task: `Build Flutter app\n\nTarget: ${params.target || "."}`, label: "flutter-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📱 Flutter Build 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "flutter_review", description: "Flutter 代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "flutter-reviewer", task: `Review Flutter code\n\nPR: ${params.pr || "local"}`, label: "flutter-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📱 Flutter Review 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Healthcare
    api.registerTool({ name: "healthcare_review", description: "医疗代码审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "healthcare-reviewer", task: `Review healthcare code\n\nPR: ${params.pr || "local"}`, label: "healthcare-review", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🏥 医疗代码审查已启动\n会话：${result.childSessionKey}` }] }; }});

    // PyTorch
    api.registerTool({ name: "pytorch_build", description: "PyTorch 构建", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "pytorch-build-resolver", task: `Build PyTorch project\n\nTarget: ${params.target || "."}`, label: "pytorch-build", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔥 PyTorch Build 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Rust test
    api.registerTool({ name: "rust_test", description: "Rust 测试", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "rust-build-resolver", task: `Run Rust tests\n\nTarget: ${params.target || "."}`, label: "rust-test", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🦀 Rust Test 已启动\n会话：${result.childSessionKey}` }] }; }});

    // Harness optimizer
    api.registerTool({ name: "harness_optimize", description: "Harness 优化", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "harness-optimizer", task: `Optimize agent harness\n\nTarget: ${params.target || "."}`, label: "harness-optimize", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `⚙️ Harness 优化已启动\n会话：${result.childSessionKey}` }] }; }});

    // Doc updater
    api.registerTool({ name: "update_docs", description: "更新文档", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("update-docs"); const result = await api.runtime.sessionsSpawn({ agentId: "doc-updater", task: `${command}\n\nTarget: ${params.target || "."}`, label: "update-docs", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📝 文档更新已启动\n会话：${result.childSessionKey}` }] }; }});

    // Loop operator
    api.registerTool({ name: "loop_start", description: "启动循环", parameters: Type.Object({ task: Type.String() }), async execute(_id, params) { const command = readCommand("loop-start"); const result = await api.runtime.sessionsSpawn({ agentId: "loop-operator", task: `${command}\n\nTask: ${params.task}`, label: "loop-start", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🔄 循环已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "loop_status", description: "循环状态", parameters: Type.Object({}), async execute(_id, _params) { const command = readCommand("loop-status"); const result = await api.runtime.sessionsSpawn({ agentId: "loop-operator", task: command, label: "loop-status", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `🔄 循环状态已查询\n会话：${result.childSessionKey}` }] }; }});

    // Opensource
    api.registerTool({ name: "opensource_fork", description: "Fork 管理", parameters: Type.Object({ repo: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "opensource-forker", task: `Manage fork\n\nRepo: ${params.repo || "current"}`, label: "oss-fork", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🍴 Fork 管理已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "opensource_package", description: "打包发布", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "opensource-packager", task: `Package project\n\nTarget: ${params.target || "."}`, label: "oss-package", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📦 打包发布已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "opensource_clean", description: "代码清理", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const result = await api.runtime.sessionsSpawn({ agentId: "opensource-sanitizer", task: `Clean code\n\nTarget: ${params.target || "."}`, label: "oss-clean", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🧹 代码清理已启动\n会话：${result.childSessionKey}` }] }; }});

    // PRP 工作流（5 个）
    api.registerTool({ name: "prp_prd", description: "PRP 产品需求文档", parameters: Type.Object({ feature: Type.String() }), async execute(_id, params) { const command = readCommand("prp-prd"); const result = await api.runtime.sessionsSpawn({ agentId: "planner", task: `${command}\n\nFeature: ${params.feature}`, label: "prp-prd", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📋 PRD 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prp_plan", description: "PRP 规划", parameters: Type.Object({ feature: Type.String() }), async execute(_id, params) { const command = readCommand("prp-plan"); const result = await api.runtime.sessionsSpawn({ agentId: "planner", task: `${command}\n\nFeature: ${params.feature}`, label: "prp-plan", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📋 规划已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prp_implement", description: "PRP 实现", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("prp-implement"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nSpec: ${params.spec}`, label: "prp-implement", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `💻 实现已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prp_pr", description: "PRP PR 审查", parameters: Type.Object({ pr: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("prp-pr"); const result = await api.runtime.sessionsSpawn({ agentId: "reviewer", task: `${command}\n\nPR: ${params.pr || "local"}`, label: "prp-pr", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 PR 审查已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prp_commit", description: "PRP Commit", parameters: Type.Object({ message: Type.String() }), async execute(_id, params) { const command = readCommand("prp-commit"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nMessage: ${params.message}`, label: "prp-commit", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `✅ Commit 已启动\n会话：${result.childSessionKey}` }] }; }});

    // 其他工具
    api.registerTool({ name: "quality_gate", description: "质量门检查", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("quality-gate"); const result = await api.runtime.sessionsSpawn({ agentId: "reviewer", task: `${command}\n\nTarget: ${params.target || "."}`, label: "quality-gate", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🚪 质量门检查已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "test_coverage", description: "测试覆盖率", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("test-coverage"); const result = await api.runtime.sessionsSpawn({ agentId: "e2e-runner", task: `${command}\n\nTarget: ${params.target || "."}`, label: "test-coverage", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📊 测试覆盖率已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "refactor", description: "重构", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("refactor-clean"); const result = await api.runtime.sessionsSpawn({ agentId: "refactor-cleaner", task: `${command}\n\nTarget: ${params.target || "."}`, label: "refactor", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🧹 重构已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "verify", description: "验证", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("verify"); const result = await api.runtime.sessionsSpawn({ agentId: "reviewer", task: `${command}\n\nTarget: ${params.target || "."}`, label: "verify", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `✅ 验证已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "promote", description: "推广", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("promote"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "promote", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📢 推广已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prune", description: "修剪", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("prune"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "prune", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `✂️ 修剪已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "rules_distill", description: "规则提炼", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("rules-distill"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "rules-distill", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📜 规则提炼已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "skill_create", description: "创建技能", parameters: Type.Object({ name: Type.String() }), async execute(_id, params) { const command = readCommand("skill-create"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nName: ${params.name}`, label: "skill-create", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🛠️ 技能创建已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "skill_health", description: "技能健康检查", parameters: Type.Object({ name: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("skill-health"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nName: ${params.name || "all"}`, label: "skill-health", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🏥 技能健康检查已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "prompt_optimize", description: "提示优化", parameters: Type.Object({ prompt: Type.String() }), async execute(_id, params) { const command = readCommand("prompt-optimize"); const result = await api.runtime.sessionsSpawn({ agentId: "performance-optimizer", task: `${command}\n\nPrompt: ${params.prompt}`, label: "prompt-optimize", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `⚡ 提示优化已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "save_session", description: "保存会话", parameters: Type.Object({ name: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("save-session"); const result = await api.runtime.sessionsSpawn({ agentId: "main", task: `${command}\n\nName: ${params.name || "auto"}`, label: "save-session", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `💾 会话已保存\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "resume_session", description: "恢复会话", parameters: Type.Object({ name: Type.String() }), async execute(_id, params) { const command = readCommand("resume-session"); const result = await api.runtime.sessionsSpawn({ agentId: "main", task: `${command}\n\nName: ${params.name}`, label: "resume-session", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `💾 会话已恢复\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "setup_pm", description: "设置项目管理", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("setup-pm"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "setup-pm", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📋 项目管理已设置\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "update_codemaps", description: "更新代码地图", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("update-codemaps"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "update-codemaps", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🗺️ 代码地图已更新\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "learn", description: "学习", parameters: Type.Object({ topic: Type.String() }), async execute(_id, params) { const command = readCommand("learn"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTopic: ${params.topic}`, label: "learn", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📚 学习已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "learn_eval", description: "学习评估", parameters: Type.Object({ topic: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("learn-eval"); const result = await api.runtime.sessionsSpawn({ agentId: "gan-evaluator", task: `${command}\n\nTopic: ${params.topic || "current"}`, label: "learn-eval", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📚 学习评估已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "instinct_status", description: "本能状态", parameters: Type.Object({}), async execute(_id, _params) { const command = readCommand("instinct-status"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: command, label: "instinct-status", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `📊 本能状态已查询\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "instinct_export", description: "本能导出", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("instinct-export"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nTarget: ${params.target || "."}`, label: "instinct-export", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📤 本能导出已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "instinct_import", description: "本能导入", parameters: Type.Object({ source: Type.String() }), async execute(_id, params) { const command = readCommand("instinct-import"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nSource: ${params.source}`, label: "instinct-import", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📥 本能导入已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "harness_audit", description: "Harness 审计", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("harness-audit"); const result = await api.runtime.sessionsSpawn({ agentId: "harness-optimizer", task: `${command}\n\nTarget: ${params.target || "."}`, label: "harness-audit", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🔍 Harness 审计已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "evolve", description: "进化", parameters: Type.Object({ target: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("evolve"); const result = await api.runtime.sessionsSpawn({ agentId: "performance-optimizer", task: `${command}\n\nTarget: ${params.target || "."}`, label: "evolve", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🧬 进化已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "devfleet", description: "开发舰队", parameters: Type.Object({ action: Type.String() }), async execute(_id, params) { const command = readCommand("devfleet"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nAction: ${params.action}`, label: "devfleet", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `🚢 开发舰队已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "claw", description: "Claw 工具", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("claw"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nAction: ${params.action || "status"}`, label: "claw", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `🦞 Claw 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "aside", description: "旁注", parameters: Type.Object({ note: Type.String() }), async execute(_id, params) { const command = readCommand("aside"); const result = await api.runtime.sessionsSpawn({ agentId: "main", task: `${command}\n\nNote: ${params.note}`, label: "aside", runTimeoutSeconds: 60 }); return { content: [{ type: "text", text: `📝 旁注已记录\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "plan", description: "规划", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("plan"); const result = await api.runtime.sessionsSpawn({ agentId: "planner", task: `${command}\n\nGoal: ${params.goal}`, label: "plan", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📋 规划已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "projects", description: "项目管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("projects"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nAction: ${params.action || "list"}`, label: "projects", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `📁 项目管理已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "sessions", description: "会话管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("sessions"); const result = await api.runtime.sessionsSpawn({ agentId: "main", task: `${command}\n\nAction: ${params.action || "list"}`, label: "sessions", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `📊 会话管理已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "pm2", description: "PM2 进程管理", parameters: Type.Object({ action: Type.Optional(Type.String()) }), async execute(_id, params) { const command = readCommand("pm2"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nAction: ${params.action || "list"}`, label: "pm2", runTimeoutSeconds: 120 }); return { content: [{ type: "text", text: `📊 PM2 已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "orchestrate", description: "编排", parameters: Type.Object({ workflow: Type.String() }), async execute(_id, params) { const command = readCommand("orchestrate"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nWorkflow: ${params.workflow}`, label: "orchestrate", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🎼 编排已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "multi_plan", description: "多 Agent 规划", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("multi-plan"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nGoal: ${params.goal}`, label: "multi-plan", runTimeoutSeconds: 300 }); return { content: [{ type: "text", text: `📋 多 Agent 规划已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "multi_execute", description: "多 Agent 执行", parameters: Type.Object({ plan: Type.String() }), async execute(_id, params) { const command = readCommand("multi-execute"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nPlan: ${params.plan}`, label: "multi-execute", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `💻 多 Agent 执行已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "multi_backend", description: "多 Agent 后端", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("multi-backend"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nSpec: ${params.spec}`, label: "multi-backend", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🔧 多 Agent 后端已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "multi_frontend", description: "多 Agent 前端", parameters: Type.Object({ spec: Type.String() }), async execute(_id, params) { const command = readCommand("multi-frontend"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nSpec: ${params.spec}`, label: "multi-frontend", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🎨 多 Agent 前端已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "multi_workflow", description: "多 Agent 工作流", parameters: Type.Object({ workflow: Type.String() }), async execute(_id, params) { const command = readCommand("multi-workflow"); const result = await api.runtime.sessionsSpawn({ agentId: "chief-of-staff", task: `${command}\n\nWorkflow: ${params.workflow}`, label: "multi-workflow", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🔄 多 Agent 工作流已启动\n会话：${result.childSessionKey}` }] }; }});
    api.registerTool({ name: "santa_loop", description: "Santa 循环", parameters: Type.Object({ goal: Type.String() }), async execute(_id, params) { const command = readCommand("santa-loop"); const result = await api.runtime.sessionsSpawn({ agentId: "loop-operator", task: `${command}\n\nGoal: ${params.goal}`, label: "santa-loop", runTimeoutSeconds: 600 }); return { content: [{ type: "text", text: `🎅 Santa 循环已启动\n会话：${result.childSessionKey}` }] }; }});
  },
});
