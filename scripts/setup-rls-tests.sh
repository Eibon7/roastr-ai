#!/bin/bash

# Setup script for RLS tests
# Verifies PostgreSQL/Supabase is available and configured correctly

set -e

echo "🔍 Verifying RLS test environment..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL (psql) is not installed"
    echo ""
    echo "Install PostgreSQL:"
    echo "  macOS: brew install postgresql@17"
    echo "  Linux: sudo apt-get install postgresql-client"
    exit 1
fi

echo "✅ PostgreSQL client found"

# Check connection
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-54322}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-postgres}
PGDATABASE=${PGDATABASE:-postgres}

echo "📋 Connection settings:"
echo "   Host: $PGHOST"
echo "   Port: $PGPORT"
echo "   User: $PGUSER"
echo "   Database: $PGDATABASE"

# Test connection
export PGPASSWORD
if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Cannot connect to database"
    echo ""
    echo "Options:"
    echo "  1. Start Supabase local: supabase start"
    echo "  2. Start PostgreSQL: brew services start postgresql@17"
    echo "  3. Set environment variables:"
    echo "     export PGHOST=localhost"
    echo "     export PGPORT=54322"
    echo "     export PGUSER=postgres"
    echo "     export PGPASSWORD=postgres"
    exit 1
fi

# Check if required extensions are available
echo ""
echo "🔍 Checking required extensions..."
EXTENSIONS=("uuid-ossp" "vector")

for ext in "${EXTENSIONS[@]}"; do
    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "SELECT 1 FROM pg_extension WHERE extname='$ext';" | grep -q 1; then
        echo "  ✅ Extension '$ext' is installed"
    else
        echo "  ⚠️  Extension '$ext' not found (will be created automatically)"
    fi
done

# Check migrations
echo ""
echo "🔍 Checking migrations..."
MIGRATIONS_DIR="supabase/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | wc -l | tr -d ' ')
    echo "  ✅ Found $MIGRATION_COUNT migration files"
else
    echo "  ⚠️  Migrations directory not found: $MIGRATIONS_DIR"
fi

echo ""
echo "✅ RLS test environment is ready!"
echo ""
echo "Run tests with:"
echo "  npm run test:rls"

