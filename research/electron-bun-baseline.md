# Electron/Bun Baseline — Recommendation

> Decision doc for the **Slaygent Auth Manager GUI** (Windows-first, WSL support, lightweight, security-first).
> Legend: ✅ = verified from a fetched source; 🧠 = design synthesis/recommendation.

---

## Decision summary

| Concern | Recommendation | Rationale |
|---|---|---|
| **Shell** | Electron (main + preload + renderer) | Stated product direction; mature Windows support |
| **Build tool** | **electron-vite** (Vite-based) | Fast HMR + hot reload, isolated main/preload/renderer builds, TS out of the box ✅ |
| **Packaging/distribution** | **electron-builder** | Most mature Windows installers (NSIS/MSIX/portable) ✅ |
| **Bundler** | Vite (via electron-vite) | Mature, huge ecosystem; Rolldown is newer/less proven |
| **Renderer** | **Minimal no-framework** (vanilla TS + HTML/CSS) for v1 | Smallest attack surface, fewest deps, aligns with security checklist 🧠 |
| **WSL helper** | **Compiled Bun binary** (`bun build --compile --target=bun-linux-x64`) | Self-contained, no runtime to install inside WSL ✅ |
| **Process model** | main (Node) · preload (contextBridge) · renderer (sandboxed) · WSL helper (Bun) | Enforces the security checklist; secrets never enter the renderer |

---

## 1. What "Bun-powered Electron" actually means

Electron's **main process runs on Electron's bundled Node.js**, not Bun — Bun cannot replace Electron's runtime. So "Bun-powered" resolves to three concrete roles for Bun:

1. **Package management & scripts** — `bun install`, `bun run` (the project is already a Bun project).
2. **The WSL helper sidecar** — a Bun script compiled to a standalone Linux binary that runs *inside* WSL to query provider CLIs there (see §6).
3. **Optional build acceleration** — Vite/electron-vite can run under Bun, though the Electron toolchain is Node-centric (see §7 risk).

This is the key architectural clarification: **Bun is the WSL-boundary tool, not the Electron runtime.**

---

## 2. Build tooling: electron-vite + electron-builder

- **electron-vite** ✅ — Vite-based, pre-configured for Electron: HMR for the renderer, hot reload for main/preload, isolated multi-entry builds, TypeScript + React/Vue/Svelte/SolidJS out of the box, optional V8-bytecode source protection.
- **electron-builder** ✅ — the community-standard packager; "adds a single dependency and manages all further requirements internally," with mature Windows targets (NSIS, MSIX, portable, AppX).

**Why not Electron Forge?** Forge is the *official* tool and now has a Vite plugin, so it's a valid alternative. But for a **Windows-first** app, electron-builder's installer maturity (NSIS/MSIX, code signing, auto-update) is the stronger default, and electron-vite + electron-builder is a very well-trodden combination. 🧠

**Why not Rolldown?** Rolldown (Rust-based, by the Vite team) is faster but newer and less proven; Vite remains the safe default. Revisit when Rolldown stabilizes. 🧠

---

## 3. Renderer: minimal no-framework for v1

The v1 UI is a **dashboard**: a list of providers, per-provider status badges, profile/account grouping, and launch/status actions. This needs no complex state management.

- **Minimal no-framework** (vanilla TypeScript + HTML/CSS, small DOM-update helper) gives the smallest dependency tree and attack surface — directly aligned with the Electron security checklist (no remote content, strict CSP, sandboxed renderer). 🧠
- **Upgrade path:** if the UI grows (settings forms, richer views), adopt **Solid** — tiny, reactive, fast, and already supported by electron-vite. Avoid React unless ecosystem needs force it. 🧠

---

## 4. Process architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (sandboxed, contextIsolation, no Node)             │
│  vanilla TS + HTML/CSS — UI only, no secrets                 │
└───────────────▲─────────────────────────────────────────────┘
                │ contextBridge (typed, minimal API)
