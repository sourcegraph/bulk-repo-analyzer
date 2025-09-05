# AGENTS.md

## Environment Variables
Required environment variables in `.env` file:
- **AMP_API_KEY**: Your Amp API key for authentication
- **SOURCEGRAPH_API_URL**: Sourcegraph instance URL (e.g., https://sourcegraph.com)
- **SOURCEGRAPH_API_TOKEN**: Your Sourcegraph API access token

## Commands
- **Build**: `npm run build` (compiles TypeScript to dist/)
- **Start**: `npm start` (runs ts-node directly) or `npm run demo` (builds then runs)
- **Dev**: `ts-node --esm src/index.ts` for direct execution
- No test framework configured - tests would need to be added manually

## Architecture
- **Main entry**: `src/index.ts` - CLI parsing and orchestration
- **Core components**: 
  - `AmpExecutor` - executes `amp -x` commands with prompts
  - `RepoProcessor` - processes individual repositories
  - `Pool` - manages concurrency for parallel execution
- **Utils**: `fs.ts` (file operations), `path.ts` (path utilities)
- **I/O**: Reads repo slugs from `input/repos.txt`, outputs to `runs/` directory

## Code Style
- TypeScript with strict mode, ES2021 target, NodeNext modules
- ES modules (.js imports in .ts files), file extensions required
- Interface-driven design with explicit typing in `types.ts`
- Async/await for all async operations
- Error handling with try/catch and process.exit(1) for failures
- Console logging with emoji prefixes for user feedback
- Private class fields with constructor injection pattern
- Functional utilities over classes where appropriate
