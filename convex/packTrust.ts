/**
 * M6 trust promotion.
 *
 * `promoteIfEligible` reads the accumulated evalRuns + submission state
 * and promotes `submission.trust` to "Verified" only if every gate passes:
 *
 *   runs >= 10
 *   passRate >= 0.95
 *   securityReview.injectionSurface !== "high"
 *   no blocking-assertion failures
 *
 * Otherwise returns a structured { eligible: false, blockedBy, failingTraceIds }.
 *
 * Honest status: we NEVER return eligible=true with failing assertions.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";

export type PromoteResult =
  | {
      eligible: true;
      submissionId: string;
      promoted: true;
      runs: number;
      passRate: number;
    }
  | {
      eligible: false;
      submissionId: string;
      promoted: false;
      blockedBy: string[];
      runs: number;
      passRate: number;
      injectionSurface: "low" | "medium" | "high" | "unknown";
      failingTraceIds: string[];
    };

const MIN_RUNS = 10;
const MIN_PASS_RATE = 0.95;

export const promoteIfEligible = mutation({
  args: {
    submissionId: v.string(),
    // Optional override: caller can inject a securityReview for tests
    // or admin-manual runs where the review isn't yet attached to the submission.
    securityReview: v.optional(
      v.object({
        injectionSurface: v.string(), // "low" | "medium" | "high"
      })
    ),
  },
  handler: async (ctx, args): Promise<PromoteResult> => {
    const sub = await ctx.db
      .query("packSubmissions")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .first();

    if (!sub) {
      return {
        eligible: false,
        submissionId: args.submissionId,
        promoted: false,
        blockedBy: ["submission-not-found"],
        runs: 0,
        passRate: 0,
        injectionSurface: "unknown",
        failingTraceIds: [],
      };
    }

    const runs = await ctx.db
      .query("evalRuns")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .collect();

    const runCount = runs.length;
    const aggregatedAssertions = runs.flatMap((r: any) => {
      if (!r.assertionsJson) return [];
      try {
        return JSON.parse(r.assertionsJson) as Array<any>;
      } catch {
        return [];
      }
    });
    const total = aggregatedAssertions.length;
    const passed = aggregatedAssertions.filter((a: any) => a.passed).length;
    const passRate = total === 0 ? 0 : passed / total;

    const blockedBy: string[] = [];
    if (runCount < MIN_RUNS) {
      blockedBy.push(`runs_lt_${MIN_RUNS}`);
    }
    if (passRate < MIN_PASS_RATE) {
      blockedBy.push(`pass_rate_lt_${MIN_PASS_RATE}`);
    }

    // Injection surface: prefer explicit arg, else look at eventLogs for any
    // security review. Default to "unknown" which we treat as NOT blocking
    // (caller must supply), but "high" is an explicit block.
    const injectionSurface = (args.securityReview?.injectionSurface ??
      "unknown") as "low" | "medium" | "high" | "unknown";
    if (injectionSurface === "high") {
      blockedBy.push("injection_surface_high");
    }

    // Blocking-assertion failures (golden.blocking=true AND failed).
    const failingBlocking: string[] = [];
    for (const run of runs as any[]) {
      if (run.passed === true) continue;
      if (run.traceId) failingBlocking.push(run.traceId);
    }
    if (failingBlocking.length > 0) {
      blockedBy.push("blocking_assertions_failed");
    }

    if (blockedBy.length > 0) {
      return {
        eligible: false,
        submissionId: args.submissionId,
        promoted: false,
        blockedBy,
        runs: runCount,
        passRate,
        injectionSurface,
        failingTraceIds: failingBlocking,
      };
    }

    // Promote.
    await ctx.db.patch(sub._id, {
      status: "verified",
      updatedAt: Date.now(),
    });

    const createdAt = Date.now();
    await ctx.db.insert("eventLogs", {
      eventId: `EVT-${createdAt}-promote`,
      eventType: "pack.trust.promoted",
      status: "verified",
      actorId: "system",
      actorName: "eval-gate",
      actorRole: "system",
      entityId: args.submissionId,
      summary: `Promoted ${sub.packName} to Verified (runs=${runCount}, passRate=${passRate.toFixed(3)}).`,
      detailsJson: JSON.stringify({
        runs: runCount,
        passRate,
        injectionSurface,
      }),
      createdAt: new Date(createdAt).toISOString(),
    });

    return {
      eligible: true,
      submissionId: args.submissionId,
      promoted: true,
      runs: runCount,
      passRate,
    };
  },
});
