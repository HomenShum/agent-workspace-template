/**
 * Minimal, safe markdown renderer for the fork preview + /view routes.
 *
 * Design:
 *   1. HTML-escape the ENTIRE input first. Anything that looks like HTML
 *      (incl. <script>, on-attributes, <iframe>, <img src="javascript:">)
 *      becomes inert text before any markdown rule runs. This is the key
 *      safety invariant — no user input ever reaches the output as live HTML.
 *   2. Translate markdown markers into allow-listed HTML tags against the
 *      already-escaped text. The only tags the renderer emits are:
 *        h1 h2 h3, p, ul, ol, li, strong, em, code, pre, a
 *   3. The only attribute we emit is `href` on anchors, and it is
 *      URL-validated (http/https/mailto only — no `javascript:` / `data:`).
 *
 * Why not a library? Keeps zero deps, keeps trust surface tiny, and the
 * catalog-side Notion-like renderer is owned by a different workstream.
 *
 * Supports: # / ## / ### headings, paragraphs, - / * / 1. lists, **bold**,
 * *italic*, `inline code`, ```fenced code```, [text](url) links, blockquotes.
 */

/** Escape every HTML-special char. First pass — runs before any markdown. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Narrow URL allow-list for anchor hrefs. Nothing else leaves this module. */
function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  // Absolute http(s) or mailto, or relative path / fragment.
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[/#]/.test(trimmed)) return trimmed;
  // Reject javascript:, data:, vbscript:, file:, and anything ambiguous.
  return null;
}

function renderInline(line: string): string {
  // `line` is already HTML-escaped. We now rewrite markdown tokens into the
  // allow-listed tags. Order matters: code first, then bold, then italic,
  // then links.
  let s = line;

  // Inline code: `...` — protect everything inside from further formatting.
  s = s.replace(/`([^`]+)`/g, (_m, body: string) => `<code>${body}</code>`);

  // Bold: **...**
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, body: string) => `<strong>${body}</strong>`);

  // Italic: *...* (single-star, non-greedy, not adjacent to another star)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, pre: string, body: string) =>
    `${pre}<em>${body}</em>`,
  );

  // Links: [text](href). Both text and href are already escaped; href is
  // run through safeHref before being emitted.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    // url is html-escaped — decode the tiny subset we need for validation.
    const decoded = url.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const safe = safeHref(decoded);
    if (safe === null) return text;
    // Re-escape the URL for the attribute; safeHref guarantees scheme is sane.
    const escapedHref = escapeHtml(safe);
    return `<a href="${escapedHref}" rel="nofollow noopener noreferrer">${text}</a>`;
  });

  return s;
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: string }
  | { type: "paragraph"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; body: string }
  | { type: "quote"; content: string };

/**
 * Render a markdown string to safe HTML. Input is treated as untrusted.
 */
export function renderMarkdown(src: string): string {
  // STEP 1 — escape everything first. After this point, no raw HTML exists
  // in the string; every `<`, `>`, `"`, `'`, `&` is inert.
  const escaped = escapeHtml(typeof src === "string" ? src : "");
  const lines = escaped.split(/\r?\n/);

  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ``` ... ``` — preserve content verbatim (already escaped).
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ type: "code", body: body.join("\n") });
      continue;
    }

    // Blank line — skip.
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Heading (max 3 levels — intentional; product calls for simple hierarchy).
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length as 1 | 2 | 3, content: h[2] });
      i++;
      continue;
    }

    // Unordered list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", content: body.join(" ") });
      continue;
    }

    // Paragraph — consume until blank / block boundary.
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", content: para.join(" ") });
  }

  // STEP 2 — emit only allow-listed tags.
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(`<h${b.level}>${renderInline(b.content)}</h${b.level}>`);
        break;
      case "paragraph":
        out.push(`<p>${renderInline(b.content)}</p>`);
        break;
      case "quote":
        out.push(`<blockquote>${renderInline(b.content)}</blockquote>`);
        break;
      case "code":
        // Body is already escaped. Do NOT run renderInline — preserve as-is.
        out.push(`<pre><code>${b.body}</code></pre>`);
        break;
      case "ul":
        out.push(
          `<ul>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`,
        );
        break;
      case "ol":
        out.push(
          `<ol>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ol>`,
        );
        break;
    }
  }
  return out.join("\n");
}
