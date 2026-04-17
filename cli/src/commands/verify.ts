import { Command } from "commander";
import chalk from "chalk";
import { RegistryClient, DEFAULT_REGISTRY } from "../registry.js";
import { readLockfile } from "../install.js";

export function verifyCommand(parent: Command): Command {
  return parent
    .command("verify")
    .description("Compare installed packs against the current registry versions")
    .action(async (_localOpts: unknown) => {
      const top = parent.parent!.opts() as { registry?: string; json?: boolean };
      const client = new RegistryClient(top.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY);
      const lock = await readLockfile(process.cwd());
      if (lock.packs.length === 0) {
        if (top.json) {
          process.stdout.write(JSON.stringify({ packs: [] }) + "\n");
        } else {
          console.log(chalk.dim("No packs installed (empty .attrition/installed.json)."));
        }
        return;
      }
      const results: Array<{
        slug: string;
        installed: string;
        latest: string | null;
        drift: "current" | "stale" | "unknown";
        error?: string;
      }> = [];

      let anyDrift = false;
      for (const pack of lock.packs) {
        const res = await client.get(pack.slug);
        if (!res.ok) {
          results.push({
            slug: pack.slug,
            installed: pack.version,
            latest: null,
            drift: "unknown",
            error: `${res.error.code}: ${res.error.message}`,
          });
          continue;
        }
        const latest = typeof res.value.version === "string" ? res.value.version : "0.0.0";
        const drift = latest === pack.version ? "current" : "stale";
        if (drift !== "current") anyDrift = true;
        results.push({ slug: pack.slug, installed: pack.version, latest, drift });
      }

      if (top.json) {
        process.stdout.write(JSON.stringify({ packs: results }, null, 2) + "\n");
      } else {
        for (const r of results) {
          const tag =
            r.drift === "current"
              ? chalk.green("OK   ")
              : r.drift === "stale"
              ? chalk.yellow("STALE")
              : chalk.red("ERR  ");
          console.log(
            `${tag} ${r.slug.padEnd(24)} ${chalk.dim(`installed ${r.installed}`)} ${
              r.latest ? `→ ${r.latest}` : r.error ?? ""
            }`
          );
        }
      }
      if (anyDrift) process.exitCode = 0; // drift is informational, not a failure
    });
}
