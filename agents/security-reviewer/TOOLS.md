# TOOLS.md - Tool Notes for security-reviewer

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

Security tools: Read, Grep, Glob, Bash (semgrep, bandit, cargo-audit)

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on detecting and remediating security vulnerabilities.
Do not use tools outside this scope without explicit instruction.
