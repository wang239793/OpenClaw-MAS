import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";

// ── 工具函数 ──────────────────────────────────────────────────

function appendLog(filename: string, entry: unknown): void {
  const logPath = path.join(os.homedir(), ".openclaw", filename);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const line = typeof entry === "string" ? entry : JSON.stringify(entry);
  fs.appendFileSync(logPath, line + "\n", "utf8");
}

function getAccumFile(sessionKey: string | undefined): string {
  const id = (sessionKey ?? "default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return path.join(os.tmpdir(), `ecc-edited-${id}.txt`);
}

function accumulateEditedFile(sessionKey: string | undefined, filePath: string): void {
  fs.appendFileSync(getAccumFile(sessionKey), filePath + "\n", "utf8");
}

function consumeAccumulatedFiles(sessionKey: string | undefined): string[] {
  const accumFile = getAccumFile(sessionKey);
  if (!fs.existsSync(accumFile)) return [];
  const content = fs.readFileSync(accumFile, "utf8");
  fs.unlinkSync(accumFile);
  return [...new Set(content.split("\n").filter(Boolean))];
}

function sanitizeCommand(cmd: string): string {
  return cmd
    .replace(/\n/g, " ")
    .replace(/--token[= ][^ ]*/g, "--token=<REDACTED>")
    .replace(/Authorization:[: ]*[^ ]*/gi, "Authorization:<REDACTED>")
    .replace(/\bAKIA[A-Z0-9]{16}\b/g, "<REDACTED>")
    .replace(/password[= ][^ ]*/gi, "password=<REDACTED>")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g, "<REDACTED>");
}

// ── 常量 ──────────────────────────────────────────────────────

const PROTECTED_CONFIG_FILES = new Set([
  ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json",
  ".eslintrc.yml", ".eslintrc.yaml",
  "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
  "eslint.config.ts", "eslint.config.mts", "eslint.config.cts",
  ".prettierrc", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.json",
  ".prettierrc.yml", ".prettierrc.yaml",
  "biome.json", "biome.jsonc",
  ".stylelintrc", ".stylelintrc.json", ".stylelintrc.yml",
  "stylelint.config.js", "stylelint.config.cjs",
]);

const ADHOC_DOC_PATTERN = /^(NOTES|TODO|SCRATCH|TEMP|DRAFT|BRAINSTORM|SPIKE|DEBUG|WIP)\.(md|txt)$/;
const STRUCTURED_DIRS = /(^|\/)(docs|\.claude|\.github|commands|skills|benchmarks|templates|\.history|memory)\//;

