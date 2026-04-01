#!/bin/bash
# Install all converted ECC hooks for OpenClaw
# Usage: ./openclaw/hooks/install-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_ROOT="$HOME/.openclaw"
HOOKS_DIR="$OPENCLAW_ROOT/hooks"
SKILLS_DIR="$OPENCLAW_ROOT/skills"

echo "🦞 Installing ECC Hooks for OpenClaw"
echo "===================================="
echo ""

# Create hooks directory
mkdir -p "$HOOKS_DIR"

# Copy hook scripts
echo "📥 Installing hook scripts..."

HOOK_SCRIPTS=(
  "pre-commit-check.sh"
  "git-push-check.sh"
  "tmux-dev.sh"
  "cost-logger.sh"
)

for script in "${HOOK_SCRIPTS[@]}"; do
  if [ -f "$SCRIPT_DIR/$script" ]; then
    cp "$SCRIPT_DIR/$script" "$HOOKS_DIR/"
    chmod +x "$HOOKS_DIR/$script"
    echo "  ✅ $script"
  else
    echo "  ⚠️  $script (not found)"
  fi
done

# Create skills
echo ""
echo "📥 Installing skills..."

SKILLS=(
  "console-check"
  "typecheck"
)

for skill in "${SKILLS[@]}"; do
  if [ -d "$SCRIPT_DIR/../skills/$skill" ]; then
    cp -r "$SCRIPT_DIR/../skills/$skill" "$SKILLS_DIR/"
    echo "  ✅ $skill"
  else
    echo "  ⚠️  $skill (not found)"
  fi
done

# Setup Git hooks (if in git repo)
echo ""
echo "🔗 Setting up Git hooks..."

if [ -d ".git/hooks" ]; then
  ln -sf "$HOOKS_DIR/pre-commit-check.sh" ".git/hooks/pre-commit" 2>/dev/null || true
  echo "  ✅ Pre-commit hook linked"
else
  echo "  ⚠️  Not a git repository (skipping Git hooks)"
fi

# Add shell aliases
echo ""
echo "📝 Adding shell aliases..."

ALIASES_ADDED=false
SHELL_RC="$HOME/.zshrc"

if [ ! -f "$SHELL_RC" ] && [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

# Check if aliases already exist
if ! grep -q "OpenClaw Hooks" "$SHELL_RC" 2>/dev/null; then
  cat >> "$SHELL_RC" << 'EOF'

# OpenClaw Hooks (installed by ECC hooks-conversion)
alias gpush='~/.openclaw/hooks/git-push-check.sh'
alias tmux-dev='~/.openclaw/hooks/tmux-dev.sh'
alias cost-tracker='~/.openclaw/hooks/cost-logger.sh'
EOF
  ALIASES_ADDED=true
  echo "  ✅ Aliases added to $SHELL_RC"
else
  echo "  ℹ️  Aliases already exist"
fi

# Summary
echo ""
echo "═══════════════════════════════════════"
echo "✅ Installation complete!"
echo ""
echo "Installed:"
echo "  - 4 hook scripts in ~/.openclaw/hooks/"
echo "  - 2 skills in ~/.openclaw/skills/"
echo "  - Git pre-commit hook (if applicable)"
if [ "$ALIASES_ADDED" = true ]; then
  echo "  - Shell aliases (gpush, tmux-dev, cost-tracker)"
fi
echo ""
echo "Next steps:"
echo "  1. source $SHELL_RC"
echo "  2. Test: gpush (or git push)"
echo "  3. Test: tmux-dev \"npm run dev\""
echo "  4. Test: /console_check (in OpenClaw chat)"
echo "═══════════════════════════════════════"
