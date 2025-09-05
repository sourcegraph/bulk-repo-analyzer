#!/usr/bin/env node

const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-list-repos',
    'description: Lists repositories that match a search query. Supports pagination via after/before cursors.',
    'queries: string An array of search terms to AND together (e.g., [django, rails])',
    'limit: number Optional max number of repositories (default 10)',
    'after: string Optional endCursor for next page',
    'before: string Optional startCursor for previous page'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => (input += chunk))
  process.stdin.on('end', async () => {
    try {
      const params = parseKeyValues(input)
      const queries = parseArray(params['queries']) || []
      const limit = toInt(params['limit']) || 10
      const after = params['after'] || null
      const before = params['before'] || null

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`

      const query = `
        query ListRepos($query: String, $first: Int, $after: String, $before: String) {
          repositories(query: $query, first: $first, after: $after, before: $before) {
            nodes { id name description stars isPrivate isArchived isFork }
            totalCount
            pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
          }
        }
      `

      const q = (queries || []).join(' ')
      const body = JSON.stringify({ query, variables: { query: q, first: limit, after, before } })

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `token ${token}`, 'User-Agent': 'Amp-Toolbox-Node/1.0' },
        body,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '))

      const data = json?.data?.repositories
      process.stdout.write(JSON.stringify(data ?? {}, null, 2) + '\n')
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
    const m = line.match(/^(\w+(\[\])?):\s*(.*)$/)
    if (m) obj[m[1]] = m[3]
  }
  return obj
}
function parseArray(v) {
  if (!v) return []
  // Expect JSON array or comma-separated
  try { return JSON.parse(v) } catch {}
  return v.split(',').map(s => s.trim()).filter(Boolean)
}
function toInt(v) { if (v == null || v === '') return undefined; const n = parseInt(v,10); return Number.isNaN(n)?undefined:n }
function requireEnv(k){ const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v }

