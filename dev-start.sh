#!/bin/bash

# Roastr.ai Development Startup Script
# This script ensures you're always on the correct branch and port

echo "🚀 Starting Roastr.ai Development Environment"
echo "=============================================="

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH="feat/disable-development-features"

echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
    echo "⚠️  WARNING: You're not on the active development branch!"
    echo "   Current: $CURRENT_BRANCH"
    echo "   Expected: $TARGET_BRANCH"
    echo ""
    read -p "Switch to $TARGET_BRANCH? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Switching to $TARGET_BRANCH..."
        git checkout $TARGET_BRANCH
        if [ $? -ne 0 ]; then
            echo "❌ Failed to switch branch. Please check manually."
            exit 1
        fi
    else
        echo "⚠️  Continuing on current branch. Results may be outdated."
    fi
fi

echo ""
echo "🔧 Starting development servers..."
echo "   Frontend: http://localhost:3001 (PRIMARY)"
echo "   Backend:  http://localhost:3000"
echo ""

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "🚀 Starting backend server..."
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🚀 Starting frontend server..."
cd frontend
npm start

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit
trap cleanup EXIT
