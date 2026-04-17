import { Command } from "commander";
import chalk from "chalk";
import * as readline from "node:readline/promises";
import { stdin, stdout, stderr } from "node:process";
import { logRow, TraceLogError, type LogRowInput, type WhyExplanation } from "../trace-log.js";

type GlobalOpts = {
  registry?: string;
  dryRun?: boolean;
  telemetry?: boolean;
  json?: boolean;
};

type LocalOpts = {
  traceId?: string;
  project?: string;
  row?: boolean;
  fromStdin?: boolean;
};

const DESCRIPTION = `Log a change-trace row locally and best-effort sync to the registry.

Rows are written to .attrition/traces/<traceId>.json FIRST. The registry POST is
fire-and-forget with a 3s timeout — local copy is the source of truth.

Input modes:
  --from-stdin       Read a JSON row from stdin: { scenario, filesTouched, diffSummary, why }
  --row              Interactive prompts for each field (default when TTY)

The 'why' object has 4 fields with word-count warnings (non-blocking):
  plain (≤15)  analogy (≤20)  principle (≤20)  hook (≤6)
`;

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => (data += chunk));
    stdin.on("end", () => resolve(data));
    stdin.on("error", reject);
  });
}

async function promptInteractive(): Promise<LogRowInput> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const scenario = (await rl.question("Scenario (user-facing, what broke):\n  > ")).trim();
    const filesRaw = (await rl.question("Files touched (comma-separated):\n  > ")).trim();
    const diffSummary = (await rl.question("Code change summary (diff or symbols):\n  > ")).trim();
    const plain = (await rl.question("Why · plain (≤15 words):\n  > ")).trim();
    const analogy = (await rl.question("Why · analogy (≤20 words):\n  > ")).trim();
    const principle = (await rl.question("Why · principle (≤20 words):\n  > ")).trim();
    const hook = (await rl.question("Why · hook (≤6 words):\n  > ")).trim();
    const filesTouched = filesRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return {
      scenario,
      filesTouched,
      diffSummary,
      why: { plain, analogy, principle, hook },
    };
  } finally {
    rl.close();
  }
}

function coerceRow(parsed: unknown): LogRowInput {
  if (!parsed || typeof parsed !== "object") {
    throw new TraceLogError("INVALID_INPUT", "stdin: expected JSON object");
  }
  const p = parsed as Record<string, unknown>;
  const why = (p.why ?? {}) as Record<string, unknown>;
  const filesTouched = Array.isArray(p.filesTouched)
    ? p.filesTouched.filter((v): v is string => typeof v === "string")
    : [];
  const whyOut: WhyExplanation = {
    plain: typeof why.plain === "string" ? why.plain : "",
    analogy: typeof why.analogy === "string" ? why.analogy : "",
    principle: typeof why.principle === "string" ? why.principle : "",
    hook: typeof why.hook === "string" ? why.hook : "",
  };
  return {
    scenario: typeof p.scenario === "string" ? p.scenario : "",
    filesTouched,
    diffSummary: typeof p.diffSummary === "string" ? p.diffSummary : "",
    why: whyOut,
  };
}

export function traceLogCommand(parent: Command): Command {
  return parent
    .command("log")
    .description("Append a change-trace row (local-first, best-effort registry sync)")
    .addHelpText("after", `\n${DESCRIPTION}`)
    .option("--trace-id <id>", "Explicit trace id (ct_YYYY-MM-DD[_slug]). Default: today's.")
    .option("--project <name>", "Project name (default: package.json#name or basename(cwd))")
    .option("--row", "Prompt interactively for row fields", false)
    .option("--from-stdin", "Read JSON row from stdin", false)
    .action(async (localOpts: LocalOpts, cmd: Command) => {
      const opts = {
        ...parent.parent!.opts(),
        ...parent.opts(),
        ...localOpts,
      } as GlobalOpts & LocalOpts;

      try {
        let rowInput: LogRowInput;
        if (opts.fromStdin) {
          const raw = await readStdin();
          const parsed = JSON.parse(raw) as unknown;
          rowInput = coerceRow(parsed);
        } else if (opts.row || stdin.isTTY) {
          rowInput = await promptInteractive();
        } else {
          throw new TraceLogError(
            "INVALID_INPUT",
            "No input source. Pass --from-stdin with JSON or --row for prompts."
          );
        }

        const result = await logRow({
          cwd: process.cwd(),
          traceId: opts.traceId,
          project: opts.project,
          registry: opts.registry,
          dryRun: opts.dryRun ?? false,
          row: rowInput,
        });

        if (opts.json) {
          stdout.write(JSON.stringify(result, null, 2) + "\n");
          return;
        }

        const verb = opts.dryRun ? chalk.yellow("would log") : chalk.green("logged");
        stdout.write(
          `${verb} ${chalk.cyan(result.traceId)}#${result.rowIndex}\n  path: ${result.path}\n`
        );
        if (!opts.dryRun) {
          if (result.synced) {
            stdout.write(chalk.dim("  synced to registry\n"));
          } else if (result.syncError) {
            stdout.write(chalk.yellow(`  not synced: ${result.syncError}\n`));
          } else {
            stdout.write(chalk.dim("  local-only (no registry configured)\n"));
          }
        }
        for (const w of result.warnings) stderr.write(chalk.yellow(`  ${w}\n`));
      } catch (err) {
        if (err instanceof TraceLogError) {
          if (opts.json) {
            stdout.write(
              JSON.stringify({ error: { code: err.code, message: err.message } }, null, 2) + "\n"
            );
          } else {
            stderr.write(chalk.red(`  [${err.code}] ${err.message}\n`));
          }
        } else {
          const e = err as Error;
          if (opts.json) {
            stdout.write(
              JSON.stringify({ error: { code: "UNKNOWN", message: e.message } }, null, 2) + "\n"
            );
          } else {
            stderr.write(chalk.red(`  ${e.message}\n`));
          }
        }
        process.exitCode = 1;
      }
    });
}
