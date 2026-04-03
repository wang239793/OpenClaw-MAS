# TOOLS.md - Tool Notes for cpp-reviewer

## Available Tools

["Read", "Grep", "Glob", "Bash"]

## Usage Notes

Review tools: Read, Grep, Glob, Bash (clang-tidy, valgrind)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on reviewing C++ code for memory safety and modern idioms.
Do not use tools outside this scope without explicit instruction.
