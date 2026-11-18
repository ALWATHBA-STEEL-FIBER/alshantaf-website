import fs from "node:fs";

/**
 * Optional Google Drive backup.
 * Configure:
 *   GOOGLE_DRIVE_FOLDER_ID=...
 *   GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account",...}'
 * or GOOGLE_DRIVE_CREDENTIALS_FILE=/path/to/service-account.json
 *
 * Without credentials this is a no-op.
 */

export function driveConfigured(): boolean {
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folder) return false;
  if (process.env.GOOGLE_DRIVE_CREDENTIALS_JSON?.trim()) return true;
  const file = process.env.GOOGLE_DRIVE_CREDENTIALS_FILE?.trim();
  return Boolean(file && fs.existsSync(file));
}

function loadCredentials(): object | null {
  const raw = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw) as object;
    } catch {
      return null;
    }
  }
  const file = process.env.GOOGLE_DRIVE_CREDENTIALS_FILE?.trim();
  if (file && fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as object;
    } catch {
      return null;
    }
  }
  return null;
}

export async function upsertProjectWorkbookToDrive(opts: {
  localPath: string;
  filename: string;
  existingFileId?: string | null;
}): Promise<string | null> {
  if (!driveConfigured()) return opts.existingFileId || null;
  const credentials = loadCredentials();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!credentials || !folderId) return opts.existingFileId || null;

  try {
    // Dynamic import so the package is optional until installed/configured.
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: credentials as Record<string, string>,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });
    const media = {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: fs.createReadStream(opts.localPath),
    };

    if (opts.existingFileId) {
      await drive.files.update({
        fileId: opts.existingFileId,
        media,
        supportsAllDrives: true,
      });
      return opts.existingFileId;
    }

    const created = await drive.files.create({
      requestBody: {
        name: opts.filename,
        parents: [folderId],
      },
      media,
      fields: "id",
      supportsAllDrives: true,
    });
    return created.data.id || null;
  } catch (err) {
    console.error("[site-work] Google Drive sync failed:", err);
    return opts.existingFileId || null;
  }
}
