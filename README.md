<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="100%">
</p>

<h1 align="center">🛠 DeepSeek Harness host-patch &amp; red-team workbench (dsh-purge)</h1>

<div align="center">

**Version 1.2.0**

</div>

---

<div align="center">

*Patch your local Harness, inject prompts, run red-team engagements.*

**Repo** <https://github.com/Nexnull/dsh-purge-fix>　·　**Host** dsh 0.2.2-rc.1　·　**License** Apache-2.0

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
  <b>English</b> | <a href="./README.zh-CN.md">中文</a>
</p>

---

## A note from the maintainers

This project patches the local DeepSeek Harness and runs red-team engagements on it. Every patch is calibrated against **dsh 0.2.2-rc.1** (compatible with 0.2.1-rc.5 / 0.2.1-rc.2), offline installers are included, the authorization scope and sensitive-operation guard are real forms instead of hand-edited JSON, and the interface is split into **Host / Red team**.

Three things we deliberately do not do: no cloud, no telemetry, nothing outside what you are authorized to touch. Every patch applies only to the **Harness already installed on your own machine**, each change is backed up as `.dshpurge.bak`, and the panel reverts them in one click.

> This is an unofficial tool with no affiliation to DeepSeek. Changes are logged in [`CHANGELOG.md`](./CHANGELOG.md).

