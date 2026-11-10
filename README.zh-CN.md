<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="100%">
</p>

<h1 align="center">🛠 DeepSeek Harness 宿主补丁与红队作业台（dsh-purge）</h1>

<div align="center">

**Version 1.2.0**

</div>

---

<div align="center">

*给本机 Harness 打补丁、注入提示词、跑红队作业。*

**仓库** <https://github.com/Nexnull/dsh-purge-fix>　·　**适配宿主** dsh 0.2.2-rc.1　·　**许可** Apache-2.0

</div>

<p align="center">
  <a href="https://github.com/Nexnull/dsh-purge-fix/stargazers"><img src="https://img.shields.io/github/stars/Nexnull/dsh-purge-fix?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat" alt="Apache-2.0"></a>
  <img src="https://img.shields.io/badge/awesome-DSH%20plugin-red?style=flat" alt="awesome DSH plugin">
  <img src="https://img.shields.io/badge/hub-dsh--purge-2f81f7?style=flat" alt="dsh-purge">
  <img src="https://img.shields.io/badge/dsh-0.2.2--rc.1%20%2F%200.2.1--rc.5-2f81f7?style=flat" alt="dsh version">
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-555?style=flat" alt="platform">
  <img src="https://img.shields.io/badge/install-offline%20bundle-success?style=flat" alt="install">
</p>

<p align="center">
  <a href="./README.md">English</a> | <b>中文</b>
</p>

---

## 维护者的话

这个项目面向新版 DeepSeek Harness 做本机宿主补丁与红队作业：补丁全部对准 **dsh 0.2.2-rc.1**（兼容 0.2.1-rc.5 / 0.2.1-rc.2），补上离线安装、授权范围表单、敏感操作守卫这些原来只能手改 JSON 的能力，界面重做成「宿主 / 红队作业」两块。

不做的三件事：不做云端、不收集任何数据、不碰你没授权的东西。所有补丁只作用于**你自己这台机器上已安装的 Harness**，每一处改动都有 `.dshpurge.bak` 备份，界面里一键可撤。

> 这是非官方工具，与 DeepSeek 无隶属或合作关系。改动记录见 [`CHANGELOG.md`](./CHANGELOG.md)。

---

## 目录

