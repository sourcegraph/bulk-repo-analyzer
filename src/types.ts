export interface RepoSpec {
  slug: string;
}

export type AuthType = 'modern_auth' | 'legacy_auth' | 'no_auth' | 'mixed' | 'uncertain';

export interface AuthAnalysisResult {
  repo_name: string;
  commit_hash: string;
  auth_type: AuthType;
  reasons: string;
  evidence_samples: string[];
}

export interface AmpRunOutcome {
  data: AuthAnalysisResult;
  threadUrl?: string;
}

export interface RepoResult {
  slug: string;
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  data?: AuthAnalysisResult;
  // Optional Amp thread info for auditing/debugging
  thread_url?: string;
  error?: string;
  // Number of attempts taken (1 if no retry, up to MAX_AMP_RETRIES)
  attempts?: number;
}

export interface PoolOptions {
  concurrency: number;
}

export interface Config {
  inputPath: string;
  concurrency: number;
  promptPath: string;
  outputDir: string;
  ampLogs: boolean; // enable per-repo amp logs (default: false)
}
