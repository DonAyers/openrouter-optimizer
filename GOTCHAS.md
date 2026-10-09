# GOTCHAS.md — Traps that cost us churn

> Log anything that burned time so a future session (or agent) skips it.
> **Also share to tipshare** — but only after the current turn is fully complete,
> so the tip reflects a finished, verified outcome. Tick the "shared" box then.

## Provider auth is not one portable credential layer
- **Symptom:** It is tempting to assume every CLI stores a token in one discoverable JSON file.
- **Cause:** Providers use different combinations of OS keychains, browser sessions, OAuth caches, config files, and environment variables; WSL may have a separate filesystem and credential boundary.
- **Fix / workaround:** Treat provider auth as an adapter/status problem. Prefer supported CLI/API status and logout operations; never scrape secrets as the default design.
- **tipshare:** [ ] not yet shared

## "Bun-powered Electron" is a misnomer
- **Symptom:** Assuming Bun can run Electron's main process.
- **Cause:** Electron's main process runs on Electron's bundled Node.js runtime; Bun cannot replace it.
- **Fix / workaround:** Use Bun for package management, the WSL helper sidecar (compiled via `bun build --compile --target=bun-linux-x64`), and optional build acceleration. Keep the Electron toolchain (electron-vite/electron-builder) on Node.
- **tipshare:** [ ] not yet shared

## MCP, skills, commands, and provider sessions are different layers
- **Symptom:** A configured MCP server does not automatically create a slash command or change the active model.
- **Cause:** MCP exposes tools; skills expose workflows; each harness has its own command/skill discovery and session model.
- **Fix / workaround:** Maintain separate integration adapters and document the exact invocation surface for each harness.
- **tipshare:** [ ] not yet shared