const SECRET_PATTERNS = [
  { name: "aws_key",        pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/i },
  { name: "generic_secret", pattern: /(?:secret|password|token|api[_-]?key)\s*[:=]\s*["'][^"']{8,}/i },
  { name: "private_key",    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: "jwt",            pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "github_token",   pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
];

const JS_TS_EXT = /\.(ts|tsx|js|jsx)$/;

// ── Plugin 入口 ───────────────────────────────────────────────

export default definePluginEntry({
  id: "ecc-hooks",
  name: "ECC Hooks",
  description: "ECC tool execution hooks: security guards, quality gates, logging",

  register(api) {

    // ════════════════════════════════════════════════════════
    // before_tool_call
    // ════════════════════════════════════════════════════════
    api.on(
      "before_tool_call",
      async (event, _ctx) => {
        const { toolName, params } = event;
        const cmd = String((params as Record<string, unknown>).command ?? "");
        const filePath = String(
          (params as Record<string, unknown>).file_path ??
          (params as Record<string, unknown>).path ?? ""
        );

        // 1. block-no-verify
        if (toolName === "Bash" && /--no-verify/.test(cmd)) {
          return {
            block: true,
            blockReason:
              "🚫 --no-verify is blocked. Fix the underlying hook issue instead of bypassing it.",
          };
        }

        // 2. git-push-reminder
        if (toolName === "Bash" && /\bgit\s+push\b/.test(cmd)) {
          return {
            requireApproval: {
              title: "Git Push",
              description:
                "You're about to push. Run `git diff HEAD~1` to review your changes first.",
              severity: "info",
              timeoutMs: 30_000,
              timeoutBehavior: "allow",
            },
          };
        }

        // 3. commit-quality
        if (toolName === "Bash" && /\bgit\s+commit\b/.test(cmd)) {
          const staged = getStagedFiles();
          const issues = staged.flatMap((f) => findFileIssues(f));
          if (issues.length > 0) {
            const summary = issues
              .slice(0, 5)
              .map((i) => `  • ${i.file}:${i.line} ${i.message}`)
              .join("\n");
            return {
              requireApproval: {
                title: "Commit Quality Check",
                description: `Found ${issues.length} issue(s) before commit:\n${summary}`,
                severity: "warning",
                timeoutMs: 30_000,
                timeoutBehavior: "allow",
              },
            };
          }
        }

        // 4. config-protection
        if ((toolName === "Write" || toolName === "Edit") && filePath) {
          const basename = path.basename(filePath);
          if (PROTECTED_CONFIG_FILES.has(basename)) {
            return {
              requireApproval: {
                title: "Config File Modification",
                description: `Modifying ${basename}. Fix the code to satisfy the linter instead of weakening the config.`,
                severity: "warning",
                timeoutMs: 30_000,
                timeoutBehavior: "deny",
              },
            };
          }
        }

        // 5. doc-file-warning（只记录，不阻止）
        if (toolName === "Write" && filePath) {
          const normalized = filePath.replace(/\\/g, "/");
          const basename = path.basename(normalized);
          if (ADHOC_DOC_PATTERN.test(basename) && !STRUCTURED_DIRS.test(normalized)) {
            appendLog("doc-warnings.log", {
              timestamp: new Date().toISOString(),
              file: filePath,
            });
          }
        }

        // 6. governance-capture (pre)
        if (process.env.ECC_GOVERNANCE_CAPTURE === "1") {
          const inputStr = JSON.stringify(params);
          for (const { name, pattern } of SECRET_PATTERNS) {
            if (pattern.test(inputStr)) {
              appendLog("governance-events.jsonl", {
                timestamp: new Date().toISOString(),
                type: "secret_detected",
                secretType: name,
                toolName,
                phase: "pre",
              });
            }
          }
        }
      }
    );

    // ════════════════════════════════════════════════════════
    // after_tool_call
    // ════════════════════════════════════════════════════════
    api.on(
      "after_tool_call",
      async (event, ctx) => {
        const { toolName, params, result, durationMs } = event;
        const cmd = String((params as Record<string, unknown>).command ?? "");
        const filePath = String(
          (params as Record<string, unknown>).file_path ??
          (params as Record<string, unknown>).path ?? ""
        );

        // 7. post-bash-command-log + cost-tracker
        if (toolName === "Bash" && cmd) {
          const sanitized = sanitizeCommand(cmd);
          appendLog("bash-commands.log",
            `[${new Date().toISOString()}] ${sanitized}`
          );
          appendLog("cost-tracker.log",
            `[${new Date().toISOString()}] tool=Bash durationMs=${durationMs ?? ""} command=${sanitized}`
          );
        }

        // 8. pr-created
        if (toolName === "Bash" && /\bgh\s+pr\s+create\b/.test(cmd)) {
          const output = String(result ?? "");
          const match = output.match(
            /https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/
          );
          if (match) {
            appendLog("pr-log.txt", `${new Date().toISOString()} ${match[0]}\n`);
          }
        }

        // 9. post-edit-accumulator
        if (
          (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") &&
          filePath &&
          JS_TS_EXT.test(filePath)
        ) {
          accumulateEditedFile(ctx.sessionKey, filePath);
        }

        // 10. post-edit-console-warn
        if ((toolName === "Edit" || toolName === "Write") && filePath && JS_TS_EXT.test(filePath)) {
          checkConsoleLog(filePath);
        }

        // 11. quality-gate
        if ((toolName === "Edit" || toolName === "Write") && filePath) {
          runQualityGate(filePath);
        }

        // 12. governance-capture (post)
        if (process.env.ECC_GOVERNANCE_CAPTURE === "1") {
          const outputStr = JSON.stringify(result ?? "");
          for (const { name, pattern } of SECRET_PATTERNS) {
            if (pattern.test(outputStr)) {
              appendLog("governance-events.jsonl", {
                timestamp: new Date().toISOString(),
                type: "secret_detected",
                secretType: name,
                toolName,
                phase: "post",
              });
            }
          }
        }
      }
    );

    // ════════════════════════════════════════════════════════
    // session_end
    // ════════════════════════════════════════════════════════
    api.on(
      "session_end",
      async (event, ctx) => {

        // 13. stop-format-typecheck（降级：对积累的文件批量检查）
        const editedFiles = consumeAccumulatedFiles(ctx.sessionKey);
        if (editedFiles.length > 0) {
          runBatchFormatCheck(editedFiles);
        }

        // cost-tracker（session 级别汇总）
        appendLog("cost-log.jsonl", {
          timestamp: new Date().toISOString(),
          sessionKey: ctx.sessionKey,
          messageCount: event.messageCount,
          durationMs: event.durationMs ?? null,
        });

        // desktop-notify
        if (process.platform === "darwin") {
          try {
            execSync(
              `osascript -e 'display notification "Session complete (${event.messageCount} messages)" with title "OpenClaw ECC"'`,
              { timeout: 5000 }
            );
          } catch {
            // 静默失败
          }
        }
      }
    );
  },
});

// ── 辅助函数 ──────────────────────────────────────────────────

function getStagedFiles(): string[] {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean);
}

function getStagedFileContent(filePath: string): string | null {
  const result = spawnSync("git", ["show", `:${filePath}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout;
}

interface FileIssue {
  file: string;
  line: number;
  message: string;
}

function findFileIssues(filePath: string): FileIssue[] {
  const checkableExts = [".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs"];
  if (!checkableExts.some((ext) => filePath.endsWith(ext))) return [];
  const content = getStagedFileContent(filePath);
  if (!content) return [];

  const issues: FileIssue[] = [];
  content.split("\n").forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (line.includes("console.log"))
      issues.push({ file: filePath, line: idx + 1, message: "console.log found" });
    if (/\bTODO\b/.test(line))
      issues.push({ file: filePath, line: idx + 1, message: "TODO comment" });
  });
  return issues;
}

function checkConsoleLog(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const found: number[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("//") && !trimmed.startsWith("*") && line.includes("console.log")) {
      found.push(idx + 1);
    }
  });
  if (found.length > 0) {
    appendLog(
      "console-log-warnings.log",
      `${new Date().toISOString()} ${filePath}: console.log at lines ${found.join(", ")}`
    );
  }
}

function runQualityGate(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const ext = path.extname(filePath);

  if (ext === ".go") {
    const result = spawnSync("gofmt", ["-l", filePath], { encoding: "utf8", timeout: 10_000 });
    if (result.stdout?.trim()) {
      appendLog("quality-gate.log",
        `${new Date().toISOString()} gofmt: ${filePath} needs formatting`
      );
    }
  }

  if (ext === ".py") {
    const result = spawnSync("python3", ["-m", "py_compile", filePath], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (result.status !== 0) {
      appendLog("quality-gate.log",
        `${new Date().toISOString()} python syntax error: ${filePath} - ${result.stderr ?? ""}`
      );
    }
  }
}

function runBatchFormatCheck(files: string[]): void {
  const tsSrcFiles = files.filter((f) => /\.(ts|tsx)$/.test(f) && fs.existsSync(f));
  if (tsSrcFiles.length === 0) return;
  const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return;

  const result = spawnSync("npx", ["tsc", "--noEmit", "--skipLibCheck"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0 && result.stdout) {
    appendLog("typecheck.log",
      `${new Date().toISOString()} tsc errors:\n${result.stdout}`
    );
  }
}
