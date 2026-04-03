# TOOLS.md - Tool Notes for kotlin-reviewer

## Available Tools

["Read", "Grep", "Glob", "Bash"]

## Usage Notes

Review tools: Read, Grep, Glob, Bash (ktlint, detekt)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on reviewing Kotlin code for idiomatic patterns and coroutine safety.
Do not use tools outside this scope without explicit instruction.
