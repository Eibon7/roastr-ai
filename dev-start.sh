#!/bin/bash

# Roastr.ai Development Startup Script
# This script ensures you're always on the correct branch and port
# Uses .dev-config as single source of truth for development settings

echo "🚀 Starting Roastr.ai Development Environment"
echo "=============================================="

# Load development configuration
if [ -f .dev-config ]; then
    echo "📄 Loading development configuration from .dev-config"
    source .dev-config
else
    echo "❌ .dev-config file not found! Using fallback values."
    ACTIVE_BRANCH="main"
    FRONTEND_PORT=3001
    BACKEND_PORT=3000
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH="${ACTIVE_BRANCH}"

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
echo "   Frontend: http://localhost:${FRONTEND_PORT} (PRIMARY)"
echo "   Backend:  http://localhost:${BACKEND_PORT}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
    lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit (before starting processes)
trap cleanup EXIT INT TERM

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "🚀 Starting backend server..."
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🚀 Starting frontend server..."
if ! cd frontend; then
    echo "❌ Failed to change to frontend directory"
    exit 1
fi

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "❌ Frontend package.json not found"
    exit 1
fi

npm start
