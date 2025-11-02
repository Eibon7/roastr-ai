const ExportCleanupWorker = require('../../../src/workers/ExportCleanupWorker');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

jest.mock('../../../src/services/emailService', () => ({
    sendExportFileDeletionNotification: jest.fn(),
    sendExportFileCleanupNotification: jest.fn()
}));

const emailService = require('../../../src/services/emailService');

describe('ExportCleanupWorker - Issue #116', () => {
    let worker;
    let mockExportDir;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup temporary test directory
        mockExportDir = path.join(process.cwd(), 'test-temp-exports');
        
        worker = new ExportCleanupWorker({
            maxRetries: 1,
            pollInterval: 100
        });
        
        worker.exportDir = mockExportDir;
        
        // Reset global download tokens
        global.downloadTokens = new Map();
    });

    afterEach(async () => {
        if (worker && worker.isRunning) {
            await worker.stop();
        }
        
        // Clean up test directory
        try {
            const files = await fs.readdir(mockExportDir);
            for (const file of files) {
                await fs.unlink(path.join(mockExportDir, file));
            }
            await fs.rmdir(mockExportDir);
        } catch (error) {
            // Directory might not exist
        }
    });

    describe('Constructor', () => {
        test('should initialize with correct worker type and retention rules', () => {
            expect(worker.workerType).toBe('export-cleanup');
            expect(worker.isRunning).toBe(false);
            expect(worker.retentionRules.maxAgeAfterCreation).toBe(24 * 60 * 60 * 1000);
            expect(worker.retentionRules.maxAgeAfterDownload).toBe(60 * 60 * 1000);
        });

        test('should merge provided retention configuration', () => {
            const customWorker = new ExportCleanupWorker({
                scanInterval: 5000,
                maxAgeAfterCreation: 2 * 60 * 60 * 1000,
                maxAgeAfterDownload: 30 * 60 * 1000
            });

            expect(customWorker.retentionRules.scanInterval).toBe(5000);
            expect(customWorker.retentionRules.maxAgeAfterCreation).toBe(2 * 60 * 60 * 1000);
            expect(customWorker.retentionRules.maxAgeAfterDownload).toBe(30 * 60 * 1000);
        });
    });

    describe('Token Cleanup', () => {
        test('should clean up expired download tokens', async () => {
            const now = Date.now();
            const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
            
            // Setup expired tokens
            global.downloadTokens.set('token1', {
                filepath: path.join(mockExportDir, 'file1.zip'),
                filename: 'file1.zip',
                expiresAt: expiredTime,
                createdAt: expiredTime
            });

            const tokensCleanedUp = await worker.cleanupExpiredTokens();

            expect(tokensCleanedUp).toBe(1);
            expect(global.downloadTokens.has('token1')).toBe(false);
        });
    });

    describe('File Deletion Logic', () => {
        test('shouldDeleteFile should correctly identify old files', async () => {
            await fs.mkdir(mockExportDir, { recursive: true });
            
            const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
            const oldFile = path.join(mockExportDir, 'old-file.zip');
            
            await fs.writeFile(oldFile, 'test');
            await fs.utimes(oldFile, new Date(oldTime), new Date(oldTime));

            const result = await worker.shouldDeleteFile(oldFile, 'old-file.zip');

            expect(result.delete).toBe(true);
            expect(result.reason).toBe('exceeded_max_age');
        });

        test('shouldDeleteFile should keep recent files', async () => {
            await fs.mkdir(mockExportDir, { recursive: true });
            
            const recentTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
            const recentFile = path.join(mockExportDir, 'recent-file.zip');
            
            await fs.writeFile(recentFile, 'test');
            await fs.utimes(recentFile, new Date(recentTime), new Date(recentTime));

            const result = await worker.shouldDeleteFile(recentFile, 'recent-file.zip');

            expect(result.delete).toBe(false);
            expect(result.reason).toBe('within_retention_period');
        });

        test('deleting a file also removes its download token', async () => {
            await fs.mkdir(mockExportDir, { recursive: true });

            const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
            const filename = 'user-data-export-abc-123.zip';
            const filepath = path.join(mockExportDir, filename);

            await fs.writeFile(filepath, 'test');
            await fs.utimes(filepath, new Date(oldTime), new Date(oldTime));

            global.downloadTokens.set('token123', {
                filepath,
                filename,
                expiresAt: Date.now() + (60 * 60 * 1000),
                createdAt: Date.now()
            });

            const results = await worker.scanAndCleanupFiles();

            expect(results.deleted).toBe(1);
            expect(results.tokensCleanedUp).toBe(1);
            expect(global.downloadTokens.has('token123')).toBe(false);
        });
    });

    describe('Worker Status', () => {
        test('should return comprehensive status information', () => {
            const status = worker.getStatus();

            expect(status).toHaveProperty('workerName');
            expect(status).toHaveProperty('workerType', 'export-cleanup');
            expect(status).toHaveProperty('retentionRules');
            expect(status).toHaveProperty('statistics');
        });
    });

    describe('Integration', () => {
        test('should perform complete cleanup scan without errors', async () => {
            await worker.performCleanupScan();
            expect(worker.cleanupStats.lastRunAt).toBeTruthy();
        });
    });
});