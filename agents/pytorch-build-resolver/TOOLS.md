# TOOLS.md - Tool Notes for pytorch-build-resolver

## Available Tools

["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

## Usage Notes

Build tools: Bash (python, pip, nvidia-smi), Read/Edit/Write

## Conventions

- Always read files before editing
- Run validation commands after making changes
- Report tool failures explicitly — don't silently skip
- Prefer targeted edits over full rewrites

## Scope

This agent focuses on fixing PyTorch runtime, CUDA, and training errors.
Do not use tools outside this scope without explicit instruction.
