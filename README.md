# Amp Bulk Executor

Run an [Amp](https://ampcode.com) thread across many repositories in parallel and save structured results to JSONL.

## Prerequisites

- Node.js ≥ 18
- Amp CLI installed (global or local)
  - Global: `npm i -g @sourcegraph/amp && amp --version`
  - Local: `npm i -D @sourcegraph/amp && npx amp --version`
- `.env` with your keys (see [.env.example](./.env.example))
  - AMP_API_KEY — Amp API key
  - SOURCEGRAPH_API_URL — your Sourcegraph code search URL
  - SOURCEGRAPH_API_TOKEN — Sourcegraph access token
- Optional: set `AMP_BIN` if `amp` is not on PATH

### Where to get tokens
- Amp API key: sign in at https://ampcode.com/settings and create/locate your API key, then export it as `AMP_API_KEY`.
- Sourcegraph URL and token:
  - Enterprise/self-hosted: your URL is your instance base; create a token at `https://{yourinstance}.com/users/{yourusername}/settings/tokens` (replace host/username).
  - Trying OSS code: use the public code search at https://sourcegraph.com/search and point `SOURCEGRAPH_API_URL=https://sourcegraph.com` (create a personal access token in your Sourcegraph user settings).

## Try the demo (best starting point)

- Quick demo (5 repos):

```bash
npm run demo
```

- Full demo (45 repos listed in [input/repos.txt](./input/repos.txt)):

```bash
npm run demo:full
```

- Results are written to a new file under `runs/` named `run_<timestamp>.jsonl`.
- The CLI prints the path at the end as: `Output file: runs/run_<timestamp>.jsonl`. 

## Customize and run yourself

1) Install dependencies

```bash
npm install
```

2) Add repositories to `input/repos.txt`

- Use simple slugs like `owner/name` (e.g., `vercel/next.js`). The agent can resolve the full repo.

3) (Optional) Edit the prompt

- The default prompt lives at `prompts/authentication_analysis.md`.
- Edit this file to change the analysis and output schema, or pass a different prompt file with `-p`.

4) Run

```bash
npm start
# or with options
npm start -- -i input/repos.txt -c 10 -p prompts/authentication_analysis.md -o runs
```

Results
- Each run streams results to `runs/run_<timestamp>.jsonl` (one JSON per line).
- The CLI prints the exact output path at the end (look for `Output file: ...`).

## How it works (at a glance)

- For each repo slug, the app invokes the Amp CLI with your prompt.
- The prompt uses a toolbox backed by your Sourcegraph code search instance to find and read code across the repository.
- Results stream to JSONL as each repo finishes.

## CLI Options

- `-i, --input`        Path to file with repo slugs (default: `input/repos.txt`)
- `-c, --concurrency`  Number of concurrent sessions (default: `10`)
- `-p, --prompt`       Path to prompt file (default: `prompts/authentication_analysis.md`)
- `-o, --output-dir`   Output directory (default: `runs`)
- `--amp-logs`         Write per-repo Amp debug logs (advanced)

## Output

- Results stream to `runs/run_<timestamp>.jsonl`, one JSON object per line with:
  - `slug`, `timestamp`, `status`
  - `data` (depends on your prompt)
  - optional `thread_url`

Tip: Visit the `thread_url` to see the full Amp thread history for each result, including the agent's actions, the context it considered, and the tools it used. This is helpful when troubleshooting results and iterating on your prompt.

Example line:

```json
{"slug":"vercel/next.js","timestamp":"2025-09-05T21:18:13.292Z","status":"SUCCESS","data":{"repo_name":"github.com/vercel/next.js","commit_hash":"de5a1b2","auth_type":"no_auth","reasons":"…","evidence_samples":["…"]},"thread_url":"https://ampcode.com/threads/T-011f58fe-f5c5-4a7a-8416-1f7849656c43"}
```

## Security

This tool invokes Amp with `-x --dangerously-allow-all`. Only run prompts you trust and never commit secrets. Keep your `.env` out of version control.

<details>
<summary>Advanced: Logging & Failure</summary>

- Logging
  - `--amp-logs` writes a debug log per repo under `runs/` (capped for safety).
  - When not set, a temporary debug log is used only to capture the Amp thread URL.
- Failures (simplified)
  - If the agent outputs `FAIL: ...`, the run is recorded as `status: "ERROR"`.
  - Each repo can retry up to 3 times; persistent failures end as `ERROR`.
  - Each repo run times out after ~5 minutes.

</details>

## Development

```bash
npm run build  # Compile TypeScript to dist/
npm run demo   # Build and run with default input
# or run directly via ts-node
ts-node --esm src/index.ts
```
