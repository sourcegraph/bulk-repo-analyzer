#!/usr/bin/env node

// Self-contained toolbox tool: read-file
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-read-file',
    'description: Read file contents from a Sourcegraph repository (line-numbered).',
    'repo: string The repository name (e.g., github.com/sourcegraph/sourcegraph)',
    'path: string File path within the repository',
    'startLine: number Optional 1-based start line',
    'endLine: number Optional 1-based end line',
    'revision: string Optional git revision (default HEAD)'
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
      const filePath = requireParam(params, 'path')
      const startLine = toInt(params['startLine'])
      const endLine = toInt(params['endLine'])
      const revision = params['revision'] || 'HEAD'

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`

      const query = `
        query ReadFile($repoName: String!, $revision: String!, $filePath: String!) {
          repository(name: $repoName) {
            id
            commit(rev: $revision) {
              file(path: $filePath) { content }
            }
          }
        }
      `

      const body = JSON.stringify({ query, variables: { repoName: repo, revision, filePath } })

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

      const content = json?.data?.repository?.commit?.file?.content
      if (!content) throw new Error('File not found or empty')

      const start = startLine ?? 1
      const lines = content.split('\n')
        .slice(startLine ? startLine - 1 : 0, endLine ? endLine : undefined)
        .map((line, idx) => `${(startLine ?? 1) + idx}: ${line}`)
        .join('\n')

      process.stdout.write(lines + '\n')
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


