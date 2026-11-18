import fs from "node:fs";
import path from "node:path";

/** Root for site-work Excel files (bind-mounted on VPS uploads/data). */
export function siteWorkDataDir(): string {
  const fromEnv = process.env.SITE_WORK_DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.resolve(__dirname, "../../data/site-work");
}

export function siteWorkProjectsDir(): string {
  return path.join(siteWorkDataDir(), "projects");
}

export function siteWorkSourceDir(): string {
  return path.join(siteWorkDataDir(), "source");
}

export function siteWorkTemplatePath(): string {
  return path.join(siteWorkDataDir(), "template.xlsx");
}

export function ensureSiteWorkDirs() {
  for (const dir of [siteWorkDataDir(), siteWorkProjectsDir(), siteWorkSourceDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function projectExcelAbsolutePath(filename: string): string {
  return path.join(siteWorkProjectsDir(), filename);
}

export function safeExcelFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `عمال مشروع ${cleaned || "جديد"}.xlsx`;
}
