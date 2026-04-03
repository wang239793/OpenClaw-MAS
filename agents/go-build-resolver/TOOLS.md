# TOOLS.md - Tool Notes for go-build-resolver

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

Build tools: Bash (go build/vet/test), Read/Edit/Write

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on fixing Go build errors and go vet issues.
Do not use tools outside this scope without explicit instruction.
