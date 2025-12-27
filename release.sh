#!/bin/bash

# BabushkaML Release Script
# Run this script to push code and create a GitHub release

set -e

VERSION="${1:-0.1.0}"
DMG_PATH="./src-tauri/target/release/bundle/macos/BabushkaML.dmg"

echo "=== BabushkaML Release Script ==="
echo "Version: v${VERSION}"
echo ""

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
  echo "DMG not found at: $DMG_PATH"
  echo "Building release first..."
  cd src-tauri && cargo tauri build && cd ..
fi

# Check git status
echo "1. Checking git status..."
git status

# Push to GitHub
echo ""
echo "2. Pushing to GitHub..."
git push -u origin main

# Create release
echo ""
echo "3. Creating GitHub release v${VERSION}..."
gh release create "v${VERSION}" \
  --repo babushkai/babushkaml-app \
  --title "BabushkaML v${VERSION}" \
  --notes "## What's New in v${VERSION}

- 🎨 Beautiful theme aligned with babushkaml.com  
- 🔐 Email/password authentication with Supabase
- 🌓 Light/Dark mode support
- 🚀 MLOps pipeline management

## Installation

### macOS (Apple Silicon)

1. Download the DMG file below
2. Open the DMG and drag BabushkaML to Applications
3. **Important:** The app is not code-signed. Run this command in Terminal:
   \`\`\`bash
   xattr -cr /Applications/BabushkaML.app
   \`\`\`
4. Now you can open BabushkaML normally

> ⚠️ **Why this step?** macOS Gatekeeper blocks unsigned apps downloaded from the internet. The command above removes the quarantine flag.

## System Requirements

- macOS 11.0 (Big Sur) or later
- Apple Silicon (arm64)" \
  "$DMG_PATH"

echo ""
echo "=== Release complete! ==="
echo "Check: https://github.com/babushkai/babushkaml-app/releases"

