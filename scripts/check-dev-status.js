#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Roastr.ai Development Status Check');
console.log('=====================================\n');

// Load .dev-config if available
let devConfig = {};
try {
    if (fs.existsSync('.dev-config')) {
        const configContent = fs.readFileSync('.dev-config', 'utf8');
        configContent.split('\n').forEach(line => {
            if (line.includes('=') && !line.startsWith('#')) {
                const [key, value] = line.split('=', 2);
                devConfig[key.trim()] = value.trim();
            }
        });
        console.log('📄 Loaded development configuration from .dev-config');
    }
} catch (error) {
    console.log('⚠️  Could not load .dev-config, using defaults');
}

// Check current branch
try {
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const expectedBranch = devConfig.ACTIVE_BRANCH || 'main';
    
    console.log(`📍 Current Branch: ${currentBranch}`);
    console.log(`🎯 Expected Branch: ${expectedBranch}`);
    
    // Check if we're on the expected development branch
    if (currentBranch === expectedBranch) {
        console.log('✅ On expected development branch\n');
    } else if (currentBranch === 'main' || currentBranch === 'master') {
        console.log('✅ On main branch\n');
    } else if (currentBranch.startsWith('feat/') || currentBranch.startsWith('fix/') || currentBranch.startsWith('hotfix/')) {
        console.log('✅ On feature/fix branch\n');
    } else {
        console.log('ℹ️  On custom branch\n');
    }
} catch (error) {
    console.log('❌ Could not determine current branch\n');
}

// Check if ports are in use with cross-platform compatibility
function checkPort(port, service) {
    try {
        // Use different commands based on platform
        const platform = process.platform;
        let command;
        
        if (platform === 'win32') {
            // Windows: use netstat
            command = `netstat -an | findstr :${port}`;
        } else {
            // Unix-like systems (macOS, Linux): use lsof
            command = `lsof -ti:${port}`;
        }
        
        execSync(command, { stdio: 'ignore' });
        console.log(`✅ ${service}: Port ${port} is in use`);
        return true;
    } catch (error) {
        console.log(`❌ ${service}: Port ${port} is free`);
        return false;
    }
}

console.log('🔌 Port Status:');
const expectedFrontendPort = devConfig.FRONTEND_PORT || 3001;
const expectedBackendPort = devConfig.BACKEND_PORT || 3000;

const frontendRunning = checkPort(expectedFrontendPort, `Frontend (PRIMARY - Port ${expectedFrontendPort})`);
const backendRunning = checkPort(expectedBackendPort, `Backend (Port ${expectedBackendPort})`);
const port3002 = checkPort(3002, 'Port 3002 (legacy/outdated)');

if (port3002) {
    console.log('⚠️  WARNING: Port 3002 is in use!');
    console.log('   This port may contain outdated code from previous development sessions.');
    console.log('   Always use the primary frontend port for development.');
    
    // Provide platform-specific kill command
    if (process.platform === 'win32') {
        console.log('   Consider stopping processes on port 3002: `netstat -ano | findstr :3002` then `taskkill /PID <PID> /F`');
    } else {
        console.log('   Consider stopping processes on port 3002: `lsof -ti:3002 | xargs kill`');
    }
}

// Check for other conflicting ports with cross-platform compatibility
const commonPorts = [3003, 3004, 3005];
const conflictingPorts = commonPorts.filter(port => {
    try {
        const platform = process.platform;
        let command;
        
        if (platform === 'win32') {
            command = `netstat -an | findstr :${port}`;
        } else {
            command = `lsof -ti:${port}`;
        }
        
        execSync(command, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
});

if (conflictingPorts.length > 0) {
    console.log(`ℹ️  Other ports in use: ${conflictingPorts.join(', ')}`);
}

console.log('\n🌐 Development URLs:');
console.log(`   Frontend: ${devConfig.FRONTEND_URL || `http://localhost:${expectedFrontendPort}`} ${frontendRunning ? '(RUNNING)' : '(STOPPED)'}`);
console.log(`   Backend:  ${devConfig.BACKEND_URL || `http://localhost:${expectedBackendPort}`} ${backendRunning ? '(RUNNING)' : '(STOPPED)'}`);

// Check for uncommitted changes
try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
        console.log('\n📝 Uncommitted Changes:');
        console.log(status);
    } else {
        console.log('\n✅ No uncommitted changes');
    }
} catch (error) {
    console.log('\n❌ Could not check git status');
}

// Check last commit
try {
    const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8' }).trim();
    console.log(`\n📝 Last Commit: ${lastCommit}`);
} catch (error) {
    console.log('\n❌ Could not get last commit info');
}

console.log('\n🚀 Quick Actions:');
console.log('   Start development: npm run dev:full');
console.log('   Check this status: node scripts/check-dev-status.js');
console.log('   Switch to main: git checkout main');