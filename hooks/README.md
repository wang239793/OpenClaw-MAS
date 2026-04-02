# OpenClaw Hooks

Converted from Everything Claude Code hooks for OpenClaw compatibility.

## Installation

Hooks are installed automatically when you run:

```bash
./openclaw/install-ecc.sh
```

Or manual installation:

```bash
cp -r hooks/* ~/.openclaw/hooks/
source ~/.zshrc  # or ~/.bashrc
```

## Available Hooks

### Shell Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `pre-commit-check.sh` | Pre-commit quality check | Auto-run by Git |
| `git-push-check.sh` | Git push reminder | `gpush` or `./git-push-check.sh` |
| `tmux-dev.sh` | Tmux wrapper for dev servers | `tmux-dev "npm run dev"` |
| `cost-logger.sh` | Cost tracking | `cost-tracker` |

### OpenClaw Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `console-check` | `/console_check` | Check for console.log |
| `typecheck` | `/typecheck` | TypeScript type checking |

## Shell Aliases

After installation, these aliases are added to your shell:

```bash
alias gpush='~/.openclaw/hooks/git-push-check.sh'
alias tmux-dev='~/.openclaw/hooks/tmux-dev.sh'
alias cost-tracker='~/.openclaw/hooks/cost-logger.sh'
```

## Usage Examples

### Pre-commit Check (Automatic)

```bash
# Just commit normally - hook runs automatically
git commit -m "feat: add login"
```

### Git Push Check

```bash
# Use alias
gpush

# Or direct
~/.openclaw/hooks/git-push-check.sh
```

### Tmux Dev Server

```bash
# Wrap dev server command
tmux-dev "npm run dev"

# Or with yarn
tmux-dev "yarn dev"
```

### OpenClaw Skills

```bash
# In OpenClaw chat
/console_check
/typecheck
```

## Conversion from ECC

These hooks are converted from Everything Claude Code:

| ECC Hook | OpenClaw Conversion |
|----------|-------------------|
| `pre-bash-commit-quality.js` | `pre-commit-check.sh` |
| `pre-bash-git-push-reminder.js` | `git-push-check.sh` |
| `auto-tmux-dev.js` | `tmux-dev.sh` |
| `cost-tracker.js` | `cost-logger.sh` |
| `post-edit-console-warn.js` | `console-check` skill |
| `post-edit-typecheck.js` | `typecheck` skill |

See [`../docs/hooks-conversion-guide.md`](../docs/hooks-conversion-guide.md) for details.

## Customization

### Disable Specific Checks

Edit the hook scripts and comment out sections:

```bash
# ~/.openclaw/hooks/pre-commit-check.sh

# Comment out console.log check
# CONSOLE_LOG_FILES=$(git diff --cached ...)
```

### Configure Cost Logger

Edit the log file location:

```bash
# ~/.openclaw/hooks/cost-logger.sh
LOG_FILE="$HOME/.openclaw/logs/cost-$(date +%Y-%m).jsonl"
```

## Troubleshooting

### Hook not running

```bash
# Check if script is executable
chmod +x ~/.openclaw/hooks/*.sh

# Check Git hook linkage
ls -la .git/hooks/pre-commit
```

### Skill not found

```bash
# Verify skill installation
ls ~/.openclaw/skills/console-check/SKILL.md

# Restart OpenClaw gateway
openclaw gateway restart
```

### Aliases not working

```bash
# Reload shell config
source ~/.zshrc  # or ~/.bashrc

# Verify aliases
alias | grep -E "gpush|tmux-dev|cost-tracker"
```

## Related

- [Hooks Conversion Guide](../docs/hooks-conversion-guide.md)
- [OpenClaw Integration](../README.md)
- [ECC Hooks](../../hooks/README.md)
