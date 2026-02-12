# Glimt

Capture ideas the moment they hit you. `Alt+I` from anywhere, type or talk, done.

Glimt is a desktop app that gets out of your way. Ideas go into a local SQLite database - no cloud, no accounts, no signup. Voice transcription and semantic search run on-device using Transformers.js, so nothing leaves your machine.

<table>
  <tr>
    <td><img src="docs/screenshot.png" alt="Glimt dashboard" width="600"></td>
    <td><img src="docs/screenshot-capture.png" alt="Glimt capture window" width="400"></td>
  </tr>
</table>
  
## Download

Grab the latest installer for your platform from [GitHub Releases](https://github.com/varsan-g/Glimt/releases):

- **Windows** - `.exe` (NSIS installer)
- **Linux** - `.deb` or `.AppImage`

## What it does

**Quick capture** - press `Alt+I`, a small floating window appears, type your idea (markdown supported), hit Enter. Gone in under 2 seconds.

**Voice input** - hit the mic button and speak instead of typing, or press `Alt+R` to start recording from anywhere without even opening the capture window. Whisper runs locally and handles 99 languages. You pick the model size in settings (Tiny at 40 MB is the default, but Base and Small are there if you want better accuracy).

**Semantic search** - type "gift ideas for gf" and find your note from three months ago that says "she mentioned wanting a bread maker." Search by what you meant, not the exact words you used. Multilingual E5 embeddings handle this, and all the vector math runs in a Web Worker so the UI stays responsive.

**AI titles** - SmolLM2 generates short titles for your ideas in the background. Also on-device.

**Obsidian export** - ideas can auto-export as markdown files with YAML frontmatter. Works with Obsidian, Logseq, whatever reads `.md` files.

Both shortcuts are customizable in settings.

The main window has a timeline grouped by day, inline editing, archive/delete, and a command palette (`Ctrl+K`). Glimt minimizes to the system tray on close and auto-updates via GitHub Releases.

## Stack

Tauri v2 (Rust) + React 19 + TypeScript + Vite. UI is shadcn/ui on Tailwind CSS v4. Editor is TipTap. Storage is SQLite through `tauri-plugin-sql`. AI inference is through @browser-ai/transformers-js running in Web Workers.

Models (all ONNX, all local):
- **STT:** Xenova/whisper-tiny (~40 MB), with base and small as options (so far)
- **Embeddings:** Xenova/multilingual-e5-small (100+ languages - so far too)
- **Titles:** HuggingFaceTB/SmolLM2-360M-Instruct

## Running it

You need [Bun](https://bun.sh/), [Rust](https://www.rust-lang.org/tools/install), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```bash
git clone https://github.com/varsan-g/glimt.git
cd glimt
bun install
bun run tauri dev
```

First launch downloads the default AI models (~40 MB). After that it's instant.

`bun run tauri build` produces installers in `src-tauri/target/release/bundle/`.

## Project layout

```
src/
  app.tsx                  Main window (dashboard + settings)
  capture-app.tsx          Capture window entry point
  indicator-app.tsx        Recording indicator
  components/              Shared UI, shadcn primitives
  features/
    capture/               Floating capture window
    dashboard/             Timeline + search
    settings/              Models, export config, shortcuts
  workers/
    embedding.worker.ts    E5 embeddings (off-thread)
    transcription.worker.ts  Whisper STT (off-thread)
    title.worker.ts        SmolLM2 title generation (off-thread)
  lib/
    db.ts                  SQLite schema + CRUD
    search.ts              Cosine similarity over embeddings
    ai/                    Model defs, embedding/whisper services

src-tauri/
  src/lib.rs               Tray, hotkey, window management
  tauri.conf.json           Windows, CSP, bundle config
  capabilities/            Plugin permissions
```

## Dev commands

| Command | What |
|---------|------|
| `bun run tauri dev` | Full desktop app |
| `bun run dev` | Vite only (no Tauri) |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `bun run test` | Vitest |
| `cargo clippy --manifest-path src-tauri/Cargo.toml` | Lint Rust |
| `cargo fmt --manifest-path src-tauri/Cargo.toml` | Format Rust |

## Contributing

Fork, branch, make sure lint and format checks pass (`bun run lint`, `bun run format:check`, `cargo clippy`, `cargo fmt --check`), then open a PR.
