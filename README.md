# SafeClaw

> **SafeClaw** is a fork of [OpenBrowserClaw](https://github.com/sachaa/openbrowserclaw) by sachaa, with modifications limiting scope to Chrome and implementing a multi-LLM provider strategy.

> **Disclaimer:** SafeClaw is a personal, open-source project. It is **not** affiliated with any cryptocurrency, meme coin, token, or social media account. If you see coins, tokens, or social media profiles claiming association with this project, they are **not legitimate** and are not endorsed by the author(s). Stay safe and do your own research.

**Website:** [safeclaw.umeton.com](https://safeclaw.umeton.com) | **App:** [app-safeclaw.umeton.com](https://app-safeclaw.umeton.com)

Browser-native personal AI assistant with multi-provider LLM support. Zero infrastructure — the browser is the server. Installable as a PWA on any device.

## What's Different from OpenBrowserClaw?

- **Multi-provider LLM support**: Anthropic Claude, Google Gemini, WebLLM (local Qwen3 models), and Chrome built-in AI (Gemini Nano)
- **Quality-first routing**: Cloud models by default; local models activate when offline, rate-limited (429), or by user preference
- **Chrome-focused**: Optimized for Chrome's capabilities (Origin Private File System, WebGPU, Chrome AI APIs)
- **Rebranded identity**: SafeClaw as a distinct fork with its own direction

## Try It Now

Visit [app-safeclaw.umeton.com](https://app-safeclaw.umeton.com) to use SafeClaw instantly in your browser — no installation required. On mobile, use your browser's "Add to Home Screen" to install it as a PWA.

## Quick Start (Development)

```bash
cd safeclaw
npm install
npm run dev
```

Open `http://localhost:5173`, add your API key(s) in Settings, and start chatting.

## Supported Providers

| Provider | Type | Models | Tool Use |
|----------|------|--------|----------|
| **Anthropic** | Cloud API | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 | Yes |
| **Google Gemini** | Cloud API | Gemini 2.5 Pro, 2.0 Flash | Yes |
| **WebLLM** | Local (WebGPU) | Qwen3-4B, Qwen3-30B | Yes (parsed) |
| **Chrome AI** | Local (built-in) | Gemini Nano | No (summarization only) |

### Provider Routing

SafeClaw uses quality-first routing:

1. **Default**: Your configured cloud provider (Anthropic or Gemini)
2. **Offline** (`navigator.onLine === false`): Falls back to WebLLM if available
3. **Rate-limited** (HTTP 429): Tries alternate cloud provider, then local
4. **User override**: Manual provider/model selection in Settings

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser Tab (PWA)                                       │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌───────┐ ┌───────┐ ┌──────────┐  │
│  │ Chat   │ │Settings│ │ Files │ │ Tasks │ │Use Cases │  │
│  └───┬────┘ └───┬────┘ └──┬────┘ └──┬────┘ └────┬─────┘  │
│       └──────┴────────┼────────┴──────┘                   │
│                      ▼                                   │
│              Orchestrator (main thread)                  │
│              ├── Provider Router (quality-first)         │
│              ├── Message queue & routing                 │
│              ├── State machine (idle/thinking/responding)│
│              └── Task scheduler (cron)                   │
│                      │                                   │
│          ┌───────────┼───────────┐                       │
│          ▼           ▼           ▼                       │
│     IndexedDB      OPFS    Agent Worker                  │
│     (messages,   (group    (LLM provider                 │
│      tasks,       files,    tool-use loop,               │
│      config)     memory)    multi-provider)              │
│                                                          │
│  Providers:                                              │
│  ├── Anthropic Claude API                                │
│  ├── Google Gemini API                                   │
│  ├── WebLLM (Qwen3 via WebGPU)                           │
│  └── Chrome AI (Gemini Nano, main thread)                │
│                                                          │
│  Channels:                                               │
│  ├── Browser Chat (built-in)                             │
│  └── Telegram Bot API (optional, pure HTTPS)             │
└──────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/orchestrator.ts` | State machine, message routing, agent invocation |
| `src/agent-worker.ts` | Web Worker: LLM provider tool-use loop |
| `src/providers/` | Provider abstraction layer (Anthropic, Gemini, WebLLM, Chrome AI) |
| `src/tools.ts` | Tool definitions (bash, read/write files, fetch, etc.) |
| `src/db.ts` | IndexedDB: messages, sessions, tasks, config |
| `src/storage.ts` | OPFS: per-group file storage |
| `src/router.ts` | Routes messages to correct channel |
| `src/channels/` | Browser chat and Telegram channels |
| `src/task-scheduler.ts` | Cron expression evaluation |
| `src/crypto.ts` | AES-256-GCM encryption for stored credentials |

## Tools

| Tool | What it does |
|------|-------------|
| `bash` | Execute shell commands in a lightweight bash emulator |
| `javascript` | Execute JS code in an isolated scope (lighter than bash) |
| `read_file` / `write_file` / `list_files` | Manage files in OPFS per-group workspace |
| `fetch_url` | HTTP requests via browser `fetch()` (subject to CORS) |
| `update_memory` | Persist context to CLAUDE.md (loaded on every conversation) |
| `create_task` | Schedule recurring tasks with cron expressions |

## Example Workflows

SafeClaw supports a wide range of personal AI workflows. Here are some top examples — sourced from [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases):

| Category | Workflow | Description |
|----------|----------|-------------|
| **Productivity** | Daily News Digest | Aggregate and summarize tech news from multiple sources into a curated daily briefing |
| **Productivity** | Inbox De-clutter | Summarize newsletters and send a condensed digest via email |
| **Productivity** | Personal CRM | Automatically discover and track contacts from email and calendar |
| **Productivity** | Meeting Notes & Action Items | Convert meeting transcripts into structured summaries with automatic task creation |
| **Creative** | Content Pipeline | Automate idea scouting, research, and content tracking for video or blog production |
| **Creative** | Podcast Production | Automate guest research, outlines, show notes, and promotional assets |
| **Research** | Personal Knowledge Base (RAG) | Build a searchable knowledge base from URLs, tweets, and articles |
| **Research** | Pre-Build Idea Validator | Scan GitHub, HN, npm, PyPI, and Product Hunt before building a new project |
| **Automation** | Health & Symptom Tracker | Track food intake and symptoms to identify triggers with scheduled reminders |
| **Automation** | Habit Tracker & Coach | Daily check-ins tracking habits with adaptive tone and accountability |
| **Social** | Reddit/YouTube Digest | Summarize curated digests from favorite subreddits or YouTube channels |
| **DevOps** | Self-Healing Home Server | Always-on infrastructure agent with SSH access, cron jobs, and self-healing capabilities |

For the full list of 40+ use cases, see the [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases) repository.

## Telegram

Optional. Works entirely via HTTPS — no WebSockets or special protocols.

1. Create a bot with `@BotFather` on Telegram
2. Open Settings in SafeClaw, paste the bot token
3. Send `/chatid` to your bot to get the chat ID
4. Add the chat ID in Settings
5. Messages from Telegram are processed the same as browser chat

**Caveat**: The browser tab must be open for the bot to respond.

## Contributing

We use **Test-Driven Development** — all contributions must include tests written before implementation, and coverage must stay above 90% on all metrics.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Full contributor guide with TDD workflow, testing examples, and PR checklist
- **[CLAUDE.md](CLAUDE.md)** — Agent-specific guide for AI contributors (repo layout, commands, test patterns)

## Development

```bash
npm run dev            # Vite dev server with HMR
npm run build          # Production build -> dist/
npm run preview        # Preview production build
npm run typecheck      # TypeScript type checking
npm run test           # Run test suite
npm run test:coverage  # Run tests with coverage report (must be >90%)
```

## Deploy

The hosted app is available at [app-safeclaw.umeton.com](https://app-safeclaw.umeton.com).

To self-host:

```bash
npm run build
# Upload dist/ to any static host:
# GitHub Pages, Cloudflare Pages, Netlify, Vercel, S3, etc.
```

No server needed. It's just HTML, CSS, and JS.

## Security

SafeClaw is a proof of concept. All data stays in your browser, nothing is sent to any server except the LLM provider APIs you configure. Here's an honest look at the current security posture:

**What it does:**
- API keys are encrypted at rest with AES-256-GCM using a non-extractable `CryptoKey` stored in IndexedDB. JavaScript cannot export the raw key material.
- All storage (IndexedDB, OPFS) is same-origin scoped by the browser.
- The agent runs in a Web Worker, separate from the UI thread.

**What it doesn't do (yet):**
- The encryption protects against casual inspection (DevTools, disk forensics) but not a full XSS attack on the same origin.
- The `javascript` tool runs `eval()` in the Worker, which has access to `fetch()`.
- Outgoing HTTP requests have no user confirmation step.
- The Telegram bot token is currently stored in plaintext.

This is a single-user local tool, not a multi-tenant platform.

## Acknowledgements

SafeClaw is based on [OpenBrowserClaw](https://github.com/sachaa/openbrowserclaw) by sachaa, which itself is a browser-only reimagination of NanoClaw. We gratefully acknowledge the original project and its contributors.
