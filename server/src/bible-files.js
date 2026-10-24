import fs from 'node:fs';
import path from 'node:path';

// Данные на постоянном томе переживают сборки из GitHub без личных текстов.
export function resolveBibleFile(filename, persistentRoot, bundledRoot) {
  const persistentFile = path.join(persistentRoot, filename);
  return fs.existsSync(persistentFile) ? persistentFile : path.join(bundledRoot, filename);
}
