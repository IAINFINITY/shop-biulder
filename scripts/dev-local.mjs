import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const apiServer = path.join(rootDir, "scripts", "local-api-server.mjs");
const children = [];
let shuttingDown = false;
const useN8nProxy = process.argv.includes("--proxy");

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    cwd: rootDir,
    env: {
      ...process.env,
      ...env,
    },
  });

  child.on("error", (error) => {
    console.error(`[dev-local] failed to start ${path.basename(command)}:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shutdown(code ?? (signal ? 1 : 0));
  });

  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  process.exit(code);
}

start(process.execPath, ["--import", "tsx", apiServer], {
  LOCAL_USE_N8N_PROXY: useN8nProxy ? "1" : "0",
});
start(process.execPath, [viteBin, "--config", "vite.config.js", "--host", "127.0.0.1", "--port", "8080"], {
  VITE_API_PROXY_TARGET: "http://127.0.0.1:3000",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
