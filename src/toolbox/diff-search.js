#!/usr/bin/env node

// Diff search between two revisions for a repo
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-diff-search',
    'description: Compare changes between two revisions and return file diffs with hunks.',
    'repo: string Repository name (e.g., github.com/org/repo)',
    'base: string Base revision (older)',
    'head: string Head revision (newer)',
    'first: number Optional max number of file diffs (default 50)',
    'after: string Optional pagination cursor'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => input += c)
  process.stdin.on('end', async () => {
    try {
      const p = parseKeyValues(input)
      const repo = requireParam(p,'repo')
      const base = requireParam(p,'base')
      const head = requireParam(p,'head')
      const first = toInt(p['first']) || 50
      const after = p['after'] || null

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`
      const query = `
        query DiffSearch($repo: String!, $base: String!, $head: String!, $first: Int!, $after: String) {
          repository(name: $repo) {
            id
            comparison(base: $base, head: $head) {
              fileDiffs(first: $first, after: $after) {
                nodes {
                  oldPath
                  newPath
                  mostRelevantFile { path url }
                  hunks {
                    oldRange { startLine lines }
                    newRange { startLine lines }
                    section
                    body
                  }
                  stat { added deleted }
                }
                pageInfo { endCursor hasNextPage }
              }
            }
          }
        }
      `
      const body = JSON.stringify({ query, variables: { repo, base, head, first, after } })
      const res = await fetch(url, { method:'POST', headers: headers(token), body })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e=>e.message).join('; '))
      process.stdout.write(JSON.stringify(json?.data?.repository?.comparison?.fileDiffs || {}, null, 2) + '\n')
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function toInt(v){ if(v==null||v==='') return undefined; const n=parseInt(v,10); return Number.isNaN(n)?undefined:n }
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
