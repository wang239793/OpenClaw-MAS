#!/bin/bash
# ══════════════════════════════════════════════════════════════
# 把 ECC commands/ 批量转换为 OpenClaw user-invocable skills
# 输出到 openclaw/skills/（安装时会复制到 ~/.openclaw/skills/）
# ══════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CMDS_SRC="$REPO_DIR/commands"
SKILLS_DST="$REPO_DIR/openclaw/skills"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# ── 类型 A：command → 单个专家 agent ──────────────────────────
declare -A AGENT_MAP=(
  ["tdd"]="tdd-guide"
  ["e2e"]="e2e-runner"
  ["plan"]="planner"
  ["code-review"]="code-reviewer"
  ["refactor-clean"]="refactor-cleaner"
  ["update-docs"]="doc-updater"
  ["update-codemaps"]="doc-updater"
  ["cpp-build"]="cpp-build-resolver"
  ["cpp-review"]="cpp-reviewer"
  ["cpp-test"]="cpp-build-resolver"
  ["go-build"]="go-build-resolver"
  ["go-review"]="go-reviewer"
  ["go-test"]="go-build-resolver"
  ["kotlin-build"]="kotlin-build-resolver"
  ["kotlin-review"]="kotlin-reviewer"
  ["kotlin-test"]="kotlin-build-resolver"
  ["rust-build"]="rust-build-resolver"
  ["rust-review"]="rust-reviewer"
  ["rust-test"]="rust-build-resolver"
  ["python-review"]="python-reviewer"
  ["java-build"]="java-build-resolver"
  ["java-review"]="java-reviewer"
  ["gradle-build"]="java-build-resolver"
  ["flutter-review"]="flutter-reviewer"
  ["pytorch-build"]="pytorch-build-resolver"
  ["security-scan"]="security-reviewer"
  ["db-review"]="database-reviewer"
  ["harness-audit"]="harness-optimizer"
  ["context-budget"]="harness-optimizer"
  ["loop-start"]="loop-operator"
  ["santa-loop"]="code-reviewer"
)

# ── 类型 A：command → 多个专家 agent 串行 ─────────────────────
# 格式："agent1|agent2|agent3"
declare -A GAN_MAP=(
  ["gan-build"]="gan-planner|gan-generator|gan-evaluator"
  ["gan-design"]="gan-generator|gan-evaluator"
)

# ── 已有手写样本，跳过自动生成 ────────────────────────────────
SKIP_LIST="tdd build-fix gan-build"

# ── 生成单个 skill ─────────────────────────────────────────────
generate_skill() {
  local cmd_file="$1"
  local cmd_basename
  cmd_basename=$(basename "$cmd_file" .md)
  local skill_name="${cmd_basename//-/_}"
  local skill_dir="$SKILLS_DST/$skill_name"

  # 跳过已有手写样本
  for skip in $SKIP_LIST; do
    [ "$cmd_basename" = "$skip" ] && return 0
  done

  # 已存在则跳过
  if [ -d "$skill_dir" ]; then
    warn "跳过（已存在）：$skill_name"
    return 0
  fi

  mkdir -p "$skill_dir"

  # 提取 description（去掉引号和多余空格）
  local description
  description=$(grep -m1 "^description:" "$cmd_file" \
    | sed 's/^description:[[:space:]]*//' \
    | sed 's/^["'"'"']//;s/["'"'"']$//' \
    | sed 's/["`]/'"'"'/g')   # 替换反引号和双引号，避免 heredoc 问题
  [ -z "$description" ] && description="ECC $cmd_basename workflow"

  # 提取 body（去掉 frontmatter）
  # 有 frontmatter（--- ... ---）的文件：跳过前两个 ---
  # 没有 frontmatter 的文件：全部内容都是 body
  local cmd_body
  if grep -q "^---" "$cmd_file"; then
    cmd_body=$(awk '/^---/{n++; if(n==2){found=1; next}} found{print}' "$cmd_file")
    # 如果只有一个 ---（只有开头没有结尾），取 --- 之后的内容
    [ -z "$cmd_body" ] && cmd_body=$(tail -n +2 "$cmd_file")
  else
    cmd_body=$(cat "$cmd_file")
  fi

  # 构建 spawn 追加内容
  local spawn_section=""

  if [ -n "${AGENT_MAP[$cmd_basename]}" ]; then
    # 类型 A：单专家 agent
    local agent_id="${AGENT_MAP[$cmd_basename]}"
    spawn_section="

---

## OpenClaw 执行

通过 sessions_spawn 调用专家 agent：

\`\`\`
sessions_spawn(
  agentId: \"$agent_id\",
  task: \"[用户的完整请求和上下文]\"
)
\`\`\`

等待 $agent_id 的 announce 结果，然后返回给用户。"

  elif [ -n "${GAN_MAP[$cmd_basename]}" ]; then
    # 类型 A：多 agent 串行
    local agents="${GAN_MAP[$cmd_basename]}"
    local agents_display="${agents//|/ → }"
    spawn_section="

---

## OpenClaw 执行

sessions_spawn 是非阻塞的，必须串行执行，每步等 announce 后再继续。

执行顺序：$agents_display

每次 sessions_spawn 后停止等待，收到 announce 后再继续下一步。
不要同时 spawn 多个 agent。"
  fi
  # 类型 B：spawn_section 为空

  # 写入 SKILL.md
  cat > "$skill_dir/SKILL.md" << EOF
---
name: $skill_name
description: "$description"
user-invocable: true
origin: ECC-command
---

$cmd_body$spawn_section
EOF

  echo "  ✅ $skill_name$([ -n "$spawn_section" ] && echo " [→ agent]" || echo " [direct]")"
}

# ── 主流程 ─────────────────────────────────────────────────────
main() {
  info "生成 Command Skills..."
  info "来源：$CMDS_SRC"
  info "目标：$SKILLS_DST"
  echo ""

  local count_a=0 count_b=0 count_skip=0

  for cmd_file in "$CMDS_SRC"/*.md; do
    [ -f "$cmd_file" ] || continue
    local cmd_basename
    cmd_basename=$(basename "$cmd_file" .md)
    local skill_name="${cmd_basename//-/_}"

    # 统计
    local is_skip=false
    for skip in $SKIP_LIST; do
      [ "$cmd_basename" = "$skip" ] && is_skip=true && break
    done

    if $is_skip; then
      count_skip=$((count_skip + 1))
    elif [ -n "${AGENT_MAP[$cmd_basename]}" ] || [ -n "${GAN_MAP[$cmd_basename]}" ]; then
      count_a=$((count_a + 1))
      generate_skill "$cmd_file"
    else
      count_b=$((count_b + 1))
      generate_skill "$cmd_file"
    fi
  done

  echo ""
  log "完成！"
  echo "  类型 A（spawn 专家 agent）：$count_a 个"
  echo "  类型 B（直接执行）：$count_b 个"
  echo "  已有手写样本（跳过）：$count_skip 个"
  echo "  总计：$((count_a + count_b + count_skip + 3)) 个（含手写样本 3 个）"
}

main "$@"
