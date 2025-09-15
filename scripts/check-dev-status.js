#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Roastr.ai Development Status Check');
console.log('=====================================\n');

// Check current branch
try {
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const targetBranch = 'feat/disable-development-features';
    
    console.log(`📍 Current Branch: ${currentBranch}`);
    
    if (currentBranch === targetBranch) {
        console.log('✅ On correct development branch\n');
    } else {
        console.log(`❌ Wrong branch! Expected: ${targetBranch}\n`);
    }
} catch (error) {
    console.log('❌ Could not determine current branch\n');
}

// Check if ports are in use
function checkPort(port, service) {
    try {
        execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
        console.log(`✅ ${service}: Port ${port} is in use`);
        return true;
    } catch (error) {
        console.log(`❌ ${service}: Port ${port} is free`);
        return false;
    }
}

console.log('🔌 Port Status:');
const frontendRunning = checkPort(3001, 'Frontend (PRIMARY)');
const backendRunning = checkPort(3000, 'Backend');
const port3002 = checkPort(3002, 'Port 3002 (should be unused)');

if (port3002) {
    console.log('⚠️  WARNING: Port 3002 is in use - this may contain outdated code!');
}

console.log('\n🌐 Development URLs:');
console.log(`   Frontend: http://localhost:3001 ${frontendRunning ? '(RUNNING)' : '(STOPPED)'}`);
console.log(`   Backend:  http://localhost:3000 ${backendRunning ? '(RUNNING)' : '(STOPPED)'}`);

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
console.log('   Switch branch: git checkout feat/disable-development-features');
