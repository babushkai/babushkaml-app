#!/bin/bash

# BabushkaML Release Script
# Run this script to push code and create a GitHub release

set -e

echo "=== BabushkaML Release Script ==="
echo ""

# Check git status
echo "1. Checking git status..."
git status

# Push to GitHub
echo ""
echo "2. Pushing to GitHub..."
git push -u origin main

# Create release
echo ""
echo "3. Creating GitHub release v0.1.0..."
gh release create v0.1.0 \
  --repo babushkai/babushkaml-app \
  --title "BabushkaML v0.1.0" \
  --notes "## What's New in v0.1.0

- 🎨 Beautiful theme aligned with babushkaml.com  
- 🔐 Email/password authentication with Supabase
- 🌓 Light/Dark mode support
- 🚀 MLOps pipeline management

## Installation

1. Download the DMG file below
2. Open the DMG and drag BabushkaML to Applications
3. Right-click the app → Open (required on first launch)

## System Requirements

- macOS 11.0 (Big Sur) or later
- Apple Silicon (arm64)" \
  ./src-tauri/target/release/bundle/macos/BabushkaML.dmg

echo ""
echo "=== Release complete! ==="
echo "Check: https://github.com/babushkai/babushkaml-app/releases"

