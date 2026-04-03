# TOOLS.md - Workspace Notes

This file is for `tdd-guide`-specific operating notes that are local to this OpenClaw workspace.

## Use this file for

- Preferred test commands in this environment
- Package manager quirks
- Known flaky suites or expensive test targets
- Coverage commands and thresholds
- Paths for unit, integration, and E2E suites

## Suggested structure

```markdown
## Test commands
- unit: npm test -- --runInBand
- integration: npm run test:integration
- e2e: npm run test:e2e

## Coverage
- command: npm run test:coverage
- threshold: 80%

## Notes
- Use pnpm in this repo
- E2E requires local database running
```

## Rule

Keep only environment-specific execution notes here.
Core TDD policy belongs in `AGENTS.md` and `SOUL.md`.
