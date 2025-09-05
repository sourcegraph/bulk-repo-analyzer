import { execa } from 'execa';
import fs from 'fs-extra';
import { join } from 'path';
import { AmpRunOutcome, AuthAnalysisResult } from '../types.js';
import { buildAmpArgs } from './AmpArgs.js';
import { resolveAmpBin } from './resolveAmp.js';
import { sanitizeSlug } from '../utils/path.js';

async function parseThreadIdFromLog(logPath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const key = typeof obj?.key === 'string' ? obj.key : undefined;
        const thread = typeof obj?.threadID === 'string' ? obj.threadID : undefined;
        const candidate = key ?? thread;
        if (candidate && /^T-[a-f0-9-]+$/i.test(candidate)) {
          return candidate;
        }
      } catch {
        // ignore parse errors for non-JSON lines
      }
    }
  } catch {
    // ignore if log can't be read
  }
  return undefined;
}

export class AmpExecutor {
  constructor(private promptPath: string, private enableLogs: boolean = false) {}

  async run(repoSlug: string): Promise<AmpRunOutcome> {
    const command = await resolveAmpBin();
    const cwd = process.cwd();

    const settingsPath = join(cwd, 'amp-settings.json');
    const toolboxRawPath = join(cwd, 'src/toolbox');
    const runsDir = join(cwd, 'runs');
    await fs.ensureDir(runsDir);

    const settingsPathAbs = (await fs.pathExists(settingsPath)) ? await fs.realpath(settingsPath) : settingsPath;
    const toolboxPathAbs = (await fs.pathExists(toolboxRawPath)) ? await fs.realpath(toolboxRawPath) : toolboxRawPath;
    const promptPathAbs = (await fs.pathExists(this.promptPath)) ? await fs.realpath(this.promptPath) : this.promptPath;

    const env = {
      ...process.env,
      AMP_TOOLBOX: toolboxPathAbs
    };

    const built = buildAmpArgs({
      settingsPathAbs,
      runsDir,
      repoSlug,
      enableLogs: this.enableLogs,
    });
    const args = [...built.args];

    // If logs are not enabled, attach a temporary log to capture the thread id
    let captureLogPath: string | undefined;
    if (!this.enableLogs) {
      captureLogPath = join(runsDir, `amp-capture-${sanitizeSlug(repoSlug)}-${Date.now()}.log`);
      args.push('--log-level', 'debug', '--log-file', captureLogPath);
    }

    const promptContent = await fs.readFile(promptPathAbs, 'utf8');
    const promptWithRepo = `${promptContent}\n\nAnalyze repository: ${repoSlug}`;

    const { stdout, stderr, exitCode } = await execa(command, args, {
      input: promptWithRepo,
      reject: false,
      timeout: 300000,
      encoding: 'utf8',
      env
    });

    if (exitCode !== 0) {
      throw new Error(`amp command failed (exit code ${exitCode}): ${stderr}`);
    }
    
    // Try to parse thread ID from log file(s)
    let threadId: string | undefined;
    const logCandidates = [built.logFile, captureLogPath].filter(Boolean) as string[];
    for (const p of logCandidates) {
      const id = await parseThreadIdFromLog(p);
      if (id) { threadId = id; break; }
    }

    // Clean up temporary capture log unless user explicitly wanted logs
    if (captureLogPath && !this.enableLogs) {
      try { await fs.remove(captureLogPath); } catch { /* ignore */ }
    }

    const trimmed = stdout.trim();
    // Handle explicit FAIL path from prompt failure_policy
    if (/^FAIL:/i.test(trimmed)) {
      const reason = trimmed.replace(/^FAIL:\s*/i, '').trim();
      throw new Error(`Agent FAIL: ${reason}`);
    }
    
    try {
      let jsonText = trimmed;
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?(.*?)\n?```/s);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        }
      }
 
      const data = JSON.parse(jsonText) as AuthAnalysisResult;
      const threadUrl = threadId ? `https://ampcode.com/threads/${threadId}` : undefined;
      return { data, threadUrl };
    } catch (parseError) {
      throw new Error(`Failed to parse JSON output: ${parseError}. Raw output: ${stdout}`);
    }
  }
}
