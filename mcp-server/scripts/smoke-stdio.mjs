import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "dist", "index.js");

const proc = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const messages = [];
proc.stdout.setEncoding("utf8");
proc.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        messages.push({ raw: line });
      }
    }
  }
});
proc.stderr.on("data", (d) => process.stderr.write("[srv] " + d));

function send(obj) {
  proc.stdin.write(JSON.stringify(obj) + "\n");
}

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  },
});

setTimeout(() => {
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
}, 100);

setTimeout(() => {
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 300);

setTimeout(() => {
  proc.kill("SIGTERM");
  console.log("Messages received:", messages.length);
  for (const m of messages) {
    if (m.id === 1) {
      console.log("[init.response] protocolVersion =", m.result?.protocolVersion, " serverInfo =", JSON.stringify(m.result?.serverInfo));
    } else if (m.id === 2) {
      const tools = m.result?.tools ?? [];
      console.log("[tools/list] count =", tools.length);
      for (const t of tools) console.log("  -", t.name);
    } else {
      console.log("[other]", JSON.stringify(m).slice(0, 200));
    }
  }
  if (messages.some((m) => m.id === 1 && m.result) && messages.some((m) => m.id === 2 && m.result)) {
    console.log("\nSTDIO HANDSHAKE OK");
    process.exit(0);
  }
  console.error("HANDSHAKE FAILED");
  process.exit(1);
}, 2000);