---

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Patch status](#patch-status)
- [Host upgrades](#host-upgrades)
- [Repository layout](#repository-layout)
- [Known limits](#known-limits)
- [License](#license)
- [Disclaimer](#disclaimer)

## What it does

**1. Host patches (86).** Targeted find/replace over the locally installed Harness sources, in five layers:

| Layer | Count | Effect |
|---|---|---|
| Prompt | 27 | drop disclaimers, rewrite approval wording, identity lines, tool descriptions |
| Code | 48 | approval defaults to `never`, sandbox policy, agent-loop steer semantics, desktop `DSH_PROFILE` fallback |
| Tools | 8 | `run_code` approval neutralization, tool tables, hooks deny/ask bypass |
| 0.1.5 compat | 1 | keep injection under the `complete` preset |
| 0.2.0 compat | 2 | Anthropic OAuth no longer injects the Claude identity |

Patches land in the host install tree (`…/app/dsh/node_modules/@deepseek-ai/*` and the desktop main process `…/app/lib/main.js`). Every file is backed up as `<file>.dshpurge.bak` before the first change and can be reverted from the panel.

**2. Prompt.** `~/.dsh/prompt-inject.md` is an editable persona/rules block injected at prompt assembly; save and it applies on the next assembly.

**3. Runtime policy.** Authorization scope (dynamic / allowlist / local-only / off) and the sensitive-operation guard (write, delete, destructive shell, SQL — root allowlist). Both apply immediately.

**4. Red-team workbench.** Targets, assets, findings, evidence chain, tunnels, scoring and reports. 24 skills cover recon, fingerprinting, directory brute force, unauthenticated exploitation, WebShells, suo5 / frp / chisel tunnels, lateral movement and credential attacks.

## Requirements

- dsh **0.2.2-rc.1** (desktop app or `dsh web`; 0.2.1-rc.5 / rc.2 also work)
- Node.js ≥ 18 (install and self-check)
- macOS / Linux: bash · Windows: PowerShell

## Install

Check the prerequisites first, then pick your platform.

**Prerequisites**

- Node.js ≥ 18 (`node -v` prints a version) and `npm` or `pnpm` on PATH
- The target profile directory must already exist — running the dsh desktop app or `dsh web` once creates it
- The installer locates the dsh harness home automatically: `DSH_HOME` → the desktop app's data directory (mac `~/Library/Application Support/DeepSeek Harness`, Win `%APPDATA%` / `%LOCALAPPDATA%\DeepSeek Harness`) → `~/.dsh`, then scans profiles in desktop → web → dsh-tui order

Installation is only supported from the **offline bundle downloaded from GitHub Releases** — there is no online install (no npm, no repository URL, no marketplace).

| Platform | Command |
|---|---|
| **macOS / Linux** | `bash install/install.sh` |
| **Windows** | `powershell -ExecutionPolicy Bypass -File .\install\install.ps1` |

---

### Offline bundle

Download `dsh-purge-1.2.0.tar.gz` from Releases, then:

#### macOS / Linux

```bash
tar xzf dsh-purge-1.2.0.tar.gz
cd dsh-purge-1.2.0
bash install/install.sh
```

The script lives in `install/`. It installs and applies the patches in one go; fully quit dsh and reopen afterwards. Dependencies are added with `--ignore-scripts`: pnpm 11/12 blocks install scripts by default (`ERR_PNPM_IGNORED_BUILDS`), and letting them run would rewrite `package.json` and wipe the `bundles` entry — so the installer runs registration itself.

| Flag | Effect |
|---|---|
| `--no-apply` | install only; apply later from the UI |
| `--profile desktop\|web\|dsh-tui` | pick a profile (default: desktop → web → dsh-tui) |
| `--profile-dir /path` | point at a profile directory directly |

#### Windows

Windows 10+ ships `tar`, so the `.tar.gz` unpacks without extra tools:

```powershell
tar -xzf .\dsh-purge-1.2.0.tar.gz
cd .\dsh-purge-1.2.0
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

With a `.zip` instead:

```powershell
Expand-Archive .\dsh-purge-1.2.0.zip -DestinationPath .
cd .\dsh-purge-1.2.0
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

| Flag | Effect |
|---|---|
| `-NoApply` | install only |
| `-Profile desktop` | pick a profile (desktop / web / dsh-tui) |
| `-ProfileDir "D:\dsh\profiles\desktop"` | point at a profile directory directly |

---

## Usage

The **dsh-purge** entry next to the session title has two tabs:

**Host** — ① runtime policy (authorization scope, hook interception, sensitive-operation guard), ② prompt, ③ rules (workspace policy, per-folder rules, rule sets). The header shows patch counts and the five layer groups; the footer has **Apply to host / Revert patches / Uninstall plugin**.

**Red team** — recon, findings, exploitation, tunnels, evidence and scoring. Configure tool paths, a recon key (Quake or FOFA) and VPS under *environment* before starting.

Commands: `/purge status|apply|revert|uninstall|edit|help`, `/rules list|use|create|delete|reset`, `/skills list|import|create|delete`.

## Patch status

| Status | Meaning |
|---|---|
| Applied | written into the host |
| Pending | not applied yet, anchor still present |
| Drifted | upstream rewrote that code; the anchor needs updating |
| Skipped | this file version does not need it |
| N/A | the target package is not installed here |

## Host upgrades

Patches are targeted text replacements; the version list is only an advisory baseline. After an upgrade most patches still land — usually only a few anchors drift. If package names or file layout change, update `targetFiles()` in `lib/core.js`; a major version may require re-checking semantics patch by patch.

## Repository layout

```
install/              user facing: install and registration
  install.sh          macOS / Linux installer
  install.ps1         Windows installer
  register.mjs        registers this package into a profile (used by postinstall and --register)

bin/dsh-purge.js      CLI: --status / --apply / --revert / --uninstall / --register
client.js             plugin front end (includes the embedded workbench)
cordis.patch.yml      patch descriptor the host uses to load the plugin

lib/                  host side: patch engine, prompt injection, policy, red-team backend
  core.js             the 86 patch definitions and status computation
  index.js            routes, commands, assembly hooks
  identity.js         prompt assembly and cwd handling
  net-scope.js        authorization scope
  sensitive-guard.js  sensitive-operation guard
  profile-insert.js   reads/writes bundles and the cordis insert
  redteam/            tools, store, reports, UI source

skills/redteam/       24 red-team skills
presets/redteam/      red-team preset
docs/                 banner, drill-auth notice, toolkit license

scripts/              for developers: build and maintenance, end users never run these
  build-client.mjs    bundles lib/redteam into client.js
  embed-default-prompt.mjs
  patch-client-dock.mjs
  export-engagement-report.mjs
  redteam-setup.sh
```

## Known limits

- Patches depend on host source shape; host upgrades may require follow-up.
- Without the `dsh-hooks-*` packages the hook-interception switch changes nothing.
- Red-team features are for systems you are authorized to test; the guard and scope are aids, not a substitute for your own judgement.

## License

This project is released under **Apache-2.0**: use it, modify it and redistribute it freely (commercially included), as long as you keep the copyright notices and [`NOTICE`](./NOTICE) and state the origin.

Full third-party notices are in [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).

## Disclaimer

This project only touches the official DeepSeek Harness installed on the operator's own machine, for local security evaluation and authorized red-team exercises. Do not point it at systems you do not own or have written permission to test.
