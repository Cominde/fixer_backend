require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_FOLDER = 'database_backups';

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * List available backups in Cloudinary
 */
async function listCloudinaryBackups() {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: BACKUP_FOLDER,
      max_results: 100,
    });
    
    const backups = result.resources || [];
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return backups.map(backup => ({
      publicId: backup.public_id,
      fileName: backup.public_id.split('/').pop(),
      createdAt: backup.created_at,
      bytes: backup.bytes,
      secureUrl: backup.secure_url,
    }));
  } catch (error) {
    console.error('Error listing Cloudinary backups:', error);
    throw error;
  }
}

/**
 * Download backup file from Cloudinary
 */
async function downloadFromCloudinary(secureUrl) {
  try {
    const fileName = secureUrl.split('/').pop();
    const downloadPath = path.join(BACKUP_DIR, fileName);
    
    console.log(`Downloading backup from Cloudinary to: ${downloadPath}`);
    
    const response = await axios({
      method: 'GET',
      url: secureUrl,
      responseType: 'stream',
    });

    const writeStream = createWriteStream(downloadPath);
    await pipeline(response.data, writeStream);
    
    console.log(`Downloaded backup to: ${downloadPath}`);
    
    return downloadPath;
  } catch (error) {
    console.error('Error downloading from Cloudinary:', error);
    throw error;
  }
}

/**
 * Extract zip file
 */
function extractZip(zipPath) {
  return new Promise((resolve, reject) => {
    const extractPath = path.join(BACKUP_DIR, 'temp_restore');
    
    // Create temp directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    const command = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`;
    
    console.log(`Extracting ${zipPath} to ${extractPath}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Extract error:', error);
        return reject(error);
      }
      if (stderr) {
        console.error('Extract stderr:', stderr);
        return reject(new Error(stderr));
      }
      console.log('Extract stdout:', stdout);
      resolve(extractPath);
    });
  });
}

/**
 * Execute mongorestore to restore MongoDB database
 */
function executeMongorestore(backupPath) {
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

    let mongorestoreCommand = `mongorestore --host=${host} --port=${port} --db=${dbName} --drop "${backupPath}/${dbName}"`;

    // Add authentication if credentials exist
    if (username && password) {
      mongorestoreCommand = `mongorestore --host=${host} --port=${port} --db=${dbName} --username="${username}" --password="${password}" --drop "${backupPath}/${dbName}"`;
    }

    console.log(`Starting MongoDB restore from: ${backupPath}`);
    console.log(`Command: ${mongorestoreCommand}`);

    exec(mongorestoreCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('mongorestore error:', error);
        return reject(error);
      }
      if (stderr) {
        console.error('mongorestore stderr:', stderr);
        return reject(new Error(stderr));
      }
      console.log('mongorestore stdout:', stdout);
      resolve();
    });
  });
}

/**
 * Clean up temporary files
 */
function cleanupTempFiles(zipPath, extractPath) {
  try {
    // Remove the zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      console.log(`Removed zip file: ${zipPath}`);
    }

    // Remove the extracted directory
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      console.log(`Removed temp directory: ${extractPath}`);
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
}

/**
 * Main restore function
 */
async function restoreDatabase(backupPublicId = null) {
  const moment = require('moment');
  console.log('=== Starting Database Restore ===');
  console.log(`Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

  let zipPath = null;
  let extractPath = null;

  try {
    // Step 1: List available backups if no specific publicId provided
    if (!backupPublicId) {
      const backups = await listCloudinaryBackups();
      
      if (backups.length === 0) {
        throw new Error('No backups found in Cloudinary');
      }

      console.log('Available backups:');
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.fileName} - ${moment(backup.createdAt).format('YYYY-MM-DD HH:mm:ss')} - ${(backup.bytes / 1024 / 1024).toFixed(2)} MB`);
      });

      // Use the most recent backup
      backupPublicId = backups[0].publicId;
      console.log(`Using most recent backup: ${backups[0].fileName}`);
    }

    // Get the backup details to find the secure URL
    const backups = await listCloudinaryBackups();
    const selectedBackup = backups.find(b => b.publicId === backupPublicId);
    
    if (!selectedBackup) {
      throw new Error(`Backup not found: ${backupPublicId}`);
    }

    // Step 2: Download backup from Cloudinary
    zipPath = await downloadFromCloudinary(selectedBackup.secureUrl);

    // Step 3: Extract zip file
    extractPath = await extractZip(zipPath);

    // Step 4: Find the database backup directory
    const dbBackupPath = path.join(extractPath, 'backup_' + selectedBackup.fileName.replace('.zip', ''));
    
    if (!fs.existsSync(dbBackupPath)) {
      // Try alternative path structure
      const dirs = fs.readdirSync(extractPath);
      if (dirs.length > 0) {
        dbBackupPath = path.join(extractPath, dirs[0]);
      }
    }

    if (!fs.existsSync(dbBackupPath)) {
      throw new Error(`Could not find database backup directory in: ${extractPath}`);
    }

    // Step 5: Execute mongorestore
    await executeMongorestore(dbBackupPath);

    // Step 6: Cleanup temp files
    cleanupTempFiles(zipPath, extractPath);

    console.log('=== Restore Completed Successfully ===');
    
    return { success: true };
  } catch (error) {
    console.error('=== Restore Failed ===');
    console.error(error);
    
    // Cleanup on error
    if (zipPath) cleanupTempFiles(zipPath, extractPath);
    
    throw error;
  }
}

// Run restore if this script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const backupPublicId = args[0] || null; // Optional: pass specific backup publicId as argument

  restoreDatabase(backupPublicId)
    .then(() => {
      console.log('Restore process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Restore process failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreDatabase, listCloudinaryBackups };
