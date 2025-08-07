#!/bin/bash

# Unified Cron Script for Roastr.ai Integrations
# This script replaces the individual Twitter cron with a unified system
# that handles all active integrations (Twitter, YouTube, Bluesky, Instagram)

# Set script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/cron_integrations.log"
NODE_PATH="/usr/local/bin/node"
NPM_PATH="/usr/local/bin/npm"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to log error
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# Function to check if node/npm are available
check_dependencies() {
    if [ ! -f "$NODE_PATH" ]; then
        log_error "Node.js not found at $NODE_PATH"
        return 1
    fi
    
    if [ ! -f "$NPM_PATH" ]; then
        log_error "npm not found at $NPM_PATH"
        return 1
    fi
    
    return 0
}

# Function to load environment variables
load_env() {
    if [ -f "$SCRIPT_DIR/.env" ]; then
        log "Loading environment variables from .env"
        # Export all variables from .env file
        export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    else
        log "Warning: .env file not found, using system environment"
    fi
}

# Function to run integrations batch
run_integrations_batch() {
    log "Starting unified integrations batch processing..."
    
    # Set NODE_ENV if not set
    export NODE_ENV="${NODE_ENV:-production}"
    
    # Run the batch processor
    "$NODE_PATH" "$SCRIPT_DIR/src/batchRunner.js" 2>&1 | tee -a "$LOG_FILE"
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        log "✅ Integrations batch completed successfully"
    else
        log_error "❌ Integrations batch failed with exit code $exit_code"
    fi
    
    return $exit_code
}

# Function to check disk space
check_disk_space() {
    local available_space=$(df "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
    local space_gb=$((available_space / 1024 / 1024))
    
    if [ $space_gb -lt 1 ]; then
        log_error "Low disk space: ${space_gb}GB available"
        return 1
    fi
    
    log "Disk space OK: ${space_gb}GB available"
    return 0
}

# Function to rotate logs if they get too large
rotate_logs() {
    local max_size=10485760  # 10MB in bytes
    
    if [ -f "$LOG_FILE" ]; then
        local file_size=$(wc -c < "$LOG_FILE")
        
        if [ $file_size -gt $max_size ]; then
            log "Rotating log file (size: ${file_size} bytes)"
            mv "$LOG_FILE" "${LOG_FILE}.old"
            touch "$LOG_FILE"
        fi
    fi
}

# Function to send webhook notification (optional)
send_webhook_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
             --max-time 10 \
             --silent \
             >> "$LOG_FILE" 2>&1
    fi
}

# Main execution
main() {
    log "================================================"
    log "🚀 Starting Roastr.ai Unified Integrations Cron"
    log "Script: $0"
    log "Working directory: $(pwd)"
    log "User: $(whoami)"
    log "PID: $$"
    log "================================================"
    
    # Pre-flight checks
    if ! check_dependencies; then
        log_error "Dependency check failed"
        send_webhook_notification "error" "Cron dependency check failed"
        exit 1
    fi
    
    if ! check_disk_space; then
        log_error "Disk space check failed"
        send_webhook_notification "warning" "Low disk space detected"
        # Continue execution but warn
    fi
    
    # Rotate logs if needed
    rotate_logs
    
    # Load environment variables
    load_env
    
    # Record enabled integrations for logging
    if [ -n "$INTEGRATIONS_ENABLED" ]; then
        log "Enabled integrations: $INTEGRATIONS_ENABLED"
    else
        log "Using default integrations (twitter)"
    fi
    
    # Run the batch processing
    local start_time=$(date +%s)
    
    if run_integrations_batch; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "✅ Cron execution completed successfully in ${duration}s"
        send_webhook_notification "success" "Integrations batch completed successfully"
        exit 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_error "❌ Cron execution failed after ${duration}s"
        send_webhook_notification "error" "Integrations batch failed"
        exit 1
    fi
}

# Handle signals for graceful shutdown
trap 'log "Received SIGINT, shutting down..."; exit 130' INT
trap 'log "Received SIGTERM, shutting down..."; exit 143' TERM

# Run main function
main "$@"