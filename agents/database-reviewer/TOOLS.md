# TOOLS.md - Tool Notes for database-reviewer

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

DB tools: Read, Grep, Glob, Bash (psql, explain analyze)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on reviewing SQL, schema design, and query optimization.
Do not use tools outside this scope without explicit instruction.
