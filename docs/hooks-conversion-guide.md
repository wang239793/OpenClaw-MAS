# ECC Hooks → OpenClaw Hooks 转换指南

**将 Everything Claude Code 的 hooks 转换为 OpenClaw 兼容的 hooks**

## 概述

### ECC Hooks vs OpenClaw Hooks

| 特性 | ECC Hooks | OpenClaw Hooks |
|------|-----------|---------------|
| **配置** | `hooks.json` | `~/.openclaw/openclaw.json` |
| **触发时机** | 每次工具调用 | 会话生命周期 |
| **脚本** | Node.js/Shell | JavaScript/Shell |
| **位置** | `hooks/` 目录 | `~/.openclaw/hooks/` |

---

## 转换策略

### 方案 1：转换为 OpenClaw 内部 Hooks

适用于：SessionStart、SessionEnd 等生命周期钩子

### 方案 2：转换为 Shell 脚本 + 别名

适用于：Pre-commit check、Tmux reminder 等

### 方案 3：转换为 OpenClaw Skills

适用于：Quality gate、TypeScript check 等

---

## 具体转换

### 1. Pre-commit Quality Check

#### ECC 原始实现

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-bash-commit-quality.js\""
  }]
}
```

#### OpenClaw 转换

**创建脚本** `~/.openclaw/hooks/pre-commit-check.sh`:

```bash
#!/bin/bash
# Pre-commit quality check for OpenClaw

set -e

echo "🔍 Running pre-commit checks..."

# 1. Check for console.log
if git diff --cached --name-only | grep -E '\.(js|ts|tsx)$' | xargs grep -l 'console\.log' 2>/dev/null; then
  echo "⚠️  Found console.log in staged files"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 2. Check for debugger
if git diff --cached --name-only | xargs grep -l 'debugger' 2>/dev/null; then
  echo "❌ Found debugger statement"
  exit 1
fi

# 3. Check for secrets (basic pattern)
if git diff --cached --name-only | xargs grep -iE '(api_key|password|secret|token)\s*[:=]' 2>/dev/null; then
  echo "⚠️  Possible secrets detected"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 4. Run linter on staged files
if command -v eslint &> /dev/null; then
  echo "🔧 Running ESLint..."
  git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|tsx)$' | xargs eslint --fix 2>/dev/null || true
fi

echo "✅ Pre-commit checks passed"
exit 0
```

**配置 Git Hooks**:

```bash
# 使脚本可执行
chmod +x ~/.openclaw/hooks/pre-commit-check.sh

# 创建 Git pre-commit hook
ln -s ~/.openclaw/hooks/pre-commit-check.sh ~/.git/hooks/pre-commit
```

---

### 2. Tmux Reminder

#### ECC 原始实现

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "node \".../auto-tmux-dev.js\""
  }]
}
```

#### OpenClaw 转换

**创建脚本** `~/.openclaw/hooks/tmux-dev.sh`:

```bash
#!/bin/bash
# Tmux dev server wrapper for OpenClaw

CMD="$@"

# Check if running in tmux
if [ -z "$TMUX" ]; then
  # Check if it's a dev server command
  if [[ "$CMD" =~ (npm run dev|yarn dev|pnpm dev|rails s|django runserver) ]]; then
    echo "⚠️  Dev server detected outside tmux"
    echo "💡 Suggestion: Run in tmux for better log access"
    echo ""
    echo "Options:"
    echo "  1. tmux new -s dev"
    echo "  2. Continue without tmux"
    echo ""
    read -p "Open tmux? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      tmux new -s dev "$CMD"
      exit 0
    fi
  fi
fi

# Execute command normally
eval "$CMD"
```

**使用方法**:

```bash
# 在 AGENTS.md 或 TOOLS.md 中添加说明
# 使用 tmux-dev 包装长运行命令
~/.openclaw/hooks/tmux-dev.sh "npm run dev"
```

---

### 3. Git Push Reminder

#### ECC 原始实现

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "node \".../pre-bash-git-push-reminder.js\""
  }]
}
```

#### OpenClaw 转换

**创建脚本** `~/.openclaw/hooks/git-push-check.sh`:

```bash
#!/bin/bash
# Git push reminder for OpenClaw

