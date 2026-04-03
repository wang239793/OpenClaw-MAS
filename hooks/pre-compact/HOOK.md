---
name: pre-compact
description: "Save a lightweight state snapshot to workspace before context compaction, so work-in-progress is not lost."
metadata:
  {"openclaw": {"emoji": "💾", "events": ["session:compact:before"]}}
---

Writes a JSON snapshot to `<workspace>/snapshots/pre-compact-<timestamp>.json` before each compaction.

The snapshot contains: timestamp, sessionKey, messageCount, tokenCount (if available).
This allows recovery of context if compaction produces an unsatisfactory summary.
