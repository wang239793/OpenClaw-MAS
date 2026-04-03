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
  echo -e "${BLUE}║       安装向导 (37 Agents + Skills)      ║${NC}"
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

  if ! command -v python3 &>/dev/null; then
    error "未找到 python3"
    exit 1
  fi
  log "Python: $(python3 --version)"

  if [ ! -f "$OC_CFG" ]; then
    error "未找到 openclaw.json。请先运行 openclaw 完成初始化。"
    exit 1
  fi
  log "openclaw.json: $OC_CFG"
}

# ── Step 0.5: 全量备份 ────────────────────────────────────────
backup_existing() {
  BACKUP_DIR="$OC_HOME/backups/pre-ecc-install-$(date +%Y%m%d-%H%M%S)"
  info "备份现有 OpenClaw 数据到 $BACKUP_DIR ..."
  mkdir -p "$BACKUP_DIR"

  # 备份 openclaw.json
  cp "$OC_CFG" "$BACKUP_DIR/openclaw.json"

  # 备份 main workspace（单数）
  [ -d "$OC_HOME/workspace" ] && cp -R "$OC_HOME/workspace" "$BACKUP_DIR/workspace"

  # 备份所有 workspace-* 目录（多 agent）
  for d in "$OC_HOME"/workspace-*/; do
    [ -d "$d" ] && cp -R "$d" "$BACKUP_DIR/$(basename "$d")"
  done

  # 备份 skills、rules、hooks
  for dir in skills rules hooks; do
    [ -d "$OC_HOME/$dir" ] && cp -R "$OC_HOME/$dir" "$BACKUP_DIR/$dir"
  done

  log "备份完成：$BACKUP_DIR"
}

