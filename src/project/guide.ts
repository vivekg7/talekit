import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The authoring guide (docs/authoring-guide.md): two folders up from src/project/ or
 * dist/project/ alike, and the npm package ships docs/ at its root the same way.
 */
export function guidePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, '..', '..', 'docs', 'authoring-guide.md');
  if (!existsSync(file)) throw new Error(`authoring-guide.md not found at ${file}`);
  return file;
}

/** One `## ` section of the guide, its heading included: the guide stays the one copy. */
export async function guideSection(title: string): Promise<string> {
  const guide = await readFile(guidePath(), 'utf8');
  const start = guide.indexOf(`\n## ${title}\n`);
  if (start < 0) throw new Error(`no section '${title}' in the authoring guide`);
  const end = guide.indexOf('\n## ', start + 1);
  return guide.slice(start + 1, end < 0 ? undefined : end).trim() + '\n';
}
