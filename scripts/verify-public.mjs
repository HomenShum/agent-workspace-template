/** Real, keyless Next HTTP proof. Owns one ephemeral server; never starts Convex. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://agentworkspace.attrition.sh";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withPublicServer(verify) {
  assert(!existsSync(path.join(root, ".env.local")), "Use a keyless checkout: preserve .env.local outside the project before this check, then restore it.");
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_PUBLIC_CONVEX_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  });
  let log = "";
  let spawnError;
  let exited = false;
  const closed = new Promise((resolve) => {
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => { exited = true; resolve({ code, signal }); });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { log = (log + chunk).slice(-32000); });
  // Also bounds an unexpectedly stalled callback; killing Next interrupts pending reads.
  const deadline = setTimeout(() => child.kill("SIGKILL"), 8 * 60_000);
  try {
    let base;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (spawnError) throw spawnError;
      assert(!exited, `Next exited before readiness: ${log}`);
      base = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (base && log.includes("Ready")) break;
      await delay(200);
    }
    assert(base && log.includes("Ready"), `Next readiness deadline exceeded: ${log}`);
    return await verify(base);
  } finally {
    clearTimeout(deadline);
    if (!exited) child.kill("SIGKILL");
    // The actual Next process, not an npm/cmd wrapper, must terminate before return.
    const stopDeadline = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { await closed; } finally { clearTimeout(stopDeadline); }
    console.error(JSON.stringify({ ownedNextPid: child.pid, closed: exited, serverLog: log }));
  }
}

export async function verifyPublic(base) {
  const receipts = [];
  async function request(route, status = 200) {
    assert(receipts.length < 500, "Request budget exceeded");
    const url = new URL(route, base);
    assert.equal(url.origin, base, "This verifier only reads its owned local server");
    const start = performance.now();
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    let body = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        assert(bytes <= 2 * 1024 * 1024, `Response exceeds 2MiB: ${route}`);
        body += decoder.decode(chunk, { stream: true });
      }
      body += decoder.decode();
    } finally { if (!response.bodyUsed) await response.body?.cancel(); }
    receipts.push({ route, status: response.status, bytes, ms: Math.round(performance.now() - start), sha256: createHash("sha256").update(body).digest("hex") });
    assert.equal(response.status, status, route);
    return { body, headers: response.headers };
  }

  function metadata(body, route) {
    const head = body.split("</head>")[0];
    const canonical = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
    assert.equal(canonical.length, 1, `Exactly one canonical: ${route}`);
    assert.equal(new URL(canonical[0][1]).href, new URL(route.split("?")[0], origin).href);
    assert.match(head, /<title>[^<]+ \| Agent Workspace<\/title>/, route);
    assert.match(head, /<meta name="description" content="[^"]{30,}"\/>/, route);
    const ogUrl = head.match(/property="og:url" content="([^"]+)"/)?.[1];
    assert(ogUrl, route);
    assert.equal(new URL(ogUrl).href, new URL(canonical[0][1]).href);
    assert.match(head, /name="twitter:card" content="summary"/, route);
    assert.match(body, /<main\b/, `SSR main: ${route}`);
    assert.match(body, /<h1\b/, `SSR heading: ${route}`);
  }

  try {
    const robots = await request("/robots.txt");
    assert.match(robots.headers.get("content-type"), /^text\/plain/);
    assert(robots.body.includes(`Sitemap: ${origin}/sitemap.xml`));
    const sitemap = await request("/sitemap.xml");
    assert.match(sitemap.headers.get("content-type"), /xml/);
    const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.equal(new Set(urls).size, urls.length);
    assert(urls.length >= 31 && urls.length <= 2000, "Current public cohort must remain discoverable");
    const packs = JSON.parse((await request("/api/packs?limit=200")).body);
    const traces = JSON.parse((await request("/api/traces?limit=200")).body);
    assert.equal(packs.packs.length, packs.total);
    assert.equal(traces.traces.length, traces.total);
    for (const pack of packs.packs) assert(urls.includes(`${origin}/packs/${pack.slug}`), pack.slug);
    for (const trace of traces.traces) assert(urls.includes(`${origin}/traces/${trace.id}`), trace.id);
    const publicBodies = new Map();
    for (const url of urls) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, origin);
      assert.equal(parsed.search, "");
      assert(!/\/(api|my-packs|chat|submit|workspace-[ab])(?:\/|$)/.test(parsed.pathname));
      const { body } = await request(parsed.pathname);
      metadata(body, parsed.pathname);
      publicBodies.set(parsed.pathname, body);
    }
    // A visitor following a pack's publisher must find that same pack in its catalog.
    // Inspect rendered anchors, not slug strings inside Next's serialized scripts.
    const rendered = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const publisherMembers = new Map();
    for (const pack of packs.packs) {
      const body = rendered(publicBodies.get(`/packs/${pack.slug}`));
      const publisherLinks = [...body.matchAll(/<a\b[^>]*>/g)]
        .map(([tag]) => attribute(tag, "href")).filter((href) => href?.startsWith("/publishers/"));
      assert.equal(publisherLinks.length, 1, `One actual publisher link: ${pack.slug}`);
      const route = publisherLinks[0];
      assert(publicBodies.has(route), `Discoverable publisher: ${route}`);
      const members = publisherMembers.get(route) ?? [];
      members.push(`/packs/${pack.slug}`);
      publisherMembers.set(route, members);
    }
    assert(publisherMembers.size > 0, "Publisher membership cohort must not be empty");
    for (const [route, members] of publisherMembers) {
      const body = rendered(publicBodies.get(route));
      const cards = [...body.matchAll(/<a\b[^>]*>/g)]
        .filter(([tag]) => attribute(tag, "class")?.split(/\s+/).includes("pack-card"))
        .map(([tag]) => attribute(tag, "href"));
      assert.deepEqual(cards.sort(), members.sort(), `Origin packs and exact publisher membership: ${route}`);
      const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      assert(text.includes(`${members.length} packs from this publisher`), `Accurate publisher count: ${route}`);
    }
    for (const prefix of ["/api/", "/my-packs", "/chat", "/submit", "/workspace-a", "/workspace-b"]) {
      assert(robots.body.includes(`Disallow: ${prefix}`));
    }
    for (const route of ["/api/packs", "/my-packs", "/chat", "/submit", "/workspace-a", "/workspace-b"]) {
      const result = await request(route);
      assert.equal(result.headers.get("x-robots-tag"), "noindex, nofollow", route);
      if (["/chat", "/submit", "/workspace-a", "/workspace-b"].includes(route)) assert(result.body.includes("Backend Connection Missing"), route);
    }
    const emptyQuery = "zz-nonexistent-public-contract";
    for (const route of [`/?q=${emptyQuery}`, `/traces?q=${emptyQuery}`]) {
      const { body } = await request(route);
      metadata(body, route);
      assert(body.includes(route.startsWith("/traces") ? "No traces match." : "No packs match"), route);
    }
    for (const route of ["/?tag=harness", "/?type=ui", "/?publisher=agent-workspace", "/?q=golden&q=unknown", "/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "/compare?a=golden-eval-harness&b=golden-eval-harness", "/compare?a=..%2F..%2Fsecret&b=unknown"]) {
      const { body } = await request(route);
      metadata(body, route);
      assert(!body.includes("<script>alert(1)</script>"));
      if (route.includes("b=golden")) assert(body.includes("Pick two different packs"));
      if (route.includes("b=unknown")) assert(body.includes("Could not find pack(s)"));
      if (route.includes("q=golden&q=")) assert(!body.includes("No packs match"));
    }
    for (const route of ["/packs/UNKNOWN", `/packs/${"x".repeat(101)}`, "/packs/does-not-exist", "/publishers/does-not-exist", "/traces/invalid", "/packs/does-not-exist/raw", "/traces/invalid/raw"]) await request(route, 404);
    for (const route of ["/packs/four-design-questions/raw", "/traces/ct_2026-04-19/raw"]) {
      const result = await request(route);
      assert.match(result.headers.get("content-type"), /^text\/markdown/);
      assert.match(result.body, /^(?:---\n[\s\S]*?\n---\n\s*)?# /);
      assert(result.body.length > 500);
    }
    const redirect = await request("/packs/grounded-operator-rail", 308);
    assert.equal(redirect.headers.get("location"), "/packs/operator-chat-rail");
    // Repeated visits and concurrent readers must not retain the prior user's filter.
    for (let round = 0; round < 4; round++) {
      await Promise.all(Array.from({ length: 6 }, async (_, index) => {
        const filtered = index % 2 === 0;
        const route = filtered ? `/traces?q=${emptyQuery}` : "/traces";
        const { body } = await request(route);
        assert.equal(body.includes("No traces match."), filtered);
        metadata(body, route);
      }));
    }
    return { passed: true, publicPages: urls.length, requests: receipts.length, scope: "Local built HTTP only; no browser, provider, production or ranking certification", receipts };
  } catch (error) {
    console.error(JSON.stringify({ passed: false, receipts, error: String(error) }));
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await withPublicServer(verifyPublic), null, 2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
