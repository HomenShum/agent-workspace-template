import { Command } from "commander";
import { traceLogCommand } from "./trace-log.js";
import { traceSearchCommand } from "./trace-search.js";
import { traceShowCommand } from "./trace-show.js";
import { traceListCommand } from "./trace-list.js";

export function traceCommand(program: Command): Command {
  const trace = program
    .command("trace")
    .description(
      "Change-trace catalog (Pillar 2) — capture, search, and browse what you + your agent changed"
    );
  traceLogCommand(trace);
  traceSearchCommand(trace);
  traceShowCommand(trace);
  traceListCommand(trace);
  return trace;
}
