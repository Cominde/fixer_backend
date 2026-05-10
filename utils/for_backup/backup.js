const { exec } = require("child_process");
const fs = require("fs");
const drive = require("./drive"); // ✅ this is the google drive client

const runBackup = async () => {
  const fileName = `backup-${Date.now()}.gz`;

  console.log("🚀 Starting backup...");

  exec(
    `mongodump --uri="${process.env.DB_URL}" --archive=${fileName} --gzip`,
    async (err) => {
      if (err) {
        console.error("❌ Backup failed:", err);
        return;
      }

      console.log("📦 Backup created");

      try {
        await drive.files.create({
          // ✅ drive already IS the google drive client
          requestBody: {
            name: fileName,
            parents: [process.env.FOLDER_ID],
          },
          media: {
            mimeType: "application/gzip", // ✅ ADD THIS — was missing
            body: fs.createReadStream(fileName),
          },
        });

        console.log("☁️ Uploaded to Google Drive");

        fs.unlinkSync(fileName);
        console.log("🧹 Local file deleted");
      } catch (uploadErr) {
        console.error("❌ Upload failed:", uploadErr);
      }
    },
  );
};

module.exports = runBackup;
