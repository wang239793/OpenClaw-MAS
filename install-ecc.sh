#!/bin/bash
# ══════════════════════════════════════════════════════════════
# ECC (Everything Claude Code) · OpenClaw 一键安装脚本
# ══════════════════════════════════════════════════════════════
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OC_HOME="$HOME/.openclaw"
OC_CFG="$OC_HOME/openclaw.json"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

banner() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  🦞  ECC · OpenClaw Multi-Agent System  ║${NC}"
  echo -e "${BLUE}║       安装向导                            ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

log()   { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }

# ── Step 0: 依赖检查 ──────────────────────────────────────────
check_deps() {
  info "检查依赖..."
  
  if ! command -v openclaw &>/dev/null; then
    error "未找到 openclaw CLI。请先安装 OpenClaw: https://docs.openclaw.ai"
    exit 1
  fi
  log "OpenClaw CLI: $(openclaw --version 2>/dev/null || echo 'OK')"

  if ! command -v node &>/dev/null; then
    error "未找到 node"
    exit 1
  fi
  log "Node.js: $(node --version)"

  if ! command -v npm &>/dev/null; then
    error "未找到 npm"
    exit 1
  fi
  log "npm: $(npm --version)"

  if [ ! -f "$OC_CFG" ]; then
    error "未找到 openclaw.json。请先运行 openclaw 完成初始化。"
    exit 1
  fi
  log "openclaw.json: $OC_CFG"
}

# ── Step 0.5: 备份已有数据 ────────────────────────────────────
backup_existing() {
  BACKUP_DIR="$OC_HOME/backups/pre-ecc-install-$(date +%Y%m%d-%H%M%S)"
  HAS_EXISTING=false

  # 检查是否有已存在的 workspace
  for d in "$OC_HOME"/workspace-*/; do
    if [ -d "$d" ]; then
      HAS_EXISTING=true
      break
    fi
  done

  if $HAS_EXISTING; then
    info "检测到已有 Agent Workspace，自动备份中..."
    mkdir -p "$BACKUP_DIR"

    # 备份所有 workspace 目录
    for d in "$OC_HOME"/workspace-*/; do
      if [ -d "$d" ]; then
        ws_name=$(basename "$d")
        cp -R "$d" "$BACKUP_DIR/$ws_name"
      fi
    done

    # 备份 openclaw.json
    if [ -f "$OC_CFG" ]; then
      cp "$OC_CFG" "$BACKUP_DIR/openclaw.json"
    fi

    log "已备份到：$BACKUP_DIR"
    info "如需恢复，运行：cp -R $BACKUP_DIR/workspace-* $OC_HOME/"
  fi
}

