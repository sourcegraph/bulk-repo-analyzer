#!/usr/bin/env node

// Natural-language style search using Sourcegraph search V3 (patternType standard)
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-nls-search',
    'description: Natural language code search (broader matching, project-wide).',
    'query: string The search query (semantically phrased).'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => input += c)
  process.stdin.on('end', async () => {
    try {
      const params = parseKeyValues(input)
      const queryStr = requireParam(params, 'query')

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`

      const query = `
        query CodeSearch($query: String!, $patternType: SearchPatternType!) {
          search(query: $query, patternType: $patternType, version: V3) {
            results { results { __typename ... on FileMatch { file { path repository { id name } } chunkMatches { content contentStart { line } } } } }
          }
        }
      `

      const body = JSON.stringify({ query, variables: { query: queryStr, patternType: 'standard' } })
      const res = await fetch(url, { method: 'POST', headers: headers(token), body })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '))

      const results = json?.data?.search?.results?.results || []
      const fileMatches = results.filter(r => r.__typename === 'FileMatch')
      const MAX_FILES = 10
      const MAX_CHUNKS_PER_RESULT = 2
      const limited = fileMatches.slice(0, MAX_FILES).map(m => ({
        repo: m.file?.repository?.name,
        file: m.file?.path,
        chunks: (m.chunkMatches||[]).slice(0, MAX_CHUNKS_PER_RESULT).map(ch => {
          const start = ch.contentStart?.line || 1
          const content = String(ch.content||'').trim()
          const numbered = content.split('\n').map((ln,i)=>`${start+i}: ${ln}`).join('\n')
          return { startLine: start, endLine: start + content.split('\n').length - 1, content: numbered }
        })
      }))
      process.stdout.write(JSON.stringify(limited, null, 2) + '\n')
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
