# TOOLS.md - Tool Notes for typescript-reviewer

## Available Tools

["Read", "Grep", "Glob", "Bash"]

## Usage Notes

Review tools: Read, Grep, Glob, Bash (tsc, eslint, biome)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on reviewing TypeScript/JavaScript for type safety and async correctness.
Do not use tools outside this scope without explicit instruction.
