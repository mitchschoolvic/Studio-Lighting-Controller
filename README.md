<div align="center">

# 💡 DMX Controller

**Professional DMX lighting control for macOS**

A tray-resident Electron application that drives an Enttec DMX USB Pro adapter, exposes a touch-friendly React-based virtual console, and integrates with Bitfocus Companion for remote automation.

[![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-000?logo=apple&logoColor=white)](https://github.com)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 🎬 Demo

### App UI & Canvas Screen

<!-- TODO: Replace with actual demo gif -->
<p align="center">
  <img src="" alt="App UI and Canvas Screen Demo" width="800" />
  <br />
  <em>Drag-and-drop canvas layout, real-time fixture control, and preset management</em>
</p>

### Touch Screen Control

<!-- TODO: Replace with actual demo gif -->
<p align="center">
  <img src="" alt="Touch Screen Video Recording" width="800" />
  <br />
  <em>Touch-optimized interface for iPad and external displays</em>
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎛️ Fixture Control
- **Canvas View** — drag-and-drop spatial fixture layout
- **Color Wheel** — HSV/RGB picker with live preview
- **Fader Bank** — per-channel sliders with fixture labels
- **Master Dimmer** — global intensity with instant blackout
- **Mode Switching** — multi-mode fixture profiles (FX, static, etc.)
- **Momentary Triggers** — press-and-hold buttons for effects

</td>
<td width="50%">

### 🎨 Preset System
- **Save & Recall** — capture and restore full lighting states
- **Crossfade** — smooth timed transitions between presets
- **Color Tags** — visual organization for preset grids
- **Companion Sync** — presets exposed to Bitfocus Companion

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Hardware & Connectivity
- **40 Hz DMX output** to Enttec DMX USB Pro
- **Auto-reconnect** with exponential backoff (1s → 30s)
- **Tray-resident** — lives in the macOS menu bar, no Dock icon
- **Remote access** — full UI from any browser on your LAN

</td>
<td width="50%">

### 🤖 Automation
- **Bitfocus Companion** — WebSocket integration (port 9091)
- **Custom Companion Module** — native actions, feedbacks, and variables
- **Variable Sender Module** — push data from Companion
- **8 remote commands** — preset recall, blackout, channel set, and more

</td>
</tr>
</table>

---

## 📋 Prerequisites

| Requirement | Version |
|---|---|
| macOS | Apple Silicon (arm64) |
| Node.js | 20+ |
| Xcode CLI Tools | Latest |
| Enttec DMX USB Pro | USB adapter connected |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repo-url> && cd Lighting_Controller

# Install dependencies
npm install

# Rebuild native serial modules for Electron
npm run rebuild

# Start development (Vite + Electron)
npm run dev
```

The app launches in the macOS menu bar. Click the tray icon to open the control window.  
The UI is also accessible at **`http://<your-ip>:9090`** from any device on your network.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        macOS Menu Bar                            │
│                         (Tray Icon)                              │
└──────────────┬───────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────────┐
│                     Electron Main Process                        │
│                                                                  │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌────────────┐  │
│  │ DMXUniverse  │  │DMXDriver │  │ FadeEngine │  │  Logger    │  │
│  │ (512-ch buf) │──│(serial)  │  │ (40Hz LERP)│  │            │  │
│  └──────┬──────┘  └────┬─────┘  └──────┬─────┘  └────────────┘  │
│         │              │               │                         │
│  ┌──────▼──────┐  ┌────▼─────────┐  ┌──▼─────────────┐          │
│  │FixtureManager│  │PresetManager │  │SocketUIServer  │          │
│  │(profiles)    │  │(save/recall) │  │(Socket.io:9090)│          │
│  └─────────────┘  └──────────────┘  └───┬────────────┘          │
│                                         │                        │
│  ┌─────────────────────┐                │                        │
│  │  CompanionServer    │                │                        │
│  │  (WebSocket:9091)   │                │                        │
│  └──────────┬──────────┘                │                        │
└─────────────┼───────────────────────────┼────────────────────────┘
              │                           │
     ┌────────▼────────┐        ┌─────────▼─────────┐
     │    Bitfocus      │        │   React UI        │
     │    Companion     │        │   (Vite + React)  │
     │                  │        │   Browser / iPad  │
     └─────────────────┘        └───────────────────┘
```

### Network Ports

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| `9090` | UI Server | Socket.io + HTTP | React UI & real-time state sync |
| `9091` | Companion | Raw WebSocket | Bitfocus Companion integration |
| `5173` | Vite Dev | HTTP | Hot-reload dev server (dev only) |

### Core Modules

| Module | Description |
|--------|-------------|
| `DMXUniverse` | Single source of truth — 512-channel buffer |
| `DMXDriver` | Serial I/O to Enttec USB Pro (VID `0403`, PID `6001`) at 40 Hz |
| `FadeEngine` | Linear interpolation engine — 25ms tick, cancellable crossfades |
| `FixtureManager` | Named fixture abstraction with multi-mode profile support |
| `PresetManager` | Persistent save/recall of complete lighting snapshots |
| `SocketUIServer` | Real-time bidirectional UI sync via Socket.io |
| `CompanionServer` | WebSocket command API for Bitfocus Companion |

---

## 🎮 UI Views

### Canvas View
The primary view. Fixtures are represented as interactive nodes on a 2D canvas. Drag fixtures from the palette, position them spatially, and control them by clicking. A control drawer opens on the left with color wheel, faders, and mode selectors for the selected fixture.

### Fixtures & Channels View
A detailed engineering view with per-fixture cards, a full 512-channel fader bank, fixture editor, and preset grid — all visible simultaneously.

---

## 📦 Fixture Profiles

The app ships with bundled fixture profiles in the `fixtures/` directory. Profiles define channel layouts, modes, control types, and default values.

### Bundled Fixtures

| Fixture | Channels | Modes | Highlights |
|---------|----------|-------|------------|
| **Nanlite Forza 200** | 5 | 14 | Daylight, Pulse, Storm, Welding, Flash, and more |
| **Aputure Nova P300c** | 10 | 15 | HSB color, Club Lights, Lightning, Cop Car, Party, and more |

### Control Types

Profiles support four control widget types:

| Type | Widget | Behavior |
|------|--------|----------|
| `fader` | Slider (0–255) | Continuous value control |
| `momentary` | Press-and-hold button | Sends 255 on press, 0 on release |
| `toggle` | On/Off switch | Binary 0 or 255 |
| `stepped` | Discrete slider | Labeled positions with specific DMX values |

### Adding Custom Fixtures

Create a JSON file in `fixtures/` following the profile schema. The app auto-discovers profiles on launch. See existing fixtures for reference.

---

## 🤖 Companion Integration

### Companion Module

A native Bitfocus Companion module is included at `companion-module-lighting-controller/`. It provides:

- **Actions** — Recall presets, blackout, set channels, switch modes, trigger effects
- **Feedbacks** — Active preset highlighting
- **Variables** — `current_preset_name`, `current_preset_id`
- **Auto-reconnect** — 5-second reconnection loop

### WebSocket API

Connect to `ws://<host>:9091` and send JSON commands:

```json
{ "action": "recall_preset",  "id": "<uuid>",  "fadeTime": 2000 }
{ "action": "blackout",       "fadeTime": 1000 }
{ "action": "set_channel",    "channel": 1,    "value": 255 }
{ "action": "master_dimmer",  "value": 200 }
{ "action": "set_mode",       "fixtureId": "<id>", "modeName": "Strobe" }
{ "action": "trigger",        "channel": 5,    "state": "on" }
{ "action": "get_state" }
{ "action": "list_presets" }
```

### Broadcast Events

The server pushes these events to all connected clients:

| Event | Payload | Description |
|-------|---------|-------------|
| `dmx_status` | `{ connected: boolean }` | DMX adapter connection state |
| `preset_activated` | `{ id, name }` | A preset was recalled |

---

## 🛠️ Development

### Scripts

```bash
npm run dev            # Start Vite + Electron concurrently
npm run dev:renderer   # Vite dev server only (port 5173)
npm run dev:main       # Compile TS + launch Electron
npm run build          # Production build (TS + Vite)
npm run package        # Build + package as .dmg
npm run rebuild        # Rebuild native serialport for Electron
```

### Project Structure

```
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry — tray, window, wiring
│   │   ├── dmx-universe.ts    # 512-channel state buffer
│   │   ├── dmx-driver.ts      # Enttec USB Pro serial driver
│   │   ├── fade-engine.ts     # Crossfade interpolation engine
│   │   ├── fixture-manager.ts # Fixture CRUD & profile loading
│   │   ├── preset-manager.ts  # Preset save/recall/persistence
│   │   ├── socket-ui.ts       # Socket.io server for UI
│   │   ├── socket-companion.ts# WebSocket API for Companion
│   │   ├── ipc-handlers.ts    # Electron IPC bridge
│   │   ├── logger.ts          # File + console logging
│   │   └── preload.ts         # Context bridge
│   └── renderer/              # React UI (Vite)
│       ├── App.tsx             # Root component & routing
│       ├── components/        # UI components
│       │   ├── CanvasView.tsx  # Spatial fixture canvas
│       │   ├── StudioCanvas.tsx# Canvas rendering engine
│       │   ├── ColorWheel.tsx  # HSV color picker
│       │   ├── FixturePanel.tsx# Fixture cards & controls
│       │   ├── FaderBank.tsx   # 512-channel fader grid
│       │   ├── PresetGrid.tsx  # Preset buttons & management
│       │   └── ...            
│       ├── hooks/             # React hooks (socket, DMX state, fixtures)
│       ├── styles/            # Global dark theme CSS
│       └── types/             # Shared TypeScript interfaces
├── fixtures/                  # Bundled fixture profile JSONs
├── companion-module-*/        # Bitfocus Companion modules
├── assets/                    # App icons & tray icon
└── scripts/                   # Build utilities
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| UI Framework | React 19 + TypeScript 5.7 |
| Bundler | Vite 6 |
| DMX Hardware | serialport 12 (Enttec USB Pro) |
| Real-time Sync | Socket.io 4.8 |
| Companion API | ws 8.18 (raw WebSocket) |
| Persistence | electron-store |
| Logging | electron-log |
| Packaging | electron-builder 25 |

---

## 📦 Build & Package

```bash
# One-command build + package
./package_app.sh
```

This script will:
1. Auto-increment the patch version
2. Install dependencies & rebuild native modules
3. Build TypeScript + Vite production bundle
4. Package as a signed macOS `.dmg` (Apple Silicon)

### Build Output

| Artifact | Location |
|----------|----------|
| DMG Installer | `dist/DMX Controller-<version>-arm64.dmg` |
| App Bundle | `dist/mac-arm64/DMX Controller.app` |

---

## 📂 File Locations

| Data | Path |
|------|------|
| Config & Presets | `~/Library/Application Support/dmx-controller-app/config.json` |
| Logs | `~/Library/Logs/dmx-controller-app/` |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## License

MIT
