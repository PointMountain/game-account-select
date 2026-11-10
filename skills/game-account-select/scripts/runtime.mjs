import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isEntrypoint(url) {
  try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(url)); }
  catch { return false; }
}
