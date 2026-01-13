# Terraform Backend State Setup

This directory contains the Terraform configuration for creating the S3 bucket that will store the Terraform state for the realtime-chat-app infrastructure.

## Purpose

The S3 backend state bucket is a **prerequisite** that must be created before running the main infrastructure Terraform configuration. This bucket stores the state file, which tracks all infrastructure resources created by Terraform.

## Features

- **Encryption**: Server-side encryption (AES256) enabled by default
- **Versioning**: Enabled for state file history and recovery
- **Public Access Blocking**: All public access is blocked
- **Audit Logging**: S3 access logs are stored in the bucket (logs/ prefix)
- **Lifecycle Management**: Old logs are automatically deleted after 90 days
- **Secure Transport**: Enforces HTTPS/SSL for all requests
- **Unencrypted Upload Prevention**: Denies any unencrypted uploads to the bucket

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform installed (>= 1.0)
- AWS account with appropriate permissions to create S3 buckets

## Usage

### Step 1: Initialize and Create the State Bucket

```bash
cd terraform-state
terraform init
terraform plan
terraform apply
```

### Step 2: Verify Bucket Creation

```bash
aws s3 ls | grep itm350-realtime-chat-app-tf-state-roger-jan
```

### Step 3: Return to Main Infrastructure Directory

Once the state bucket is created, proceed to the parent `infrastructure/` directory and configure the backend before running the main configuration:

```bash
cd ..
terraform init
```

Terraform will prompt you to migrate the state to the S3 backend. Accept the migration.

## Variables

The following variables can be customized:

| Variable            | Description                          | Default                             |
| ------------------- | ------------------------------------ | ----------------------------------- |
| `aws_region`        | AWS region for the S3 bucket         | `us-west-2`                         |
| `state_bucket_name` | Name of the S3 bucket                | `itm350-realtime-chat-app-tf-state` |
| `enable_versioning` | Enable S3 versioning                 | `true`                              |
| `enable_encryption` | Enable server-side encryption        | `true`                              |
| `enable_mfa_delete` | Require MFA to delete objects        | `false`                             |
| `force_destroy`     | Allow destroying bucket with objects | `false`                             |
| `tags`              | Common tags for resources            | Project-specific tags               |

### Override Variables

Create a `terraform.tfvars` file to override defaults:

```hcl
aws_region          = "us-west-2"
state_bucket_name   = "my-custom-bucket-name"
enable_versioning   = true
enable_mfa_delete   = false
```

## Outputs

After applying this configuration, the following outputs are provided:

- `state_bucket_name`: The name of the created S3 bucket
- `state_bucket_arn`: The ARN of the S3 bucket
- `state_bucket_region`: The region where the bucket is located
- `terraform_backend_config`: The backend configuration block to use in your main Terraform configuration

## Important Notes

1. **Bucket Naming**: S3 bucket names are globally unique. If the default name is already taken, provide a custom name via `terraform.tfvars`
2. **State Lock**: DynamoDB table for state locking is created automatically by Terraform when using the S3 backend with `use_lockfile = true`
3. **Credentials**: Ensure your AWS credentials are configured before running Terraform
4. **Cost**: S3 storage and DynamoDB for state locking have minimal cost, but ensure you understand AWS pricing

## Cleanup

To destroy the state bucket (use with caution):

```bash
terraform destroy
```

**Warning**: This will delete the bucket. Only do this if you're sure you want to remove the state storage infrastructure.

## Troubleshooting

### "Bucket already exists"

S3 bucket names are globally unique. Choose a different name in `terraform.tfvars`.

### "Access Denied" error

Ensure your AWS credentials have permissions to create S3 buckets and are configured properly.

### State migration issues

If you've already initialized Terraform in the parent directory, you may need to:

1. Remove the local `.terraform` directory
2. Remove `terraform.tfstate` and `terraform.tfstate.backup` files
3. Re-run `terraform init`
