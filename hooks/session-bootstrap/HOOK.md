---
name: session-bootstrap
description: "Inject previous session memory and latest session summary into agent bootstrap context for cross-session continuity."
metadata:
  {"openclaw": {"emoji": "🧠", "events": ["agent:bootstrap"]}}
---

Injects two files into the agent's bootstrap context (if they exist):

1. `MEMORY.md` — curated long-term memory from the workspace
2. Latest file in `sessions/` — summary of the most recent session

This gives the agent continuity across sessions without manual context loading.
