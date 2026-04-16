# Adopting This Template

Use this repo when you want the `FloorAI` platform patterns without the retail domain.

## Preserve

- chat rail UX
- message streaming through `messageEvents`
- answer packets
- quality checks
- file upload pipeline
- audit trail

## Replace

- sample workspaces
- operator personas
- agent prompt and tool routing
- domain tables and indexes
- seed data
- goldens

## First five changes in a new domain repo

1. Rewrite `convex/schema.ts`
2. Rewrite `convex/seed.ts`
3. Add domain tools and queries
4. Replace the generic answer synthesis in `convex/agent.ts`
5. Replace `/workspace-a` and `/workspace-b` with domain-native pages
