import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The authoring guide (docs/authoring-guide.md), from the source tree or the built one. */
export function guidePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    path.join(here, '..', '..', 'docs', 'authoring-guide.md'),
    path.join(here, '..', 'docs', 'authoring-guide.md'),
  ])
    if (existsSync(candidate)) return candidate;
  throw new Error('authoring-guide.md not found');
}

/** One `## ` section of the guide, its heading included: the guide stays the one copy. */
export async function guideSection(title: string): Promise<string> {
  const guide = await readFile(guidePath(), 'utf8');
  const start = guide.indexOf(`\n## ${title}\n`);
  if (start < 0) throw new Error(`no section '${title}' in the authoring guide`);
  const end = guide.indexOf('\n## ', start + 1);
  return guide.slice(start + 1, end < 0 ? undefined : end).trim() + '\n';
}
