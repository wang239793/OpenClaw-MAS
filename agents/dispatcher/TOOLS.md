# TOOLS.md - Available Tools

## ECC Plugin Tools (86 个)

### GAN 开发
| Tool | Description |
|------|-------------|
| `gan_build` | GAN 式开发循环（Planner → Generator → Evaluator） |
| `gan_design` | GAN 设计循环（专注视觉质量） |

### 代码质量
| Tool | Description |
|------|-------------|
| `code_review` | 代码审查（本地变更或 GitHub PR） |
| `e2e` | E2E 测试执行 |
| `tdd` | TDD 工作流 |
| `refactor_clean` | 重构清理 |

### 语言特定
| Language | Build | Review | Test |
|----------|-------|--------|------|
| **C++** | `cpp_build` | `cpp_review` | `cpp_test` |
| **Go** | `go_build` | `go_review` | `go_test` |
| **Kotlin** | `kotlin_build` | `kotlin_review` | `kotlin_test` |
| **Rust** | `rust_build` | `rust_review` | `rust_test` |
| **Python** | `python_build` | `python_review` | `python_test` |
| **Java** | `java_build`, `gradle_build` | `java_review` | - |
| **TypeScript** | `ts_build` | `ts_review` | - |
| **Flutter** | `flutter_build` | `flutter_review` | - |

### 其他工具
| Tool | Description |
|------|-------------|
| `security_scan` | 安全扫描 |
| `performance_audit` | 性能审计 |
| `db_review` | 数据库审查 |
| `build_error` | 构建错误解决 |
| `harness_optimize` | Harness 优化 |
| `update_docs` | 更新文档 |
| `loop_start` | 启动循环 |
| `loop_status` | 循环状态 |

## Usage

通过 `/dispatch` 命令触发：
```
/dispatch 帮我审查代码
/dispatch 帮我做一个待办应用
```
