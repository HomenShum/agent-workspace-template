import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";

type GlobalOpts = {
  registry?: string;
  json?: boolean;
};

export function traceSearchCommand(parent: Command): Command {
  return parent
    .command("search <query>")
    .description("Search change-traces by scenario/symbol/text")
    .option("--limit <n>", "Max results (default 10)", "10")
    .option("--project <name>", "Filter by project")
    .action(async (query: string, localOpts: { limit?: string; project?: string }, cmd: Command) => {
      const opts = {
        ...parent.parent!.opts(),
        ...parent.opts(),
        ...localOpts,
      } as GlobalOpts & { limit?: string; project?: string };
      const registryUrl = opts.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY;
      const client = new RegistryClient(registryUrl);
      const limit = Number.parseInt(opts.limit ?? "10", 10);
      const filter: { q?: string; limit?: number; project?: string } = { q: query };
      if (!Number.isNaN(limit)) filter.limit = limit;
      if (opts.project) filter.project = opts.project;
      const res = await client.listTraces(filter);

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

      const rows = res.value.traces ?? [];
      if (rows.length === 0) {
        process.stdout.write(chalk.dim("  no matches\n"));
        return;
      }
      for (const r of rows) {
        const rows = typeof r.rows === "number" ? `${r.rows}` : "?";
        const snippet = (r.scenarioSnippet ?? "").slice(0, 80);
        process.stdout.write(
          `  ${chalk.cyan(r.id)}  ${chalk.dim((r.project ?? "").padEnd(20).slice(0, 20))}  ${rows.padStart(3)} rows  ${snippet}\n`
        );
      }
    });
}
