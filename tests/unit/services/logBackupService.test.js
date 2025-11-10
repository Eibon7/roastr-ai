/**
 * Log Backup Service Tests
 * 
 * Tests for log backup functionality including:
 * - S3 configuration and initialization
 * - File upload and download operations
 * - Backup scheduling and retention
 * - Error handling and retry mechanisms
 * - Mock mode compatibility
 */

const fs = require('fs-extra');
const path = require('path');
const AWS = require('aws-sdk');
const LogBackupService = require('../../../src/services/logBackupService');

// Mock dependencies
jest.mock('aws-sdk');
jest.mock('fs-extra');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(() => ({
    on: jest.fn((event, handler) => {
      // Don't call error handler by default
    })
  }))
}));
jest.mock('../../../src/utils/advancedLogger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  queueLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('LogBackupService', () => {
  let logBackupService;
  let mockS3;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.LOG_BACKUP_S3_BUCKET = 'test-bucket';
    process.env.LOG_BACKUP_S3_PREFIX = 'test-logs';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    // Mock S3
    mockS3 = {
      upload: jest.fn(),
      listObjectsV2: jest.fn(),
      deleteObjects: jest.fn(),
      getObject: jest.fn(),
      headBucket: jest.fn()
    };
    
    AWS.S3.mockImplementation(() => mockS3);
    
    // Mock fs-extra
    fs.stat = jest.fn();
    fs.ensureDir = jest.fn();
    fs.readdir = jest.fn();
    fs.writeFile = jest.fn();
    
    logBackupService = new LogBackupService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(logBackupService.bucketName).toBe('test-bucket');
      expect(logBackupService.backupPrefix).toBe('test-logs');
      expect(logBackupService.region).toBe('us-east-1');
      expect(logBackupService.retryConfig).toEqual({
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2
      });
    });

    test('should initialize S3 client when credentials are available', () => {
      expect(AWS.S3).toHaveBeenCalled();
      expect(logBackupService.s3).toBe(mockS3);
    });

    test('should handle missing S3 configuration gracefully', () => {
      delete process.env.LOG_BACKUP_S3_BUCKET;
      const service = new LogBackupService();
      expect(service.bucketName).toBeUndefined();
    });
  });

  describe('isBackupEnabled', () => {
    test('should return true when S3 is properly configured', () => {
      expect(logBackupService.isBackupEnabled()).toBe(true);
    });

    test('should return false when bucket name is missing', () => {
      logBackupService.bucketName = null;
      expect(logBackupService.isBackupEnabled()).toBe(false);
    });

    test('should return false when S3 client is not initialized', () => {
      logBackupService.s3 = null;
      expect(logBackupService.isBackupEnabled()).toBe(false);
    });
  });

  describe('uploadFileToS3', () => {
    beforeEach(() => {
      fs.stat.mockResolvedValue({ size: 1024 });
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test-bucket.s3.amazonaws.com/test-key',
          ETag: '"test-etag"'
        })
      });
    });

    test('should upload file to S3 successfully', async () => {
      const filePath = '/test/logs/app.log';
      const s3Key = 'test-logs/2024-01-01/app.log';
      const metadata = { logType: 'application' };

      const result = await logBackupService.uploadFileToS3(filePath, s3Key, metadata);

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: s3Key,
          ContentType: 'text/plain',
          ContentEncoding: 'gzip',
          StorageClass: 'STANDARD_IA',
          ServerSideEncryption: 'AES256',
          Metadata: expect.objectContaining({
            originalSize: '1024',
            service: 'roastr-ai',
            ...metadata
          })
        })
      );
      
      // S3 returns Location and ETag (capitalized)
      expect(result.Location).toBe('https://test-bucket.s3.amazonaws.com/test-key');
      expect(result.ETag).toBe('"test-etag"');
    });

    test('should handle upload errors with retry', async () => {
      const error = new Error('Network error');
      error.code = 'RequestTimeout'; // Make it retryable
      
      // Mock fs.stat for file size
      fs.stat.mockResolvedValue({ size: 1024 });

      // Mock S3 upload with retry behavior - fail twice, succeed on third attempt
      let attemptCount = 0;
      mockS3.upload.mockImplementation(() => {
        attemptCount++;
        const promiseFn = jest.fn();
        
        if (attemptCount <= 2) {
          promiseFn.mockRejectedValue(error);
        } else {
          promiseFn.mockResolvedValue({ 
            Location: 'https://test-bucket.s3.amazonaws.com/test-key',
            ETag: '"success-etag"'
          });
        }
        
        return { promise: promiseFn };
      });

      const result = await logBackupService.uploadFileToS3('/test/file.log', 'test-key');
      
      // Verify retry was attempted (should be called 3 times due to retry logic)
      expect(mockS3.upload).toHaveBeenCalledTimes(3);
      expect(result.Location).toBe('https://test-bucket.s3.amazonaws.com/test-key');
      expect(result.ETag).toBe('"success-etag"');
    });

    test('should fail after max retries', async () => {
      const error = new Error('Persistent error');
      error.code = 'RequestTimeout'; // Make it retryable
      
      // Mock fs.stat for file size
      fs.stat.mockResolvedValue({ size: 1024 });

      // Mock S3 upload to always fail
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });

      await expect(
        logBackupService.uploadFileToS3('/test/file.log', 'test-key')
      ).rejects.toThrow('Persistent error');
      
      // Should be called 3 times (maxRetries)
      expect(mockS3.upload).toHaveBeenCalledTimes(3);
    });
  });

  describe('backupLogsForDate', () => {
    beforeEach(() => {
      fs.readdir.mockResolvedValue(['app.log', 'error.log']);
      fs.stat.mockResolvedValue({ size: 1024, isFile: () => true });
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Location: 'success', ETag: 'success' })
      });
    });

    test('should backup logs for specific date', async () => {
      const targetDate = new Date('2024-01-01');
      
      const result = await logBackupService.backupLogsForDate(targetDate, {
        includeDirectories: ['application']
      });

      expect(result.uploaded).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.totalSize).toBe(2048);
    });

    test('should perform dry run without uploading', async () => {
      const targetDate = new Date('2024-01-01');
      
      const result = await logBackupService.backupLogsForDate(targetDate, {
        dryRun: true,
        includeDirectories: ['application']
      });

      expect(result.uploaded).toHaveLength(2);
      expect(result.uploaded[0].dryRun).toBe(true);
      expect(mockS3.upload).not.toHaveBeenCalled();
    });

    test('should skip existing files when skipExisting is true', async () => {
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockRejectedValue({ code: 'NoSuchKey' })
      });

      const targetDate = new Date('2024-01-01');
      const result = await logBackupService.backupLogsForDate(targetDate, {
        skipExisting: true,
        includeDirectories: ['application']
      });

      expect(result.skipped).toHaveLength(2);
    });

    test('should validate date range', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      await expect(
        logBackupService.backupLogsForDate(futureDate)
      ).rejects.toThrow('targetDate cannot be in the future');

      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 11);

      await expect(
        logBackupService.backupLogsForDate(oldDate)
      ).rejects.toThrow('targetDate cannot be more than 10 years in the past');
    });

    test('should require S3 configuration for non-dry runs', async () => {
      logBackupService.bucketName = null;

      await expect(
        logBackupService.backupLogsForDate(new Date('2024-01-01'))
      ).rejects.toThrow('S3 backup is not configured');
    });
  });

  describe('listBackups', () => {
    test('should list backups from S3', async () => {
      mockS3.listObjectsV2.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Contents: [
            {
              Key: 'test-logs/2024-01-01/app.log',
              LastModified: new Date('2024-01-01'),
              Size: 1024
            }
          ]
        })
      });

      const result = await logBackupService.listBackups();

      expect(result.backups).toHaveLength(1);
      expect(result.backups[0]).toEqual({
        key: 'test-logs/2024-01-01/app.log',
        lastModified: new Date('2024-01-01'),
        size: 1024,
        sizeFormatted: '1.00 KB'
      });
    });

    test('should filter backups by date', async () => {
      mockS3.listObjectsV2.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Contents: [
            { Key: 'test-logs/2024-01-01/app.log', LastModified: new Date(), Size: 1024 },
            { Key: 'test-logs/2024-01-02/app.log', LastModified: new Date(), Size: 1024 }
          ]
        })
      });

      const result = await logBackupService.listBackups({ date: '2024-01-01' });

      expect(mockS3.listObjectsV2).toHaveBeenCalledWith(
        expect.objectContaining({
          Prefix: 'test-logs/2024-01-01/'
        })
      );
    });
  });
});
