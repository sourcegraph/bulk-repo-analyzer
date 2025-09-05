#!/usr/bin/env node

import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs-extra';
import { Config } from './types.js';
import { readRepoFile, ensureDir } from './utils/fs.js';
import { buildRunFilePathJsonl } from './utils/path.js';
import { AmpExecutor } from './exec/AmpExecutor.js';
import { RepoProcessor } from './processors/RepoProcessor.js';
import { runWithPoolEach } from './concurrency/Pool.js';

// Hard cap on per-repo debug logging to prevent accidental huge log volumes
export const MAX_DEBUG_LOG_REPOS = 10;

// Load environment variables from .env file
dotenv.config();

async function parseArgs(): Promise<Config> {
  const argv = await yargs(hideBin(process.argv))
    .option('input', {
      alias: 'i',
      type: 'string',
      default: 'input/repos.txt',
      describe: 'Path to input file containing repo slugs'
    })
    .option('concurrency', {
      alias: 'c',
      type: 'number',
      default: 10,
      describe: 'Number of concurrent amp sessions'
    })
    .option('prompt', {
      alias: 'p',
      type: 'string',
      default: 'prompts/authentication_analysis.md',
      describe: 'Path to authentication analysis prompt file'
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      default: 'runs',
      describe: 'Output directory for results'
    })
    .option('amp-logs', {
      type: 'boolean',
      default: false,
      describe: 'Enable per-repo amp log files (default: off)'
    })
    .help()
    .argv;

  return {
    inputPath: argv.input,
    concurrency: argv.concurrency,
    promptPath: argv.prompt,
    outputDir: argv['output-dir'],
    ampLogs: argv['amp-logs'] as boolean
  };
}

async function main(): Promise<void> {
  try {
    const config = await parseArgs();
    
    console.log('🚀 Starting repo authentication analysis...');
    console.log(`📁 Input: ${config.inputPath}`);
    console.log(`⚡ Concurrency: ${config.concurrency}`);
    console.log(`📝 Prompt: ${config.promptPath}`);
    console.log(`📤 Output: ${config.outputDir}`);
    console.log(`🪵 Per-repo logs: ${config.ampLogs ? 'enabled' : 'disabled'}`);
    
    // Read repo list
    const repos = readRepoFile(config.inputPath);
    console.log(`🔍 Found ${repos.length} repositories to analyze`);

    // Fail-fast guard: prevent accidental massive log generation
    if (config.ampLogs && repos.length > MAX_DEBUG_LOG_REPOS) {
      console.error(`🛑 Refusing to write per-repo debug logs for ${repos.length} repos (limit: ${MAX_DEBUG_LOG_REPOS}).`);
      console.error('   Re-run without --amp-logs, or edit MAX_DEBUG_LOG_REPOS in src/index.ts to change the limit.');
      process.exit(1);
    }
    
    // Ensure output directory exists
    await ensureDir(config.outputDir);

    // Prepare streaming output
    const outputPath = buildRunFilePathJsonl(config.outputDir);
    const stream = fs.createWriteStream(outputPath, { flags: 'a' });
    let successful = 0;
    let failed = 0;
    const failedRepos: { slug: string; error?: string }[] = [];
    
    // Create amp executor
    const ampExecutor = new AmpExecutor(config.promptPath, config.ampLogs);
    
    // Process repos with concurrency pool, streaming results per repo
    console.log(`⏳ Processing repositories...`);
    await runWithPoolEach(
      repos,
      async (repo) => {
        const processor = new RepoProcessor(repo, ampExecutor);
        return processor.process();
      },
      { concurrency: config.concurrency },
      async (result) => {
        stream.write(JSON.stringify(result) + '\n');
        if (result.status === 'SUCCESS') {
          successful++;
        } else {
          failed++;
          failedRepos.push({ slug: result.slug, error: result.error });
        }
      }
    );

    await new Promise<void>((resolve) => {
      stream.end(() => resolve());
    });
    
    // Print summary
    console.log(`✅ Analysis complete!`);
    console.log(`📊 Results: ${successful} successful, ${failed} failed`);
    console.log(`📄 Output file: ${outputPath}`);
    
    if (failed > 0) {
      console.log(`❌ Failed repositories:`);
      failedRepos.forEach(r => console.log(`   - ${r.slug}: ${r.error}`));
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(console.error);
