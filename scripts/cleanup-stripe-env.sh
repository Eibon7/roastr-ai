#!/bin/bash

# Stripe Environment Cleanup Script
# Issue #678: Remove Stripe configuration from environment files
#
# This script removes all STRIPE_* environment variables from:
# - .env (if exists)
# - .env.local (if exists)
# - .env.production (if exists)
# - Any .env.* files

set -e

echo "🧹 Cleaning up Stripe environment variables..."

# Function to clean a single env file
clean_env_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        echo "Cleaning $file..."

        # Create backup
        cp "$file" "$file.backup.$(date +%Y%m%d_%H%M%S)"

        # Remove STRIPE_ lines
        sed -i '' '/^STRIPE_/d' "$file"

        # Add comment about removal
        if ! grep -q "DEPRECATED.*Issue #678" "$file"; then
            echo "" >> "$file"
            echo "# =================================" >> "$file"
            echo "# DEPRECATED (Issue #678 - Stripe removed)" >> "$file"
            echo "# =================================" >> "$file"
            echo "# STRIPE_SECRET_KEY=removed_in_issue_678" >> "$file"
            echo "# STRIPE_WEBHOOK_SECRET=removed_in_issue_678" >> "$file"
            echo "# STRIPE_PRICE_LOOKUP_STARTER=removed_in_issue_678" >> "$file"
            echo "# STRIPE_PRICE_LOOKUP_PRO=removed_in_issue_678" >> "$file"
            echo "# STRIPE_PRICE_LOOKUP_PLUS=removed_in_issue_678" >> "$file"
        fi

        echo "✅ Cleaned $file"
    else
        echo "⚠️  $file not found, skipping"
    fi
}

# Clean common env files
clean_env_file ".env"
clean_env_file ".env.local"
clean_env_file ".env.production"
clean_env_file ".env.staging"
clean_env_file ".env.test"

# Find and clean any other .env.* files
for env_file in .env.*; do
    if [[ -f "$env_file" && "$env_file" != *.backup.* ]]; then
        clean_env_file "$env_file"
    fi
done

echo ""
echo "🎉 Stripe cleanup complete!"
echo "📋 Summary:"
echo "   - Removed all STRIPE_* environment variables"
echo "   - Created backup files with timestamps"
echo "   - Added deprecation comments"
echo ""
echo "Next steps:"
echo "1. Update your deployment scripts to remove STRIPE_* vars"
echo "2. Update CI/CD pipelines to remove STRIPE_* secrets"
echo "3. Add POLAR_* variables when Polar integration is ready"