# ── Step 1: 注册 Agent Workspace（全量覆盖）─────────────────
create_workspaces() {
  info "注册 Agent Workspace（全量覆盖）..."

  COUNT=0

  register_agent() {
    local agent_name="$1"
    local ws="$2"

    # 如果已注册，先删除再重建（全量覆盖）
    if openclaw agents list --json 2>/dev/null \
        | python3 -c "import json,sys; ids=[a['id'] for a in json.load(sys.stdin)]; exit(0 if '$agent_name' in ids else 1)" 2>/dev/null; then
      openclaw agents delete "$agent_name" --force 2>/dev/null || true
    fi

    # 确保 workspace 目录存在
    mkdir -p "$ws"

    # 用 CLI 注册（写入 agents.list + 创建 agentDir）
    openclaw agents add "$agent_name" \
      --workspace "$ws" \
      --non-interactive \
      --json >/dev/null 2>&1 || {
        warn "注册 $agent_name 失败，跳过"
        return
      }

    COUNT=$((COUNT + 1))
  }

  # 注册 openclaw/agents/ 下的专家 agent
  AGENTS_DIR="$REPO_DIR/openclaw/agents"
  if [ -d "$AGENTS_DIR" ]; then
    for agent_dir in "$AGENTS_DIR"/*/; do
      [ -d "$agent_dir" ] || continue
      agent_name=$(basename "$agent_dir")
      ws="$OC_HOME/workspace-$agent_name"

      register_agent "$agent_name" "$ws"

      # 覆盖写入所有 workspace 文件（AGENTS.md, SOUL.md 等）
      for file in "$agent_dir"/*; do
        [ -f "$file" ] && cp -f "$file" "$ws/"
      done
    done
  fi

  log "Agent 注册完成：共 $COUNT 个"
}

# ── Step 2: 生成并安装所有 Skills（全量覆盖）────────────────
# 包含：142 个 ECC skill + 68 个 command-skill，共 210 个
install_skills() {
  info "安装 Skills（全量覆盖）..."

  ECC_SKILLS_SRC="$REPO_DIR/skills"
  CMD_SKILLS_SRC="$REPO_DIR/openclaw/skills"
  SKILLS_DST="$OC_HOME/skills"
  SCRIPT="$REPO_DIR/openclaw/scripts/generate_skills.py"

  if [ ! -f "$SCRIPT" ]; then
    error "未找到生成脚本：$SCRIPT"
    exit 1
  fi

  # 1. 先生成 68 个 command-skill 到 openclaw/skills/
  rm -rf "$CMD_SKILLS_SRC"
  mkdir -p "$CMD_SKILLS_SRC"
  python3 "$SCRIPT"

  # 2. 全量清空 ~/.openclaw/skills/ 再统一写入
  rm -rf "$SKILLS_DST"
  mkdir -p "$SKILLS_DST"

  # 2a. 复制 142 个 ECC skill
  if [ -d "$ECC_SKILLS_SRC" ]; then
    cp -r "$ECC_SKILLS_SRC/"* "$SKILLS_DST/"
  else
    warn "未找到 ECC skills 目录：$ECC_SKILLS_SRC，跳过"
  fi

  # 2b. 复制 68 个 command-skill（同名时报错，不允许覆盖 ECC skill）
  CONFLICT=0
  for skill_dir in "$CMD_SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    if [ -d "$SKILLS_DST/$skill_name" ]; then
      error "命名冲突：command-skill '$skill_name' 与已有 ECC skill 同名，请重命名"
      CONFLICT=$((CONFLICT + 1))
    else
      cp -r "$skill_dir" "$SKILLS_DST/$skill_name"
    fi
  done
  if [ "$CONFLICT" -gt 0 ]; then
    error "发现 $CONFLICT 个命名冲突，安装中止"
    exit 1
  fi

  CMD_COUNT=$(ls -1 "$CMD_SKILLS_SRC" | wc -l | tr -d ' ')
  TOTAL_COUNT=$(ls -1 "$SKILLS_DST" | wc -l | tr -d ' ')
  log "Skills 安装完成：command-skill $CMD_COUNT 个，共享目录总计 $TOTAL_COUNT 个"
}

# ── Step 4: 安装 Rules（全量覆盖）───────────────────────────
install_rules() {
  info "安装 Rules（全量覆盖）..."

  RULES_SRC="$REPO_DIR/rules"
  RULES_DST="$OC_HOME/rules"

  if [ ! -d "$RULES_SRC" ]; then
    warn "未找到 rules 目录：$RULES_SRC，跳过"
    return
  fi

  rm -rf "$RULES_DST"
  mkdir -p "$RULES_DST"
  cp -r "$RULES_SRC/"* "$RULES_DST/"

  log "Rules 已安装：$(ls -1 "$RULES_DST" | wc -l | tr -d ' ') 个语言"
}

# ── Step 5: 安装 Hooks（全量覆盖）───────────────────────────
install_hooks() {
  info "安装 Hooks..."

  # 5a. Internal hooks（session-bootstrap, pre-compact）
  INT_HOOKS_SRC="$REPO_DIR/openclaw/hooks"
  INT_HOOKS_DST="$OC_HOME/hooks"

  if [ -d "$INT_HOOKS_SRC" ]; then
    mkdir -p "$INT_HOOKS_DST"
    for hook_dir in "$INT_HOOKS_SRC"/*/; do
      [ -d "$hook_dir" ] || continue
      hook_name=$(basename "$hook_dir")
      rm -rf "$INT_HOOKS_DST/$hook_name"
      cp -r "$hook_dir" "$INT_HOOKS_DST/$hook_name"
    done
    log "Internal hooks 已安装：$(ls -1 "$INT_HOOKS_DST" | wc -l | tr -d ' ') 个"
  fi

  # 5b. Plugin（ecc-hooks）：编译并安装
  PLUGIN_SRC="$REPO_DIR/openclaw/plugin"
  PLUGIN_DST="$OC_HOME/plugins/ecc-hooks"

  if [ ! -d "$PLUGIN_SRC" ]; then
    warn "未找到 plugin 目录：$PLUGIN_SRC，跳过"
    return
  fi

  # 安装依赖并编译
  info "编译 ecc-hooks plugin..."
  cd "$PLUGIN_SRC"
  npm install --silent 2>/dev/null || npm install
  npx tsc --skipLibCheck 2>/dev/null || {
    warn "Plugin 编译失败，hooks 功能可能不完整"
    cd - >/dev/null
    return
  }
  cd - >/dev/null

  # 复制到 plugins 目录
  rm -rf "$PLUGIN_DST"
  mkdir -p "$PLUGIN_DST"
  cp -r "$PLUGIN_SRC/dist" "$PLUGIN_DST/"
  cp "$PLUGIN_SRC/package.json" "$PLUGIN_DST/"
  cp "$PLUGIN_SRC/openclaw.plugin.json" "$PLUGIN_DST/dist/"
  # 复制 node_modules 中的 openclaw 依赖（plugin 运行时需要）
  if [ -d "$PLUGIN_SRC/node_modules/openclaw" ]; then
    mkdir -p "$PLUGIN_DST/node_modules"
    cp -r "$PLUGIN_SRC/node_modules/openclaw" "$PLUGIN_DST/node_modules/"
  fi

  log "ecc-hooks plugin 已安装：$PLUGIN_DST"
}

