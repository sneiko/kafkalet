# Build assets

Place `appicon.png` here (1024×1024 px PNG).

Wails will auto-generate platform-specific icon formats:
- **macOS**: `appicon.icns` (from `appicon.png`)
- **Windows**: `appicon.ico` (from `appicon.png`)
- **Linux**: `appicon.png` used directly

To generate the icon, run `wails generate module` after placing `appicon.png`.
