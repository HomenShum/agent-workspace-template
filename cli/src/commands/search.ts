import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";

export function searchCommand(parent: Command): Command {
  return parent
    .command("search <query>")
    .description("Search packs by text query")
    .action(async (query: string, _localOpts: unknown) => {
      const top = parent.parent!.opts() as { registry?: string; json?: boolean };
      const client = new RegistryClient(top.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY);
      const res = await client.list(query);
      if (!res.ok) {
        if (top.json) process.stdout.write(JSON.stringify({ error: res.error }) + "\n");
        else console.error(chalk.red(`[${res.error.code}] ${res.error.message}`));
        process.exitCode = 1;
        return;
      }
      if (top.json) {
        process.stdout.write(JSON.stringify(res.value, null, 2) + "\n");
        return;
      }
      const rows = res.value.packs;
      if (rows.length === 0) {
        console.log(chalk.dim(`No packs matched "${query}".`));
        return;
      }
      for (const p of rows) {
        console.log(
          `${chalk.cyan(p.slug)} ${chalk.dim(`v${p.version}`)} — ${p.name}\n  ${chalk.dim(p.tagline)}`
        );
      }
    });
}
