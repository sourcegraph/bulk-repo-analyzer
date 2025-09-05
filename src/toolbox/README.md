# Toolbox

Sourcegraph toolbox for Amp integration. Self-contained Node.js executables that provide code search and repository analysis capabilities.

## Tools

- `commit-search.js` - Search commits by message, author, content, files, repos, and date range
- `diff-search.js` - Compare changes between revisions and return file diffs with hunks  
- `find-references.js` - Find references to a symbol in a repository file
- `get-code-owners.js` - Identify code owners and recent contributors for files
- `get-contributor-repos.js` - Find repositories where a contributor has commits
- `go-to-definition.js` - Find the definition of a symbol
- `keyword-search.js` - Keyword-based code search
- `list-files.js` - List files and directories in a repository path
- `list-repos.js` - List repositories matching a search query
- `nls-search.js` - Natural language code search
- `read-file.js` - Read file contents from a repository

## Integration

Set `AMP_TOOLBOX` environment variable to this directory path. Amp will automatically discover and register these tools with the `tb__` prefix.

For detailed usage and examples, see the [Amp Toolboxes documentation](https://ampcode.com/manual#toolboxes).
