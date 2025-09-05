import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';

const WIN = process.platform === 'win32';
const CANDIDATE_NAMES = WIN ? ['amp.cmd', 'amp.exe', 'amp.bat', 'amp'] : ['amp'];

async function existsFile(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

async function canExecute(cmd: string): Promise<boolean> {
  try {
    const { exitCode } = await execa(cmd, ['--version'], { reject: false, timeout: 3000 });
    return exitCode === 0;
  } catch {
    return false;
  }
}

export async function resolveAmpBin(): Promise<string> {
  // 1) Explicit override via env
  const envBin = process.env.AMP_BIN;
  if (envBin && await existsFile(envBin) && await canExecute(envBin)) {
    return envBin;
  }

  // 2) Local node_modules/.bin (project install)
  const localBinDir = path.join(process.cwd(), 'node_modules', '.bin');
  for (const name of CANDIDATE_NAMES) {
    const p = path.join(localBinDir, name);
    if (await existsFile(p) && await canExecute(p)) return p;
  }

  // 3) PATH lookup
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    for (const name of CANDIDATE_NAMES) {
      const p = path.join(dir, name);
      if (await existsFile(p) && await canExecute(p)) return p;
    }
  }

  throw new Error(
    'Amp CLI not found. Install @sourcegraph/amp (global or dev dependency), or set AMP_BIN to the executable path.\n' +
    'Install globally:  npm i -g @sourcegraph/amp\n' +
    'Install locally:   npm i -D @sourcegraph/amp\n' +
    'Then run:          npx amp --version or ensure amp is on PATH.'
  );
}
