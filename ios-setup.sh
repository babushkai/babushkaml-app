#!/bin/bash
# iOS App Setup Script for MLOps Console
# Run this after npm install to set up Capacitor for iOS

set -e

echo "🚀 Setting up MLOps Console for iOS..."

# Install Capacitor dependencies
echo "📦 Installing Capacitor..."
npm install @capacitor/core @capacitor/cli @capacitor/ios --legacy-peer-deps
npm install @capacitor/filesystem @capacitor/network @capacitor/preferences --legacy-peer-deps

# Build the web app first (needed before adding platform)
echo "🏗️ Building web app..."
npm run build

# Add iOS platform if not exists
if [ ! -d "ios" ]; then
  echo "📱 Adding iOS platform..."
  npx cap add ios
else
  echo "📱 iOS platform already exists"
fi

# Sync web assets to iOS
echo "🔄 Syncing to iOS..."
npx cap sync ios

echo ""
echo "✅ iOS setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open Xcode: npx cap open ios"
echo "  2. Add your Team ID for signing"
echo "  3. Add Core ML models to ios/App/App/Models/"
echo "  4. Run on simulator or device"
echo ""
echo "For local ML inference, add ONNX or Core ML models."
echo "See MOBILE_GUIDE.md for detailed instructions."