# ── Step 1: 创建 Workspace ────────────────────────────────────
create_workspaces() {
  info "创建 Agent Workspace..."
  
  # 从 agents 目录读取所有 agent
  AGENTS_DIR="$REPO_DIR/agents"
  if [ ! -d "$AGENTS_DIR" ]; then
    error "未找到 agents 目录：$AGENTS_DIR"
    exit 1
  fi

  COUNT=0
  for agent_dir in "$AGENTS_DIR"/*/; do
    if [ -d "$agent_dir" ]; then
      agent_name=$(basename "$agent_dir")
      ws="$OC_HOME/workspace-$agent_name"
      mkdir -p "$ws"
      
      # 复制 AGENTS.md
      if [ -f "$agent_dir/AGENTS.md" ]; then
        cp "$agent_dir/AGENTS.md" "$ws/AGENTS.md"
      fi
      
      COUNT=$((COUNT + 1))
    fi
  done

  log "已创建 $COUNT 个 Agent Workspace"
}

# ── Step 2: 安装 Plugin ──────────────────────────────────────
install_plugin() {
  info "安装 ECC Plugin..."
  
  PLUGIN_SRC="$REPO_DIR/openclaw/plugin"
  PLUGIN_DST="$OC_HOME/plugins/ecc"
  
  if [ ! -d "$PLUGIN_SRC" ]; then
    error "未找到 plugin 目录：$PLUGIN_SRC"
    exit 1
  fi
  
  # 备份旧版本
  if [ -d "$PLUGIN_DST" ]; then
    BACKUP_PLUGIN="$OC_HOME/plugins/ecc.bak.$(date +%Y%m%d-%H%M%S)"
    mv "$PLUGIN_DST" "$BACKUP_PLUGIN"
    info "已备份旧 plugin 到：$BACKUP_PLUGIN"
  fi
  
  # 复制 plugin
  mkdir -p "$PLUGIN_DST"
  cp -r "$PLUGIN_SRC/"* "$PLUGIN_DST/"
  
  # 安装依赖并编译
  cd "$PLUGIN_DST"
  npm install --silent 2>/dev/null || npm install
  npx tsc --skipLibCheck 2>/dev/null || npx tsc
  
  log "ECC Plugin 已安装：$PLUGIN_DST"
}

# ── Step 3: 安装 Commands ─────────────────────────────────────
install_commands() {
  info "安装 Commands (68 个)..."
  
  CMDS_SRC="$REPO_DIR/commands"
  CMDS_DST="$OC_HOME/commands"
  
  if [ ! -d "$CMDS_SRC" ]; then
    error "未找到 commands 目录：$CMDS_SRC"
    exit 1
  fi
  
  mkdir -p "$CMDS_DST"
  cp -r "$CMDS_SRC/"* "$CMDS_DST/"
  
  log "Commands 已安装：$CMDS_DST"
}

# ── Step 4: 安装 Skills ──────────────────────────────────────
install_skills() {
  info "安装 Skills (142 个)..."
  
  SKILLS_SRC="$REPO_DIR/skills"
  SKILLS_DST="$OC_HOME/skills"
  
  if [ ! -d "$SKILLS_SRC" ]; then
    error "未找到 skills 目录：$SKILLS_SRC"
    exit 1
  fi
  
  mkdir -p "$SKILLS_DST"
  cp -r "$SKILLS_SRC/"* "$SKILLS_DST/"
  
  log "Skills 已安装：$SKILLS_DST"
}

# ── Step 5: 安装 Rules ───────────────────────────────────────
install_rules() {
  info "安装 Rules (14 个语言)..."
  
  RULES_SRC="$REPO_DIR/rules"
  RULES_DST="$OC_HOME/rules"
  
  if [ ! -d "$RULES_SRC" ]; then
    error "未找到 rules 目录：$RULES_SRC"
    exit 1
  fi
  
  mkdir -p "$RULES_DST"
  cp -r "$RULES_SRC/"* "$RULES_DST/"
  
  log "Rules 已安装：$RULES_DST"
}

# ── Step 6: 安装 Hooks ───────────────────────────────────────
install_hooks() {
  info "安装 Hooks..."
  
  HOOKS_INSTALLER="$REPO_DIR/openclaw/hooks/install-hooks.sh"
  
  if [ -x "$HOOKS_INSTALLER" ]; then
    "$HOOKS_INSTALLER" 2>/dev/null || warn "Hooks 安装可能有警告"
    log "Hooks 已安装"
  else
    warn "Hooks 安装脚本不存在：$HOOKS_INSTALLER"
  fi
}

# ── Step 7: 更新配置 ─────────────────────────────────────────
update_config() {
  info "更新 OpenClaw 配置..."
  
  python3 << 'PYEOF'
import json, pathlib

cfg_path = pathlib.Path.home() / '.openclaw' / 'openclaw.json'
cfg = json.loads(cfg_path.read_text())

# 添加 ecc 到 plugins.allow
plugins = cfg.setdefault('plugins', {})
allow_list = plugins.get('allow', [])
if 'ecc' not in allow_list:
    allow_list.insert(0, 'ecc')  # 插到最前面
    plugins['allow'] = allow_list
    print('  + added ecc to plugins.allow')
else:
    print('  ~ ecc already in plugins.allow')

# 添加 ecc 到 plugins.load.paths
load = plugins.get('load', {})
paths = load.get('paths', [])
ecc_path = str(pathlib.Path.home() / '.openclaw' / 'plugins' / 'ecc')
if ecc_path not in paths:
    paths.insert(0, ecc_path)  # 插到最前面
    load['paths'] = paths
    plugins['load'] = load
    print('  + added ecc to plugins.load.paths')
else:
    print('  ~ ecc already in plugins.load.paths')

cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
print('Config updated')
PYEOF

  log "配置已更新"
}

# ── Step 8: 重启 Gateway ─────────────────────────────────────
restart_gateway() {
  info "重启 OpenClaw Gateway..."
  
  if openclaw gateway restart 2>/dev/null; then
    log "Gateway 重启成功"
    sleep 3
  else
    warn "Gateway 重启失败，请手动重启：openclaw gateway restart"
  fi
}

# ── Step 9: 验证安装 ─────────────────────────────────────────
verify_install() {
  info "验证安装..."
  
  # 检查 plugin 是否加载
  if openclaw plugins list 2>/dev/null | grep -q "ecc"; then
    log "ECC Plugin: 已加载"
  else
    warn "ECC Plugin: 未加载，请检查配置"
  fi
  
  # 检查 commands
  CMD_COUNT=$(ls -1 "$OC_HOME/commands" 2>/dev/null | wc -l)
  log "Commands: $CMD_COUNT 个"
  
  # 检查 skills
  SKILL_COUNT=$(ls -1 "$OC_HOME/skills" 2>/dev/null | wc -l)
  log "Skills: $SKILL_COUNT 个"
  
  # 检查 rules
  RULE_COUNT=$(ls -1 "$OC_HOME/rules" 2>/dev/null | wc -l)
  log "Rules: $RULE_COUNT 个语言"
}

# ── Main ─────────────────────────────────────────────────────
banner
check_deps
backup_existing
create_workspaces
install_plugin
install_commands
install_skills
install_rules
install_hooks
update_config
restart_gateway
verify_install

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉  ECC 安装完成！                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "已安装："
echo "  - Plugin:     1 个 (ecc，包含 86 tools + /dispatch 命令)"
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
echo "文档：$REPO_DIR/openclaw/README.md"
echo ""
