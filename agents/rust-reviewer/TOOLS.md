# TOOLS.md - Workspace Notes

This file is for `rust-reviewer`-specific local notes in the OpenClaw workspace.

## Use this file for

- Canonical Rust validation commands
- Workspace/package selection notes
- Clippy or fmt exceptions that are intentionally allowed
- Audit or deny commands used in this environment
- Paths for benches, integration tests, or examples relevant to review

## Suggested structure

```markdown
## Review commands
- check: cargo check --workspace
- clippy: cargo clippy --workspace -- -D warnings
- fmt: cargo fmt --all --check
- test: cargo test --workspace

## Security
- audit: cargo audit
- deny: cargo deny check

## Notes
- Review proc-macro crates separately
- Integration tests live under crates/api/tests/
```

## Rule

Keep only local Rust review mechanics here.
General review standards belong in `AGENTS.md` and `SOUL.md`.
