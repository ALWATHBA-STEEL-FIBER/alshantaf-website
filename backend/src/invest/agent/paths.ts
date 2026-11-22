import fs from "node:fs";
import path from "node:path";
import { siteWorkDataDir } from "../../lib/siteWorkPaths";

/** Private storage for assistant uploads and encrypted memory files (on the persistent data volume). */
export function investDocsDir() {
  const dir = process.env.INVEST_DOCS_DIR?.trim() || path.join(siteWorkDataDir(), "invest-docs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
