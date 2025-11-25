#!/bin/bash
# Script to run migration 056_add_portkey_metadata_to_roasts.sql
# Issue #920: Portkey AI Gateway integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/database/migrations/056_add_portkey_metadata_to_roasts.sql"

echo "🚀 Running migration for Issue #920: Portkey metadata"
echo "📄 Migration file: $MIGRATION_FILE"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL not set. Checking for .env file..."
    if [ -f "$PROJECT_ROOT/.env" ]; then
        echo "✅ Found .env file. Loading environment variables..."
        set -a
        . "$PROJECT_ROOT/.env"
        set +a
    else
        echo "❌ Error: DATABASE_URL not set and .env file not found"
        echo "💡 Please set DATABASE_URL or create .env file"
        exit 1
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL is still not set after loading .env"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo "💡 Please install PostgreSQL client tools"
    exit 1
fi

echo "📊 Executing migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📋 New columns added to roasts_metadata:"
    echo "   - mode (VARCHAR(50))"
    echo "   - provider (VARCHAR(50))"
    echo "   - fallback_used (BOOLEAN)"
    echo "   - portkey_metadata (JSONB)"
    echo ""
    echo "📊 Indexes created for performance"
else
    echo "❌ Migration failed!"
    exit 1
fi

