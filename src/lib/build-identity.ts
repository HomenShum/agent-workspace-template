import { execFileSync } from "node:child_process";

// Build identity, adapted from node-foyer's vite.config.ts (foyer-build-sha) and NodeVoice
// PR #10's Vite plugin (nodevoice-build-sha). Next.js has no build-time HTML transform hook
// equivalent to Vite's transformIndexHtml, so this resolves the sha as a plain function the
// root layout's Metadata `other` field reads — Next renders `other` entries as
// `<meta name={key} content={value}>` in the server HTML for every page under that layout.
// Non-strict: falls back to "unavailable" rather than throwing when no signal is available.
const BUILD_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export function resolveBuildSha(): string {
  for (const value of [process.env.VERCEL_GIT_COMMIT_SHA, process.env.GITHUB_SHA]) {
    const sha = value?.trim().toLowerCase();
    if (sha && BUILD_SHA_PATTERN.test(sha)) return sha;
  }
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    }).trim();
    if (BUILD_SHA_PATTERN.test(sha)) return sha;
  } catch {
    // fall through to unavailable
  }
  return "unavailable";
}

// Resolved once per server process (build/runtime env vars don't change mid-process).
export const BUILD_SHA = resolveBuildSha();
