# TOOLS.md - Tool Notes for rust-build-resolver

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

Build tools: Bash (cargo build/check/clippy), Read/Edit/Write

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on fixing Rust build errors and borrow checker issues.
Do not use tools outside this scope without explicit instruction.
