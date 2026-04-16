import { mutation } from "./_generated/server";

async function clearTable(ctx: any, tableName: string) {
  const rows = await ctx.db.query(tableName).collect();
  await Promise.all(rows.map((row: any) => ctx.db.delete(row._id)));
}

export const seedTemplate = mutation({
  args: {},
  handler: async (ctx) => {
    for (const table of [
      "eventLogs",
      "evalCases",
      "evalRuns",
      "answerPackets",
      "packArtwork",
      "packSubmissions",
      "messageEvents",
      "messages",
      "files",
      "users",
      "workspaces",
    ]) {
      await clearTable(ctx, table);
    }

    await ctx.db.insert("workspaces", {
      workspaceId: "WS-001",
      slug: "workspace-a",
      label: "Builder Preview",
      eyebrow: "Studio preview workspace",
      headline: "A builder-facing preview surface for your first real domain persona.",
      description:
        "Use this route as the starting point for a domain-native builder or operator workspace after you replace the schema, brief, and tool contract.",
      primaryPersona: "Builder / Operator",
      samplePrompts: [
        "What should I investigate first here?",
        "Summarize the current workspace state.",
        "What evidence is missing before I act?",
      ],
    });

    await ctx.db.insert("workspaces", {
      workspaceId: "WS-002",
      slug: "workspace-b",
      label: "Reviewer Preview",
      eyebrow: "Secondary preview workspace",
      headline: "A reviewer-facing route for oversight, escalation, or aggregated scopes.",
      description:
        "Replace this with the secondary role or aggregated view in your domain, such as a portfolio, program, or regional perspective.",
      primaryPersona: "Reviewer / Lead",
      samplePrompts: [
        "What patterns are emerging across this scope?",
        "Which item is highest priority?",
        "What follow-up should be created next?",
      ],
    });

    await ctx.db.insert("users", {
      operatorId: "OP-001",
      name: "Alex Rivera",
      email: "alex@example.com",
      role: "workspace_owner",
      workspaceIds: ["WS-001"],
    });

    await ctx.db.insert("users", {
      operatorId: "OP-002",
      name: "Jordan Lee",
      email: "jordan@example.com",
      role: "workspace_owner",
      workspaceIds: ["WS-002"],
    });

    await ctx.db.insert("users", {
      operatorId: "OP-003",
      name: "Sam Patel",
      email: "sam@example.com",
      role: "cross_workspace_lead",
      workspaceIds: ["WS-001", "WS-002"],
    });

    return { ok: true };
  },
});
