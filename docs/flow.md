# OpenClaw MAS — End-to-End Flow

This document traces what happens from user input to final output for each skill type.

---

## After Installation

`install-ecc.sh` sets up the following structure:

```
~/.openclaw/
├── skills/
│   ├── tdd/SKILL.md              ← generated from commands/tdd.md
│   ├── code_review/SKILL.md      ← generated from commands/code-review.md
│   ├── build_fix/SKILL.md
│   ├── gan_build/SKILL.md
│   ├── rust_review/SKILL.md
│   ├── ... (68 command-skills)
│   └── ... (142 original ECC skills)
│
├── workspace-main/
├── workspace-tdd-guide/
├── workspace-rust-reviewer/
├── workspace-gan-planner/
├── workspace-gan-generator/
├── workspace-gan-evaluator/
└── ... (37 specialist agent workspaces)
```

---

## Type A: Specialist Agent Flow

**Example**: `/skill tdd implement a login endpoint with JWT auth`

```
1. User sends: /skill tdd implement a login endpoint with JWT auth

2. OpenClaw identifies /skill built-in command
   → looks up ~/.openclaw/skills/tdd/SKILL.md

3. main agent receives message
   → reads tdd/SKILL.md
   → SKILL.md body says: spawn tdd-guide

4. main agent calls:
   sessions_spawn(agentId: "tdd-guide", task: "implement a login endpoint with JWT auth")

5. tdd-guide subagent starts
   → loads workspace-tdd-guide/AGENTS.md (full TDD workflow spec)
   → executes:
       🔍 Analyzing requirements: JWT login endpoint...
       ⚙️  Scaffold: defining interface types...
       ✅ Interface defined
       ⚙️  RED: writing failing tests...
       ✅ Tests written, confirmed failing
       ⚙️  GREEN: minimal implementation...
       ✅ Tests passing
       ⚙️  REFACTOR: cleaning up...
       ✅ Done. Coverage: 94%

6. tdd-guide sends announce → appears as new message in main agent's session

7. main agent returns result to user
```

---

## Type B: Direct Execution Flow

**Example**: `/skill build_fix`

```
1. User sends: /skill build_fix

2. OpenClaw looks up ~/.openclaw/skills/build_fix/SKILL.md

3. main agent reads build_fix/SKILL.md
   → no agent spawn instruction in body
   → main agent executes the workflow directly:

       🔍 Detected TypeScript project (tsconfig.json found)
       ⚙️  Running tsc --noEmit... 3 errors found
       ⚙️  Fixing src/api.ts:42 — type mismatch...
       ✅ Fixed
       ⚙️  Fixing src/db.ts:17...
       ✅ All errors resolved. Build successful.

4. Result returned directly to user (no subagent, no announce)
```

---

## Type A Multi-Agent Flow (GAN Loop)

**Example**: `/skill gan_build build a real-time collaborative whiteboard`

```
1. User sends: /skill gan_build build a real-time collaborative whiteboard

2. main agent reads gan_build/SKILL.md
   → body describes a 3-phase serial pipeline

3. Phase 1:
   sessions_spawn(agentId: "gan-planner", task: "design spec for whiteboard app")
   → non-blocking, main agent waits for announce

   gan-planner runs → produces gan-harness/spec.md
   → announce arrives as new message in main agent's session

4. Phase 2 (after announce):
   sessions_spawn(agentId: "gan-generator", task: "implement per spec.md")
   → wait for announce

   gan-generator runs → produces implementation
   → announce arrives

5. Phase 3 (after announce):
   sessions_spawn(agentId: "gan-evaluator", task: "evaluate and score")
   → wait for announce

   gan-evaluator runs → returns score

6. Score check:
   < 7.0 → back to Phase 2 (next iteration)
   ≥ 7.0 → done, return final report to user
```

**Rule**: Never spawn the next agent before receiving the previous `announce`. Concurrent spawns break the pipeline.

---

## sessions_spawn Internals

```
sessions_spawn(agentId: "tdd-guide", task: "...")

1. Look up "tdd-guide" in openclaw.json agents.list
   → workspace: ~/.openclaw/workspace-tdd-guide

2. Start subagent, load from workspace:
   ✅ AGENTS.md     (workflow instructions)
   ✅ TOOLS.md      (available tools)
   ✅ skills/       (shared skills visible)
   ✅ rules/        (language rules)
   ✗  SOUL.md       (not loaded by subagents)
   ✗  IDENTITY.md   (not loaded by subagents)
   ✗  USER.md       (not loaded by subagents)
   ✗  HEARTBEAT.md  (not loaded by subagents)

3. Return runId immediately (non-blocking)

4. Subagent completes → announce pushed back to caller
   → announce becomes a new conversation turn
   → main agent sees it on next LLM call and continues
```

---

## Skill Invocation Reference

| Input | Type | Agent |
|-------|------|-------|
| `/skill tdd implement X` | A | tdd-guide |
| `/skill code_review` | A | code-reviewer |
| `/skill rust_review` | A | rust-reviewer |
| `/skill security_scan` | A | security-reviewer |
| `/skill gan_build X` | A (multi) | planner → generator → evaluator |
| `/skill build_fix` | B | main agent |
| `/skill save_session` | B | main agent |
| `/skill orchestrate X` | B | main agent |
| `/skill prp_prd X` | B | main agent |
