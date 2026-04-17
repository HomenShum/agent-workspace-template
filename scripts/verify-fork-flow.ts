#!/usr/bin/env tsx
/**
 * Scenario-level verification for the fork-to-workspace flow.
 *
 * Uses the file-backed fallback (src/lib/fork-storage.ts) so it runs
 * without a live Convex deployment. Matches the validation behaviour of
 * convex/userPackForks.ts.
 *
 * Personas simulated:
 *   - Alice ("op_alice"): forks pack, edits, saves, downloads, reverts, deletes.
 *   - Bob ("op_bob"): forks the same pack — his copy is isolated from Alice.
 *   - "Mallory" attempts path traversal via slug and session id; must be rejected.
 *
 * Run: npx tsx scripts/verify-fork-flow.ts
 * Exit: 0 on pass (prints "FORK FLOW OK"), non-zero otherwise.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  FORK_MAX_MARKDOWN_BYTES,
  __purgeSessionForTests,
  deleteFork,
  getFork,
  isValidForkSlug,
  isValidSessionId,
  listForksForSession,
  saveFork,
} from "../src/lib/fork-storage";
import { renderMarkdown } from "../src/lib/markdown-render";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  const tail = detail ? ` — ${detail}` : "";
  // eslint-disable-next-line no-console
  console.log(`  ${mark}  ${name}${tail}`);
}

function assertEq<T>(name: string, actual: T, expected: T): void {
  record(name, actual === expected, `expected=${String(expected)} got=${String(actual)}`);
}

const ROOT = resolve(__dirname, "..");
const FORKS_ROOT = join(ROOT, ".attrition", "forks");
const ALICE = "op_alice_verify";
const BOB = "op_bob_verify";
const SLUG = "advisor-pattern-v2";

// Clean slate — remove anything left from a previous run.
__purgeSessionForTests(ALICE);
__purgeSessionForTests(BOB);

// ---- Scenario 1: validator hygiene ----

record("slug validator accepts clean slug", isValidForkSlug("advisor-pattern-v2"));
record(
  "slug validator rejects traversal",
  !isValidForkSlug("../etc/passwd"),
);
record(
  "slug validator rejects upper case",
  !isValidForkSlug("Advisor-Pattern"),
);
record("slug validator rejects empty", !isValidForkSlug(""));
record("slug validator rejects non-string", !isValidForkSlug(123 as unknown as string));

record(
  "session validator rejects traversal",
  !isValidSessionId("../../etc"),
);
record(
  "session validator rejects backslash traversal",
  !isValidSessionId("..\\etc"),
);
record(
  "session validator rejects slash",
  !isValidSessionId("a/b"),
);
record(
  "session validator rejects null byte",
  !isValidSessionId("a\0b"),
);
record("session validator accepts normal id", isValidSessionId("op_alice_verify"));

// ---- Scenario 2: happy path create / read ----

const initialBody = "# Fork for Alice\n\nHello, world.";
const saved = saveFork(ALICE, SLUG, initialBody, "0.1.0");
record("Alice can create a new fork", saved.ok === true);
if (saved.ok) {
  assertEq("Alice's new-fork created flag", saved.created, true);
}

const mdFile = join(FORKS_ROOT, ALICE, `${SLUG}.md`);
const metaFile = join(FORKS_ROOT, ALICE, `${SLUG}.meta.json`);
record("fork md file exists at expected path", existsSync(mdFile), mdFile);
record("fork meta file exists at expected path", existsSync(metaFile));
record(
  "fork md content matches source",
  existsSync(mdFile) && readFileSync(mdFile, "utf8") === initialBody,
);

const fetched = getFork(ALICE, SLUG);
record("getFork returns the record", fetched !== null);
if (fetched) {
  assertEq("fetched markdown matches", fetched.markdown, initialBody);
  assertEq("fetched sourceVersion matches", fetched.sourceVersion, "0.1.0");
}

// ---- Scenario 3: idempotent update ----

const newBody = "# Fork for Alice\n\nEdited content.";
const updated = saveFork(ALICE, SLUG, newBody, "0.1.0");
record("Alice can update existing fork", updated.ok === true);
if (updated.ok) {
  assertEq("update does not re-create", updated.created, false);
}
const refetched = getFork(ALICE, SLUG);
record(
  "fork content reflects edits",
  refetched !== null && refetched.markdown === newBody,
);

// ---- Scenario 4: listForksForSession ----

const list = listForksForSession(ALICE);
record("listForksForSession returns one entry", list.length === 1);
if (list.length > 0) {
  assertEq("listed slug matches", list[0].slug, SLUG);
}

// ---- Scenario 5: session isolation (Alice vs Bob) ----

const bobBody = "# Bob's Fork\n\nIndependent copy.";
const bobSaved = saveFork(BOB, SLUG, bobBody, "0.1.0");
record("Bob can fork the same slug independently", bobSaved.ok === true);
const bobFetch = getFork(BOB, SLUG);
const aliceAfterBob = getFork(ALICE, SLUG);
record(
  "Bob's fork has Bob's content",
  bobFetch !== null && bobFetch.markdown === bobBody,
);
record(
  "Alice's fork unchanged by Bob's save",
  aliceAfterBob !== null && aliceAfterBob.markdown === newBody,
);

// ---- Scenario 6: adversarial inputs ----

const badSessionSave = saveFork("../../etc", SLUG, "evil", "0.1.0");
record(
  "traversal session id rejected",
  badSessionSave.ok === false && badSessionSave.error === "INVALID_SESSION_ID",
);
const badSlugSave = saveFork(ALICE, "../etc/passwd", "evil", "0.1.0");
record(
  "traversal slug rejected",
  badSlugSave.ok === false && badSlugSave.error === "INVALID_SLUG",
);

// Oversized markdown → FORK_TOO_LARGE
const huge = "x".repeat(FORK_MAX_MARKDOWN_BYTES + 1);
const hugeSave = saveFork(ALICE, SLUG, huge, "0.1.0");
record(
  "oversized markdown rejected with FORK_TOO_LARGE",
  hugeSave.ok === false && hugeSave.error === "FORK_TOO_LARGE",
);

// Invalid source version
const badVersion = saveFork(ALICE, SLUG, "body", "");
record(
  "empty sourceVersion rejected",
  badVersion.ok === false && badVersion.error === "INVALID_SOURCE_VERSION",
);

// ---- Scenario 7: edge — get/revert on missing fork returns null ----

const missing = getFork(ALICE, "this-slug-does-not-exist");
record("getFork returns null on miss (no throw)", missing === null);

// Delete on missing fork — {deleted:false}, no throw.
const delMissing = deleteFork(ALICE, "this-slug-does-not-exist");
record(
  "deleteFork on miss returns deleted:false",
  delMissing.ok === true && delMissing.deleted === false,
);

// ---- Scenario 8: markdown renderer — XSS safety ----

const evilMd = `# Hi\n\n<script>alert('x')</script>\n\n<img src="x" onerror="alert(1)" />\n\n[click](javascript:alert(1))`;
const html = renderMarkdown(evilMd);
record(
  "renderer escapes <script>",
  !/<script>/i.test(html) && /&lt;script&gt;/.test(html),
);
record(
  "renderer neutralises onerror (attribute inert)",
  // The literal word "onerror" may survive as text; what matters is that
  // it is no longer an HTML attribute. The surrounding angle brackets and
  // quotes must all be escaped — so there can never be a live attribute
  // assignment of the form `onerror="..."` in the output. We check that
  // every pre-equals `<` was escaped to `&lt;` (no raw `<img` remains).
  !/<img\b/i.test(html) && /&lt;img src=&quot;x&quot; onerror=&quot;alert\(1\)&quot;/.test(html),
);
record(
  "renderer blocks javascript: href",
  !/href="javascript:/i.test(html),
);
record(
  "renderer emits the heading",
  /<h1>Hi<\/h1>/.test(html),
);

// ---- Scenario 9: delete + cleanup ----

const del = deleteFork(ALICE, SLUG);
record(
  "delete Alice's fork succeeds",
  del.ok === true && del.deleted === true,
);
record("md file removed after delete", !existsSync(mdFile));
record("meta file removed after delete", !existsSync(metaFile));
const postListAlice = listForksForSession(ALICE);
record("Alice's session has 0 forks after delete", postListAlice.length === 0);
const postListBob = listForksForSession(BOB);
record("Bob's session still has his fork", postListBob.length === 1);

// ---- Scenario 10: malformed meta file — getFork still returns null-safe ----

const malformedSession = "op_malformed_verify";
__purgeSessionForTests(malformedSession);
mkdirSync(join(FORKS_ROOT, malformedSession), { recursive: true });
writeFileSync(join(FORKS_ROOT, malformedSession, "weird-slug.md"), "body");
writeFileSync(join(FORKS_ROOT, malformedSession, "weird-slug.meta.json"), "{{{not json");
const malformedRead = getFork(malformedSession, "weird-slug");
record("malformed meta → getFork returns null (no throw)", malformedRead === null);
__purgeSessionForTests(malformedSession);

// Clean up Bob for idempotency of this script.
deleteFork(BOB, SLUG);
__purgeSessionForTests(ALICE);
__purgeSessionForTests(BOB);

// ---- Result ----
const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`\nFAILED: ${failed.length}/${checks.length}`);
  for (const f of failed) {
    // eslint-disable-next-line no-console
    console.error(`  ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`\n${checks.length}/${checks.length} checks passed`);
// eslint-disable-next-line no-console
console.log("FORK FLOW OK");