# ── Step 6: 更新配置 ─────────────────────────────────────────
update_config() {
  info "更新 OpenClaw 配置..."

  python3 << 'PYEOF'
import json, pathlib

cfg_path = pathlib.Path.home() / '.openclaw' / 'openclaw.json'
cfg = json.loads(cfg_path.read_text())

# ── 1. 清理旧的 plugin 配置 ──────────────────────────────────
plugins = cfg.get('plugins', {})
allow_list = plugins.get('allow', [])
if 'ecc' in allow_list:
    allow_list.remove('ecc')
    plugins['allow'] = allow_list
    print('  - 移除 ecc from plugins.allow')

load = plugins.get('load', {})
paths = load.get('paths', [])
ecc_path = str(pathlib.Path.home() / '.openclaw' / 'plugins' / 'ecc')
if ecc_path in paths:
    paths.remove(ecc_path)
    load['paths'] = paths
    plugins['load'] = load
    print('  - 移除 ecc from plugins.load.paths')

if plugins:
    cfg['plugins'] = plugins

# ── 2. 清理旧的 agentToAgent 配置 ────────────────────────────
tools_cfg = cfg.get('tools', {})
if 'agentToAgent' in tools_cfg:
    del tools_cfg['agentToAgent']
    cfg['tools'] = tools_cfg
    print('  - 移除 agentToAgent 配置')

# ── 3. 配置 commands ─────────────────────────────────────────
commands = cfg.setdefault('commands', {})
commands['text'] = True           # 文本命令解析（/skill 依赖此项）
commands['nativeSkills'] = True   # Telegram/Discord 原生 skill 命令
commands['native'] = 'auto'       # 原生命令自动模式
print('  + commands: text=true, nativeSkills=true, native=auto')

# ── 4. 配置 agents.defaults.subagents ────────────────────────
# 正确路径：agents.defaults.subagents.maxSpawnDepth
agents_cfg = cfg.setdefault('agents', {})
defaults = agents_cfg.setdefault('defaults', {})
subagents = defaults.setdefault('subagents', {})
subagents['maxSpawnDepth'] = 2        # 支持 GAN 循环等二层嵌套
subagents['maxChildrenPerAgent'] = 10  # 并发子 agent 上限
print('  + agents.defaults.subagents: maxSpawnDepth=2, maxChildrenPerAgent=10')

# agents.list 由 openclaw agents add CLI 管理，无需手动写入
print('  ~ agents.list 由 CLI 管理，共',
      len(agents_cfg.get('list', [])), '个已注册')

# ── 5. 启用 Internal hooks ────────────────────────────────────
hooks_cfg = cfg.setdefault('hooks', {})
internal = hooks_cfg.setdefault('internal', {})
internal['enabled'] = True
entries = internal.setdefault('entries', {})
for hook_name in ['session-bootstrap', 'pre-compact']:
    entries.setdefault(hook_name, {})['enabled'] = True
print('  + hooks: session-bootstrap, pre-compact 已启用')

# ── 6. 注册 ecc-hooks plugin ──────────────────────────────────
plugins = cfg.setdefault('plugins', {})
# 从 allow 移除旧的 ecc-hooks 条目（改用 load.paths 自动发现）
allow_list = plugins.get('allow', [])
if 'ecc-hooks' in allow_list:
    allow_list.remove('ecc-hooks')
    plugins['allow'] = allow_list
    print('  - 移除 ecc-hooks from plugins.allow（改用 load.paths 自动发现）')
load = plugins.setdefault('load', {})
paths = load.setdefault('paths', [])
# 指向 plugins/ 父目录，OpenClaw 会扫描其中每个子目录作为 plugin
plugins_dir = str(pathlib.Path.home() / '.openclaw' / 'plugins')
# 移除旧的 ecc-hooks 直接路径（如有）
paths[:] = [p for p in paths if not p.endswith('/ecc-hooks') and not p.endswith('/ecc-hooks/dist')]
if plugins_dir not in paths:
    paths.insert(0, plugins_dir)
    print(f'  + plugins 目录加入 plugins.load.paths: {plugins_dir}')

# ── 7. 写回配置 ──────────────────────────────────────────────
cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
print('配置已更新')
PYEOF

  log "配置更新完成"
}

