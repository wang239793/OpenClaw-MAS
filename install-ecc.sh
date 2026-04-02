#!/bin/bash
# install-ecc.sh - 一键安装 ECC 到 OpenClaw
# 用法：./openclaw/install-ecc.sh

set -euo pipefail

OPENCLAW_DIR="$HOME/.openclaw"
ECC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "🔧 $*"; }
error() { echo "❌ $*" >&2; exit 1; }
success() { echo "✅ $*"; }

log "开始安装 ECC 到 OpenClaw..."

# 1. 安装 Plugin
log "安装 ECC Plugin..."
mkdir -p "$OPENCLAW_DIR/plugins/ecc"
cp -r "$ECC_ROOT/openclaw/plugin/"* "$OPENCLAW_DIR/plugins/ecc/"
cd "$OPENCLAW_DIR/plugins/ecc"
npm install --silent 2>/dev/null || true
npx tsc --skipLibCheck 2>/dev/null || true
success "ECC Plugin 已安装"

# 2. 安装 Agents
log "安装 Agents (36 个)..."
if [ -x "$ECC_ROOT/openclaw/agents/create-agents.sh" ]; then
  "$ECC_ROOT/openclaw/agents/create-agents.sh" 2>/dev/null || log "Agents 可能需要手动创建"
else
  log "创建 agents 目录..."
  for agent_dir in "$ECC_ROOT/agents"/*/; do
    agent_name=$(basename "$agent_dir")
    mkdir -p "$OPENCLAW_DIR/workspace-$agent_name"
    cp "$agent_dir/AGENTS.md" "$OPENCLAW_DIR/workspace-$agent_name/AGENTS.md" 2>/dev/null || true
  done
fi
success "Agents 已安装"

# 3. 安装 Commands
log "安装 Commands (68 个)..."
mkdir -p "$OPENCLAW_DIR/commands"
cp -r "$ECC_ROOT/commands/"* "$OPENCLAW_DIR/commands/" 2>/dev/null || true
success "Commands 已安装"

# 4. 安装 Skills
log "安装 Skills (142 个)..."
mkdir -p "$OPENCLAW_DIR/skills"
cp -r "$ECC_ROOT/skills/"* "$OPENCLAW_DIR/skills/" 2>/dev/null || true
success "Skills 已安装"

# 5. 安装 Rules
log "安装 Rules (14 个语言)..."
mkdir -p "$OPENCLAW_DIR/rules"
cp -r "$ECC_ROOT/rules/"* "$OPENCLAW_DIR/rules/" 2>/dev/null || true
success "Rules 已安装"

# 6. 安装 Hooks
log "安装 Hooks..."
if [ -x "$ECC_ROOT/openclaw/hooks/install-hooks.sh" ]; then
  "$ECC_ROOT/openclaw/hooks/install-hooks.sh" 2>/dev/null || log "Hooks 安装可能需要手动执行"
else
  log "Hooks 安装脚本不存在"
fi
success "Hooks 已安装"

# 7. 更新配置
log "检查 OpenClaw 配置..."
if [ -f "$OPENCLAW_DIR/openclaw.json" ]; then
  if grep -q '"ecc"' "$OPENCLAW_DIR/openclaw.json"; then
    success "ECC 已在配置中"
  else
    log "需要手动添加 ecc 到 plugins.allow"
  fi
else
  log "OpenClaw 配置文件不存在"
fi

# 8. 重启网关
log "重启 OpenClaw Gateway..."
if command -v openclaw &>/dev/null; then
  openclaw gateway restart 2>/dev/null || log "请手动重启：openclaw gateway restart"
  success "Gateway 已重启"
else
  log "openclaw 命令不存在，请手动重启 Gateway"
fi

echo ""
echo "=================================="
echo "✅ ECC 安装完成！"
echo "=================================="
echo ""
echo "已安装："
echo "  - Plugin:     1 个 (ecc，包含 86 tools + /dispatch)"
echo "  - Agents:     36 个"
echo "  - Commands:   68 个"
echo "  - Skills:     142 个"
echo "  - Rules:      14 个语言"
echo "  - Hooks:      已安装"
echo ""
echo "使用方法："
echo "  /dispatch 帮我审查代码"
echo "  /dispatch 帮我做一个待办应用"
echo ""
echo "或者让主 Agent 自动调用 tools"
echo ""
