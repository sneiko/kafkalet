# kafkalet

**A desktop Kafka client for developers who want clarity, not complexity.**

Browse topics, stream messages in real-time, manage consumer groups, and produce test data — all from a fast native app.

[![Build](https://github.com/your-org/kafkalet/actions/workflows/build.yml/badge.svg)](https://github.com/your-org/kafkalet/actions/workflows/build.yml)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Screenshots

> _Coming soon — first release in progress._

<!-- ![Main window](.github/screenshots/main.png) -->
<!-- ![Stream view](.github/screenshots/stream.png) -->
<!-- ![Settings](.github/screenshots/settings.png) -->

---

## Why kafkalet?

Most Kafka GUIs are heavy, slow, or require a running server. kafkalet is a single self-contained binary (~15 MB) that connects directly to your brokers. No Docker, no JVM, no cloud account required.

---

## Features

### Message Streaming

- **Observer mode** — read messages without joining a consumer group. No committed offsets, no side effects on your cluster.
- **Consumer mode** — join a consumer group and commit offsets manually when you're ready.
- **Multi-tab sessions** — stream multiple topics at the same time in independent tabs.
- **Seek to timestamp** — jump to any point in a topic's history by wall-clock time, or start from earliest/latest.
- **Live filtering** — filter by key or value with a regex while the stream is running.
- **Virtualized list** — scrolls smoothly through 50,000+ messages without freezing.
- **Export** — save the current message buffer to JSON or CSV.

### Admin Operations

- Browse all topics with partition counts at a glance.
- Create and delete topics; alter any topic config entry.
- Inspect partition metadata: leader, replicas, in-sync replicas.
- View all consumer groups for a topic with per-partition lag.
- Reset consumer group offsets to earliest, latest, or a specific timestamp.
- Cluster health overview: broker count, under-replicated partitions, offline partitions.
- Produce a message with custom key, value, headers, and target partition.

### Authentication

| Mechanism | Status |
|---|---|
| No auth (plaintext) | ✓ |
| SASL PLAIN | ✓ |
| SASL SCRAM-SHA-256 | ✓ |
| SASL SCRAM-SHA-512 | ✓ |
| OAUTHBEARER — static token | ✓ |
| OAUTHBEARER — client credentials | ✓ |
| TLS (server cert verification) | ✓ |
| mTLS (mutual, client certificates) | ✓ |

All passwords and tokens are stored in the **OS keychain** — never written to disk as plain text.

### Profile System

- Group broker connections by environment: production, staging, dev.
- Multiple **named credentials** per broker — switch the active credential from the sidebar without editing the broker config.
- Hot-swap profiles with one click: active streams stop, the new profile connects automatically.
- Import and export profiles as a JSON backup file (passwords included, store securely).

### Schema Registry

Automatic Avro decoding via [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html). Configure a Schema Registry URL per broker; messages decode transparently in both Observer and Consumer views. HTTP Basic authentication supported.

### Plugin System

Write JavaScript decoder plugins to transform raw message bytes. Plugins match topics by regex and run a decode function on every message — useful for Protobuf, MessagePack, or any in-house serialisation format.

---

## Installation

Download the latest build for your platform from the [Releases](https://github.com/your-org/kafkalet/releases) page.

| Platform | File | Notes |
|---|---|---|
| macOS (Apple Silicon) | `kafkalet-darwin-arm64.zip` | Drag `kafkalet.app` to Applications |
| macOS (Intel) | `kafkalet-darwin-amd64.zip` | Drag `kafkalet.app` to Applications |
| Windows | `kafkalet-windows-amd64-installer.exe` | Requires WebView2 (pre-installed on Win 11) |
| Linux | `kafkalet-linux-amd64.tar.gz` | See Linux notes below |

**macOS Gatekeeper:** on first launch right-click → _Open_ if the app is blocked by Gatekeeper.

**Linux dependencies:**
```bash
# Ubuntu / Debian
sudo apt-get install libgtk-3-0 libwebkit2gtk-4.0-37 libsecret-1-0
```

---

## Quick Start

1. Launch kafkalet. The main window opens with an empty sidebar.
2. Press **⌘,** (macOS) or **Ctrl+,** (Windows/Linux) to open Settings.
3. Click **New Profile** and give it a name, e.g. `Production`.
4. Click **Add Broker**, fill in the address(es) and authentication details, then **Test Connection**.
5. Save and close Settings. Your broker appears in the sidebar.
6. Expand the broker to see its topics.
7. Click a topic → **Observe** to stream without side effects, or **Consume** to join a consumer group.

**Keyboard shortcuts:**

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Profile switcher |
| `⌘,` / `Ctrl+,` | Settings |

---

## Configuration

Settings are stored in the standard user config directory:

| Platform | Location |
|---|---|
| macOS | `~/Library/Application Support/kafkalet/` |
| Windows | `%APPDATA%\kafkalet\` |
| Linux | `~/.config/kafkalet/` |

`profiles.json` holds broker connection details (addresses, SASL usernames, TLS settings). Passwords are stored exclusively in the OS keychain and are never written to `profiles.json`.

---

## Building from Source

### Prerequisites

- Go 1.24+
- Node.js 18+
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev libsecret-1-dev`

### Development (hot reload)

```bash
git clone https://github.com/your-org/kafkalet.git
cd kafkalet
wails dev
```

The app opens as a native window. React fast-refresh and Go recompilation happen automatically on file save.

### Production build

```bash
# Current platform
wails build

# Specific targets
wails build -platform darwin/arm64        # macOS Apple Silicon
wails build -platform darwin/amd64        # macOS Intel
wails build -platform darwin/universal    # macOS universal binary (arm64 + amd64)
wails build -platform windows/amd64 -nsis # Windows with NSIS installer
wails build -platform linux/amd64         # Linux binary

# Output: build/bin/
```

### Tests and linting

```bash
go test ./...               # Go tests
cd frontend && npm run lint # ESLint (FSD import boundaries enforced)
```

---

## Project Structure

```
kafkalet/
├── main.go               # wails.Run entry point
├── app.go                # public Wails RPCs (thin wrappers only)
├── internal/
│   ├── profile/          # profile & broker CRUD, keychain helpers
│   ├── broker/           # franz-go client, metadata, producer, admin
│   ├── stream/           # observer/consumer sessions, lifecycle manager
│   ├── schema/           # Confluent Schema Registry + Avro decoding
│   ├── plugin/           # JavaScript decoder plugin loader & store
│   └── config/           # cross-platform config path helpers
└── frontend/src/
    ├── app/              # providers, router, global styles
    ├── pages/            # MainPage, SettingsPage
    ├── widgets/          # Sidebar, StreamPane, ProfileBar, GroupLagPanel
    ├── features/         # ProfileSwitcher, BrokerConnect, TopicObserve,
    │                     # TopicConsume, TopicInfo, MessageProduce, PluginManager
    ├── entities/         # broker, profile, topic, message, session, consumer-group
    └── shared/           # shadcn/ui exports, Wails bindings, utilities
```

Architecture follows [Feature-Sliced Design](https://feature-sliced.design).
Import direction is strictly enforced: `app → pages → widgets → features → entities → shared`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Native window & RPC bridge | [Wails v2](https://wails.io) |
| Kafka client | [franz-go](https://github.com/twmb/franz-go) |
| Schema Registry / Avro | [goavro](https://github.com/linkedin/goavro) |
| OS keychain | [go-keyring](https://github.com/zalando/go-keyring) |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS |
| State management | [Zustand](https://github.com/pmndrs/zustand) |
| Frontend build | Vite + React 18 + TypeScript |
| List virtualisation | [@tanstack/react-virtual](https://tanstack.com/virtual) |

---

## Contributing

Pull requests are welcome. For larger changes please open an issue first.

After changing public methods on the `App` struct, regenerate TypeScript bindings:

```bash
wails generate module
```

See [`CLAUDE.md`](CLAUDE.md) for architecture conventions and [`docs/`](docs/) for design documentation.

---

## License

[MIT](LICENSE)
