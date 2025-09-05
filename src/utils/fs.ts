import fs from 'fs-extra';
import { RepoSpec } from '../types.js';

export async function ensureDir(path: string): Promise<void> {
  await fs.ensureDir(path);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await fs.writeJson(path, data, { spaces: 2 });
}

export function readRepoFile(path: string): RepoSpec[] {
  const content = fs.readFileSync(path, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(slug => ({ slug }));
}
