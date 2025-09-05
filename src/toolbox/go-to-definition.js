#!/usr/bin/env node

// Find definition of a symbol by locating it then querying usagesForSymbol and reading surrounding lines
const action = process.env.TOOLBOX_ACTION || ''

if (action === 'describe') {
  process.stdout.write([
    'name: sgcs-go-to-definition',
    'description: Finds the definition of a specified symbol and returns context around it.',
    'repo: string Repository name',
    'path: string File path containing a reference to the symbol',
    'symbol: string Symbol name to locate'
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

      async function readFileWindow(rp, fp, start, end){
        const query = `
          query ReadFile($repoName: String!, $revision: String!, $filePath: String!, $startLine: Int, $endLine: Int) {
            repository(name: $repoName) { commit(rev: "HEAD") { file(path: $filePath) { ... on GitBlob { content(startLine:$startLine, endLine:$endLine) } } } }
          }
        `
        const body = JSON.stringify({ query, variables: { repoName: rp, filePath: fp, startLine: start, endLine: end } })
        const res = await fetch(url, { method:'POST', headers: headers(token), body })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        const json = await res.json(); if (json.errors) throw new Error(json.errors.map(e=>e.message).join('; '))
        return json?.data?.repository?.commit?.file?.content || ''
      }

      // locate symbol
      const CHUNK=500; let startLine=1; let found=null
      while(true){
        const endLine = startLine + CHUNK - 1
        const content = await readFileWindow(repo, path, startLine, endLine)
        if (!content || content.trim()==='') break
        const idx = content.indexOf(symbol)
        if (idx !== -1){
          const lines = content.split('\n');
          for (let i=0;i<lines.length;i++){ const pos=lines[i].indexOf(symbol); if(pos!==-1){ found={ line:(startLine + i) - 1, character: pos }; break } }
          break
        }
        startLine += CHUNK
      }
      if (!found) throw new Error(`Symbol '${symbol}' not found in the file.`)

      // query usages
      const usagesQuery = `
        query Usages($repo: String!, $path: String!, $startLine: Int!, $startCharacter: Int!, $endLine: Int!, $endCharacter: Int!) {
          usagesForSymbol(range: { repository:$repo, path:$path, start:{line:$startLine, character:$startCharacter}, end:{line:$endLine, character:$endCharacter} }) {
            nodes { usageKind usageRange { repository path range { start { line } } } }
          }
        }
      `
      const uBody = JSON.stringify({ query: usagesQuery, variables: { repo, path, startLine: found.line, startCharacter: found.character, endLine: found.line, endCharacter: found.character + symbol.length } })
      const uRes = await fetch(url, { method:'POST', headers: headers(token), body: uBody })
      if (!uRes.ok) throw new Error(`HTTP ${uRes.status}: ${uRes.statusText}`)
      const uJson = await uRes.json(); if (uJson.errors) throw new Error(uJson.errors.map(e=>e.message).join('; '))
      const defs = (uJson?.data?.usagesForSymbol?.nodes || []).filter(n=>n.usageKind==='DEFINITION'||n.usageKind==='SUPER')
      if (defs.length===0){ process.stdout.write(JSON.stringify({ message:`No definition found for '${symbol}'.` }, null, 2)+"\n"); return }

      const out=[]
      for (const d of defs){
        const defRepo = d.usageRange.repository
        const defPath = d.usageRange.path
        const defLine = d.usageRange.range.start.line
        const winStart = Math.max(1, defLine)
        const winEnd = defLine + 50
        const snippet = await readFileWindow(defRepo, defPath, winStart, winEnd)
        const numbered = String(snippet||'').split('\n').map((ln,i)=>`${winStart + i}: ${ln}`).join('\n')
        out.push({ repo: defRepo, file: defPath, startLine: winStart, endLine: winEnd, content: numbered })
      }
      process.stdout.write(JSON.stringify(out, null, 2)+"\n")
    } catch (err) { console.error(`Error: ${err.message}`); process.exit(1) }
  })
  process.stdin.resume()
} else { failAction() }

function parseKeyValues(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^(\w+):\s*(.*)$/);if(m)o[m[1]]=m[2]}return o}
function headers(t){return { 'Content-Type':'application/json','Authorization':`token ${t}`,'User-Agent':'Amp-Toolbox-Node/1.0' }}
function requireParam(o,k){const v=o[k]; if(!v) throw new Error(`Missing parameter: ${k}`); return v}
function requireEnv(k){const v=process.env[k]; if(!v||v.includes('[REDACTED')) throw new Error(`Missing env: ${k}`); return v}

 function failAction(){console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'"); process.exit(1)}
