#!/usr/bin/env node

// Get repositories where a contributor has commits
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-get-contributor-repos',
    'description: Finds repositories where a specific author has commits, with counts and recent activity.',
    'author: string Author name or email (partial allowed)',
    'limit: number Optional max repositories (default 20)',
    'minCommits: number Optional minimum commits per repo (default 1)'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => input += c)
  process.stdin.on('end', async () => {
    try {
      const p = parseKeyValues(input)
      const author = requireParam(p,'author')
      const limit = toInt(p['limit']) || 20
      const minCommits = toInt(p['minCommits']) || 1

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`
      const query = `
        query GetContributorRepos($author: String!, $first: Int, $minCommits: Int) {
          contributorRepositories(author: $author, first: $first, minCommits: $minCommits) {
            nodes { repository { id name } authorName authorEmail commitCount mostRecentCommitDate }
            totalCount pageInfo { hasNextPage endCursor }
          }
        }
      `
      const body = JSON.stringify({ query, variables: { author, first: limit, minCommits } })
      const res = await fetch(url, { method:'POST', headers: headers(token), body })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e=>e.message).join('; '))
      process.stdout.write(JSON.stringify(json?.data?.contributorRepositories || {}, null, 2) + '\n')
    } catch (err) { console.error(`Error: ${err.message}`); process.exit(1) }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function toInt(v){ if(v==null||v==='') return undefined; const n=parseInt(v,10); return Number.isNaN(n)?undefined:n }
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
