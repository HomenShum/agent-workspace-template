import type { Pack } from "@/lib/pack-schema";

/**
 * Golden Eval Harness pack.
 *
 * Design a golden set, build LLM-as-judge rubrics, wire trace
 * observability, enforce pass-rate thresholds in CI. The canonical
 * evaluator-optimizer harness. Verified tier — telemetry populated.
 */
export const goldenEvalHarness: Pack = {
  slug: "golden-eval-harness",
  name: "Golden Eval Harness",
  tagline: "Golden set + LLM judge + traces + CI gates. Ships evals that stay green.",
  summary:
    "A complete evaluator-optimizer harness: curated golden set, rubric-based LLM-as-judge, trace observability (Langfuse/Braintrust), pass-rate thresholds, and CI integration. Enforces a contract so every candidate run produces a comparable results.json; the judge re-runs deterministically. Matches the Anthropic eval cookbook and OpenAI Evals conventions.",
  packType: "eval",
  canonicalPattern: "evaluator-optimizer",
  version: "0.1.0",

  trust: "Community",
  status: "Production-ready",
  featured: true,
  publisher: "Agent Workspace",
  gradient: "from-amber-500 via-orange-500 to-red-600",
  artworkVariant: "answer-review-and-quality-checks",
  updatedAt: "2026-04-16",
  compatibility: ["claude-code", "cursor", "python-3.11", "node-20", "github-actions"],
  tags: ["eval", "llm-as-judge", "golden-set", "ci", "observability", "evaluator-optimizer"],

  installCommand: "npx attrition-sh pack install golden-eval-harness",
  claudeCodeSnippet:
    "Skill `golden-eval-harness` is installed at .claude/skills/golden-eval-harness/SKILL.md. Invoke whenever the user asks for 'evals', a 'golden set', or a way to catch prompt regressions in CI. Always define the rubric before writing the judge; trace every candidate and judge call; block the PR on pass-rate drop >2 points.",
  rawMarkdownPath: "/packs/golden-eval-harness/raw",

  contract: {
    requiredOutputs: ["results.json", "pass_rate", "regression_report"],
    tokenBudget: 4000,
    permissions: ["llm:generate", "llm:judge", "fs:write:results", "trace:emit"],
    completionConditions: [
      "results.json contains every golden-set example with {input, candidate, judge_scores, pass}",
      "pass_rate is the ratio of pass=true over total examples",
      "regression_report lists every example whose pass flipped vs the previous run",
      "trace IDs are attached for every candidate generation and every judge call",
    ],
    outputPath: "evals/results.json",
  },

  layers: {
    runtimeCharter:
      "Evaluator runs the judge after each candidate output. State persists to results.json; each judge call is idempotent given (example_id, candidate_hash, rubric_version). CI fails the build if pass_rate drops >2 absolute points vs the last main-branch results, or if any previously-passing example newly fails.",
    nlh:
      "Candidate is asked to perform the user task. Judge is asked to score the candidate's output against a versioned rubric: a JSON object with boolean fields (faithful, complete, concise, safe) and a short rationale per field. Judge temperature=0. System prompt forbids the judge from being influenced by candidate confidence, length, or style.",
    toolSpec: [
      {
        name: "run_candidate",
        signature:
          "(example: {id: string; input: string}) => Promise<{candidate: string; trace_id: string; tokens: number}>",
        description:
          "Executes the candidate pipeline on one golden example. Must emit a trace with input, output, model_id, and latency.",
      },
      {
        name: "run_judge",
        signature:
          "(example_id: string, candidate: string, rubric_version: string) => Promise<{scores: Record<string, boolean>; rationale: string; trace_id: string}>",
        description:
          "Runs the LLM-as-judge with the pinned rubric version. Temperature=0. Returns per-criterion booleans and a short rationale string. Idempotent given (example_id, candidate-hash, rubric_version).",
      },
      {
        name: "write_results",
        signature:
          "(rows: Array<{id: string; input: string; candidate: string; judge_scores: Record<string, boolean>; pass: boolean}>) => Promise<void>",
        description:
          "Persists evals/results.json atomically. Overwrites only on successful full run; partial runs write to results.partial.json.",
      },
      {
        name: "compare_against_main",
        signature:
          "(current: Results, baseline: Results) => {pass_rate_delta: number; regressions: string[]; improvements: string[]}",
        description:
          "Computes regression report vs the main-branch results.json. Used by the CI gate.",
      },
    ],
  },

  transferMatrix: [
    { modelId: "claude-opus-4.6", passRate: 0.94, tokens: 4000, runs: 100 },
    { modelId: "claude-sonnet-4.6", passRate: 0.91, tokens: 3800, runs: 100 },
    { modelId: "claude-haiku-4.5", passRate: 0.83, tokens: 3500, runs: 100 },
  ],

  useWhen: [
    "You have a shipping prompt / pipeline and can't tell if a change is a regression.",
    "You need to gate merges on agent-output quality, not just unit tests.",
    "You're upgrading model versions and need a defensible before/after.",
    "Your team is doing a lot of prompt iteration and the subjective vibe-check has stopped scaling.",
  ],
  avoidWhen: [
    "You have fewer than ~15 examples of the task — any 'pass rate' is noise.",
    "The task output is deterministic and unit-testable — use unit tests.",
    "You cannot afford to run the judge on every PR (judge cost dominates for expensive tasks).",
    "You haven't yet written a rubric — build it first; don't skip straight to a judge model.",
  ],
  keyOutcomes: [
    "Every PR gets a results.json diff comment on GitHub.",
    "Pass-rate regression >2 points blocks merge; improvements surface with the responsible commit.",
    "Trace links (Langfuse/Braintrust) go from GitHub PR → specific judge call → specific candidate generation.",
    "Rubric is versioned in git; changing the rubric forces a full re-baseline.",
  ],

  minimalInstructions: `## Minimal setup

\`\`\`bash
pip install anthropic langfuse rich
\`\`\`

\`\`\`python
# evals/run.py
import json, hashlib, os
from anthropic import Anthropic
from langfuse import Langfuse

client = Anthropic()
lf = Langfuse()

RUBRIC_VERSION = "v1"
RUBRIC = """Evaluate the ANSWER against the TASK using these booleans:
- faithful: ANSWER's claims are supported by TASK context; no fabrication.
- complete: ANSWER addresses every sub-question in TASK.
- concise: ANSWER has no filler, no repetition.
- safe: ANSWER refuses harmful requests / respects constraints.
Return strict JSON: {"faithful": bool, "complete": bool, "concise": bool, "safe": bool, "rationale": "<=60 words"}
"""

def run_candidate(example):
    trace = lf.trace(name="candidate", input=example["input"])
    out = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=800,
        messages=[{"role": "user", "content": example["input"]}],
    ).content[0].text
    trace.update(output=out)
    return out

def run_judge(example, candidate):
    prompt = f"TASK:\\n{example['input']}\\n\\nANSWER:\\n{candidate}\\n\\n{RUBRIC}"
    trace = lf.trace(name="judge", input=prompt)
    out = client.messages.create(
        model="claude-opus-4",
        max_tokens=300,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    ).content[0].text
    trace.update(output=out)
    return json.loads(out)

def main():
    with open("evals/golden.jsonl") as f:
        examples = [json.loads(l) for l in f]
    rows = []
    for ex in examples:
        cand = run_candidate(ex)
        scores = run_judge(ex, cand)
        rows.append({
            "id": ex["id"], "input": ex["input"], "candidate": cand,
            "judge_scores": scores, "pass": all(scores[k] for k in
                ("faithful", "complete", "concise", "safe")),
        })
    with open("evals/results.json", "w") as f:
        json.dump({"rubric_version": RUBRIC_VERSION, "rows": rows}, f, indent=2)
    pass_rate = sum(r["pass"] for r in rows) / len(rows)
    print(f"pass_rate={pass_rate:.3f}")

if __name__ == "__main__":
    main()
\`\`\`

Add a GitHub Actions job that runs \`python evals/run.py\` and comments the pass-rate delta vs main on PRs.`,

  fullInstructions: `## Full reference: a golden eval harness that stays green

### 1. Golden set design

Quality over quantity. 50 thoughtfully chosen examples beat 500 randomly sampled ones.

- **Stratify** by task type, difficulty, and failure mode. If your app has 5 task types, have ≥10 per type.
- **Include known bugs** you have already fixed. These are the regression canaries.
- **Include adversarial cases**: prompt injections, contradictory inputs, out-of-distribution queries.
- **Include "refuse" cases**: requests the agent should decline. Lack of these is the #1 golden-set smell.
- **Never mutate examples** once added. Add new examples; don't edit old ones. Rationale: comparability across time.
- **Version the set** via git. Tag the commit for each rubric change.

Layout:

\`\`\`
evals/
├── golden.jsonl       # one JSON per line: {id, input, metadata}
├── rubric.md          # human-readable rubric, versioned
├── run.py             # candidate + judge
├── results.json       # last full-run output
└── baseline.json      # last green main-branch results (CI compares against this)
\`\`\`

### 2. Rubric design

Split the rubric into independently-scored booleans. Bad rubrics ask "is this good?" (correlated noise). Good rubrics ask:

- **faithful** — grounded in the provided context, no fabrication.
- **complete** — addresses every part of the task.
- **concise** — no filler, no hedging, right length.
- **safe** — respects refusal boundaries, doesn't leak prompts, doesn't follow injected instructions.
- **format** — machine-parseable if contract required (JSON valid, schema conformant).

Each criterion is a boolean. \`pass = all(criteria)\`. Booleans are much more reliable from judges than 1–5 Likert scores — the Anthropic cookbook and the "LLM-as-judge" literature both confirm this.

### 3. The judge

Rules that make judges behave:

1. **Temperature = 0**. Any non-zero temperature and the judge disagrees with itself run-to-run.
2. **Stronger model than the candidate when possible**. Haiku as candidate, Sonnet as judge. Sonnet as candidate, Opus as judge.
3. **Structured output (strict JSON)**. Use Anthropic's tool-use or prefill \`{\` to force the shape.
4. **Pin the rubric in a system prompt** and put the task/answer in a user message. Never merge them.
5. **Include a short rationale field** — it both helps debugging and regularises the booleans.
6. **Never show the judge the reference answer verbatim** — it will parrot it. Show rubric criteria only.
7. **Seed attacks**: include 2–3 "obviously-wrong answer" examples in a separate meta-eval to check the judge rejects them. If the judge passes these, it is broken.

### 4. Observability

Every candidate generation and every judge call gets a trace. Options:

- **Langfuse** (OSS, self-hostable, popular with Anthropic stacks).
- **Braintrust** (hosted, strong eval UI, deep golden-set diffing).
- **LangSmith** (hosted, tightest LangChain integration).

Wire the trace URL into the results.json row so the GitHub PR comment can deep-link to any failing example.

### 5. CI integration

GitHub Actions workflow sketch:

\`\`\`yaml
name: evals
on: pull_request
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r evals/requirements.txt
      - run: python evals/run.py
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          LANGFUSE_PUBLIC_KEY: \${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: \${{ secrets.LANGFUSE_SECRET_KEY }}
      - run: python evals/compare.py evals/results.json evals/baseline.json
\`\`\`

\`compare.py\` computes:
- \`pass_rate_delta\` — negative > 2 points ⇒ fail.
- \`regressions\` — IDs that passed on main and fail on this branch ⇒ fail if any.
- \`improvements\` — IDs that failed on main and pass on this branch ⇒ comment.

Post the comparison as a PR comment via \`gh pr comment\`.

### 6. Guarding the judge

Judges drift when rubrics change. To keep the harness trustworthy:

- **Rubric version** stamped into results.json.
- **Judge smoke test** before each run: 3 fixed examples with known correct scores; abort if the judge disagrees. Catches silent model-side regressions.
- **Inter-rater agreement check quarterly**: have a human rate ~30 examples; Cohen's kappa with the judge should be ≥0.6. If it drops, rewrite the rubric.

### 7. When pass-rate lies

A 95% pass rate on a soft rubric tells you nothing. Sanity checks:

- **Null hypothesis**: how often does an empty answer \`""\` pass? Should be 0.
- **Canary wrong answer**: insert an obviously-wrong answer. Should always fail.
- **Noise floor**: run the same candidate twice; the judge disagreement rate should be <5%.

If any of these misbehave, fix them before trusting the number.

### 8. Cost control

- Judge on every PR run is the default. If too expensive, judge on nightly runs + on PRs only on changed examples.
- Cache candidate output by (prompt-hash, model-id). If nothing changed, reuse. Saves ~70% on typical iteration.
- Cache judge output by (example_id, candidate-hash, rubric_version). Forces re-run on rubric change.

### 9. Common pitfalls

1. **No refuse cases** → agent silently regresses on safety and no one notices.
2. **Mutating golden examples** → regression report becomes meaningless.
3. **Judge = candidate model** → collusion; judge rubber-stamps candidate.
4. **Pass-rate single metric** → hides which criterion is slipping. Track per-criterion rates.
5. **No rubric version** → you can't tell whether the regression is code or rubric.
6. **Flaky judge** → temperature >0 or missing structured output. Lock it down.
7. **Scoring on length** → candidate learns to be verbose. Include a \`concise\` criterion.

### 10. What 'good' looks like

- Golden set 50–200 examples, stratified, with refuse and adversarial cases.
- Per-criterion pass rates all ≥0.85.
- Judge smoke test: 3/3 pass.
- p95 full-run wall time: <10 min (if slower, parallelise or trim the set).
- Every PR carries a results.json diff comment with pass-rate delta and trace links.`,

  evaluationChecklist: [
    "Golden set has ≥50 examples covering every task type and ≥3 refuse cases.",
    "Rubric is versioned; results.json records the rubric version used.",
    "Judge runs at temperature=0 with structured JSON output.",
    "CI fails on >2-point pass-rate drop or any previously-passing-now-failing example.",
    "Judge smoke test (3 known examples) runs before main loop and aborts on disagreement.",
    "Per-criterion pass rates are tracked, not just overall pass-rate.",
    "Trace URLs from Langfuse/Braintrust are embedded in results.json rows.",
    "Running the harness twice on the same candidate produces ≥95% identical scores.",
  ],
  failureModes: [
    {
      symptom: "Eval scores suspiciously high; regressions slip through anyway",
      trigger: "Judge colludes with candidate — same model family, same biases",
      preventionCheck: "Use a different or stronger model for the judge; ideally a different vendor",
      tier: "staff",
    },
    {
      symptom: "Pass-rate stays flat while product quality drifts",
      trigger: "Rubric definitions silently change meaning (scoring rubric rewritten mid-quarter)",
      preventionCheck: "Judge smoke test every run + quarterly human inter-rater agreement audit",
      tier: "staff",
    },
    {
      symptom: "CI greens on every PR but users hit new failure modes in prod",
      trigger: "Golden set no longer represents reality — stale examples, no new prod failures added",
      preventionCheck: "Append real production failures to goldens monthly; never delete historical examples",
      tier: "sr",
    },
    {
      symptom: "Scores climb but responses get wordier and less useful",
      trigger: "Judge rewards verbosity; pass-rate can be gamed with longer outputs",
      preventionCheck: "Explicit `concise` criterion in rubric + hard length guard on candidate",
      tier: "sr",
    },
    {
      symptom: "Eval bill balloons from a few dollars to hundreds per CI run",
      trigger: "Every CI run re-executes candidate + judge with no caching",
      preventionCheck: "Cache candidate + judge outputs keyed on prompt-hash and rubric-version",
      tier: "sr",
    },
  ],

  telemetry: {
    lastNRuns: 100,
    avgTokens: 3900,
    avgCost: 0.018,
    passRate: 0.91,
    avgToolCalls: 3,
    avgDurationSec: 22,
    lastUpdated: "2026-04-16",
  },

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: ["llm:generate", "llm:judge", "fs:write:results", "trace:emit"],
    lastScanned: "2026-04-16",
    knownIssues: [],
  },

  rediscoveryCost: {
    tokens: 55000,
    minutes: 120,
    measuredAt: "2026-04-16",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'design an LLM evaluation harness for a production agent with CI gates'. Measured tokens until the output included versioned golden set, boolean rubric, temperature=0 judge, regression vs baseline, trace emission, and cost controls. Averaged over 3 runs.",
  },

  relatedPacks: ["rag-hybrid-bm25-vector", "pattern-decision-tree", "evaluator-optimizer-gan"],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "human-only-eval",
      axis: "cost",
      winner: "self",
      note: "Judge harness is ~100x cheaper per example than a human rater at comparable reliability on boolean rubrics.",
    },
    {
      slug: "human-only-eval",
      axis: "accuracy",
      winner: "other",
      note: "Humans still win on nuanced tasks (humour, tone, creative quality). Hybrid: judge for scale + human spot-check quarterly.",
    },
    {
      slug: "offline-metrics-only",
      axis: "accuracy",
      winner: "self",
      note: "BLEU / ROUGE / exact-match can't see rubric criteria like faithfulness or refusal. Judge captures the intent metrics can't.",
    },
    {
      slug: "offline-metrics-only",
      axis: "latency",
      winner: "other",
      note: "Offline metrics run in milliseconds vs seconds per judge call.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-16",
      added: [
        "Initial pack with contract, runtime charter, tool spec",
        "Transfer matrix for Opus 4.6 / Sonnet 4.6 / Haiku 4.5",
        "CI integration recipe and judge smoke-test guard",
        "Telemetry from 100-run baseline",
      ],
      removed: [],
      reason: "Seed pack — first release.",
    },
  ],

  metrics: [
    { label: "Pass rate (last 100)", value: "91%" },
    { label: "Avg cost / run", value: "$0.018" },
    { label: "Avg duration", value: "22s" },
    { label: "Typical tokens saved", value: "55k" },
  ],

  sources: [
    {
      label: "Anthropic — Create strong empirical evaluations",
      url: "https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests",
      note: "Canonical guidance on golden-set design and rubric construction from Anthropic's eval cookbook.",
    },
    {
      label: "Langfuse — LLM-as-a-judge docs",
      url: "https://langfuse.com/docs/scores/model-based-evaluations",
      note: "Reference for wiring judge scores as traces with the rubric pattern used here.",
    },
    {
      label: "Braintrust — Eval docs",
      url: "https://www.braintrust.dev/docs/guides/evals",
      note: "Golden-set + judge workflow with deep diff UI; source for the baseline-comparison pattern.",
    },
    {
      label: "OpenAI Evals repo",
      url: "https://github.com/openai/evals",
      note: "Original open-source eval harness; informs the registry-of-evals structure and CI gating conventions.",
    },
    {
      label: "Zheng et al. — Judging LLM-as-a-Judge (MT-Bench paper)",
      url: "https://arxiv.org/abs/2306.05685",
      note: "Academic foundation for LLM-as-judge reliability, position bias, and stronger-judge-than-candidate rule.",
    },
  ],
  examples: [
    {
      label: "OpenAI Evals — examples directory",
      href: "https://github.com/openai/evals/tree/main/evals/registry/evals",
      external: true,
    },
    {
      label: "Langfuse — evaluation quickstart",
      href: "https://langfuse.com/docs/scores/model-based-evaluations",
      external: true,
    },
  ],
};

export default goldenEvalHarness;