┌───────────────┴─────────────────────────────────────────────┐
│  Preload — exposes window.api.{listProviders,getStatus,      │
│            launch,logout} via contextBridge                  │
└───────────────▲─────────────────────────────────────────────┘
                │ IPC (validated sender)
┌───────────────┴─────────────────────────────────────────────┐
│  Main (Electron/Node) — orchestrates:                        │
│   • spawn Windows provider CLIs (gh, claude, codex, …)       │
│   • read non-secret config only                              │
│   • manage app config (profiles, project mapping)            │
│   • invoke WSL helper via wsl.exe                            │
└───────────────┬─────────────────────────────────────────────┘
                │ wsl.exe -d <distro> <helper> status --json
┌───────────────▼─────────────────────────────────────────────┐
│  WSL helper (compiled Bun binary, bun-linux-x64)             │
│   • query provider CLIs inside WSL                           │
│   • JSON-over-stdout protocol                                │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Renderer is **sandboxed** (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`).
- All privileged work (spawning CLIs, reading config, WSL calls) lives in the **main process**.
- Preload exposes a **narrow, typed** surface; no raw `ipcRenderer` in the renderer.
- Secrets never cross into the renderer; status is obtained via each provider's own status command (see the evidence matrix).

---

## 5. Security posture (from the Electron security checklist)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- No remote content; strict **CSP**; no `shell.openExternal` on untrusted input.
- Validate every IPC sender (`event.senderFrame`).
- The app **never reads secret material** by default — it uses provider status commands and `cmdkey /list` (names only), per the evidence matrix.

---

## 6. WSL helper (the Bun core)

The WSL helper is a single Bun script compiled to a **standalone Linux x64 binary**:

```
bun build ./wsl-helper.ts --compile --target=bun-linux-x64 --outfile slaygent-wsl
```

- ✅ Self-contained: bundles the Bun runtime + all imports; **no Node/Bun install required inside the WSL distro**.
- ✅ Cross-compiled from the Windows dev machine (`--target=bun-linux-x64`).
- Protocol: **JSON-over-stdout** (`slaygent-wsl status --json` → `{ "providers": [...] }`), mirroring the existing CLI's `--json` convention.
- The Windows main process invokes it via `wsl.exe -d <distro> <path> status --json` and parses stdout.
- Windows-side GUI metadata (`--windows-hide-console`, `--windows-icon`) is available if the helper is ever run natively on Windows, but the WSL build targets Linux.

---

## 7. Risks / gotchas

- **Electron tooling is Node-centric.** electron-vite/electron-builder are Node packages; Bun's Node compatibility is high but not guaranteed for every plugin. Verify `bun install` + `bun run` works for the full Electron build before committing. 🧠
- **Bun binary size.** `bun build --compile` binaries are large (~tens of MB); acceptable for a single WSL helper, but note it. ✅ (Bun docs acknowledge size; minify/bytecode help.)
- **WSL interop requires `wsl.exe`** (Windows 10 1903+), consistent with the GCM bridge finding in the evidence matrix.
- **No machine-readable status for Zed/Zen** — v1 treats them as launch-only (see evidence matrix).

---

## 8. Open questions

- [ ] Confirm electron-vite + electron-builder run cleanly under `bun install`/`bun run` (spike before full build).
- [ ] Choose the WSL distro discovery strategy (`wsl.exe -l -v` parsing) and how to handle multiple distros.
- [ ] Decide the app config format/location (non-secret): JSON under `%APPDATA%\Slaygent` vs `~/.config/slaygent`.
- [ ] Decide whether the WSL helper is distributed as one binary per distro or a single Linux x64 binary (glibc vs musl — `bun-linux-x64` targets glibc; most WSL distros are glibc).

---

## Sources

- https://www.electronjs.org/docs/latest/tutorial/forge-overview (Forge vs Builder)
- https://electron-vite.org/ (electron-vite capabilities)
- https://bun.sh/docs/bundler/executables (Bun `--compile`, cross-compile targets, Windows flags)
- https://www.electronjs.org/docs/latest/tutorial/security (Electron security checklist — read in prior session)