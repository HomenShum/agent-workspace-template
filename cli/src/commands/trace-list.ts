import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";

type GlobalOpts = {
  registry?: string;
  json?: boolean;
};

export function traceListCommand(parent: Command): Command {
  return parent
    .command("list")
    .description("List recent change-traces")
    .option("--limit <n>", "Max results (default 20)", "20")
    .option("--project <name>", "Filter by project")
    .action(async (localOpts: { limit?: string; project?: string }, cmd: Command) => {
      const opts = {
        ...parent.parent!.opts(),
        ...parent.opts(),
        ...localOpts,
      } as GlobalOpts & { limit?: string; project?: string };
      const registryUrl = opts.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY;
      const client = new RegistryClient(registryUrl);
      const limit = Number.parseInt(opts.limit ?? "20", 10);
      const filter: { limit?: number; project?: string } = {};
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
        process.stdout.write(chalk.dim("  no traces\n"));
        return;
      }
      for (const r of rows) {
        const rowsLabel = typeof r.rows === "number" ? `${r.rows}` : "?";
        const snippet = (r.scenarioSnippet ?? "").slice(0, 60);
        process.stdout.write(
          `  ${chalk.cyan(r.id)}  ${chalk.dim((r.project ?? "").padEnd(20).slice(0, 20))}  ${rowsLabel.padStart(3)} rows  ${snippet}\n`
        );
      }
    });
}
