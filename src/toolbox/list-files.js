#!/usr/bin/env node

// Self-contained toolbox tool: list-files
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-list-files',
    'description: List files and directories in a repository path (adds trailing / for directories).',
    'repo: string The repository name (e.g., github.com/sourcegraph/sourcegraph)',
    'path: string Optional directory path (default ".")',
    'revision: string Optional git revision (default HEAD)',
    'first: number Optional max entries to return (default 1000)'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => (input += chunk))
  process.stdin.on('end', async () => {
    try {
      const params = parseKeyValues(input)
      const repo = requireParam(params, 'repo')
      const dirPath = params['path'] || '.'
      const revision = params['revision'] || 'HEAD'
      const first = toInt(params['first']) || 1000

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`

      const query = `
        query ListFiles($repoName: String!, $revision: String!, $filePath: String!) {
          repository(name: $repoName) {
            id
            commit(rev: $revision) {
              tree(path: $filePath) {
                entries { path isDirectory }
              }
            }
          }
        }
      `

      const body = JSON.stringify({ query, variables: { repoName: repo, revision, filePath: dirPath } })

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${token}`,
          'User-Agent': 'Amp-Toolbox-Node/1.0'
        },
        body
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '))

      const entries = json?.data?.repository?.commit?.tree?.entries || []
      for (const e of entries) {
        const p = e.isDirectory ? `${e.path}/` : e.path
        process.stdout.write(p + '\n')
      }
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
  })
  process.stdin.resume()
} else {
  console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'")
  process.exit(1)
}

function parseKeyValues(text) {
  const obj = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) obj[m[1]] = m[2]
  }
  return obj
}

function requireParam(obj, key) {
  const v = obj[key]
  if (!v) throw new Error(`Missing parameter: ${key}`)
  return v
}

function toInt(v) {
if (v == null || v === '') return undefined
const n = Number.parseInt(v, 10)
if (Number.isNaN(n)) return undefined
return n
}

function requireEnv(key) {
  const v = process.env[key]
  if (!v || v.includes('[REDACTED')) throw new Error(`Missing env: ${key}`)
  return v
}