# ── Step 7: 重启 Gateway ─────────────────────────────────────
restart_gateway() {
  info "重启 OpenClaw Gateway..."

  if openclaw gateway restart 2>/dev/null; then
    log "Gateway 重启成功"
    sleep 2
  else
    warn "Gateway 重启失败，请手动重启：openclaw gateway restart"
  fi
}

# ── Step 8: 验证安装 ─────────────────────────────────────────
verify_install() {
  info "验证安装..."

  # 检查 skills
  SKILL_COUNT=$(ls -1 "$OC_HOME/skills" 2>/dev/null | wc -l | tr -d ' ')
  log "Skills: $SKILL_COUNT 个"

  # 检查关键 command-skill（带 cmd_ 前缀）
  for name in cmd_tdd cmd_build_fix cmd_code_review cmd_rust_review cmd_gan_build cmd_plan cmd_e2e; do
    if [ -d "$OC_HOME/skills/$name" ]; then
      echo -e "  ${GREEN}✅ /skill $name${NC}"
    else
      echo -e "  ${RED}❌ /skill $name 未找到${NC}"
    fi
  done

  # 检查 rules
  RULE_COUNT=$(ls -1 "$OC_HOME/rules" 2>/dev/null | wc -l | tr -d ' ')
  log "Rules: $RULE_COUNT 个语言"

  # 检查 agents
  AGENT_COUNT=$(openclaw agents list --json 2>/dev/null \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  log "Agents: $AGENT_COUNT 个已注册"

  # 检查 openclaw.json 关键配置
  python3 << 'PYEOF'
import json, pathlib
cfg = json.loads((pathlib.Path.home() / '.openclaw' / 'openclaw.json').read_text())
commands = cfg.get('commands', {})
agents = cfg.get('agents', {})
defaults = agents.get('defaults', {})
subagents = defaults.get('subagents', {})

ok = True
checks = [
    (commands.get('text'),         'commands.text'),
    (commands.get('nativeSkills'), 'commands.nativeSkills'),
    (subagents.get('maxSpawnDepth', 1) >= 2, 'agents.defaults.subagents.maxSpawnDepth >= 2'),
    (len(agents.get('list', [])) >= 10,      'agents.list 已注册 >= 10 个'),
]
for passed, label in checks:
    if passed:
        print(f'  ✅ {label}')
    else:
        print(f'  ⚠️  {label} 未满足')
        ok = False
PYEOF
}

# ── Main ─────────────────────────────────────────────────────
banner
check_deps
backup_existing
create_workspaces
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
echo "使用方法："
echo "  /skill cmd_tdd 实现一个登录功能"
echo "  /skill cmd_build_fix"
echo "  /skill cmd_code_review"
echo "  /skill cmd_rust_review"
echo "  /skill cmd_gan_build 做一个待办应用"
echo ""
echo "查看所有可用 skill："
echo "  openclaw skills list"
echo ""
echo "文档：$REPO_DIR/openclaw/FLOW.md"
echo ""
