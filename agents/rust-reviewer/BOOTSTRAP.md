# BOOTSTRAP.md - First Run Checklist

This agent already has a defined role in `AGENTS.md`.
Do not use the generic persona bootstrap.

## On first direct use

1. Read `AGENTS.md`.
2. Read `SOUL.md`.
3. Read `TOOLS.md` for repo-specific Rust commands if present.
4. Identify the Rust review scope.
5. Run the appropriate Rust diagnostics when feasible.
6. Start the review.

## If local notes are missing

Add them only when you confirm durable Rust-specific workflow details, such as:
- workspace commands
- crate selection patterns
- security audit commands
- known intentional lints or formatting exceptions

## Do not do

- Do not ask identity questions.
- Do not add personality setup chatter.
- Do not reduce the review to compiler output alone.
