# Agent Workspace Template

`agent-workspace-template` is the reusable platform extracted from `FloorAI`.

It keeps the shared pieces that made the original project useful:

- centered shared chat plus expandable agent rail
- durable Convex message streaming via `messageEvents`
- file upload and evidence handling
- trace, telemetry, quality-check, and answer-packet persistence
- role-aware workspace access

It intentionally removes retail-specific domain logic. The expectation is that you will use this repo as the starting point for a new domain implementation such as:

- `PropertyAI`
- `CourseAI`
- another operations or knowledge-work agent

## What this template includes

```text
src/app/
  /                 generic landing page
  /chat             shared channel surface
  /workspace-a      example persona workspace
  /workspace-b      example persona workspace

src/components/
  ChatPanel         right-rail assistant UI
  GroupChat         centered shared thread
  AttachmentList    evidence rendering
  Sidebar           nav and workspace switcher
  ConvexClientProvider
  OperatorSessionProvider

convex/
  schema.ts         generic runtime tables
  users.ts          operator lookup
  workspaces.ts     workspace registry
  access.ts         generic access helpers
  messages.ts       message + event persistence
  files.ts          upload metadata
  audit.ts          event log
  answerPackets.ts  final answer persistence
  evalRuns.ts       eval storage
  agent.ts          generic agent action shell
  seed.ts           sample workspaces and operators
```

## What this template does not include

- domain entities such as `stores`, `leases`, or `courses`
- domain tool registry for your real workflows
- domain goldens or evaluation prompts
- production retrieval corpora

Those are the first things you should add when turning the template into a real product repo.

## Quick start

```bash
npm install
npx convex dev
npm run seed
```

Then set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` using the local Convex URL printed by `convex dev`.

## Adoption sequence

Do not start by editing the large agent file. Lock these in order:

1. domain schema
2. seed data
3. brief packet shape
4. tool registry
5. answer packet shape

Only then should you rewrite the agent runtime and workspace pages.

## Default runtime behavior

The template agent is intentionally lightweight:

- it writes user and assistant messages
- it emits ordered message events
- it persists a simple trace and answer packet
- it uses Gemini if `GOOGLE_API_KEY` is set
- otherwise it falls back to a deterministic placeholder response

That means the repo boots cleanly as a workspace scaffold before you add your own domain retrieval or evaluation logic.

## Recommended next steps after cloning this template

```text
1. Rename workspace-a / workspace-b to real personas
2. Replace generic workspaces with domain entities
3. Add domain tool functions
4. Replace the generic prompt and renderer in convex/agent.ts
5. Add domain goldens and live eval
6. Rewrite README, slides, and demo video for the new domain
```

## Related reference

If you are coming from the `FloorAI` repo, the original extraction notes live there in:

- `docs/DOMAIN_SPINOUT_PLAYBOOK.md`
