import * as fs from "fs";
import * as path from "path";

const handler = async (event: {
  type: string;
  action: string;
  context?: {
    workspaceDir?: string;
    agentId?: string;
    bootstrapFiles?: string[];
  };
}) => {
  if (event.type !== "agent" || event.action !== "bootstrap") return;

  const workspaceDir = event.context?.workspaceDir;
  if (!workspaceDir) return;

  const bootstrapFiles = event.context?.bootstrapFiles;
  if (!Array.isArray(bootstrapFiles)) return;

  // 1. 注入 MEMORY.md（如存在）
  const memoryFile = path.join(workspaceDir, "MEMORY.md");
  if (fs.existsSync(memoryFile)) {
    bootstrapFiles.push(memoryFile);
  }

  // 2. 注入最近一次 session 摘要（如存在）
  const sessionDir = path.join(workspaceDir, "sessions");
  if (fs.existsSync(sessionDir)) {
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith(".md"))
      .sort();
    const latest = files.at(-1);
    if (latest) {
      bootstrapFiles.push(path.join(sessionDir, latest));
    }
  }
};

export default handler;