echo "🚀 Git Push Check"
echo "================"
echo ""

# Show staged changes
echo "📋 Staged changes:"
git diff --cached --stat
echo ""

# Show recent commits
echo "📝 Recent commits:"
git log --oneline -3
echo ""

# Show unpushed commits
echo "📤 Unpushed commits:"
git log --oneline @{u}..HEAD 2>/dev/null || echo "  (none)"
echo ""

read -p "Continue with push? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push "$@"
else
  echo "Push cancelled"
  exit 1
fi
```

**使用方法**:

```bash
# 创建 git 别名
echo "alias gpush='~/.openclaw/hooks/git-push-check.sh'" >> ~/.zshrc
source ~/.zshrc

# 使用
gpush
```

---

### 4. Console.log Warning (Post-Edit)

#### ECC 原始实现

```json
{
  "matcher": "Edit",
  "hooks": [{
    "type": "command",
    "command": "node \".../post-edit-console-warn.js\""
  }]
}
```

#### OpenClaw 转换

**创建 Skill** `~/.openclaw/skills/console-check/SKILL.md`:

```markdown
---
name: console_check
description: Check for console.log statements in modified files
user-invocable: true
---

# Console.log Check

## When to Use

- Before committing code
- After editing JavaScript/TypeScript files
- As part of code review

## How to Run

```bash
# Check staged files
git diff --cached --name-only | grep -E '\.(js|ts|tsx)$' | xargs grep -n 'console\.log'

# Check all modified files
git diff --name-only | grep -E '\.(js|ts|tsx)$' | xargs grep -n 'console\.log'

# Find and remove
find src -name '*.ts' -o -name '*.js' | xargs grep -l 'console\.log'
```

## Auto-Fix

```bash
# Remove all console.log (be careful!)
git diff --cached --name-only | grep -E '\.(js|ts|tsx)$' | xargs sed -i '' '/console\.log/d'
```
```

---

### 5. TypeScript Check (Post-Edit)

#### ECC 原始实现

```json
{
  "matcher": "Edit",
  "hooks": [{
    "type": "command",
    "command": "node \".../post-edit-typecheck.js\""
  }]
}
```

#### OpenClaw 转换

**创建 Skill** `~/.openclaw/skills/typecheck/SKILL.md`:

```markdown
---
name: typecheck
description: Run TypeScript type checking
user-invocable: true
---

# TypeScript Type Check

## When to Use

- After editing TypeScript files
- Before committing
- As part of CI/CD

## How to Run

```bash
# Quick check (no emit)
tsc --noEmit

# Watch mode
tsc --noEmit --watch

# Specific project
tsc --project tsconfig.json --noEmit
```

## Pre-commit Integration

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
if command -v tsc &> /dev/null; then
  echo "🔍 Running TypeScript check..."
  tsc --noEmit || exit 1
fi
```
```

---

### 6. Session Start (Lifecycle)

#### ECC 原始实现

```json
{
  "matcher": "*",
  "hooks": [{
    "type": "command",
    "command": "node \".../session-start-bootstrap.js\""
  }]
}
```

#### OpenClaw 转换

OpenClaw 已有内部 hooks 实现类似功能：

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": { "enabled": true }
      }
    }
  }
}
```

**增强版本** - 创建 `~/.openclaw/hooks/session-start.sh`:

```bash
#!/bin/bash
# Session start bootstrap for OpenClaw

echo "🦞 OpenClaw Session Started"
echo "=========================="
echo ""

# Show current directory
echo "📁 Working directory: $(pwd)"

# Show git branch
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "🌿 Git branch: $(git branch --show-current)"
fi

# Show package manager
if [ -f "package.json" ]; then
  if [ -f "pnpm-lock.yaml" ]; then
    echo "📦 Package manager: pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "📦 Package manager: yarn"
  elif [ -f "bun.lockb" ]; then
    echo "📦 Package manager: bun"
  else
    echo "📦 Package manager: npm"
  fi
fi

# Show recent memory
if [ -f "~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md" ]; then
  echo ""
  echo "📝 Today's memory:"
  tail -10 "~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md"
fi

