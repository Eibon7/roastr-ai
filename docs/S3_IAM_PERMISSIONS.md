# S3 IAM Permissions for Log Backup System

This document outlines the required AWS IAM permissions for the log backup and rotation system to function properly.

## Overview

The log backup system requires specific IAM permissions to interact with AWS S3 for backing up, listing, and cleaning up log files. These permissions follow the principle of least privilege to ensure security while maintaining functionality.

## Required Environment Variables

Before configuring IAM permissions, ensure these environment variables are set:

```bash
# Required for S3 backup functionality
LOG_BACKUP_S3_BUCKET=your-backup-bucket-name
LOG_BACKUP_S3_PREFIX=roastr-ai-logs  # Optional, defaults to 'roastr-ai-logs'
AWS_REGION=us-east-1                 # Optional, defaults to 'us-east-1'

# AWS Credentials (choose one method)
# Method 1: Environment Variables
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Method 2: IAM Role (recommended for EC2/ECS)
# No additional variables needed if using IAM roles

# Method 3: AWS Profile
AWS_PROFILE=your-profile-name
```

## Required IAM Permissions

### Minimum Required Policy

Create an IAM policy with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LogBackupBasicOperations",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": ["arn:aws:s3:::your-backup-bucket-name/*"]
    },
    {
      "Sid": "LogBackupListOperations",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::your-backup-bucket-name"]
    }
  ]
}
```

### Enhanced Policy with Additional Security

For production environments, consider this more comprehensive policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LogBackupRestrictedOperations",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": ["arn:aws:s3:::your-backup-bucket-name/roastr-ai-logs/*"],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-storage-class": "STANDARD_IA"
        }
      }
    },
    {
      "Sid": "LogBackupListWithPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::your-backup-bucket-name"],
      "Condition": {
        "StringLike": {
          "s3:prefix": "roastr-ai-logs/*"
        }
      }
    },
    {
      "Sid": "LogBackupEncryption",
      "Effect": "Allow",
      "Action": ["s3:PutObjectAcl"],
      "Resource": ["arn:aws:s3:::your-backup-bucket-name/roastr-ai-logs/*"],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

## Permission Breakdown

### Core Permissions

| Permission        | Purpose                                | Required |
| ----------------- | -------------------------------------- | -------- |
| `s3:PutObject`    | Upload log files to S3                 | Yes      |
| `s3:GetObject`    | Download backup files for restoration  | Yes      |
| `s3:DeleteObject` | Remove old backups during cleanup      | Yes      |
| `s3:HeadObject`   | Check if files exist, verify integrity | Yes      |
| `s3:ListBucket`   | List existing backups, enumerate files | Yes      |

### Optional Permissions

| Permission               | Purpose                   | When Needed                |
| ------------------------ | ------------------------- | -------------------------- |
| `s3:PutObjectAcl`        | Set object access control | When using custom ACLs     |
| `s3:GetBucketLocation`   | Verify bucket region      | Cross-region operations    |
| `s3:GetBucketVersioning` | Check versioning status   | When versioning is enabled |

## IAM Role Setup (Recommended)

For applications running on AWS infrastructure (EC2, ECS, Lambda), use IAM roles:

### 1. Create IAM Role

```bash
aws iam create-role \
  --role-name roastr-ai-log-backup-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ec2.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'
```

### 2. Create and Attach Policy

```bash
# Create policy from JSON file
aws iam create-policy \
  --policy-name roastr-ai-log-backup-policy \
  --policy-document file://log-backup-policy.json

# Attach policy to role
aws iam attach-role-policy \
  --role-name roastr-ai-log-backup-role \
  --policy-arn arn:aws:iam::YOUR-ACCOUNT-ID:policy/roastr-ai-log-backup-policy
```

### 3. Create Instance Profile

```bash
# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name roastr-ai-log-backup-profile

# Add role to instance profile
aws iam add-role-to-instance-profile \
  --instance-profile-name roastr-ai-log-backup-profile \
  --role-name roastr-ai-log-backup-role
```

## IAM User Setup (Alternative)

For applications not running on AWS infrastructure:

### 1. Create IAM User

```bash
aws iam create-user --user-name roastr-ai-log-backup-user
```

### 2. Attach Policy

```bash
aws iam attach-user-policy \
  --user-name roastr-ai-log-backup-user \
  --policy-arn arn:aws:iam::YOUR-ACCOUNT-ID:policy/roastr-ai-log-backup-policy
```

### 3. Create Access Keys

```bash
aws iam create-access-key --user-name roastr-ai-log-backup-user
```

## S3 Bucket Configuration

### Required Bucket Settings

1. **Bucket Policy** (optional, for additional security):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RestrictToLogBackupPrefix",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:role/roastr-ai-log-backup-role"
      },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-backup-bucket-name/roastr-ai-logs/*"
    }
  ]
}
```

2. **Lifecycle Configuration** (recommended for cost optimization):

```json
{
  "Rules": [
    {
      "ID": "LogBackupLifecycle",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "roastr-ai-logs/"
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
```

## Security Best Practices

### 1. Principle of Least Privilege

- Only grant permissions necessary for log backup operations
- Use resource-level restrictions when possible
- Implement condition-based access controls

### 2. Access Key Management

- Rotate access keys regularly (every 90 days)
- Never commit access keys to version control
- Use AWS Secrets Manager or similar for key storage

### 3. Monitoring and Auditing

- Enable CloudTrail for S3 API logging
- Set up CloudWatch alerts for unusual S3 activity
- Monitor backup operation success/failure rates

### 4. Network Security

- Use VPC endpoints for S3 when possible
- Implement bucket policies to restrict IP access
- Enable S3 server-side encryption

## Validation

To validate your IAM configuration, the log backup service will check:

1. S3 bucket accessibility
2. Required permissions during startup
3. Credential validity

Monitor the application logs for any permission-related errors during startup:

```
INFO: S3 backup configuration validated { bucket: "your-bucket", region: "us-east-1", prefix: "roastr-ai-logs" }
ERROR: S3 backup is enabled but AWS credentials are not configured
```

## Troubleshooting

### Common Issues

1. **Access Denied Errors**
   - Verify IAM policy includes all required permissions
   - Check bucket name matches environment variable
   - Ensure prefix restrictions allow the configured prefix

2. **Credential Issues**
   - Validate AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
   - For IAM roles, verify instance profile is attached
   - Check AWS region configuration

3. **Bucket Access Issues**
   - Verify bucket exists in the specified region
   - Check bucket policies don't conflict with IAM permissions
   - Ensure bucket name is correctly configured

### Debug Commands

```bash
# Test S3 access
aws s3 ls s3://your-backup-bucket-name/roastr-ai-logs/

# Test upload permission
echo "test" | aws s3 cp - s3://your-backup-bucket-name/roastr-ai-logs/test.txt

# Test delete permission
aws s3 rm s3://your-backup-bucket-name/roastr-ai-logs/test.txt
```

## Related Documentation

- [Log Retention Policy](LOG_RETENTION_POLICY.md)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