- [它能做什么](#它能做什么)
- [环境要求](#环境要求)
- [安装](#安装)
- [使用](#使用)
- [补丁状态怎么读](#补丁状态怎么读)
- [宿主升级了怎么办](#宿主升级了怎么办)
- [仓库结构](#仓库结构)
- [已知限制](#已知限制)
- [许可](#许可)
- [免责声明](#免责声明)

## 它能做什么

**一、宿主补丁（86 条）** —— 用定点文本替换修改本机已安装的 Harness 源码，分五层：

| 层 | 条数 | 作用 |
|---|---|---|
| 提示词 | 27 | 去掉免责声明、改写审批话术、身份句、工具说明、注入段保留 |
| 代码 | 48 | 审批默认 `never`、沙箱策略、agent-loop 的 steer 语义、桌面主进程 `DSH_PROFILE` 兜底 |
| 工具 | 8 | `run_code` 审批中性化、工具表、hooks deny / ask 旁路 |
| 0.1.5 兼容 | 1 | `complete` 预设仍保留注入 |
| 0.2.0 兼容 | 2 | Anthropic OAuth 不再强插 Claude 身份 |

补丁打在本机宿主安装目录的源文件上（桌面端 `…/app/dsh/node_modules/@deepseek-ai/*` 与主进程 `…/app/lib/main.js`），首次改动前自动备份为 `<文件>.dshpurge.bak`，界面里可一键撤销。

**二、提示词** —— `~/.dsh/prompt-inject.md` 是可编辑的身份与规则段，在拼装系统提示词时挂上去；保存后下一次拼装即生效，不必重启。

**三、运行时策略** —— 授权范围（dynamic / allowlist / local-only / off）与敏感操作守卫（写入、删除、破坏性命令、SQL 的根目录白名单），都在面板里改，立即生效。

**四、红队作业台** —— 靶标、资产、漏洞、证据链、隧道、得分与报告。24 份技能覆盖测绘、指纹、目录爆破、未授权利用、WebShell、suo5 / frp / chisel 隧道、内网横向、凭据攻击等。

## 环境要求

- dsh **0.2.2-rc.1**（桌面端或 `dsh web`；0.2.1-rc.5 / rc.2 亦可）
- Node.js ≥ 18（安装与自检用）
- macOS / Linux 用 bash；Windows 用 PowerShell

## 安装

先确认前置条件，再按平台选命令。

**前置**

- Node.js ≥ 18（`node -v` 能出版本），并且 `npm` 或 `pnpm` 在 PATH 里
- 目标 profile 目录已存在：跑过一次 dsh 桌面端或 `dsh web` 就会有
- 安装器自动识别 dsh harness 主目录：`DSH_HOME` → 桌面端数据目录（mac `~/Library/Application Support/DeepSeek Harness`，Win `%APPDATA%` / `%LOCALAPPDATA%\DeepSeek Harness`）→ `~/.dsh`，再在其中按 desktop → web → dsh-tui 找 profile

只支持从 **GitHub Releases 下载的离线包**安装，没有在线安装（npm / 仓库 / 插件市场都不行）。

| 平台 | 安装命令 |
|---|---|
| **macOS / Linux** | `bash install/install.sh` |
| **Windows** | `powershell -ExecutionPolicy Bypass -File .\install\install.ps1` |

---

### 离线包

从 Releases 下载 `dsh-purge-1.2.0.tar.gz`，然后：

#### macOS / Linux

```bash
tar xzf dsh-purge-1.2.0.tar.gz
cd dsh-purge-1.2.0
bash install/install.sh
```

脚本在 `install/` 目录下。装完连补丁一起打好了，完全退出 dsh 再打开即可用。依赖统一带 `--ignore-scripts`：pnpm 11/12 默认拦截安装脚本（`ERR_PNPM_IGNORED_BUILDS`），放行后重写 `package.json` 还会覆盖写进去的 `bundles`，所以登记由脚本装完显式跑一次。

常用开关：

| 开关 | 作用 |
|---|---|
| `--no-apply` | 只安装，补丁留到界面里点「应用到宿主」 |
| `--profile desktop\|web\|dsh-tui` | 指定 profile（默认自动找 desktop → web → dsh-tui） |
| `--profile-dir /path` | 直接指定 profile 目录 |

#### Windows

Windows 10 及以上自带 `tar`，可以直接解压 `.tar.gz`：

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

常用开关：

| 开关 | 作用 |
|---|---|
| `-NoApply` | 只安装，补丁留到界面里点 |
| `-Profile desktop` | 指定 profile（desktop / web / dsh-tui） |
| `-ProfileDir "D:\dsh\profiles\desktop"` | 直接指定 profile 目录 |

---

## 使用

会话标题旁的 **dsh-purge** 里有两个页签：

**宿主**（本机）

1. `① 运行时策略`：授权范围、Hook 拦截、敏感操作守卫 —— 保存即生效（Hook 拦截需应用并重启）
2. `② 提示词`：身份与规则段，保存写入 `prompt-inject.md`；要让模型收到需再应用一次
3. `③ 规则`：工作区策略、当前目录规则、规则集

页面上方是补丁计数与五个分层列表，下方是「应用到宿主 / 撤销补丁 / 卸载插件」。

**红队作业**（靶标）

资产测绘、漏洞发现、利用、隧道、证据链、得分与报告。开工前到「环境适配」填写工具路径、测绘 KEY（Quake 或 FOFA 任一）、VPS。

命令：

```
/purge status | apply | revert | uninstall | edit | help
/rules  list | use <id> | create | delete | reset
/skills list | import <路径> | create <id> [说明] | delete <id>
```

## 补丁状态怎么读

| 状态 | 含义 |
|---|---|
| 已应用 | 补丁已写入宿主 |
| 待应用 | 还没打，锚点仍在 |
| 已漂移 | 宿主那段代码被改写了，需要更新锚点 |
| 跳过 | 这版文件不需要这条（撤销型补丁无残留 / 目标文件换了实现） |
| 本端不需要 | 目标包不在这台机器上 |

## 宿主升级了怎么办

补丁是对宿主源码的定点替换，版本号只用来**提示**适配基线，真正的判定是每条补丁的锚点是否命中。升级后通常三种结果：

1. 大部分照打，少数几条漂移 → 只改那几条的锚点；
2. 包名或文件布局变了 → 改 `lib/core.js` 里的 `targetFiles()` 映射；
3. 大版本语义变化 → 逐条核对锚点与语义。

升级后先看「宿主」页有没有「已漂移」，没有就不必动。

## 仓库结构

```
install/              面向使用者：安装与登记
  install.sh          macOS / Linux 安装器
  install.ps1         Windows 安装器
  register.mjs        把本包登记进 profile（postinstall 与 --register 都走它）

bin/dsh-purge.js      CLI：--status / --apply / --revert / --uninstall / --register
client.js             插件前端（含内嵌的红队作业台）
cordis.patch.yml      本体的 patch 描述，宿主按它加载插件

lib/                  宿主侧：补丁引擎、身份注入、策略、红队后端
  core.js             86 条补丁定义与状态计算
  index.js            路由、命令、装配钩子
  identity.js         提示词拼装与 cwd 处理
  net-scope.js        授权范围
  sensitive-guard.js  敏感操作守卫
  profile-insert.js   bundles 与 cordis insert 的读写
  redteam/            红队工具、存储、报告、UI 源码

skills/redteam/       24 份红队技能
presets/redteam/      红队预设
docs/                 横幅、授权声明页、第三方工具箱许可

scripts/              面向开发者：构建与维护，终端用户不需要跑
  build-client.mjs    把 lib/redteam 打进 client.js
  embed-default-prompt.mjs
  patch-client-dock.mjs
  export-engagement-report.mjs
  redteam-setup.sh
```

## 已知限制

- 补丁依赖宿主源码形态，宿主升级后可能需要跟进（见上）。
- 未安装 `dsh-hooks-*` 包时，「Hook 拦截」开关不产生任何改动。
- 红队功能只面向你有权测试的目标；守卫与授权范围是辅助，不替代你自己的判断。

## 许可

本项目按 **Apache-2.0** 发布：可自由使用、修改、再分发（含商用），条件是保留版权声明与 [`NOTICE`](./NOTICE)，并注明来源。

第三方组件的完整版权声明见 [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)。

## 免责声明

本项目只作用于**使用者本机已安装的官方 DeepSeek Harness**，用于本机安全评测与授权范围内的红队演练。请勿用于未授权的目标或生产系统。使用者对自己的行为负责。
