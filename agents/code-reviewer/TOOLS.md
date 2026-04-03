# TOOLS.md - Workspace Notes

This file is for `code-reviewer`-specific local notes in the OpenClaw workspace.

## Use this file for

- Preferred review commands in this repo
- Base branch conventions for PR review
- Lint, typecheck, and test commands used to validate findings
- Known generated-code paths to ignore unless explicitly requested
- Security or compliance review checkpoints specific to this environment

## Suggested structure

```markdown
## Review commands
- diff: git diff main...HEAD
- lint: npm run lint
- types: npm run typecheck
- tests: npm test

## Ignore by default
- dist/
- coverage/

## Notes
- Review migrations for rollback safety
- Treat console logs as warnings unless test fixtures
```

## Rule

Keep only local review mechanics here.
The review policy itself lives in `AGENTS.md` and `SOUL.md`.
