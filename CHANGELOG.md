# CHANGELOG

面向新版 DeepSeek Harness 的本机宿主补丁与红队作业插件。下文按版本记录全部改动。

## 1.2.0

首个公开版本。

### 安装

- 安装器自动识别 dsh harness 主目录（`DSH_HOME` → 桌面端数据目录 → `~/.dsh`），macOS / Windows 同一套识别顺序。
- 只支持 GitHub Release 离线包安装，移除全部在线安装指引（npm / 仓库 tarball / 插件市场）。
- 修复 Windows 安装脚本乱码：`install.ps1` 固定以 UTF-8 with BOM 保存（PowerShell 5.1 把无 BOM 文件按 ANSI 读取），CI 增加 BOM 校验。
- 清理旧项目痕迹：用户须知里的仓库指向改为本仓库，文档与注释不再引用旧仓库与旧版本线。

### 适配

- 宿主目标更新为 **dsh 0.2.2-rc.1**（兼容 0.2.1-rc.5 / 0.2.1-rc.2）。
- 桌面主进程 `DSH_PROFILE` 兜底补丁：0.2.2 打包后 `import` 与 `home-paths` region 之间相隔上千行，旧的两行连读锚点失效，改为直接锚 region 注释行。
- 梁神 phase-1 补丁：新版 bootstrap 改为工具锚定、不再过滤 prompt sections，新增 `absentWhen` 判定——目标文件不含该标识时记「跳过」，不再误报「漂移」。
- 补丁状态恢复为 `69/71 · 跳过 2 · 漂移 0`。

### 红队

- 24 份红队技能：测绘、指纹、目录爆破、未授权利用、WebShell、suo5 / frp / chisel 隧道、内网横向、凭据攻击等。
- 测绘双通道：Quake 与 FOFA 并存，`QUAKE_KEY` / `FOFA_KEY` 任一即可通过预检与技能可用性检查，两个都填可交叉验证。
- 红队预设补上证据链核实流程：子智能体回报先记 `claimed`，核实后才升级为 `observed`（`redteam_evidence_*`）。

### 界面

- 页签：「清洗 / 演练台」改为「宿主 / 红队作业」。
- 宿主页按 ① 运行时策略 ② 提示词 ③ 规则 三段编号，每段标注生效方式（即时 / 保存即写入 / 需重启）。
- 授权范围从一句话说明补成表单：模式、银行拦截、静态名单。
- 敏感操作守卫改为单张卡片，根目录与规则同屏，保存即生效。
- 按钮统一为「应用到宿主 / 撤销补丁 / 卸载插件 / 保存提示词」。
- 修复：报告页无法滚动、回退按钮被浮层遮挡、dock 外点不关闭、下拉框透明与被裁剪。

### 安装

- 新增离线安装器 `install/install.sh`（macOS / Linux）与 `install/install.ps1`（Windows），默认「安装 + 应用补丁」。
- `pnpm add` / `npm install` 统一带 `--ignore-scripts`，避免包管理器拦截安装脚本导致 bundle 登记失败。

### 修复

- `scripts/ensure-profile-bundle.mjs` 通过 `node_modules/dsh-purge/scripts/...` 调用时静默不做事：入口判断只比字符串，而 `node_modules/dsh-purge` 是软链，`argv[1]` 与 `import.meta.url` 字面不同。改为比较 realpath。
- `install.ps1` 之前保存为无 BOM 的 UTF-8：Windows PowerShell 5.1 对无 BOM 文件按系统 GBK 解码，中文全部变成乱码并连带出十几条解析错误；改为 UTF-8 with BOM 后 5.1 / 7 均可正确读取。
- `install.sh` / `install.ps1` 自检信息与实际校验的目录名不一致的标签修正。
- 「从仓库安装」补上缺失的第二步：`pnpm add` 不会写 `dsh.profile.bundles`，也不写 `cordis.patch.yml` 的 `insert`。文档与命令同步修正，并说明 pnpm 11 会拦截安装脚本、`--allow-build` 放行后 `bundles` 仍会被 `package.json` 重写覆盖。

### 工程

- 新增 `CHANGELOG.md`、`INSTALL.md`、`.gitignore`、GitHub Actions（语法检查与 tag 发布）。
- 目录重组：面向使用者的安装器独立到 `install/`（`install.sh` / `install.ps1` / `register.mjs`），`scripts/` 只保留开发者用的构建与维护脚本。
- `bin/dsh-purge.js` 新增 `--register`，作为登记进 profile 的统一入口（`postinstall` 与本文件走同一实现）。
- 自更新源指向本仓库，并把 `skills` / `presets` / `scripts` 纳入同步清单，避免更新后丢失技能目录。
- 移除过期的界面截图与历史发布日志。
