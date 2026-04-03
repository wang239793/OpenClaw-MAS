# TOOLS.md - Tool Notes for e2e-runner

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

Test tools: Read, Write, Edit, Bash (playwright, npx), Glob, Grep

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on generating and running E2E tests with Playwright.
Do not use tools outside this scope without explicit instruction.
