import { resolveAmpBin } from '../exec/resolveAmp.js';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main() {
  const originalEnv = { ...process.env };
  let baselinePath: string | null = null;

  console.log('== resolveAmp smoke test ==');

  // 1) Baseline (PATH)
  try {
    const p = await resolveAmpBin();
    baselinePath = p;
    console.log('[1] baseline PATH resolution:', p);
    assert(typeof p === 'string' && p.length > 0, 'baseline: expected a non-empty path');
  } catch (e) {
    console.error('[1] baseline failed:', e);
    console.error('Install @sourcegraph/amp globally or locally, or set AMP_BIN.');
    process.exit(1);
  }

  // 2) Env override (valid)
  try {
    process.env.AMP_BIN = baselinePath!;
    const p = await resolveAmpBin();
    console.log('[2] env override (valid):', p);
    assert(p === baselinePath, 'env override valid: expected to return AMP_BIN path');
  } catch (e) {
    console.error('[2] env override (valid) failed:', e);
    process.exit(1);
  } finally {
    process.env.AMP_BIN = originalEnv.AMP_BIN; // restore
  }

  // 3) Env override (invalid) -> should fall back to PATH
  try {
    process.env.AMP_BIN = '/ definitely /not/ a/ path';
    const p = await resolveAmpBin();
    console.log('[3] env override (invalid) fell back to:', p);
    assert(p === baselinePath, 'env override invalid: expected to fall back to baseline PATH result');
  } catch (e) {
    console.error('[3] env override (invalid) failed:', e);
    process.exit(1);
  } finally {
    process.env.AMP_BIN = originalEnv.AMP_BIN; // restore
  }

  // 4) Missing amp -> should throw (simulate by empty PATH and clearing AMP_BIN)
  try {
    process.env.AMP_BIN = '';
    process.env.PATH = '';
    let threw = false;
    try {
      await resolveAmpBin();
    } catch {
      threw = true;
      console.log('[4] missing amp: correctly threw error');
    }
    assert(threw, 'missing amp: expected resolveAmpBin to throw');
  } catch (e) {
    console.error('[4] missing amp test failed:', e);
    process.exit(1);
  } finally {
    // restore env
    process.env.AMP_BIN = originalEnv.AMP_BIN;
    process.env.PATH = originalEnv.PATH;
  }

  console.log('All resolveAmp smoke tests passed.');
}

main().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
