# Pi Desktop

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-36.2.0-9FE349)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6)](https://www.typescriptlang.org/)

> A cross-platform desktop application for the [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — your AI-powered coding companion.

[![Screenshot](https://github.com/psylsph/pi-desktop/raw/main/.github/screenshot.png)](https://github.com/psylsph/pi-desktop)

## ✨ Features

- 🤖 **Chat interface** — Send prompts and receive streaming responses with markdown rendering
- 🧠 **Thinking blocks** — Collapsible display of agent reasoning (when using reasoning models)
- 🔧 **Tool call visualization** — Real-time streaming of tool executions with status indicators (running, success, error)
- 🎯 **Model selector** — Browse and switch between available models grouped by provider
- ⚙️ **Thinking level controls** — Adjust agent thinking depth (off, low, medium, high)
- 💾 **Session management** — Create new sessions, compact context, and manage conversation history
- 📁 **Project selector** — Choose a working directory via native OS dialog
- 🌙 **Dark theme** — Tokyo Night-inspired color scheme
- ⌨️ **Keyboard shortcuts** — Enter to send, Shift+Enter for newlines, Escape to abort
- 🔔 **Toast notifications** — Non-intrusive feedback for state changes and errors

## 🚀 Quick Start

**Prerequisites:** Node.js 18+ and an API key for at least one supported provider (e.g., `ANTHROPIC_API_KEY`)

```bash
# Clone and install
git clone https://github.com/psylsph/pi-desktop.git
cd pi-desktop
npm install

# Run in development
npm run dev

# Build for distribution
npm run dist
```

### Platform-Specific Builds

| Command              | Output                        |
|----------------------|-------------------------------|
| `npm run dist:mac`   | `.dmg`, `.zip`                |
| `npm run dist:linux` | `.AppImage`, `.deb`           |
| `npm run dist:win`   | NSIS installer, portable `.exe` |

## 📖 Usage

Pi Desktop reads your existing pi agent configuration from `~/.pi/agent/`:

| File              | Purpose                          |
|-------------------|----------------------------------|
| `auth.json`       | API keys and OAuth tokens        |
| `settings.json`   | Global agent settings            |
| `models.json`     | Custom model definitions         |
| `extensions/`     | Extensions                       |
| `skills/`         | Skills                           |

The app automatically uses these on launch. Configure your API keys first via the pi CLI:

```bash
# Set your API key
pi config set ANTHROPIC_API_KEY your_key_here

# Then launch Pi Desktop
npm run dev
```

## 🏗️ Architecture

```
pi-desktop/
├── src/
│   ├── main/
│   │   ├── main.ts        # Electron main process — agent lifecycle, IPC handlers
│   │   └── preload.cjs    # Context bridge (CommonJS) — safe IPC to renderer
│   ├── renderer/
│   │   ├── index.html     # UI layout — sidebar, message area, input
│   │   ├── renderer.js    # Renderer logic — event handling, message rendering
│   │   └── styles.css     # Tokyo Night dark theme
│   └── shared/
│       └── types.ts       # Shared TypeScript types and IPC channel constants
├── tests/
│   ├── e2e.test.ts
│   ├── renderer.test.ts
│   ├── sdk.test.ts
│   └── types.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### How It Works

1. The **main process** (`main.ts`) initializes an agent session using the `@earendil-works/pi-coding-agent` SDK on startup
2. A **preload script** (`preload.cjs`) exposes a `window.piDesktop` API to the renderer via Electron's `contextBridge`
3. The **renderer** (`renderer.js`) communicates with the main process exclusively through IPC — sending prompts, switching models, and subscribing to streaming events (text deltas, thinking blocks, tool calls)
4. Session events are forwarded from the SDK subscription to the renderer, which renders messages, tool blocks, and status updates in real time

### IPC Channels

All communication between renderer and main process uses typed IPC channels defined in `src/shared/types.ts`:

- **Renderer → Main**: `sendPrompt`, `abort`, `newSession`, `getState`, `getMessages`, `getModels`, `setModel`, `setThinking`, `compact`, `setWorkingDir`, `quit`
- **Main → Renderer**: `session:event`, `session:state`, `session:messages`, `session:models`, `session:status`

## 🧪 Testing

```bash
npm test          # run once
npm run test:watch # watch mode
```

Tests use [Vitest](https://vitest.dev/) and live in `tests/`.

## 🛠️ Tech Stack

- [Electron](https://www.electronjs.org/) 36 — desktop shell
- [TypeScript](https://www.typescriptlang.org/) 5 — main process and shared types
- [Vitest](https://vitest.dev/) 4 — testing
- [electron-builder](https://www.electron.build/) — packaging and distribution
- `@earendil-works/pi-coding-agent` — pi SDK

## 📄 License

[MIT](LICENSE) © [Stuart Harding](https://github.com/psylsph)

## 🔗 Links

- [pi CLI Documentation](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
- [Report Issues](https://github.com/psylsph/pi-desktop/issues)
- [Contributions Welcome](https://github.com/psylsph/pi-desktop/pulls)
