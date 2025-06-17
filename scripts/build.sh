#!/bin/bash

# Build optimization script for HighLite
echo "🚀 Starting optimized build process..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out dist node_modules/.cache

# Type checking
echo "🔍 Running type checks..."
npm run typecheck

# Linting
echo "🧹 Running linter..."
npm run lint:check

# Build with optimizations
echo "🔨 Building application..."
NODE_ENV=production npm run build

# Optional: Run build for specific platform
if [ "$1" = "win" ]; then
    echo "🪟 Building for Windows..."
    npm run build:win
elif [ "$1" = "mac" ]; then
    echo "🍎 Building for macOS..."
    npm run build:mac
elif [ "$1" = "linux" ]; then
    echo "🐧 Building for Linux..."
    npm run build:linux
fi

echo "✅ Build process completed!"
