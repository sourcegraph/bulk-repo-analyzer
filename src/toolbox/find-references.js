#!/usr/bin/env node

// Find references to a symbol by locating it in the file then calling usagesForSymbol
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-find-references',
    'description: Finds references to a provided symbol in a repository file and returns contextual snippets.',
    'repo: string Repository name',
    'path: string File path containing the symbol reference',
    'symbol: string Symbol name to find references for'
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
      const path = requireParam(p,'path')
      const symbol = requireParam(p,'symbol')

      const token = requireEnv('SOURCEGRAPH_API_TOKEN')
      const baseUrl = requireEnv('SOURCEGRAPH_API_URL')
      const url = `${baseUrl}/.api/graphql`

      // helper to read a file window
      async function readFileWindow(start, end){
        const query = `
          query ReadFile($repoName: String!, $revision: String!, $filePath: String!, $startLine: Int, $endLine: Int) {
            repository(name: $repoName) { commit(rev: "HEAD") { file(path: $filePath) { ... on GitBlob { content(startLine:$startLine, endLine:$endLine) } } } }
          }
        `
        const body = JSON.stringify({ query, variables: { repoName: repo, filePath: path, startLine: start, endLine: end } })
        const res = await fetch(url, { method:'POST', headers: headers(token), body })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        const json = await res.json(); if (json.errors) throw new Error(json.errors.map(e=>e.message).join('; '))
        return json?.data?.repository?.commit?.file?.content || ''
      }

      // find approximate symbol location by scanning chunks
      const CHUNK = 500
      let startLine = 1
      let found = null
      while(true){
        const endLine = startLine + CHUNK - 1
        const content = await readFileWindow(startLine, endLine)
        if (!content || content.trim()==='') break
        const idx = content.indexOf(symbol)
        if (idx !== -1){
          // get line and character
          const lines = content.split('\n')
          let acc = 0
          for (let i=0;i<lines.length;i++){
            const pos = lines[i].indexOf(symbol)
            if (pos !== -1){ found = { line: (startLine + i) - 1, character: pos }; break }
            acc += lines[i].length+1
          }
          break
        }
        startLine += CHUNK
      }
      if (!found) throw new Error(`Symbol '${symbol}' not found in the file.`)

      // query usages
      const usagesQuery = `
        query Usages($repo: String!, $path: String!, $startLine: Int!, $startCharacter: Int!, $endLine: Int!, $endCharacter: Int!) {
          usagesForSymbol(range: { repository:$repo, path:$path, start:{line:$startLine, character:$startCharacter}, end:{line:$endLine, character:$endCharacter} }) {
            nodes {
              provenance
              usageKind
              symbol { name }
              usageRange { repository repositoryID path revision range { start { line character } end { line character } } }
              surroundingContent
            }
          }
        }
      `
      const body = JSON.stringify({ query: usagesQuery, variables: { repo, path, startLine: found.line, startCharacter: found.character, endLine: found.line, endCharacter: found.character + symbol.length } })
      const usagesRes = await fetch(url, { method:'POST', headers: headers(token), body })
      if (!usagesRes.ok) throw new Error(`HTTP ${usagesRes.status}: ${usagesRes.statusText}`)
      const usagesJson = await usagesRes.json(); if (usagesJson.errors) throw new Error(usagesJson.errors.map(e=>e.message).join('; '))
      const nodes = usagesJson?.data?.usagesForSymbol?.nodes || []
      const refs = nodes.filter(n => n.usageKind === 'REFERENCE')
      if (refs.length===0){ process.stdout.write(JSON.stringify({ message:`No references found for '${symbol}'.` }, null, 2)+"\n"); return }

      // group by file and fetch small windows for context
      const byFile = new Map()
      for (const r of refs){
        const key = `${r.usageRange.repository}/${r.usageRange.path}`
        if (!byFile.has(key)) byFile.set(key, [])
        byFile.get(key).push(r)
      }
      const result = []
      for (const [key, arr] of byFile){
        arr.sort((a,b)=>a.usageRange.range.start.line - b.usageRange.range.start.line)
        const repoName = arr[0].usageRange.repository
        const filePath = arr[0].usageRange.path
        for (const r of arr){
          const line = r.usageRange.range.start.line
          const winStart = Math.max(1, line - 3)
          const winEnd = line + 3
          const snippet = await readFileWindow(winStart+1, winEnd+1)
          const numbered = String(snippet||'').split('\n').map((ln,i)=>`${winStart + i + 1}: ${ln}`).join('\n')
          result.push({ repo: repoName, file: filePath, line, context: numbered })
        }
      }
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } catch (err) { console.error(`Error: ${err.message}`); process.exit(1) }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
