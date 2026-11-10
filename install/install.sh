#!/usr/bin/env bash
# dsh-purge 一键安装（仅支持 GitHub Release 离线包）：自动识别 dsh harness
# 主目录，注册进 dsh profile + 直接把补丁写进宿主。不联网、不拉 npm、不拉仓库。
# 用法：
#   bash install/install.sh            # 装好并应用（默认）
#   bash install/install.sh --no-apply  # 只安装，补丁留到界面里点
#   bash install/install.sh --profile desktop  # 指定 profile
#   bash install/install.sh --profile-dir PATH # 直接指定 profile 目录
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE=""
PROFILE_DIR=""
APPLY="yes"

usage() {
  sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY="yes"; shift ;;
    --no-apply) APPLY="no"; shift ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --profile-dir) PROFILE_DIR="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
die() { printf '错误：%s\n' "$*" >&2; exit 1; }

# ---------- 1. 校验插件目录 ----------
[ -f "$PLUGIN_DIR/package.json" ] || die "找不到 $PLUGIN_DIR/package.json"
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync(process.argv[1] + "/package.json", "utf8"));
if (p.name !== "dsh-purge") { console.error("这个目录不是 dsh-purge：包名是 " + p.name); process.exit(1); }
if (!fs.existsSync(process.argv[1] + "/client.js")) { console.error("缺少 client.js，包不完整"); process.exit(1); }
' "$PLUGIN_DIR" || die "插件目录校验失败"

# ---------- 2. 自动识别 dsh harness 主目录（同 lib/core.js findDshHome 的顺序） ----------
# DSH_HOME → 桌面端目录旁的 .dsh / dsh-home → ~/.dsh
home_has_harness_data() {
  [ -f "$1/prompt-inject.md" ] || [ -d "$1/profiles" ] || [ -f "$1/cordis.patch.yml" ]
}

cands=()
[ -n "${DSH_HOME:-}" ] && cands+=("$DSH_HOME")
case "$(uname -s)" in
  Darwin)
    _r="$HOME/Library/Application Support/DeepSeek Harness"
    cands+=("$_r" "$_r/.dsh" "$_r/dsh-home")
    ;;
esac
cands+=("$HOME/.dsh")

DSH_HOME_FOUND=""
for c in "${cands[@]}"; do
  if [ -d "$c" ] && home_has_harness_data "$c"; then DSH_HOME_FOUND="$c"; break; fi
done
if [ -z "$DSH_HOME_FOUND" ]; then
  for c in "${cands[@]}"; do [ -d "$c" ] && { DSH_HOME_FOUND="$c"; break; }; done
fi
[ -n "$DSH_HOME_FOUND" ] || die "找不到 dsh harness 主目录（试过：${cands[*]}）"

# ---------- 3. 定位 profile ----------
if [ -z "$PROFILE_DIR" ]; then
  if [ -n "$PROFILE" ]; then
    PROFILE_DIR="$DSH_HOME_FOUND/profiles/$PROFILE"
  else
    for cand in desktop web dsh-tui; do
      if [ -f "$DSH_HOME_FOUND/profiles/$cand/package.json" ]; then PROFILE_DIR="$DSH_HOME_FOUND/profiles/$cand"; break; fi
    done
  fi
fi
[ -n "$PROFILE_DIR" ] && [ -f "$PROFILE_DIR/package.json" ] || die "找不到 dsh profile（harness 主目录 $DSH_HOME_FOUND，试过 profiles/{desktop,web,dsh-tui}），用 --profile 或 --profile-dir 指定"
PROFILE_DIR="$(cd "$PROFILE_DIR" && pwd)"
PROFILE_NAME="$(basename "$PROFILE_DIR")"
say "dsh 主目录  $DSH_HOME_FOUND"
say "插件目录  $PLUGIN_DIR"
say "目标 profile  $PROFILE_DIR"

# ---------- 4. 装进 profile ----------
cd "$PROFILE_DIR"
if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
  say "包管理器  pnpm"
  pnpm add --ignore-scripts "file:$PLUGIN_DIR"
else
  PM="npm"
  say "包管理器  npm"
  npm install --ignore-scripts --no-audit --no-fund "file:$PLUGIN_DIR"
fi

# ---------- 5. 注册 bundle + cordis insert ----------
INIT_CWD="$PROFILE_DIR" node "$PLUGIN_DIR/install/register.mjs"

# ---------- 6. 校验 ----------
node - "$PROFILE_DIR" <<'NODE' || exit 1
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
const bundles = pkg.dsh?.profile?.bundles ?? [];
const problems = [];
if (!bundles.includes("dsh-purge")) problems.push("dsh.profile.bundles 里没有 dsh-purge");
const nm = path.join(dir, "node_modules", "dsh-purge");
if (!fs.existsSync(path.join(nm, "package.json"))) problems.push("node_modules/dsh-purge 不存在");
const yml = path.join(dir, "cordis.patch.yml");
if (!fs.existsSync(yml) || !/id:\s*dsh-purge/.test(fs.readFileSync(yml, "utf8"))) problems.push("cordis.patch.yml 缺少 id: dsh-purge");
if (problems.length) { console.error("校验失败：\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("校验通过：bundles / node_modules / cordis.patch.yml 三处都就位");
NODE

# ---------- 7. 可选：应用补丁 ----------
should_apply() {
  case "$APPLY" in
    no) return 1 ;;
    *) return 0 ;;
  esac
}

if should_apply; then
  say ""
  say "开始应用补丁（会先备份宿主文件）…"
  node "$PLUGIN_DIR/bin/dsh-purge.js" --apply
  say ""
  say "已完成。完全退出 dsh 再打开即生效。"
else
  say ""
  say "已安装，未应用补丁。接下来："
  say "  1) 完全退出 dsh 再打开"
  say "  2) 打开 dsh-purge → 宿主 → 点「应用到宿主」→ 再重启一次"
  say "  （或现在跑：node \"$PLUGIN_DIR/bin/dsh-purge.js\" --apply）"
fi
