/**
 * 敏感操作保护
 *
 * 目标：删 / 写 / 增 这类会改动本机文件的动作，默认限制在授权根目录内；
 *       渗透测试本身的扫描、请求、拿权限不受影响。
 *
 * 配置：$DSH_HOME/redteam/sensitive-ops.json
 * {
 *   "mode": "block",              // off | audit | block
 *   "roots": ["/Users/me/security", "/tmp"],
 *   "rules": {
 *     "writeOutsideRoots": true,
 *     "deleteOutsideRoots": true,
 *     "bashDestructive": true,
 *     "dbDestructive": false
 *   },
 *   "auditFile": "$DSH_HOME/redteam/sensitive-ops-audit.log"
 * }
 */
import fs from "node:fs";
import path from "node:path";
import { findDshHome } from "./core.js";

const DEFAULT_RULES = Object.freeze({
  writeOutsideRoots: true,
  deleteOutsideRoots: true,
  bashDestructive: true,
  dbDestructive: false,
});

function configPath(home = findDshHome()) {
  return path.join(home, "redteam", "sensitive-ops.json");
}

function defaultRoots(home = findDshHome()) {
  return [process.cwd(), path.join(home, "redteam"), "/tmp"];
}

function loadConfig(home = findDshHome()) {
  const fallback = {
    mode: "block",
    roots: defaultRoots(home),
    rules: { ...DEFAULT_RULES },
    auditFile: path.join(home, "redteam", "sensitive-ops-audit.log"),
  };
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(home), "utf8"));
    const modes = new Set(["off", "audit", "block"]);
    return {
      mode: modes.has(raw?.mode) ? raw.mode : "block",
      roots: Array.isArray(raw?.roots) && raw.roots.length ? raw.roots.map(String) : fallback.roots,
      rules: { ...DEFAULT_RULES, ...(raw?.rules && typeof raw.rules === "object" ? raw.rules : {}) },
      auditFile: typeof raw?.auditFile === "string" && raw.auditFile ? raw.auditFile : fallback.auditFile,
    };
  } catch {
    return fallback;
  }
}

function realpathBestEffort(target) {
  let current = path.resolve(target);
  const tail = [];
  for (let i = 0; i < 12; i += 1) {
    try {
      const real = fs.realpathSync(current);
      return path.join(real, ...tail.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      tail.push(path.basename(current));
      current = parent;
    }
  }
  return path.resolve(target);
}

function insideRoots(target, roots) {
  const real = realpathBestEffort(target);
  return roots.some((root) => {
    const base = realpathBestEffort(root);
    return real === base || real.startsWith(base + path.sep);
  });
}

function audit(config, entry) {
  try {
    fs.mkdirSync(path.dirname(config.auditFile), { recursive: true });
    fs.appendFileSync(config.auditFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
  } catch { /* 审计写不了不影响主流程 */ }
}

function deny(reason) {
  const text = `SENSITIVE_OP_BLOCKED: ${reason}（删除/写入/新增受保护；配置 ~/.dsh/redteam/sensitive-ops.json）`;
  return { kind: "deny", reason: text };
}

function pathTokens(command) {
  const out = [];
  const sample = String(command || "");
  // 0.2.2 适配：前缀类去掉 ':'，URL（https://host/... 里的 //host/...）不再被当成路径提取。
  for (const m of sample.matchAll(/(?:^|[\s='""])((?:~|\/)[^\s'";|&<>()]+)/g)) out.push(m[1].replace(/[),;]+$/, ""));
  return out;
}

function destructive(command) {
  const c = String(command || "");
  return [
    /\brm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*\s+)*[^\s]/i,
    /\brmdir\b/i,
    /\bunlink\b/i,
    /\bshred\b/i,
    /\btruncate\b/i,
    /\bdd\s+if=/i,
    /\bmkfs(?:\.\w+)?\b/i,
    /\bgit\s+clean\b/i,
    /\bDROP\s+(?:TABLE|DATABASE)\b/i,
    /\bDELETE\s+FROM\b/i,
    // 0.2.2 适配：排除 fd 前缀重定向（2>/dev/null）与 /dev/null 本身，二者皆无破坏性，
    // 否则所有带 2>/dev/null 的渗透命令都会被误判为破坏性。
    /(?<![0-9])>\s*\/(?!tmp(?:\/|$)|dev\/null\b)[^\s]+/,
  ].some((re) => re.test(c));
}

function toolName(exec) {
  return String(exec?.tool?.name || exec?.name || exec?.toolName || "").toLowerCase();
}

function toolArgs(exec) {
  return exec?.arguments ?? exec?.args ?? exec?.input ?? exec?.parameters ?? exec?.params ?? {};
}

export function installSensitiveGuard(ctx) {
  if (!ctx || typeof ctx.on !== "function") return;
  if (ctx.__dshPurgeSensitiveGuard) return;
  const home = findDshHome();
  // 0.2.2 适配：config 改为每次事件现场读（与 net-policy 同款热加载），
  // 运行时改 sensitive-ops.json（roots / mode / rules）立即生效，不用重启。
  const hook = async (exec, next) => {
    const forward = () => (typeof next === "function" ? next() : { kind: "allow" });
    const config = loadConfig(home);
    if (config.mode === "off") return forward();
    const name = toolName(exec);
    if (!["write", "edit", "bash", "pwsh"].includes(name)) return forward();
    const args = toolArgs(exec);
    let reason = "";
    try {
      if (name === "write" || name === "edit") {
        const fp = String(args?.file_path || args?.path || args?.filename || "");
        /* 相对路径由宿主按工作区解析，不在本守卫里猜；只拦绝对路径越界。 */
        if (fp && path.isAbsolute(fp) && config.rules.writeOutsideRoots && !insideRoots(fp, config.roots)) {
          reason = `写入目标不在授权根目录内：${fp}`;
        }
      } else if (config.rules.bashDestructive) {
        const command = String(args?.command || args?.cmd || args?.script || "");
        if (command && config.rules.dbDestructive && /\b(?:DROP\s+(?:TABLE|DATABASE)|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i.test(command)) {
          reason = "数据库破坏性语句（DROP / DELETE / TRUNCATE）已被 sensitive-ops 禁止";
        } else if (command && destructive(command)) {
          const outside = pathTokens(command).filter((p) => !insideRoots(p.replace(/^~(?=\/|$)/, process.env.HOME || "~"), config.roots));
          if (outside.length) reason = `破坏性命令涉及授权根目录外的路径：${outside.slice(0, 3).join("、")}`;
        }
      }
    } catch { /* 判定失败不阻塞工具 */ }
    if (!reason) return forward();
    audit(config, { mode: config.mode, tool: name, reason, args });
    if (config.mode === "audit") return forward();
    if (exec && typeof exec === "object") {
      exec.blocked = true;
      exec.error = reason;
    }
    return deny(reason);
  };

  try {
    try { ctx.on("tools/pre-execute", hook, { global: true, prepend: true }); } catch { try { ctx.on("tools/pre-execute", hook); } catch { /* 旧宿主没有工具钩。 */ } }
    ctx.__dshPurgeSensitiveGuard = true;
  } catch { /* 旧宿主没有工具钩 */ }
}
