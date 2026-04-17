import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";

export function listCommand(parent: Command): Command {
  return parent
    .command("list")
    .description("List all packs in the registry")
    .action(async (_localOpts: unknown, _cmd: Command) => {
      const top = parent.parent!.opts() as { registry?: string; json?: boolean };
      const client = new RegistryClient(top.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY);
      const res = await client.list();
      if (!res.ok) {
        if (top.json) {
          process.stdout.write(JSON.stringify({ error: res.error }) + "\n");
        } else {
          console.error(chalk.red(`[${res.error.code}] ${res.error.message}`));
        }
        process.exitCode = 1;
        return;
      }
      if (top.json) {
        process.stdout.write(JSON.stringify(res.value, null, 2) + "\n");
        return;
      }
      const rows = res.value.packs;
      if (rows.length === 0) {
        console.log(chalk.dim("No packs found."));
        return;
      }
      const slugW = Math.max(4, ...rows.map((p) => p.slug.length));
      const nameW = Math.max(4, ...rows.map((p) => p.name.length));
      const typeW = Math.max(4, ...rows.map((p) => String(p.packType).length));
      console.log(
        chalk.bold(
          `${"slug".padEnd(slugW)}  ${"name".padEnd(nameW)}  ${"type".padEnd(typeW)}  trust`
        )
      );
      for (const p of rows) {
        console.log(
          `${p.slug.padEnd(slugW)}  ${p.name.padEnd(nameW)}  ${String(p.packType).padEnd(typeW)}  ${p.trust}`
        );
      }
    });
}
