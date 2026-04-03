# TOOLS.md - Workspace Notes

This file is for `gan-generator`-specific local notes in the OpenClaw workspace.

## Use this file for

- Dev server command and port conventions
- Build, lint, and test commands
- Locations of GAN feedback and state artifacts
- Framework-specific run instructions
- Known setup prerequisites for live evaluation

## Suggested structure

```markdown
## Dev server
- command: npm run dev
- url: http://localhost:3000

## Validation
- build: npm run build
- test: npm test
- lint: npm run lint

## GAN artifacts
- spec: gan-harness/spec.md
- state: gan-harness/generator-state.md
- feedback: gan-harness/feedback/
```

## Rule

Keep only local execution details here.
Generator behavior belongs in `AGENTS.md` and `SOUL.md`.
