import { RepoSpec, RepoResult } from '../types.js';
import { AmpExecutor } from '../exec/AmpExecutor.js';

const MAX_AMP_RETRIES = 3;

export class RepoProcessor {
  constructor(
    private spec: RepoSpec,
    private ampExecutor: AmpExecutor
  ) {}

  async process(): Promise<RepoResult> {
    const timestamp = new Date().toISOString();
    let lastErr: unknown;

    for (let attempt = 1; attempt <= MAX_AMP_RETRIES; attempt++) {
      try {
        const outcome = await this.ampExecutor.run(this.spec.slug);
        return {
          slug: this.spec.slug,
          timestamp,
          status: 'SUCCESS',
          data: outcome.data,
          thread_url: outcome.threadUrl,
          attempts: attempt,
        };
      } catch (error) {
        lastErr = error;
        if (attempt < MAX_AMP_RETRIES) {
          console.warn(
            `⚠️  ${this.spec.slug} attempt ${attempt}/${MAX_AMP_RETRIES} failed – retrying immediately`
          );
        }
      }
    }

    return {
      slug: this.spec.slug,
      timestamp,
      status: 'ERROR',
      error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      attempts: MAX_AMP_RETRIES,
    };
  }
}
