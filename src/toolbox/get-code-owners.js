#!/usr/bin/env node

// Get code owners and blame contributors for a file
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-get-code-owners',
    'description: Identifies code owners and recent contributors for a given file.',
    'repo: string Repository name',
    'filePath: string File path in repository',
    'revision: string Optional revision (default HEAD)'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => input += c)
  process.stdin.on('end', async () => {
    try {
      const p = parseKeyValues(input)
      const repoName = requireParam(p,'repo')
      const filePath = requireParam(p,'filePath')
      const revision = p['revision'] || 'HEAD'

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`
      const query = `
        query GetCodeOwners($repoName: String!, $revision: String!, $filePath: String!) {
          repository(name: $repoName) {
            id
            commit(rev: $revision) { file(path: $filePath) {
              __typename
              ... on GitBlob {
                ownership(reasons: [CODEOWNERS_FILE_ENTRY, ASSIGNED_OWNER, RECENT_CONTRIBUTOR_OWNERSHIP_SIGNAL]) {
                  totalCount totalOwners nodes {
                    owner { __typename ... on Person { name displayName email avatarURL } ... on Team { name displayName avatarURL } }
                    reasons { __typename ... on CodeownersFileEntry { title description ruleLineMatch } ... on RecentContributorOwnershipSignal { title description } ... on AssignedOwner { title description isDirectMatch } }
                  }
                }
                blame(startLine: 1, endLine: 50) { author { date person { name email } } rev }
              }
            } }
          }
        }
      `
      const body = JSON.stringify({ query, variables: { repoName, revision, filePath } })
      const res = await fetch(url, { method:'POST', headers: headers(token), body })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e=>e.message).join('; '))
      process.stdout.write(JSON.stringify(json?.data?.repository?.commit?.file, null, 2)+"\n")
    } catch (err) { console.error(`Error: ${err.message}`); process.exit(1) }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
