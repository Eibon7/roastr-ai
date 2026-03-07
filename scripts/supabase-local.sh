#!/usr/bin/env bash
set -euo pipefail

case "${1:-start}" in
  start)
    echo "Starting Supabase local..."
    npx supabase start
    npx supabase status
    ;;
  stop)
    echo "Stopping Supabase local..."
    npx supabase stop
    ;;
  reset)
    echo "Resetting Supabase local..."
    npx supabase db reset --local
    ;;
  status)
    npx supabase status
    ;;
  *)
    echo "Usage: $0 {start|stop|reset|status}"
    exit 1
    ;;
esac
