#!/bin/bash

# Roastr.ai Development Startup Script
# This script ensures you're always on the correct branch and port
# Uses .dev-config as single source of truth for development settings

# Exit on any error
set -e

# Error handling function
handle_error() {
    local exit_code=$?
    echo ""
    echo "❌ Script failed with exit code $exit_code at line $1"
    echo "💡 Please check the error above and try again"
    cleanup
    exit $exit_code
}

# Set error trap
trap 'handle_error $LINENO' ERR

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

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    echo "💡 Please run this script from the project root directory"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    echo "❌ Error: Could not determine current git branch"
    exit 1
fi

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
        if ! git checkout $TARGET_BRANCH; then
            echo "❌ Failed to switch branch. Please check manually."
            exit 1
        fi
        echo "✅ Successfully switched to $TARGET_BRANCH"
    else
        echo "⚠️  Continuing on current branch. Results may be outdated."
    fi
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in current directory"
    echo "💡 Please run this script from the project root directory"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "💡 Please ensure you're in the correct project directory"
    exit 1
fi

# Check if frontend/package.json exists
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: frontend/package.json not found"
    echo "💡 Please ensure the frontend is properly set up"
    exit 1
fi

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ Error: npm is not installed or not in PATH"
    echo "💡 Please install Node.js and npm first"
    exit 1
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
    
    # Kill backend process if it exists
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        echo "🔴 Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        sleep 1
        # Force kill if still running
        kill -9 $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on these ports
    if command -v lsof >/dev/null 2>&1; then
        echo "🧹 Cleaning up any remaining processes..."
        lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
        lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
    fi
    
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
if command -v lsof >/dev/null 2>&1; then
    lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
    lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
else
    echo "⚠️  Warning: lsof not available, cannot clean up existing processes"
fi

# Start backend in background
echo "🚀 Starting backend server..."
# Redirect stdout/stderr to a log file and start in background
npm start > backend.log 2>&1 &
BACKEND_PID=$!

# Wait a short moment and verify the process actually started
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Error: Backend server failed to start"
    echo "📋 Backend log output:"
    tail -n 20 backend.log
    exit 1
fi

echo "✅ Backend server started successfully (PID: $BACKEND_PID)"

# Wait a moment for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Verify backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Error: Backend server failed to start or crashed"
    exit 1
fi

# Start frontend
echo "🚀 Starting frontend server..."
if ! cd frontend; then
    echo "❌ Error: Failed to change to frontend directory"
    exit 1
fi

if ! npm start; then
    echo "❌ Error: Failed to start frontend server"
    exit 1
fi