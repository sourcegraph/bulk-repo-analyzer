#!/usr/bin/env node

// Commit search built from structured parameters -> query string
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-commit-search',
    'description: Search commits by message, author, content, files, repos, and date range.',
    'messageTerms: string Optional commit message terms (OR combined)',
    'authors: string Optional author names/emails (OR combined)',
    'contentTerms: string Optional changed code terms (OR combined)',
    'files: string Optional file path patterns',
    'repos: string REQUIRED repositories to search (OR combined)',
    'after: string Optional date (e.g., 2025-05-01 or 1 month ago)',
    'before: string Optional date',
    'count: number Optional result limit (default 50, max 100)',
    'useRegex: boolean Optional use regexp pattern type'
  ].join('\n'))
  process.exit(0)
} else if (action === 'execute') {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => input += c)
  process.stdin.on('end', async () => {
    try {
      const p = parseKeyValues(input)
      const repos = parseArray(p['repos[]'] || p['repos'])
      if (!repos || repos.length === 0) throw new Error('Missing parameter: repos')
      const messageTerms = parseArray(p['messageTerms[]'] || p['messageTerms'])
      const authors = parseArray(p['authors[]'] || p['authors'])
      const contentTerms = parseArray(p['contentTerms[]'] || p['contentTerms'])
      const files = parseArray(p['files[]'] || p['files'])
      const after = p['after'] || undefined
      const before = p['before'] || undefined
      const count = toInt(p['count'])
      const useRegex = parseBool(p['useRegex'])

      const query = buildQuery({ messageTerms, authors, contentTerms, files, repos, after, before, count, useRegex })
      const patternType = resolvePatternType(query, useRegex)

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`
      const gql = `
        query CommitSearch($query: String!, $patternType: SearchPatternType!) {
          search(query: $query, patternType: $patternType, version: V3) {
            results {
              limitHit
              results { __typename ... on CommitSearchResult { commit { oid abbreviatedOID author { person { name email } date } repository { id name } message subject } messagePreview { value } diffPreview { value } } }
            }
          }
        }
      `
      const body = JSON.stringify({ query: gql, variables: { query, patternType } })
      const res = await fetch(url, { method: 'POST', headers: headers(token), body })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '))

      const results = json?.data?.search?.results
      const commits = (results?.results || [])
        .filter(r => r.__typename === 'CommitSearchResult')
        .map(r => r.commit)
        .filter(Boolean)
        .map(c => ({
          repository: c.repository?.name,
          commit: c.abbreviatedOID,
          author: [c.author?.person?.name, c.author?.person?.email && `<${c.author.person.email}>`].filter(Boolean).join(' '),
          date: c.author?.date,
          title: (c.message||'').split('\n')[0],
          message: c.message
        }))

      process.stdout.write(JSON.stringify({ query, totalCount: commits.length, commits, limitHit: !!results?.limitHit }, null, 2) + '\n')
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
  })
  process.stdin.resume()
} else { failAction() }

function buildQuery(p){
  const parts=['type:commit']
  const or=' OR '
  if (p.messageTerms?.length){ parts.push(p.messageTerms.length===1? `message:${q(p.messageTerms[0])}` : `message:(${p.messageTerms.map(q).join(or)})`) }
  if (p.authors?.length){ parts.push(p.authors.length===1? `author:${q(p.authors[0])}` : `author:(${p.authors.map(q).join(or)})`) }
  if (p.contentTerms?.length){ parts.push(p.contentTerms.length===1? `content:${q(p.contentTerms[0])}` : `content:(${p.contentTerms.map(q).join(or)})`) }
  if (p.files?.length){ parts.push(p.files.length===1? `file:${p.files[0]}` : `file:(${p.files.join(or)})`) }
  if (p.repos.length===1){ parts.push(`repo:${p.repos[0]}`)} else { parts.push(`(${p.repos.map(r=>`repo:${r}`).join(or)})`) }
  if (p.after) parts.push(`after:${q(p.after)}`)
  if (p.before) parts.push(`before:${q(p.before)}`)
  const effective = p.count || (p.after||p.before ? 100 : 50)
  parts.push(`count:${Math.min(effective,100)}`)
  if (p.useRegex) parts.push('patternType:regexp')
  return parts.join(' ')
}
function resolvePatternType(query, useRegex){ if (useRegex) return 'regexp'; if (/patternType:regexp/.test(query)) return 'regexp'; if (/patternType:literal/.test(query)) return 'literal'; return 'standard' }
function q(s){ return /[\s:()"]/.test(s) && !(s.startsWith('"')&&s.endsWith('"')) ? `"${s}"` : s }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+)(\[\])?:\s*(.*)$/);if(m)o[m[1]+(m[2]||'')]=m[3]}return o}
function parseArray(v){ if(!v) return []; try { return JSON.parse(v) } catch {} return v.split(',').map(s=>s.trim()).filter(Boolean) }
function parseBool(v){ if(v==null) return false; return String(v).toLowerCase()==='true' }
function toInt(v){ if(v==null||v==='') return undefined; const n=parseInt(v,10); return Number.isNaN(n)?undefined:n }
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
