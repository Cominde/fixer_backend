# Database Backup System

This system provides automated MongoDB database backups with cloud storage on Cloudinary (free tier).

## Features

- **Automated Daily Backups**: Scheduled to run daily at 2:00 AM
- **Cloudinary Storage**: Backups are stored securely on Cloudinary (free tier available)
- **Compression**: Backups are compressed to save storage space
- **Retention Policy**: Keeps the last 7 days of backups automatically
- **Manual Backup**: Can trigger backups manually
- **Restore Functionality**: Easy restore from any available backup

## Prerequisites

### MongoDB Tools
You must have MongoDB Database Tools installed on your system:
- `mongodump` - for creating backups
- `mongorestore` - for restoring backups

**Download**: https://www.mongodb.com/try/download/database-tools

### Cloudinary Account
You need a Cloudinary account (free tier available):
- Sign up at: https://cloudinary.com/users/register_free
- Get your Cloud Name, API Key, and API Secret from the dashboard

## Environment Variables

Add the following variables to your `.env` file:

```env
# MongoDB Connection
DB_URI=mongodb://username:password@host:port/database

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Timezone for scheduler (optional, default: Africa/Cairo)
TIMEZONE=Africa/Cairo
```

### Cloudinary Setup

1. **Create Cloudinary Account**:
   - Go to https://cloudinary.com/users/register_free
   - Sign up for free (no credit card required)
   - Free tier includes:
     - 25GB storage
     - 25GB bandwidth per month
     - 25 transformations per month
     - Sufficient for database backups

2. **Get Credentials**:
   - After signing up, go to Dashboard
   - Copy your:
     - **Cloud Name** (e.g., `abc123`)
     - **API Key** (e.g., `123456789012345`)
     - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
   - Add them to your `.env` file

3. **Create Folder (Optional)**:
   - Backups will be stored in `database_backups` folder automatically
   - You can view/manage backups in Cloudinary Media Library

## Usage

### Manual Backup

Run a backup immediately:

```bash
node scripts/backupDatabase.js
```

### Scheduled Backup

Start the backup scheduler (runs daily at 2:00 AM):

```bash
node scripts/backupScheduler.js
```

Run backup immediately with scheduler:

```bash
node scripts/backupScheduler.js --run-now
```

### List Available Backups

List all backups in S3:

```bash
node scripts/restoreDatabase.js
```

This will show:
- Backup filename
- Date/time of backup
- File size

### Restore Database

Restore from the most recent backup:

```bash
node scripts/restoreDatabase.js
```

### Restore from a specific backup (provide the Cloudinary public ID):

```bash
node scripts/restoreDatabase.js database_backups/your_database_backup_2024-08-16_02-00-00
```

## Integration with Main Application

To integrate the backup scheduler with your main application, add this to your `server.js`:

```javascript
// In production mode, start the backup scheduler
if (process.env.NODE_ENV === 'production') {
  require('./scripts/backupScheduler');
}
```

Or add to your `package.json` scripts:

```json
{
  "scripts": {
    "backup": "node scripts/backupDatabase.js",
    "restore": "node scripts/restoreDatabase.js",
    "backup:scheduler": "node scripts/backupScheduler.js"
  }
}
```

## Backup Structure

Backups are stored in Cloudinary with the following structure:

```
Cloudinary Media Library
└── database_backups/
    ├── your_database_backup_2024-08-16_02-00-00.zip
    ├── your_database_backup_2024-08-15_02-00-00.zip
    └── ...
```

Each backup file contains:
- Complete database dump
- All collections and documents
- Indexes

## Retention Policy

The system automatically:
- Keeps the last 7 days of backups
- Deletes older backups automatically after each new backup
- This can be changed by modifying `MAX_BACKUPS` in `backupDatabase.js`

## Security Considerations

- **Never commit `.env` file** to version control
- **Keep Cloudinary API Secret secure** - it provides full access to your account
- **Enable Cloudinary auto-upload moderation** if needed
- **Use separate Cloudinary account** for backups if possible
- **Regularly rotate API keys** for security

## Troubleshooting

### mongodump command not found
Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools

### Cloudinary credentials error
Verify your Cloudinary credentials in `.env` file:
- Cloud Name
- API Key
- API Secret

### Cloudinary upload failed
- Check your Cloudinary account has available storage (free tier: 25GB)
- Verify API Secret is correct
- Check Cloudinary service status

### Permission denied on restore
Ensure your MongoDB user has the necessary permissions to drop and restore collections

## Monitoring

The backup system logs all operations to the console:
- Backup start time
- Upload progress
- Success/failure status
- Cleanup operations

For production use, consider:
- Adding logging to a file
- Setting up alerts for failed backups
- Monitoring Cloudinary storage usage

## Cost Estimation

Cloudinary Free Tier (as of 2024):
- **Storage**: 25GB included
- **Bandwidth**: 25GB/month included
- **Transformations**: 25/month included
- **No credit card required**

Example: 7 backups of 100MB each = 700MB total (well within free tier)

If you exceed free tier limits:
- **Storage**: ~$0.015/GB/month
- **Bandwidth**: ~$0.09/GB
- Still very cost-effective for database backups
