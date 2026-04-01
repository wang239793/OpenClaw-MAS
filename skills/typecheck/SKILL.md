---
name: typecheck
description: Run TypeScript type checking. Use after editing TypeScript files or before committing.
user-invocable: true
metadata:
  {"openclaw": {"requires": {"bins": ["tsc", "node"]}}}
---

# TypeScript Type Check

Run TypeScript compiler in no-emit mode to check for type errors.

## When to Use

- After editing TypeScript files
- Before committing code
- As part of CI/CD pipeline
- When adding new features or refactoring

## How to Run

### Quick check (no emit)

```bash
tsc --noEmit
```

### Check specific project

```bash
tsc --project tsconfig.json --noEmit
```

### Watch mode

```bash
tsc --noEmit --watch
```

### Check with specific config

```bash
tsc --noEmit --strict --noImplicitAny
```

## What I Do

When you invoke this skill:

1. Check if TypeScript is installed
2. Run `tsc --noEmit` in the current directory
3. Parse and report any type errors
4. Suggest fixes for common errors
5. Offer to run auto-fix if available

## Example Usage

**User**: "Run typecheck"

**Me**:
```
🔍 Running TypeScript check...

❌ Found 3 type errors:

📁 src/user.ts:42:7
   Type 'string' is not assignable to type 'number'.
   
   40 | interface User {
   41 |   id: number;
   42 |   name: string;  // ← Error here
      |       ^
   43 | }

📁 src/api.ts:15:18
   Property 'email' does not exist on type 'User'.

📁 src/utils.ts:28:5
   Parameter 'callback' implicitly has an 'any' type.

💡 Suggestions:
1. Fix type mismatch in user.ts (line 42)
2. Add 'email' property to User interface
3. Add explicit type for callback parameter

Would you like me to:
1. Help fix these errors
2. Show more context
3. Run with different tsconfig
```

## Pre-commit Integration

Add to your `.git/hooks/pre-commit`:

```bash
#!/bin/bash
if command -v tsc &> /dev/null; then
  echo "🔍 Running TypeScript check..."
  tsc --noEmit || {
    echo "❌ Type check failed"
    exit 1
  }
fi
```

## Common Errors and Fixes

### Type 'string' is not assignable to type 'number'

```typescript
// ❌ Wrong
const id: number = "123";

// ✅ Fix
const id: number = 123;
// or
const id: number = parseInt("123", 10);
```

### Property does not exist on type

```typescript
// ❌ Wrong
interface User {
  name: string;
}
user.email; // Error

// ✅ Fix
interface User {
  name: string;
  email?: string;  // Make optional
}
```

### Parameter implicitly has 'any' type

```typescript
// ❌ Wrong
const fn = (callback) => callback();

// ✅ Fix
const fn = (callback: () => void) => callback();
```

## Related

- `/console_check` - Check for console.log statements
- `/code_review` - Full code review
- `pre-commit-check.sh` - Pre-commit quality checks
