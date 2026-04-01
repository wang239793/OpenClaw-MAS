---
name: console_check
description: Check for console.log statements in JavaScript/TypeScript files. Use before committing or as part of code review.
user-invocable: true
metadata:
  {"openclaw": {"requires": {"bins": ["git", "grep"]}}}
---

# Console.log Check

Check for `console.log` statements in modified or staged JavaScript/TypeScript files.

## When to Use

- Before committing code
- After editing JavaScript/TypeScript files
- As part of code review
- When cleaning up debug statements

## How to Run

### Check staged files (pre-commit)

```bash
git diff --cached --name-only | grep -E '\.(js|ts|tsx|jsx)$' | xargs grep -n 'console\.log'
```

### Check all modified files

```bash
git diff --name-only | grep -E '\.(js|ts|tsx|jsx)$' | xargs grep -n 'console\.log'
```

### Check entire project

```bash
find src -name '*.ts' -o -name '*.js' | xargs grep -n 'console\.log'
```

## What I Do

When you invoke this skill:

1. Check for staged files (if in git repo)
2. Search for `console.log`, `console.warn`, `console.error`, `console.debug`
3. Report file locations and line numbers
4. Offer to remove them

## Example Usage

**User**: "Check for console.log statements"

**Me**: 
```
🔍 Found console.log statements:

📁 src/login.js
   - Line 42: console.log('User logged in')
   - Line 58: console.log(error)

📁 src/utils/api.ts
   - Line 15: console.log('API call')

Total: 3 occurrences in 2 files

Would you like me to:
1. Remove all console.log statements
2. Show the context around each
3. Just noting for manual cleanup
```

## Auto-Fix (Optional)

To remove all console.log statements:

```bash
# From staged files
git diff --cached --name-only | grep -E '\.(js|ts|tsx)$' | xargs sed -i '' '/console\.log/d'

# From all files in src/
find src -name '*.ts' -o -name '*.js' | xargs sed -i '' '/console\.log/d'
```

⚠️ **Warning**: Always review changes before committing!

## Related

- `/typecheck` - TypeScript type checking
- `/code_review` - Full code review
- `pre-commit-check.sh` - Pre-commit quality checks
