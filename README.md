# Agent Workspace

`agent-workspace-template` is now framed as `Agent Workspace`: a components-style directory and starter runtime for natural-language agent harness packs, publicly hosted at `agentworkspace.attrition.sh`.

The repo still contains the reusable platform extracted from `FloorAI`, but the product story is now simpler:

- browse verified harness packs on the homepage
- open detail pages with instructions, sources, and evaluation guidance
- submit new harness packs into a lightweight review queue
- use the built-in studio routes to preview the shared chat and right-side agent rail
- adapt the underlying runtime into your own domain implementation

It keeps the shared runtime pieces that made the original project useful:

- centered shared chat plus expandable agent rail
- durable Convex message streaming via `messageEvents`
- file upload and evidence handling
- trace, telemetry, quality-check, and answer-packet persistence
- role-aware workspace access

It intentionally removes retail-specific domain logic. The expectation is that you will use this repo as the starting point for a new domain implementation such as:

- `PropertyAI`
- `CourseAI`
- another operations or knowledge-work agent

## What this repo includes

```text
src/app/
  /                 harness pack directory
  /packs/[slug]     pack detail pages
  /submit           submission form + review queue preview
  /chat             shared channel studio
  /workspace-a      builder preview workspace
  /workspace-b      reviewer preview workspace

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
  submissions.ts    harness pack submission queue
  access.ts         generic access helpers
  messages.ts       message + event persistence
  files.ts          upload metadata
  audit.ts          event log
  answerPackets.ts  final answer persistence
  evalRuns.ts       eval storage
  agent.ts          generic agent action shell
  seed.ts           sample workspaces and operators
```

## What this repo does not include

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

## Public URL

The current public-facing catalog lives at:

- `https://agentworkspace.attrition.sh`

The GitHub repository stays `agent-workspace-template`, but the product surface is branded as `Agent Workspace`. The hosted URL is intentionally an Attrition subdomain rather than a separate root domain.

## Adaptation sequence

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

## Recommended next steps after cloning this repo

```text
1. Rename workspace-a / workspace-b to real personas
2. Replace generic workspaces with domain entities
3. Add domain tool functions
4. Replace the generic prompt and renderer in convex/agent.ts
5. Add domain goldens and live eval
6. Rewrite README, slides, and demo video for the new domain
```

## Related references

If you are coming from the `FloorAI` repo, the original extraction notes live there in:

- `docs/DOMAIN_SPINOUT_PLAYBOOK.md`