echo ""
```

---

### 7. Cost Tracker (Lifecycle)

#### ECC 原始实现

```json
{
  "matcher": "*",
  "hooks": [{
    "type": "command",
    "command": "node \".../cost-tracker.js\""
  }]
}
```

#### OpenClaw 转换

OpenClaw 已有 `/usage` 命令，可以创建增强脚本：

**创建脚本** `~/.openclaw/hooks/cost-logger.sh`:

```bash
#!/bin/bash
# Cost tracker for OpenClaw

LOG_FILE="~/.openclaw/logs/cost-$(date +%Y-%m).jsonl"

# Get usage from OpenClaw
usage=$(openclaw status --usage 2>/dev/null)

# Log to file
echo "{\"timestamp\":\"$(date -Iseconds)\",\"usage\":\"$usage\"}" >> "$LOG_FILE"

# Show summary
echo "💰 Cost Tracker"
echo "=============="
echo "Monthly log: $LOG_FILE"
echo ""
echo "$usage"
```

---

## 批量安装脚本

**创建** `~/.openclaw/hooks/install-all.sh`:

```bash
#!/bin/bash
# Install all converted hooks

set -e

HOOKS_DIR="$HOME/.openclaw/hooks"

echo "🦞 Installing OpenClaw Hooks..."
echo ""

# Create hooks directory
mkdir -p "$HOOKS_DIR"

# Download hooks (from ECC project or create locally)
echo "📥 Downloading hooks..."

# Copy from ECC project if available
if [ -d "$HOME/.openclaw/project/everything-claude-code/scripts/hooks" ]; then
  cp "$HOME/.openclaw/project/everything-claude-code/scripts/hooks/"*.sh "$HOOKS_DIR/" 2>/dev/null || true
fi

# Make all scripts executable
chmod +x "$HOOKS_DIR"/*.sh 2>/dev/null || true

# Setup Git hooks
echo ""
echo "🔗 Setting up Git hooks..."
if [ -d ".git/hooks" ]; then
  ln -sf "$HOOKS_DIR/pre-commit-check.sh" ".git/hooks/pre-commit" 2>/dev/null || true
  echo "✅ Pre-commit hook linked"
fi

# Add aliases to shell
echo ""
echo "📝 Adding shell aliases..."
cat >> ~/.zshrc << 'EOF'

# OpenClaw Hooks
alias gpush='~/.openclaw/hooks/git-push-check.sh'
alias tmux-dev='~/.openclaw/hooks/tmux-dev.sh'
alias cost-tracker='~/.openclaw/hooks/cost-logger.sh'
EOF

echo ""
echo "✅ Hooks installed!"
echo ""
echo "Next steps:"
echo "1. source ~/.zshrc"
echo "2. Test: gpush (or git push)"
echo "3. Test: tmux-dev \"npm run dev\""
```

---

## 使用指南

### 1. 安装所有 Hooks

```bash
cd ~/.openclaw/project/everything-claude-code/openclaw
./hooks/install-all.sh
source ~/.zshrc
```

### 2. 测试 Hooks

```bash
# Test pre-commit
git commit -m "test: hook check"

# Test git push
gpush

# Test tmux dev
tmux-dev "npm run dev"

# Test cost tracker
cost-tracker
```

### 3. 自定义配置

编辑 `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "boot-md": { "enabled": true },
        "bootstrap-extra-files": { "enabled": true },
        "command-logger": { "enabled": true },
        "session-memory": { "enabled": true }
      }
    }
  }
}
```

---

## 总结

### 已转换的 Hooks

| ECC Hook | OpenClaw 转换 | 状态 |
|----------|--------------|------|
| Pre-commit quality | `pre-commit-check.sh` | ✅ |
| Tmux reminder | `tmux-dev.sh` | ✅ |
| Git push reminder | `git-push-check.sh` | ✅ |
| Console.log warning | `skills/console-check` | ✅ |
| TypeScript check | `skills/typecheck` | ✅ |
| Session start | `session-start.sh` | ✅ |
| Cost tracker | `cost-logger.sh` | ✅ |

### 下一步

1. 创建所有转换脚本
2. 测试每个 hook
3. 添加到 ECC 项目的 `openclaw/hooks/` 目录
4. 更新文档

---

**最后更新**: 2026-04-01 14:30
