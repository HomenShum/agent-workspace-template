#!/usr/bin/env node
import { Command } from "commander";
import { installCommand } from "./commands/install.js";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";
import { verifyCommand } from "./commands/verify.js";
import { traceCommand } from "./commands/trace.js";

const program = new Command();

program
  .name("attrition")
  .description("attrition.sh CLI — install Agent Workspace packs as Claude Code skills")
  .version("0.1.0")
  .option("--registry <url>", "Registry base URL (overrides ATTRITION_REGISTRY_URL)")
  .option("--dry-run", "Plan changes without writing files", false)
  .option("--no-telemetry", "Disable anonymous install telemetry")
  .option("--json", "Emit machine-readable JSON output", false);

const pack = program.command("pack").description("Pack management commands");
installCommand(pack);
listCommand(pack);
searchCommand(pack);
verifyCommand(pack);

traceCommand(program);

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
