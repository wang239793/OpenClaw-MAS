# TOOLS.md - Workspace Notes

This file is for `planner`-specific local notes in the OpenClaw workspace.

## Use this file for

- Common architecture files to inspect first
- Planning docs or templates used in this repo
- Canonical base directories and module boundaries
- Known deployment or migration constraints that shape plans
- Repo-specific testing or release expectations

## Suggested structure

```markdown
## Read first
- CLAUDE.md
- docs/architecture.md
- src/app/

## Plan artifacts
- docs/prd/
- docs/adr/

## Constraints
- Migrations must be reversible
- New endpoints require rate limiting
```

## Rule

Only store durable repo-specific planning context here.
General planning behavior belongs in `AGENTS.md` and `SOUL.md`.
