export async function requireOperator(ctx: any, operatorId: string) {
  const operator = await ctx.db
    .query("users")
    .withIndex("by_operatorId", (q: any) => q.eq("operatorId", operatorId))
    .first();

  if (!operator) {
    throw new Error("Operator session is missing or invalid.");
  }

  return operator;
}

export async function requireWorkspaceAccess(ctx: any, operatorId: string, workspaceId: string) {
  const operator = await requireOperator(ctx, operatorId);
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_workspaceId", (q: any) => q.eq("workspaceId", workspaceId))
    .first();

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found.`);
  }

  if (!operator.workspaceIds.includes(workspaceId)) {
    throw new Error(`Operator ${operator.name} cannot access workspace ${workspaceId}.`);
  }

  return { operator, workspace };
}
