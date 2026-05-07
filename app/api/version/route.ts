import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function readGitHeadSha(): string | null {
  try {
    const gitDir = path.join(process.cwd(), ".git");
    const headPath = path.join(gitDir, "HEAD");
    const head = fs.readFileSync(headPath, "utf8").trim();

    if (head.startsWith("ref:")) {
      const ref = head.replace("ref:", "").trim(); // e.g. refs/heads/main
      const refPath = path.join(gitDir, ref);
      if (fs.existsSync(refPath)) {
        return fs.readFileSync(refPath, "utf8").trim();
      }
      return null;
    }

    // Detached HEAD contains sha directly
    return head || null;
  } catch {
    return null;
  }
}

function getCommitSha(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    readGitHeadSha()
  );
}

export async function GET() {
  const sha = getCommitSha();
  const shortSha = sha ? sha.slice(0, 7) : null;

  return NextResponse.json({
    name: "awakening-1s",
    packageVersion: process.env.npm_package_version ?? null,
    commitSha: sha,
    commitShortSha: shortSha,
    buildTimeIso: process.env.BUILD_TIME_ISO ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}

