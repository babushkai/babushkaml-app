#!/bin/bash
# macOS App Setup Script for MLOps Console using Tauri
# Creates a native macOS .app bundle

set -e

echo "🚀 Setting up MLOps Console for macOS..."

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "📦 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Install Tauri CLI
echo "📦 Installing Tauri CLI..."
cargo install tauri-cli

# Initialize Tauri if not already done
if [ ! -f "src-tauri/Cargo.toml" ]; then
    echo "🔧 Initializing Tauri..."
    cargo tauri init --ci
fi

# Build the app
echo "🏗️ Building macOS app..."
cargo tauri build

echo ""
echo "✅ macOS build complete!"
echo ""
echo "Your app is at: src-tauri/target/release/bundle/macos/"
echo ""
echo "To run in development mode:"
echo "  cargo tauri dev"
echo ""
echo "To open the .app:"
echo "  open src-tauri/target/release/bundle/macos/MLOps\\ Console.app"





