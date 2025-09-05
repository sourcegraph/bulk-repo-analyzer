import { join } from 'path';
import { sanitizeSlug } from '../utils/path.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AmpArgsOptions {
  settingsPathAbs: string;
  runsDir: string;
  repoSlug: string;
  enableLogs: boolean;
  logLevel?: LogLevel;
}

export function buildAmpArgs(opts: AmpArgsOptions): { args: string[]; logFile?: string } {
  const baseArgs = [
    '-x',
    '--dangerously-allow-all',
    '--settings-file', opts.settingsPathAbs,
  ];

  if (!opts.enableLogs) {
    return { args: baseArgs };
  }

  const level: LogLevel = opts.logLevel ?? 'debug';
  const logFile = join(opts.runsDir, `amp-${sanitizeSlug(opts.repoSlug)}.log`);

  return {
    args: [
      ...baseArgs,
      '--log-level', level,
      '--log-file', logFile,
    ],
    logFile,
  };
}
