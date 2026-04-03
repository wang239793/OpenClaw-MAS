#!/usr/bin/env python3
"""
把 ECC commands/ 批量转换为 OpenClaw user-invocable skills
输出到 openclaw/skills/（安装时会复制到 ~/.openclaw/skills/）
"""
import os
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent.parent
CMDS_SRC = REPO_DIR / "commands"
SKILLS_DST = SCRIPT_DIR.parent / "skills"

# ── 类型 A：command → 单个专家 agent ──────────────────────────
AGENT_MAP = {
    "tdd":            "tdd-guide",
    "e2e":            "e2e-runner",
    "plan":           "planner",
    "code-review":    "code-reviewer",
    "refactor-clean": "refactor-cleaner",
    "update-docs":    "doc-updater",
    "update-codemaps":"doc-updater",
    "cpp-build":      "cpp-build-resolver",
    "cpp-review":     "cpp-reviewer",
    "cpp-test":       "cpp-build-resolver",
    "go-build":       "go-build-resolver",
    "go-review":      "go-reviewer",
    "go-test":        "go-build-resolver",
    "kotlin-build":   "kotlin-build-resolver",
    "kotlin-review":  "kotlin-reviewer",
    "kotlin-test":    "kotlin-build-resolver",
    "rust-build":     "rust-build-resolver",
    "rust-review":    "rust-reviewer",
    "rust-test":      "rust-build-resolver",
    "python-review":  "python-reviewer",
    "java-build":     "java-build-resolver",
    "java-review":    "java-reviewer",
    "gradle-build":   "java-build-resolver",
    "flutter-review": "flutter-reviewer",
    "pytorch-build":  "pytorch-build-resolver",
    "security-scan":  "security-reviewer",
    "db-review":      "database-reviewer",
    "harness-audit":  "harness-optimizer",
    "context-budget": "harness-optimizer",
    "loop-start":     "loop-operator",
    "santa-loop":     "code-reviewer",
}

# ── 类型 A：command → 多个专家 agent 串行 ─────────────────────
GAN_MAP = {
    "gan-build":  ["gan-planner", "gan-generator", "gan-evaluator"],
    "gan-design": ["gan-generator", "gan-evaluator"],
}

# 所有 command 全部自动生成，无手写样本
SKIP_LIST = set()


def extract_frontmatter_and_body(content: str):
    """提取 description frontmatter 和 body 内容"""
    description = ""
    body = content

    # 检查是否有 frontmatter（以 --- 开头）
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            front = parts[1]
            body = parts[2].lstrip("\n")
            # 提取 description
            for line in front.splitlines():
                if line.startswith("description:"):
                    description = line[len("description:"):].strip()
                    description = description.strip('"\'')
                    break

    return description, body


def make_spawn_section(cmd_name: str) -> str:
    """生成 OpenClaw 执行说明（类型 A 追加，类型 B 返回空字符串）"""

    if cmd_name in AGENT_MAP:
        agent_id = AGENT_MAP[cmd_name]
        return f"""

---

## OpenClaw 执行

通过 sessions_spawn 调用专家 agent：

```
sessions_spawn(
  agentId: "{agent_id}",
  task: "[用户的完整请求和上下文]"
)
```

等待 {agent_id} 的 announce 结果，然后返回给用户。
"""

    if cmd_name in GAN_MAP:
        agents = GAN_MAP[cmd_name]
        agents_display = " → ".join(agents)
        agents_list = "\n".join(
            f"{i+1}. sessions_spawn(agentId: \"{a}\", task: \"...\")"
            for i, a in enumerate(agents)
        )
        return f"""

---

## OpenClaw 执行

sessions_spawn 是非阻塞的，必须串行执行，每步等 announce 后再继续。

执行顺序：{agents_display}

{agents_list}

每次 sessions_spawn 后停止等待，收到 announce 后再继续下一步。
不要同时 spawn 多个 agent。
"""

    return ""  # 类型 B，不追加


def generate_skill(cmd_file: Path):
    cmd_name = cmd_file.stem  # e.g. "code-review"
    skill_name = "cmd_" + cmd_name.replace("-", "_")  # e.g. "cmd_code_review"
    skill_dir = SKILLS_DST / skill_name

    # 跳过手写样本
    if cmd_name in SKIP_LIST:
        return "skip", skill_name

    # 已存在则跳过
    if skill_dir.exists():
        return "exists", skill_name

    skill_dir.mkdir(parents=True, exist_ok=True)

    content = cmd_file.read_text(encoding="utf-8")
    description, body = extract_frontmatter_and_body(content)

    if not description:
        description = f"ECC {cmd_name} workflow"

    # 转义 description 里的双引号
    description = description.replace('"', "'")

    spawn_section = make_spawn_section(cmd_name)
    skill_type = "A" if spawn_section else "B"

    skill_content = f"""---
name: {skill_name}
description: "{description}"
user-invocable: true
origin: ECC-command
---

{body}{spawn_section}"""

    (skill_dir / "SKILL.md").write_text(skill_content, encoding="utf-8")
    return skill_type, skill_name


def main():
    print(f"生成 Command Skills")
    print(f"来源：{CMDS_SRC}")
    print(f"目标：{SKILLS_DST}")
    print()

    SKILLS_DST.mkdir(parents=True, exist_ok=True)

    count = {"A": 0, "B": 0, "skip": 0, "exists": 0}

    for cmd_file in sorted(CMDS_SRC.glob("*.md")):
        result, skill_name = generate_skill(cmd_file)
        count[result] = count.get(result, 0) + 1

        if result == "A":
            agent = AGENT_MAP.get(cmd_file.stem) or " → ".join(GAN_MAP.get(cmd_file.stem, []))
            print(f"  ✅ {skill_name} → {agent}")
        elif result == "B":
            print(f"  ✅ {skill_name} [直接执行]")
        elif result == "skip":
            print(f"  ⏭  {skill_name} [手写样本，跳过]")
        elif result == "exists":
            print(f"  ⚠️  {skill_name} [已存在，跳过]")

    print()
    print("完成！")
    print(f"  类型 A（spawn 专家 agent）：{count.get('A', 0)} 个")
    print(f"  类型 B（直接执行）：{count.get('B', 0)} 个")
    print(f"  手写样本（跳过）：{count.get('skip', 0)} 个")
    print(f"  已存在（跳过）：{count.get('exists', 0)} 个")
    total = sum(count.values())
    print(f"  总计处理：{total} 个 command 文件")


if __name__ == "__main__":
    main()
