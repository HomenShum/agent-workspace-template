import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  install,
  InstallError,
  isValidInstallTarget,
  INSTALL_TARGETS,
  type InstallTarget,
} from "../install.js";

type GlobalOpts = {
  registry?: string;
  dryRun?: boolean;
  telemetry?: boolean;
  json?: boolean;
};

export function installCommand(parent: Command): Command {
  return parent
    .command("install <slug>")
    .description("Install a pack as a Claude Code skill or Cursor rule in the current repo")
    .option("--force", "Overwrite SKILL.md even if modified locally", false)
    .option(
      "--target <target>",
      `Install target: ${INSTALL_TARGETS.join("|")} (default: claude-code)`,
      "claude-code"
    )
    .action(
      async (
        slug: string,
        localOpts: { force?: boolean; target?: string },
        cmd: Command
      ) => {
      const opts = { ...parent.parent!.opts(), ...parent.opts(), ...localOpts } as GlobalOpts & {
        force?: boolean;
        target?: string;
      };
      const spinner = opts.json ? null : ora(`Installing ${chalk.cyan(slug)}`).start();
      try {
        const rawTarget = opts.target ?? "claude-code";
        if (!isValidInstallTarget(rawTarget)) {
          throw new InstallError(
            "INVALID_TARGET",
            `Invalid --target "${rawTarget}". Allowed: ${INSTALL_TARGETS.join(", ")}`
          );
        }
        const target: InstallTarget = rawTarget;
        const result = await install(slug, {
          cwd: process.cwd(),
          dryRun: opts.dryRun ?? false,
          registry: opts.registry,
          telemetry: opts.telemetry !== false,
          force: opts.force,
          target,
        });
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
          return;
        }
        spinner?.succeed(
          `${result.dryRun ? "Planned" : "Installed"} ${chalk.cyan(result.slug)} v${chalk.dim(
            result.version
          )}`
        );
        const label = result.dryRun ? chalk.yellow("would write") : chalk.green("wrote");
        const modLabel = result.dryRun ? chalk.yellow("would modify") : chalk.green("modified");
        for (const f of result.filesWritten) console.log(`  ${label}   ${f}`);
        for (const f of result.filesModified) console.log(`  ${modLabel}  ${f}`);
        if (result.dryRun) console.log(chalk.dim("(dry-run — no files touched)"));
      } catch (err) {
        spinner?.fail(`Install failed`);
        if (err instanceof InstallError) {
          if (opts.json) {
            process.stdout.write(
              JSON.stringify({ error: { code: err.code, message: err.message } }, null, 2) + "\n"
            );
          } else {
            console.error(chalk.red(`  [${err.code}] ${err.message}`));
          }
        } else {
          const e = err as Error;
          if (opts.json) {
            process.stdout.write(
              JSON.stringify({ error: { code: "UNKNOWN", message: e.message } }, null, 2) + "\n"
            );
          } else {
            console.error(chalk.red(`  ${e.message}`));
          }
        }
        process.exitCode = 1;
      }
    });
}
