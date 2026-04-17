import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";
import { validateTraceId, TraceLogError } from "../trace-log.js";

type GlobalOpts = {
  registry?: string;
  json?: boolean;
};

type ChangeRowLike = {
  scenario?: string;
  filesTouched?: string[];
  changes?: Array<{ diffSummary?: string; path?: string }>;
  why?: { plain?: string; analogy?: string; principle?: string; hook?: string };
};

type ChangeTraceLike = {
  id?: string;
  project?: string;
  createdAt?: string;
  rows?: ChangeRowLike[];
  tags?: string[];
  packsReferenced?: string[];
};

export function traceShowCommand(parent: Command): Command {
  return parent
    .command("show <id>")
    .description("Show a change-trace (JSON by default, --raw for markdown)")
    .option("--raw", "Fetch raw markdown export from /traces/<id>/raw", false)
    .action(async (id: string, localOpts: { raw?: boolean }, cmd: Command) => {
      const opts = {
        ...parent.parent!.opts(),
        ...parent.opts(),
        ...localOpts,
      } as GlobalOpts & { raw?: boolean };
      try {
        validateTraceId(id);
      } catch (err) {
        const e = err as TraceLogError;
        if (opts.json) {
          process.stdout.write(
            JSON.stringify({ error: { code: e.code, message: e.message } }, null, 2) + "\n"
          );
        } else {
          process.stderr.write(chalk.red(`  [${e.code}] ${e.message}\n`));
        }
        process.exitCode = 1;
        return;
      }
      const registryUrl = opts.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY;
      const client = new RegistryClient(registryUrl);

      if (opts.raw) {
        const res = await client.getRawTrace(id);
        if (!res.ok) {
          if (opts.json) {
            process.stdout.write(
              JSON.stringify({ error: { code: res.error.code, message: res.error.message } }, null, 2) + "\n"
            );
          } else {
            process.stderr.write(chalk.red(`  [${res.error.code}] ${res.error.message}\n`));
          }
          process.exitCode = 1;
          return;
        }
        process.stdout.write(res.value);
        if (!res.value.endsWith("\n")) process.stdout.write("\n");
        return;
      }

      const res = await client.getTrace(id);
      if (!res.ok) {
        if (opts.json) {
          process.stdout.write(
            JSON.stringify({ error: { code: res.error.code, message: res.error.message } }, null, 2) + "\n"
          );
        } else {
          process.stderr.write(chalk.red(`  [${res.error.code}] ${res.error.message}\n`));
        }
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(res.value, null, 2) + "\n");
        return;
      }

      const trace = (res.value ?? {}) as ChangeTraceLike;
      process.stdout.write(chalk.bold(`${trace.id ?? id}`) + `  ${chalk.dim(trace.project ?? "")}\n`);
      if (trace.createdAt) process.stdout.write(chalk.dim(`  created: ${trace.createdAt}\n`));
      if (trace.tags?.length) process.stdout.write(`  tags: ${trace.tags.join(", ")}\n`);
      const rows = trace.rows ?? [];
      process.stdout.write(chalk.dim(`  rows: ${rows.length}\n\n`));
      rows.forEach((r, i) => {
        process.stdout.write(`${chalk.cyan(`#${i}`)} ${r.scenario ?? ""}\n`);
        if (r.filesTouched?.length) {
          process.stdout.write(`    files: ${r.filesTouched.join(", ")}\n`);
        }
        if (r.changes?.length) {
          for (const c of r.changes) {
            if (c.diffSummary) process.stdout.write(`    change: ${c.diffSummary}\n`);
          }
        }
        if (r.why) {
          if (r.why.plain) process.stdout.write(`    plain: ${r.why.plain}\n`);
          if (r.why.analogy) process.stdout.write(`    analogy: ${r.why.analogy}\n`);
          if (r.why.principle) process.stdout.write(`    principle: ${r.why.principle}\n`);
          if (r.why.hook) process.stdout.write(`    ${chalk.bold("hook")}: ${r.why.hook}\n`);
        }
        process.stdout.write("\n");
      });
    });
}
