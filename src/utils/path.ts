import path from 'path';

export function buildRunFilePath(outputDir: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return path.join(outputDir, `run_${timestamp}.json`);
}

export function buildRunFilePathJsonl(outputDir: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return path.join(outputDir, `run_${timestamp}.jsonl`);
}


export function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '_');
}
