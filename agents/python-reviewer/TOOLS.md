# TOOLS.md - Tool Notes for python-reviewer

## Available Tools

["Read", "Grep", "Glob", "Bash"]

## Usage Notes

Review tools: Read, Grep, Glob, Bash (ruff, mypy, bandit)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on reviewing Python code for PEP 8, type hints, and security.
Do not use tools outside this scope without explicit instruction.
