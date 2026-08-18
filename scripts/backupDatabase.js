require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const moment = require('moment');

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BACKUP_DIR = path.join(__dirname, '../backups');
const MAX_BACKUPS = 7; // Keep last 7 days of backups
const BACKUP_FOLDER = 'database_backups';

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Execute mongodump to backup MongoDB database
 */
function executeMongodump() {
  return new Promise((resolve, reject) => {
    const dbUri = process.env.DB_URI;
    if (!dbUri) {
      return reject(new Error('DB_URI not found in environment variables'));
    }

    // Parse connection string to extract host, port, database name
    const url = new URL(dbUri);
    const host = url.hostname;
    const port = url.port || '27017';
    const dbName = url.pathname.substring(1); // Remove leading slash
    const username = url.username;
    const password = url.password;

    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}`);

    let mongodumpCommand = `mongodump --host=${host} --port=${port} --db=${dbName} --out="${backupPath}"`;

    // Add authentication if credentials exist
    if (username && password) {
      mongodumpCommand = `mongodump --host=${host} --port=${port} --db=${dbName} --username="${username}" --password="${password}" --out="${backupPath}"`;
    }

    console.log(`Starting MongoDB backup to: ${backupPath}`);
    console.log(`Command: ${mongodumpCommand}`);

    exec(mongodumpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('mongodump error:', error);
        return reject(error);
      }
      if (stderr) {
        console.error('mongodump stderr:', stderr);
        return reject(new Error(stderr));
      }
      console.log('mongodump stdout:', stdout);
      resolve({ backupPath, timestamp, dbName });
    });
  });
}

/**
 * Compress backup directory to a zip file
 */
function compressBackup(backupPath, timestamp) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(BACKUP_DIR, `backup_${timestamp}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Backup compressed: ${archive.pointer()} bytes`);
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(backupPath, false);
    archive.finalize();
  });
}

/**
 * Upload backup file to Cloudinary
 */
async function uploadToCloudinary(filePath, timestamp, dbName) {
  const fileName = `${dbName}_backup_${timestamp}.zip`;
  const publicId = `${BACKUP_FOLDER}/${dbName}_backup_${timestamp}`;

  console.log(`Uploading ${fileName} to Cloudinary`);

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw',
      public_id: publicId,
      folder: BACKUP_FOLDER,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    console.log(`Successfully uploaded ${fileName} to Cloudinary`);
    console.log(`Public ID: ${result.public_id}`);
    console.log(`Secure URL: ${result.secure_url}`);
    
    return { 
      publicId: result.public_id, 
      fileName,
      secureUrl: result.secure_url,
      resourceType: result.resource_type
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

/**
 * Clean up local backup files
 */
function cleanupLocalFiles(backupPath, zipPath) {
  try {
    // Remove the backup directory
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
      console.log(`Removed backup directory: ${backupPath}`);
    }

    // Remove the zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      console.log(`Removed zip file: ${zipPath}`);
    }
  } catch (error) {
    console.error('Error cleaning up local files:', error);
  }
}

/**
 * List existing backups in Cloudinary
 */
async function listCloudinaryBackups() {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: BACKUP_FOLDER,
      max_results: 100,
    });
    
    return result.resources || [];
  } catch (error) {
    console.error('Error listing Cloudinary backups:', error);
    return [];
  }
}

/**
 * Delete old backups from Cloudinary (keep only MAX_BACKUPS)
 */
async function cleanupOldBackups() {
  try {
    const backups = await listCloudinaryBackups();
    
    if (backups.length <= MAX_BACKUPS) {
      console.log(`No cleanup needed. Current backups: ${backups.length}, Max: ${MAX_BACKUPS}`);
      return;
    }

    // Sort by creation date (oldest first)
    backups.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Delete oldest backups
    const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
    
    for (const backup of toDelete) {
      await cloudinary.uploader.destroy(backup.public_id, {
        resource_type: 'raw',
      });
      console.log(`Deleted old backup: ${backup.public_id}`);
    }

    console.log(`Cleaned up ${toDelete.length} old backups`);
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }
}

/**
 * Main backup function
 */
async function backupDatabase() {
  console.log('=== Starting Database Backup ===');
  console.log(`Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

  try {
    // Step 1: Execute mongodump
    const { backupPath, timestamp, dbName } = await executeMongodump();

    // Step 2: Compress backup
    const zipPath = await compressBackup(backupPath, timestamp);

    // Step 3: Upload to Cloudinary
    const { publicId, fileName, secureUrl } = await uploadToCloudinary(zipPath, timestamp, dbName);

    // Step 4: Cleanup local files
    cleanupLocalFiles(backupPath, zipPath);

    // Step 5: Cleanup old Cloudinary backups
    await cleanupOldBackups();

    console.log('=== Backup Completed Successfully ===');
    console.log(`Backup file: ${fileName}`);
    console.log(`Cloudinary Public ID: ${publicId}`);
    console.log(`Secure URL: ${secureUrl}`);
    
    return { success: true, publicId, fileName, secureUrl };
  } catch (error) {
    console.error('=== Backup Failed ===');
    console.error(error);
    throw error;
  }
}

// Run backup if this script is executed directly
if (require.main === module) {
  backupDatabase()
    .then(() => {
      console.log('Backup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backup process failed:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase };
