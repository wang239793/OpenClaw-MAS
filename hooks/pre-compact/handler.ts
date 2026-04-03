import * as fs from "fs";
import * as path from "path";

const handler = async (event: {
  type: string;
  action: string;
  sessionKey?: string;
  context?: {
    sessionEntry?: {
      workspaceDir?: string;
    };
    messageCount?: number;
    tokenCount?: number;
    sessionFile?: string;
  };
}) => {
  const workspaceDir = event.context?.sessionEntry?.workspaceDir;
  if (!workspaceDir) return;

  const snapshotDir = path.join(workspaceDir, "snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `pre-compact-${timestamp}.json`;

  const snapshot = {
    timestamp: new Date().toISOString(),
    sessionKey: event.sessionKey ?? null,
    messageCount: event.context?.messageCount ?? null,
    tokenCount: event.context?.tokenCount ?? null,
    sessionFile: event.context?.sessionFile ?? null,
  };

  fs.writeFileSync(
    path.join(snapshotDir, filename),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );
};

export default handler;
