# dsh-purge 一键安装（Windows，仅支持 GitHub Release 离线包）：
# 自动识别 dsh harness 主目录，注册进 dsh profile + 直接把补丁写进宿主。
# 不联网、不拉 npm、不拉仓库。本文件必须保存为 UTF-8 with BOM（PowerShell 5.1 要求）。
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1
#   .\install\install.ps1 -NoApply                 # 只安装，补丁留到界面里点
#   .\install\install.ps1 -Profile desktop         # desktop / web / dsh-tui
#   .\install\install.ps1 -ProfileDir "D:\dsh\profiles\desktop"
param(
  [switch]$NoApply,
  [string]$Profile = "",
  [string]$ProfileDir = ""
)

$ErrorActionPreference = "Stop"

function Say($m) { Write-Host $m }
function Die($m) { Write-Host "错误：$m" -ForegroundColor Red; exit 1 }

$PluginDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
function Test-HomeData($d) {
  (Test-Path (Join-Path $d "prompt-inject.md") -PathType Leaf) -or
  (Test-Path (Join-Path $d "profiles") -PathType Container) -or
  (Test-Path (Join-Path $d "cordis.patch.yml") -PathType Leaf)
}

# 1. 校验插件目录
$pkgPath = Join-Path $PluginDir "package.json"
if (-not (Test-Path $pkgPath)) { Die "找不到 $pkgPath" }
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($pkg.name -ne "dsh-purge") { Die "这个目录不是 dsh-purge：包名是 $($pkg.name)" }
if (-not (Test-Path (Join-Path $PluginDir "client.js"))) { Die "缺少 client.js，包不完整" }

# 2. 自动识别 dsh harness 主目录（同 lib/core.js findDshHome 的顺序）
#    DSH_HOME → 桌面端数据目录旁的 .dsh / dsh-home → ~\.dsh
$cands = @()
if ($env:DSH_HOME) { $cands += $env:DSH_HOME }
$appRoots = @()
if ($env:APPDATA) { $appRoots += (Join-Path $env:APPDATA "DeepSeek Harness") }
if ($env:LOCALAPPDATA) { $appRoots += (Join-Path $env:LOCALAPPDATA "DeepSeek Harness") }
foreach ($r in $appRoots) { $cands += @($r, (Join-Path $r ".dsh"), (Join-Path $r "dsh-home")) }
$cands += (Join-Path $env:USERPROFILE ".dsh")

$DshHome = ""
foreach ($c in $cands) {
  if ((Test-Path $c -PathType Container) -and (Test-HomeData $c)) { $DshHome = $c; break }
}
if (-not $DshHome) {
  foreach ($c in $cands) { if (Test-Path $c -PathType Container) { $DshHome = $c; break } }
}
if (-not $DshHome) { Die "找不到 dsh harness 主目录（试过：$($cands -join '、')）" }

# 3. 定位 profile
if (-not $ProfileDir) {
  if ($Profile) {
    $ProfileDir = Join-Path $DshHome "profiles\$Profile"
  } else {
    foreach ($cand in @("desktop", "web", "dsh-tui")) {
      $p = Join-Path $DshHome "profiles\$cand"
      if (Test-Path (Join-Path $p "package.json")) { $ProfileDir = $p; break }
    }
  }
}
if (-not $ProfileDir -or -not (Test-Path (Join-Path $ProfileDir "package.json"))) {
  Die "找不到 dsh profile（harness 主目录 $DshHome，试过 profiles\{desktop,web,dsh-tui}），用 -Profile 或 -ProfileDir 指定"
}
$ProfileDir = (Resolve-Path $ProfileDir).Path
Say "dsh 主目录  $DshHome"
Say "插件目录  $PluginDir"
Say "目标 profile  $ProfileDir"

# 4. 装进 profile
$spec = "file:" + ($PluginDir -replace '\\', '/')
Push-Location $ProfileDir
try {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ((Test-Path (Join-Path $ProfileDir "pnpm-lock.yaml")) -and $pnpm) {
    Say "包管理器  pnpm"
    & pnpm add --ignore-scripts $spec
    if ($LASTEXITCODE -ne 0) { Die "pnpm add 失败" }
  } else {
    Say "包管理器  npm"
    & npm install --ignore-scripts --no-audit --no-fund $spec
    if ($LASTEXITCODE -ne 0) { Die "npm install 失败" }
  }
} finally {
  Pop-Location
}

# 5. 注册 bundle + cordis insert
$env:INIT_CWD = $ProfileDir
& node (Join-Path $PluginDir "install\register.mjs")
if ($LASTEXITCODE -ne 0) { Die "注册 bundles / insert 失败" }

# 6. 自检
$checkJs = @'
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || [];
const problems = [];
if (!bundles.includes("dsh-purge")) problems.push("dsh.profile.bundles 里没有 dsh-purge");
if (!fs.existsSync(path.join(dir, "node_modules", "dsh-purge", "package.json"))) problems.push("node_modules/dsh-purge 不存在");
const yml = path.join(dir, "cordis.patch.yml");
if (!fs.existsSync(yml) || !/id:\s*dsh-purge/.test(fs.readFileSync(yml, "utf8"))) problems.push("cordis.patch.yml 缺少 id: dsh-purge");
if (problems.length) { console.error("校验失败：\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("校验通过：bundles / node_modules / cordis.patch.yml 三处都就位");
'@
$tmp = Join-Path $env:TEMP ("dsh-purge-check-" + [guid]::NewGuid().ToString("N") + ".js")
Set-Content -Path $tmp -Value $checkJs -Encoding UTF8
& node $tmp $ProfileDir
$code = $LASTEXITCODE
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
if ($code -ne 0) { Die "自检未通过" }

# 7. 应用补丁
if (-not $NoApply) {
  Say ""
  Say "开始应用补丁（会先备份宿主文件）…"
  & node (Join-Path $PluginDir "bin\dsh-purge.js") --apply
  Say ""
  Say "已完成。完全退出 dsh 再打开即生效。"
} else {
  Say ""
  Say "已安装，未应用补丁。打开 dsh-purge → 宿主 → 点「应用到宿主」再重启一次。"
}
