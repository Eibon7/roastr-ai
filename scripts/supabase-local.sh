#!/usr/bin/env bash
set -euo pipefail

case "${1:-start}" in
  start)
    echo "Starting Supabase local..."
    npx supabase start
    echo "Supabase is running at http://localhost:54321"
    ;;
  stop)
    echo "Stopping Supabase local..."
    npx supabase stop
    ;;
  reset)
    echo "Resetting Supabase local..."
    npx supabase db reset
    ;;
  status)
    npx supabase status
    ;;
  *)
    echo "Usage: $0 {start|stop|reset|status}"
    exit 1
    ;;
esac
