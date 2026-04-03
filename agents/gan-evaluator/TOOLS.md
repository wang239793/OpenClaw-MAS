# TOOLS.md - Workspace Notes

This file is for `gan-evaluator`-specific local notes in the OpenClaw workspace.

## Use this file for

- Default app URL and port for evaluation
- Playwright or browser automation commands available in this environment
- Fallback evaluation commands when live browser control is unavailable
- Locations of rubric, spec, state, and feedback files
- Screenshot or artifact storage conventions

## Suggested structure

```markdown
## Target app
- url: http://localhost:3000

## Evaluation inputs
- spec: gan-harness/spec.md
- rubric: gan-harness/eval-rubric.md
- state: gan-harness/generator-state.md

## Browser tools
- playwright: available
- fallback: npm run build && npm test
```

## Rule

Keep only local evaluation mechanics here.
Evaluation standards belong in `AGENTS.md` and `SOUL.md`.
