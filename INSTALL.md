# dsh-purge 安装说明

仓库：<https://github.com/Nexnull/dsh-purge-fix>（Apache-2.0，版权与出处见 [NOTICE](./NOTICE)）

适配 `dsh 0.2.2-rc.1`（桌面端 / `dsh web` 均可；兼容 0.2.1-rc.5 / 0.2.1-rc.2）。

## 前置条件

| 项 | 要求 |
|---|---|
| Node.js | ≥ 18（`node -v` 能出版本） |
| 包管理器 | `npm` 或 `pnpm` 在 PATH 里（安装脚本自动选） |
| profile 目录 | 已存在。跑过一次 dsh 桌面端或 `dsh web` 就会有 |
| 主目录识别 | 安装器自动找：`DSH_HOME` → 桌面端数据目录（mac `~/Library/Application Support/DeepSeek Harness`，Win `%APPDATA%` / `%LOCALAPPDATA%\DeepSeek Harness`）→ `~/.dsh` |
| 默认 profile | `<主目录>/profiles/desktop`，找不到时按 desktop → web → dsh-tui 顺序扫 |

安装脚本在 **`install/`** 目录下。**只支持从 GitHub Releases 下载的离线包安装**，不提供在线安装（npm / 仓库 tarball / 插件市场都不行）。

| 平台 | 安装命令 |
|---|---|
| macOS / Linux | `bash install/install.sh` |
| Windows | `powershell -ExecutionPolicy Bypass -File .\install\install.ps1` |

---

## 一、macOS / Linux

从 Releases 下载 `dsh-purge-1.2.0.tar.gz`，解压后运行：

```bash
tar xzf dsh-purge-1.2.0.tar.gz
cd dsh-purge-1.2.0
bash install/install.sh
```

默认「安装 + 应用补丁」：登记依赖与 bundle、补 `cordis.patch.yml` 的 `insert`、自检三项，然后把 86 条补丁写进宿主（首次自动备份宿主原文件）。跑完完全退出 dsh 再打开即可用。

| 参数 | 作用 |
|---|---|
| `--no-apply` | 只安装，补丁留到界面里点「应用到宿主」 |
| `--profile desktop\|web\|dsh-tui` | 指定 profile（默认自动找 desktop → web → dsh-tui） |
| `--profile-dir /path` | 直接指定 profile 目录 |

---

## 二、Windows

从 Releases 下载 `dsh-purge-1.2.0.zip`（或 `.tar.gz`）。Windows 10 及以上自带 `tar`，`.tar.gz` 可以直接解：

```powershell
tar -xzf .\dsh-purge-1.2.0.tar.gz
cd .\dsh-purge-1.2.0
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

如果是 `.zip`：

```powershell
Expand-Archive .\dsh-purge-1.2.0.zip -DestinationPath .
cd .\dsh-purge-1.2.0
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

| 参数 | 作用 |
|---|---|
| `-NoApply` | 只安装，补丁留到界面里点 |
| `-Profile desktop` | 指定 profile（desktop / web / dsh-tui） |
| `-ProfileDir "D:\dsh\profiles\desktop"` | 直接指定 profile 目录 |

脚本做的事与 `install.sh` 完全一致：`pnpm add`（没有 pnpm 或没有 `pnpm-lock.yaml` 时用 `npm install`，统一带 `--ignore-scripts`）→ 跑 `bin/dsh-purge.js --register` 写 bundles + insert → 自检 → `node bin\dsh-purge.js --apply`。

### 不想跑脚本时的手动等价操作（Windows）

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
npm install --ignore-scripts "file:C:/path/to/dsh-purge-1.2.0"
node "C:/path/to/dsh-purge-1.2.0/bin/dsh-purge.js" --register
node "C:/path/to/dsh-purge-1.2.0/bin/dsh-purge.js" --apply
```

---

## 三、装完之后（两个平台相同）

1. **完全退出 dsh 再打开**（不是关窗口，是退出进程；桌面端托盘也要退）。
2. 打开插件：`dsh-purge → 宿主`，看补丁计数是否全绿（形如 `69/71 · 跳过 2`）。
   - 安装时已 `--apply` 的话这步只是核对；否则点「应用到宿主」再重启一次。
3. 红队作业前：`红队作业 → 环境适配`，填工具路径、测绘 KEY（Quake 或 FOFA 任一）、VPS。

---

## 四、可选：把配置一起带走

插件包不含个人配置，需要的话从原机器的 `~/.dsh` 复制：

| 路径 | 内容 |
|---|---|
| `redteam/config.json` | 工具路径与测绘 KEY（新机路径要重填） |
| `redteam/net-policy.json` | 授权模式与名单 |
| `redteam/sensitive-ops.json` | 敏感操作守卫（`roots` 里的绝对路径要改） |
| `prompt-inject.md` | 自定义提示词（改过才需要） |

**不要复制** `dsh-purge/applied.json`、`installed-rev`、`local-patches/`、`reapply.sh`：前两个是本机状态记录，会让面板误判「已应用」；后两个是旧快照，会把补丁回退。

---

## 五、卸载

**macOS / Linux**

```bash
cd ~/.dsh/profiles/desktop
pnpm remove dsh-purge              # 用 npm 装的写 npm uninstall dsh-purge
```

**Windows**

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm remove dsh-purge
```

然后到 `cordis.patch.yml` 里删掉 `- insert: … id: dsh-purge` 那一段。

安装脚本不会自动回滚宿主补丁——宿主补丁要在界面里点「撤销补丁」，或直接恢复 `*.dshpurge.bak`。

---

## 六、注意

- **只支持离线包安装**：npm 上没有 `dsh-purge` 这个包，也不要走插件市场（会报 `already queued: dsh-purge`）。
- 宿主版本不同会显示「未适配」并可能出现漂移，属正常；本包按 `0.2.2-rc.1` 校准。
- 首次应用会自动备份宿主原文件（`<文件>.dshpurge.bak`），界面里「撤销补丁」可回滚。
