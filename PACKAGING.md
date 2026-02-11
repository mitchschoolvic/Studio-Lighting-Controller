# DMX Controller - Packaging Guide

## Building the macOS Application

### Quick Start
```bash
./package_app.sh
```

This script will:
1. **Auto-increment** the version number (patch version)
2. Install dependencies
3. Rebuild native modules (serialport)
4. Build the application
5. Package as a macOS app (Apple Silicon)
6. Create a DMG installer
7. Use **ad-hoc signing** (no certificate required)

### Build Output

Build artifacts are created in the `dist/` directory:
- **DMG file**: `dist/DMX Controller-<version>-arm64.dmg`
- **App bundle**: `dist/mac-arm64/DMX Controller.app`

### Version Display

The app version is automatically displayed in the header next to "DMX Controller" as a badge (e.g., "v1.0.1").

### Excluded from Build

The following are excluded from the packaged app:
- `dist/` directory (previous builds)
- `*.dmg` files
- `*.app` bundles
- Development dependencies

### Manual Version Control

To manually set a specific version before building:
```bash
npm version 2.0.0 --no-git-tag-version
./package_app.sh
```

### Requirements

- macOS (Apple Silicon)
- Node.js 16+
- Xcode Command Line Tools (for native module compilation)

### Troubleshooting

If you encounter serialport build issues:
```bash
npm run rebuild
```

If the packaging fails, check:
1. All dependencies are installed: `npm install`
2. TypeScript compiles without errors: `npm run build`
3. Electron Builder is installed: `npm list electron-builder`
