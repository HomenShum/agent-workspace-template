/**
 * M6 eval-gate assertion engine.
 *
 * Pure functions — no Convex dependency. Used by:
 *  - convex/eval.ts action (runs against a Pack loaded server-side)
 *  - scripts/verify-eval-gate.ts (scenario verification)
 *
 * Assertion types mirror convex/goldens.ts. Keep in sync.
 *
 * Security:
 *  - No URL fetches performed here. Assertions cannot trigger network calls.
 *  - Regex patterns are wrapped in try/catch; invalid patterns fail honestly,
 *    they are NEVER silently skipped (no false-pass).
 */

export type Assertion =
  | {
      kind: "substring-present";
      field: string;
      needle: string;
      caseInsensitive?: boolean;
    }
  | {
      kind: "substring-absent";
      field: string;
      needle: string;
      caseInsensitive?: boolean;
    }
  | {
      kind: "regex-match";
      field: string;
      pattern: string;
      flags?: string;
    }
  | {
      kind: "field-equals";
      field: string;
      expected: unknown;
    }
  | {
      kind: "field-nonempty";
      field: string;
    }
  | {
      kind: "injection-probe";
      field: string;
      bannedPhrases: string[];
    }
  | {
      kind: "llm-judge-rubric";
      field: string;
      rubric: string;
      requiredKeywords: string[];
      minKeywords: number;
    };

export type AssertionResult = {
  assertion: Assertion;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
};

/**
 * Walk a dot-path into an object. Returns undefined if any segment is
 * missing. Does not throw on null/undefined intermediate values.
 */
export function getFieldByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function stringify(value: unknown, max = 240): string {
  if (value === undefined) return "<undefined>";
  if (value === null) return "<null>";
  if (typeof value === "string") return value.length > max ? value.slice(0, max) + "…" : value;
  try {
    const s = JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(value);
  }
}

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return Boolean(value);
}

/**
 * Run a single assertion against a pack-like target.
 * Never throws — always returns an AssertionResult with passed=false on error.
 */
export function runAssertion(
  target: unknown,
  assertion: Assertion
): AssertionResult {
  try {
    switch (assertion.kind) {
      case "substring-present": {
        const raw = getFieldByPath(target, assertion.field);
        const text = typeof raw === "string" ? raw : stringify(raw, 10_000);
        const needle = assertion.caseInsensitive
          ? assertion.needle.toLowerCase()
          : assertion.needle;
        const hay = assertion.caseInsensitive ? text.toLowerCase() : text;
        const passed = hay.includes(needle);
        return {
          assertion,
          passed,
          expected: `contains "${assertion.needle}"`,
          actual: stringify(raw),
        };
      }
      case "substring-absent": {
        const raw = getFieldByPath(target, assertion.field);
        const text = typeof raw === "string" ? raw : stringify(raw, 10_000);
        const needle = assertion.caseInsensitive
          ? assertion.needle.toLowerCase()
          : assertion.needle;
        const hay = assertion.caseInsensitive ? text.toLowerCase() : text;
        const passed = !hay.includes(needle);
        return {
          assertion,
          passed,
          expected: `does not contain "${assertion.needle}"`,
          actual: stringify(raw),
        };
      }
      case "regex-match": {
        const raw = getFieldByPath(target, assertion.field);
        const text = typeof raw === "string" ? raw : stringify(raw, 10_000);
        let re: RegExp;
        try {
          re = new RegExp(assertion.pattern, assertion.flags ?? "");
        } catch (err) {
          return {
            assertion,
            passed: false,
            expected: `regex /${assertion.pattern}/${assertion.flags ?? ""}`,
            actual: stringify(raw),
            error: `invalid regex: ${(err as Error).message}`,
          };
        }
        return {
          assertion,
          passed: re.test(text),
          expected: `matches /${assertion.pattern}/${assertion.flags ?? ""}`,
          actual: stringify(raw),
        };
      }
      case "field-equals": {
        const raw = getFieldByPath(target, assertion.field);
        const passed =
          JSON.stringify(raw) === JSON.stringify(assertion.expected);
        return {
          assertion,
          passed,
          expected: stringify(assertion.expected),
          actual: stringify(raw),
        };
      }
      case "field-nonempty": {
        const raw = getFieldByPath(target, assertion.field);
        return {
          assertion,
          passed: isNonEmpty(raw),
          expected: "non-empty value",
          actual: stringify(raw),
        };
      }
      case "injection-probe": {
        const raw = getFieldByPath(target, assertion.field);
        const text = typeof raw === "string" ? raw : stringify(raw, 20_000);
        const lower = text.toLowerCase();
        const hits = assertion.bannedPhrases.filter((phrase) =>
          lower.includes(phrase.toLowerCase())
        );
        return {
          assertion,
          passed: hits.length === 0,
          expected: `none of: ${assertion.bannedPhrases.join(" | ")}`,
          actual: hits.length
            ? `matched: ${hits.join(" | ")}`
            : stringify(raw).slice(0, 240),
        };
      }
      case "llm-judge-rubric": {
        // Deterministic MVP: keyword-presence proxy, no external LLM.
        const raw = getFieldByPath(target, assertion.field);
        const text = typeof raw === "string" ? raw : stringify(raw, 20_000);
        const lower = text.toLowerCase();
        const matched = assertion.requiredKeywords.filter((k) =>
          lower.includes(k.toLowerCase())
        );
        const passed = matched.length >= assertion.minKeywords;
        return {
          assertion,
          passed,
          expected: `>=${assertion.minKeywords} of [${assertion.requiredKeywords.join(", ")}]`,
          actual: `matched ${matched.length}: [${matched.join(", ")}]`,
        };
      }
    }
  } catch (err) {
    return {
      assertion,
      passed: false,
      expected: "<exec>",
      actual: "<exec-error>",
      error: (err as Error).message,
    };
  }
}

/**
 * Run a batch of assertions against a single target. Honest status:
 * passRate reflects ACTUAL passes, never synthesized.
 */
export function runAssertions(
  target: unknown,
  assertions: Assertion[]
): {
  results: AssertionResult[];
  passed: number;
  failed: number;
  passRate: number;
} {
  const results = assertions.map((a) => runAssertion(target, a));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const passRate = results.length === 0 ? 0 : passed / results.length;
  return { results, passed, failed, passRate };
}

/**
 * Validate required submission fields before running goldens. Returns
 * { ok: false, missing: [...] } if the submission is malformed so the
 * gate can reject early without wasting eval runs.
 */
export function validateSubmissionShape(pack: unknown): {
  ok: boolean;
  missing: string[];
} {
  const required = [
    "slug",
    "name",
    "packType",
    "summary",
    "tagline",
    "useWhen",
    "avoidWhen",
    "installCommand",
    "minimalInstructions",
    "fullInstructions",
    "evaluationChecklist",
    "failureModes",
  ];
  const missing: string[] = [];
  for (const path of required) {
    const val = getFieldByPath(pack, path);
    if (!isNonEmpty(val)) missing.push(path);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Bounded hash helper for CAS/trace IDs. Deterministic — sorts object
 * keys before stringifying so the hash is stable regardless of property
 * enumeration order.
 */
export function stableHash(value: unknown): string {
  const normalized = stableStringify(value);
  // FNV-1a 32-bit — sufficient for non-crypto trace IDs.
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ":" + stableStringify((value as any)[k])
      )
      .join(",") +
    "}"
  );
}
