// src/index.ts
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// src/constants.ts
var PLUGIN_NAME = "dsh-headroom";
var HEADROOM_PORT = 8787;
var DEEPSEEK_ANTHROPIC_URL = "https://api.deepseek.com/anthropic";
var DEEPSEEK_OPENAI_URL = "https://api.deepseek.com";
var HEADROOM_BASE_URL = `http://127.0.0.1:${HEADROOM_PORT}/v1`;
var DIRECT_BASE_URL = "https://api.deepseek.com";
var LLM_DEEPSEEK_NAMESPACE = "llm-deepseek";
var HEADROOM_LIVEZ_URL = `http://127.0.0.1:${HEADROOM_PORT}/livez`;

// src/index.ts
function pluginHome() {
  return join(homedir(), ".dsh-headroom");
}
function venvDir() {
  return join(pluginHome(), "venv");
}
function proxyLogPath() {
  return join(pluginHome(), "proxy.log");
}
function startupLogPath() {
  return join(pluginHome(), "startup.log");
}
function venvPython() {
  return process.platform === "win32" ? join(venvDir(), "Scripts", "python.exe") : join(venvDir(), "bin", "python");
}
function venvHeadroom() {
  return process.platform === "win32" ? join(venvDir(), "Scripts", "headroom.exe") : join(venvDir(), "bin", "headroom");
}
function findSystemPython() {
  const candidates = process.platform === "win32" ? ["python", "py -3.13", "py -3.12", "py -3.11", "py -3.10"] : ["python3", "python"];
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        resolve(void 0);
        return;
      }
      const candidate = candidates[index++];
      execFile(candidate.split(" ")[0], [...candidate.split(" ").slice(1), "--version"], { timeout: 8e3 }, (error, stdout, stderr) => {
        if (!error && /Python 3\.(1[0-9]|[0-9])/.test(`${stdout}${stderr}`)) resolve(candidate);
        else tryNext();
      });
    };
    tryNext();
  });
}
function venvReady() {
  return existsSync(venvPython()) && existsSync(venvHeadroom());
}
async function probeHealth(timeoutMs = 3e3) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`http://127.0.0.1:${HEADROOM_PORT}/livez`, { signal: controller.signal });
      if (!response.ok) return { healthy: false };
      const body = await response.json();
      return { healthy: true, version: typeof body.version === "string" ? body.version : void 0 };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { healthy: false };
  }
}
function run(command, logPath) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32" ? true : false,
      env: { ...process.env }
    });
    const chunks = [];
    child.stdout?.on("data", (c) => chunks.push(c));
    child.stderr?.on("data", (c) => chunks.push(c));
    child.on("close", (code) => {
      try {
        writeFileSync(logPath, Buffer.concat(chunks).toString("utf8"), { flag: "a" });
      } catch {
      }
      resolve(code ?? -1);
    });
  });
}
async function ensureInstalled(log) {
  mkdirSync(pluginHome(), { recursive: true });
  if (venvReady()) return { ok: true, message: "Headroom already installed (plugin venv)." };
  const systemPython = await findSystemPython();
  if (systemPython === void 0) {
    return { ok: false, message: "No Python 3.10+ found. Install Python first (Windows: also need MSVC Build Tools + Rust, see README)." };
  }
  log(`Creating venv with ${systemPython} ...`);
  const createCode = await run(
    process.platform === "win32" ? [systemPython, "-m", "venv", venvDir()] : [...systemPython.split(" "), "-m", "venv", venvDir()],
    join(pluginHome(), "venv-create.log")
  );
  if (createCode !== 0) {
    return { ok: false, message: `Failed to create venv (exit ${createCode}). See ~/.dsh-headroom/venv-create.log` };
  }
  log("Installing headroom-ai[proxy] (lightweight, no torch) ...");
  const pip = process.platform === "win32" ? [venvPython(), "-m", "pip", "install", "--disable-pip-version-check", "headroom-ai[proxy]"] : [venvPython(), "-m", "pip", "install", "--disable-pip-version-check", "headroom-ai[proxy]"];
  const installCode = await run(pip, join(pluginHome(), "install.log"));
  if (installCode !== 0) {
    return { ok: false, message: "pip install headroom-ai[proxy] failed. See ~/.dsh-headroom/install.log. On Windows, Rust/MSVC may be required (README)." };
  }
  return { ok: true, message: "Headroom installed into plugin venv." };
}
async function startProxy(log) {
  if (!venvReady()) {
    const installed = await ensureInstalled(log);
    if (!installed.ok) return installed;
  }
  mkdirSync(pluginHome(), { recursive: true });
  const health = await probeHealth(1500);
  if (health.healthy) return { ok: true, message: "Headroom already running." };
  const args = [
    "proxy",
    "--port",
    String(HEADROOM_PORT),
    "--anthropic-api-url",
    DEEPSEEK_ANTHROPIC_URL,
    "--openai-api-url",
    DEEPSEEK_OPENAI_URL,
    "--host",
    "127.0.0.1",
    "--connect-timeout-seconds",
    "15",
    "--request-timeout-seconds",
    "120",
    "--log-file",
    proxyLogPath()
  ];
  try {
    const child = spawn(venvHeadroom(), args, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        HEADROOM_DETECT_BACKEND: "python",
        // avoid Windows detect_content_type deadlock
        HEADROOM_TOOL_SEARCH: "off"
        // DeepSeek does not know the Anthropic tool_search type
      }
    });
    child.unref();
    writeFileSync(startupLogPath(), `${(/* @__PURE__ */ new Date()).toISOString()} spawned headroom proxy pid=${child.pid}
`, { flag: "a" });
    log(`Headroom proxy starting (pid ${child.pid}). Waiting for health...`);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1e3));
      const now = await probeHealth(1500);
      if (now.healthy) return { ok: true, message: `Headroom healthy (v${now.version ?? "?"}).` };
    }
    return { ok: true, message: "Headroom process started; health check still warming up (cold start)." };
  } catch (error) {
    return { ok: false, message: `Failed to start Headroom: ${error instanceof Error ? error.message : String(error)}` };
  }
}
async function stopProxy(log) {
  const health = await probeHealth(1500);
  if (!health.healthy) return { ok: true, message: "Headroom is not running." };
  if (process.platform === "win32") {
    const code = await new Promise((resolve) => {
      execFile("taskkill", ["/PID", "/T", "/F"], { timeout: 8e3 }, (error) => resolve(error ? 1 : 0));
    });
    void code;
  }
  await new Promise((resolve) => {
    execFile("taskkill", ["/F", "/IM", "headroom.exe"], { timeout: 8e3 }, () => resolve());
  });
  log("Headroom proxy stopped.");
  return { ok: true, message: "Headroom proxy stopped." };
}
function apply(_ctx) {
}
export {
  DEEPSEEK_ANTHROPIC_URL,
  DEEPSEEK_OPENAI_URL,
  DIRECT_BASE_URL,
  HEADROOM_BASE_URL,
  HEADROOM_LIVEZ_URL,
  HEADROOM_PORT,
  LLM_DEEPSEEK_NAMESPACE,
  PLUGIN_NAME,
  apply,
  ensureInstalled,
  probeHealth,
  startProxy,
  stopProxy
};
//# sourceMappingURL=index.js.map
